import { getLevel } from "../data/levels";
import { TREE, TREE_BY_ID, TREE_VERSION, nodeCost } from "../data/tree";
import { runCampaign, STANDARD_BUY_ORDER } from "./campaign";
import {
  applyRunResult,
  buyBlock,
  buyNode,
  computeModifiers,
  computeReward,
  descendants,
  isLevelUnlocked,
  markSeen,
  hasSeen,
  nodeLevel,
  syncTreeVersion,
  refundAll,
  refundNode,
  totalSpent,
} from "./progress";
import { createNewSave, type SaveData } from "./save";

const withCe = (ce: number): SaveData => {
  const s = createNewSave(new Date(0));
  return { ...s, meta: { ...s.meta, tokens: { ce } } };
};

describe("スキルツリーの購入 (SPEC-107)", () => {
  it("ルートは最初から買え、子は親を買うまでロック", () => {
    let s = withCe(1000);
    expect(buyBlock(s, "yabusame")).toBe("locked");
    expect(buyBlock(s, "root")).toBeNull();
    s = buyNode(s, "root");
    expect(nodeLevel(s, "root")).toBe(1);
    expect(s.meta.tokens.ce).toBe(1000 - nodeCost(TREE_BY_ID.get("root")!, 0));
    expect(buyBlock(s, "yabusame")).toBeNull();
  });

  it("トークン不足・最大レベル・未知の ID は買えない（状態は変わらない）", () => {
    let s = withCe(2);
    expect(buyBlock(s, "root")).toBe("tokens");
    expect(buyNode(s, "root")).toBe(s);
    s = withCe(10_000);
    const root = TREE_BY_ID.get("root")!;
    for (let i = 0; i < root.maxLevel; i++) s = buyNode(s, "root");
    expect(buyBlock(s, "root")).toBe("maxed");
    expect(buyBlock(s, "nope")).toBe("unknown");
  });
});

describe("無料返金 (SPEC-108)", () => {
  function bought(): SaveData {
    let s = withCe(10_000);
    for (const id of ["root", "root", "yabusame", "yabusame", "elite_yabusame", "kyudo", "moai"]) s = buyNode(s, id);
    return s;
  }

  it("1 レベル返金で費用が全額戻る", () => {
    const s = bought();
    const r = refundNode(s, "yabusame");
    expect(nodeLevel(r, "yabusame")).toBe(1);
    expect(r.meta.tokens.ce).toBe(s.meta.tokens.ce + nodeCost(TREE_BY_ID.get("yabusame")!, 1));
  });

  it("レベル 0 になると子孫もまとめて返金される", () => {
    const s = refundNode(bought(), "yabusame");
    const r = refundNode(s, "yabusame");
    for (const id of ["yabusame", "elite_yabusame", "kyudo"]) expect(nodeLevel(r, id)).toBe(0);
    expect(nodeLevel(r, "moai")).toBe(1);
    expect(r.meta.tokens.ce + totalSpent(r)).toBe(10_000);
  });

  it("全返金でトークンが元に戻り、ツリーが空になる", () => {
    const r = refundAll(bought());
    expect(r.meta.tokens.ce).toBe(10_000);
    expect(r.meta.tree).toEqual({});
  });

  it("descendants は子孫だけを返す", () => {
    expect(descendants("kyudo").map((n) => n.id).sort()).toEqual(["dokugiri", "kyudo_a", "ogi_otoshi", "sanjushi"].sort());
  });
});

describe("ツリーの版 (SPEC-108 §1)", () => {
  it("版が違うセーブは全返金（所持 = 累計獲得）し、版を合わせる", () => {
    const s = createNewSave();
    const old: SaveData = { ...s, meta: { ...s.meta, treeVersion: 0, tree: { root: 2, nope: 1 }, tokens: { ce: 5 }, tokensEarned: { ce: 40 } } };
    const { save, refunded } = syncTreeVersion(old);
    expect(refunded).toBe(true);
    expect(save.meta.tree).toEqual({});
    expect(save.meta.tokens.ce).toBe(40);
    expect(save.meta.treeVersion).toBe(TREE_VERSION);
    expect(syncTreeVersion(save).save).toBe(save);
  });

  it("ツリーが空なら返金のお知らせは出さない", () => {
    const s = createNewSave();
    expect(syncTreeVersion({ ...s, meta: { ...s.meta, treeVersion: 0 } }).refunded).toBe(false);
  });
});

describe("補正値 (SPEC-108)", () => {
  it("レベル × 1 レベルあたりの値を合算する", () => {
    let s = withCe(10_000);
    for (const id of ["root", "root", "yabusame", "novice_protection", "novice_protection"]) s = buyNode(s, id);
    const m = computeModifiers(s);
    expect(m.startGumAdd).toBe(40);
    expect(m.damagePct).toBeCloseTo(0.1);
    expect(m.maxHpAdd).toBe(6);
  });

  it("未知のノード・親が 0 のノード・上限超過は効果を持たない", () => {
    const s = withCe(0);
    const broken: SaveData = { ...s, meta: { ...s.meta, tree: { nope: 3, yabusame: 2, root: 99 } } };
    const m = computeModifiers(broken);
    const root = TREE_BY_ID.get("root")!;
    expect(m.startGumAdd).toBe(root.effects[0].perLevel * root.maxLevel);
    expect(m.damagePct).toBeCloseTo(0.1 * 2);
    const orphan: SaveData = { ...s, meta: { ...s.meta, tree: { yabusame: 2 } } };
    expect(computeModifiers(orphan).damagePct).toBe(0);
  });

  it("全ノードの効果が補正値のキーを指す", () => {
    const m = computeModifiers(createNewSave());
    for (const n of TREE) for (const e of n.effects) expect(e.stat in m).toBe(true);
  });
});

describe("ラン報酬と進行 (SPEC-106)", () => {
  const L1 = getLevel("L1");

  it("負けてもクリアした Wave 分の CE がもらえる", () => {
    const r = computeReward(L1, { levelId: "L1", won: false, wavesReached: 5, wavesCleared: 4 }, createNewSave());
    expect(r.ce).toBe(4 * L1.reward.perWave);
    expect(r.firstClear).toBe(false);
  });

  it("初回クリアはボーナス、2 回目以降は無し", () => {
    let s = createNewSave();
    const res = { levelId: "L1", won: true, wavesReached: 10, wavesCleared: 10 };
    const first = computeReward(L1, res, s);
    expect(first.ce).toBe(10 * L1.reward.perWave + L1.reward.clear + L1.reward.firstClear);
    s = applyRunResult(s, res, first);
    expect(s.meta.tokens.ce).toBe(first.ce);
    expect(s.meta.levels.L1).toEqual({ cleared: true, bestWave: 10, clears: 1, runs: 1 });
    expect(computeReward(L1, res, s).firstClear).toBe(false);
  });

  it("レベルは前のレベルをクリアすると解放される", () => {
    let s = createNewSave();
    expect(isLevelUnlocked(s, "L1")).toBe(true);
    expect(isLevelUnlocked(s, "L2")).toBe(false);
    s = applyRunResult(s, { levelId: "L1", won: true, wavesReached: 10, wavesCleared: 10 }, { ce: 0, breakdown: [], firstClear: true });
    expect(isLevelUnlocked(s, "L2")).toBe(true);
    expect(isLevelUnlocked(s, "L3")).toBe(false);
  });

  it("既読フラグ", () => {
    const s = markSeen(createNewSave(), "run.tutorial");
    expect(hasSeen(s, "run.tutorial")).toBe(true);
    expect(markSeen(s, "run.tutorial")).toBe(s);
  });
});

describe("コアループの到達可能性 (SPEC-106 §4)", () => {
  it.each([1, 2])("強化しながら挑むと少しずつ先へ進み、26 ラン以内に Lv3 までクリアできる（シード %i）", (seed) => {
    const { log, save } = runCampaign({ buyOrder: STANDARD_BUY_ORDER, maxRuns: 26, seed });
    expect(save.meta.levels.L3?.cleared).toBe(true);
    // 1 回目は Wave 2 で負ける（それでも CE は入る）
    expect(log[0]).toMatchObject({ levelId: "L1", won: false, wavesReached: 2 });
    expect(log[0].ce).toBeGreaterThan(0);
    // Lv1 はすぐには勝てず、到達 Wave が伸びていく
    const l1 = log.filter((l) => l.levelId === "L1");
    const firstWin = l1.findIndex((l) => l.won);
    expect(firstWin).toBeGreaterThanOrEqual(4);
    expect(Math.max(...l1.slice(0, firstWin).map((l) => l.wavesReached))).toBeGreaterThan(l1[0].wavesReached);
  });
});
