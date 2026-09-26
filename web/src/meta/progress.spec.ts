import { LEVELS, getLevel } from "../data/levels";
import { TREE, TREE_BY_ID, TREE_VERSION, nodeCost } from "../data/tree";
import { runCampaign, STANDARD_BUY_ORDER } from "./campaign";
import {
  applyRunResult,
  buyBlock,
  conditionalLevels,
  isFeatureUnlocked,
  newlyUnlocked,
  runResultOf,
  buyNode,
  computeModifiers,
  computeReward,
  descendants,
  isLevelUnlocked,
  nextChallengeLevel,
  loadBuildSet,
  saveBuildSet,
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
  return { ...s, meta: { ...s.meta, tokens: { ce, emblem: 99 } } };
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
    expect(descendants("kyudo").map((n) => n.id).sort()).toEqual(["dokugiri", "eiyu", "f_levels", "kyudo_a", "multi_crit", "ogi_otoshi", "sanjushi", "ten_ichigeki"]);
  });
});

describe("ツリーの版 (SPEC-108 §1)", () => {
  it("版が違うセーブは全返金（所持 = 累計獲得）し、版を合わせる", () => {
    const s = createNewSave();
    const old: SaveData = { ...s, meta: { ...s.meta, treeVersion: 0, tree: { root: 2, nope: 1 }, tokens: { ce: 5, emblem: 0 }, tokensEarned: { ce: 40, emblem: 3 } } };
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
    s = applyRunResult(s, { levelId: "L1", won: true, wavesReached: 10, wavesCleared: 10 }, { ce: 0, emblems: 0, breakdown: [], firstClear: true });
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
  it.each([1, 2])("強化しながら挑むと少しずつ先へ進み、32 ラン以内に Lv3 までクリアできる（シード %i）", (seed) => {
    const { log, save } = runCampaign({ buyOrder: STANDARD_BUY_ORDER, maxRuns: 32, seed });
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

  it("Lv4〜9 も強化を続ければ 90 ラン以内に全クリアでき、Lv4〜7 は数回負ける", () => {
    const { log, save } = runCampaign({ buyOrder: STANDARD_BUY_ORDER, maxRuns: 90, seed: 1 });
    expect(save.meta.levels.L9?.cleared).toBe(true);
    for (const id of ["L4", "L6", "L7"]) {
      const runs = log.filter((l) => l.levelId === id);
      expect(runs.length, id).toBeGreaterThanOrEqual(3);
    }
  }, 300_000);
});

describe("エンブレムとビルドセット (SPEC-116 / 116a)", () => {
  it("初回クリアでエンブレムが入り、解放ノードはエンブレムで買う", () => {
    let s = createNewSave();
    const L1 = LEVELS[0];
    const reward = computeReward(L1, { levelId: "L1", won: true, wavesReached: 10, wavesCleared: 10 }, s);
    expect(reward.emblems).toBe(L1.reward.emblems);
    s = applyRunResult(s, { levelId: "L1", won: true, wavesReached: 10, wavesCleared: 10 }, reward);
    expect(s.meta.tokens.emblem).toBe(L1.reward.emblems);
    // 2 回目のクリアではもらえない
    expect(computeReward(L1, { levelId: "L1", won: true, wavesReached: 10, wavesCleared: 10 }, s).emblems).toBe(0);
    // 幻獣砲の解放はエンブレム 1。CE は減らない
    const ce = s.meta.tokens.ce;
    const bought = buyNode(buyNode(s, "root"), "amenra");
    expect(nodeLevel(bought, "amenra")).toBe(1);
    expect(bought.meta.tokens.emblem).toBe(s.meta.tokens.emblem - 1);
    // 返金はトークンごとに戻る
    const back = refundAll(bought);
    expect(back.meta.tokens.emblem).toBe(s.meta.tokens.emblem);
    expect(back.meta.tokens.ce).toBe(ce);
  });

  it("ビルドセットを保存・読み込みでき、読み込みは全返金してから買い直す", () => {
    let s = withCe(500);
    s = buyNode(buyNode(buyNode(s, "root"), "yabusame"), "yabusame");
    s = saveBuildSet(s, 0, "弓");
    s = refundAll(s);
    s = buyNode(s, "root");
    s = buyNode(s, "novice_protection");
    const { save, missing } = loadBuildSet(s, 0);
    expect(missing).toBe(0);
    expect(nodeLevel(save, "yabusame")).toBe(2);
    expect(nodeLevel(save, "novice_protection")).toBe(0);
    expect(save.meta.tokens.ce + totalSpent(save)).toBe(500);
  });

  it("旧マイルストーンは累計 CE の丸パネルになり、自動回収は補正値に入る", () => {
    const s = createNewSave();
    expect(computeModifiers(s).autoCollect).toBe(0);
    expect(isFeatureUnlocked(s, "speed3x")).toBe(false);
    const mid = { ...s, meta: { ...s.meta, tokensEarned: { ce: 700, emblem: 0 } } };
    expect(computeModifiers(mid).autoCollect).toBe(1);
    expect(isFeatureUnlocked(mid, "buildSets")).toBe(true);
    expect(isFeatureUnlocked(mid, "speed3x")).toBe(true);
    expect(isFeatureUnlocked(mid, "autoLevel")).toBe(false);
    expect(newlyUnlocked(conditionalLevels(s), mid).map((u) => u.node.id)).toEqual(expect.arrayContaining(["ms_auto_collect", "ms_build_sets", "ms_speed3x"]));
  });
});

describe("条件つきパネル (SPEC-119)", () => {
  const withStats = (patch: Partial<ReturnType<typeof createNewSave>["meta"]["stats"]>) => {
    const s = createNewSave();
    return { ...s, meta: { ...s.meta, stats: { ...s.meta.stats, ...patch } } };
  };

  it("記録がしきい値に届くたびに無料でレベルが上がり、買えず・返金されない", () => {
    const n = TREE_BY_ID.get("f_kills")!;
    expect(nodeLevel(withStats({ kills: 299 }), "f_kills")).toBe(0);
    const s = withStats({ kills: 1500 });
    expect(nodeLevel(s, "f_kills")).toBe(2);
    expect(buyBlock(s, "f_kills")).toBe("condition");
    expect(refundNode(s, "f_kills")).toBe(s);
    expect(computeModifiers(s).damagePct).toBeCloseTo(n.effects[0].perLevel * 2);
    expect(totalSpent(s)).toBe(0);
  });

  it("条件つきパネルは親が未解放でも効き、子は条件を満たすと買えるようになる", () => {
    let s = withStats({ kills: 300 });
    s = { ...s, meta: { ...s.meta, tokens: { ce: 1000, emblem: 0 } } };
    expect(nodeLevel(s, "elite_shot")).toBe(0);
    expect(computeModifiers(s).damagePct).toBeGreaterThan(0);
    expect(buyBlock(s, "mark")).toBeNull();
    expect(buyBlock(withStats({ kills: 0 }), "mark")).toBe("locked");
  });

  it("ノードのクリア数・累計 CE の条件も読める", () => {
    let s = createNewSave();
    for (const l of LEVELS.slice(0, 3)) s = applyRunResult(s, { levelId: l.id, won: true, wavesReached: 10, wavesCleared: 10 }, { ce: 0, emblems: 0, breakdown: [], firstClear: true });
    expect(nodeLevel(s, "f_levels")).toBe(1);
  });

  it("ランの記録が累計に積み上がり、到達されずに勝つとノーダメージクリアになる", () => {
    let s = createNewSave();
    const stats = { wavesReached: 10, wavesCleared: 10, kills: 120, bossKills: 1, gumEarned: 800, damageTaken: 0 };
    s = applyRunResult(s, runResultOf("L1", true, stats), { ce: 0, emblems: 0, breakdown: [], firstClear: true });
    s = applyRunResult(s, runResultOf("L1", true, { ...stats, damageTaken: 2 }), { ce: 0, emblems: 0, breakdown: [], firstClear: false });
    s = applyRunResult(s, runResultOf("L2", false, { ...stats, wavesCleared: 4 }), { ce: 0, emblems: 0, breakdown: [], firstClear: false });
    expect(s.meta.stats).toEqual({ kills: 360, bossKills: 3, gumCollected: 2400, wavesCleared: 24, flawlessClears: 1, runs: 3 });
    expect(nodeLevel(s, "f_flawless")).toBe(1);
  });
});

describe("次に挑むノード", () => {
  it("未クリアなら同じノード、クリア済みなら次の未クリアのノード", () => {
    let s = createNewSave();
    expect(nextChallengeLevel(s, "L1")).toBe("L1");
    s = applyRunResult(s, { levelId: "L1", won: true, wavesReached: 10, wavesCleared: 10 }, { ce: 0, emblems: 0, breakdown: [], firstClear: true });
    expect(nextChallengeLevel(s, "L1")).toBe("L2");
    // 最後のノードをクリア済みなら同じノード
    const all = LEVELS.reduce((acc, l) => applyRunResult(acc, { levelId: l.id, won: true, wavesReached: 10, wavesCleared: 10 }, { ce: 0, emblems: 0, breakdown: [], firstClear: true }), s);
    expect(nextChallengeLevel(all, "L3")).toBe("L3");
  });
});
