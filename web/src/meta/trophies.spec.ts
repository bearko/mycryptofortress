import { describe, expect, it } from "vitest";
import { ROLE_IDS, ROLES } from "../data/balance/heroes";
import { LEVELS } from "../data/levels";
import { TREE, TREE_BY_ID } from "../data/tree";
import { createNewSave, type SaveData } from "./save";
import {
  achievementIdsForRun,
  achievementIdsForSave,
  allHeroesUnlocked,
  LEVEL_TROPHIES,
  trophyIdsForLevelClear,
} from "./trophies";

/** 共通基盤（SPEC-008）から渡された、本作が送る ID（fortress.visit は SDK が自動で送るので含まない） */
const ALL_IDS = [
  "fortress.level01",
  "fortress.level03",
  "fortress.heroes5",
  "fortress.boss10",
  "fortress.level05",
  "fortress.flawless",
  "fortress.level07",
  "fortress.clear",
  "fortress.boss25",
  "fortress.rta",
  "fortress.l9flawless",
  "fortress.panel",
  "fortress.firstboss",
  "fortress.kills1000",
];

const fresh = (): SaveData => createNewSave(new Date(0));
const withStats = (s: SaveData, stats: Partial<SaveData["meta"]["stats"]>): SaveData => ({ ...s, meta: { ...s.meta, stats: { ...s.meta.stats, ...stats } } });
const withTree = (s: SaveData, tree: Record<string, number>): SaveData => ({ ...s, meta: { ...s.meta, tree } });
const withCleared = (s: SaveData, ids: string[]): SaveData => ({
  ...s,
  meta: { ...s.meta, levels: Object.fromEntries(ids.map((id) => [id, { cleared: true, bestWave: 1, clears: 1, runs: 1 }])) },
});

/** ノードとその先祖をすべて Lv1 にしたツリー */
function treeWith(ids: string[]): Record<string, number> {
  const tree: Record<string, number> = {};
  for (const id of ids) {
    for (let n = TREE_BY_ID.get(id); n; n = n.parent ? TREE_BY_ID.get(n.parent) : undefined) tree[n.id] = 1;
  }
  return tree;
}
/** ロールを解放するノード（雷・結界・炎・採掘） */
const UNLOCK_NODES = ROLE_IDS.map((r) => ROLES[r].unlock)
  .filter((k): k is NonNullable<typeof k> => !!k)
  .map((key) => TREE.find((n) => n.effects.some((e) => e.stat === key))!.id);

describe("SPEC-120 / SPEC-130 レベルのクリア", () => {
  it("L1・L3・L5・L7・L9 のクリアで送る（負け・撤退では送らない）", () => {
    expect(trophyIdsForLevelClear("L1", true)).toEqual(["fortress.level01"]);
    expect(trophyIdsForLevelClear("L3", true)).toEqual(["fortress.level03"]);
    expect(trophyIdsForLevelClear("L5", true)).toEqual(["fortress.level05"]);
    expect(trophyIdsForLevelClear("L7", true)).toEqual(["fortress.level07"]);
    expect(trophyIdsForLevelClear("L9", true)).toEqual(["fortress.clear"]);
    expect(trophyIdsForLevelClear("L2", true)).toEqual([]);
    expect(trophyIdsForLevelClear("L1", false)).toEqual([]);
  });

  it("対応表のレベルはすべて実在し、全クリアは最後のレベル", () => {
    const ids = LEVELS.map((l) => l.id);
    for (const levelId of Object.keys(LEVEL_TROPHIES)) expect(ids).toContain(levelId);
    expect(LEVEL_TROPHIES[ids[ids.length - 1]]).toBe("fortress.clear");
  });
});

describe("SPEC-130 セーブから判定するアチーブメント", () => {
  it("新しいセーブでは何も満たさない", () => {
    expect(achievementIdsForSave(fresh())).toEqual([]);
  });

  it("クリア済みのレベル（前から遊んでいる人にも付く）", () => {
    const ids = achievementIdsForSave(withCleared(fresh(), ["L1", "L2", "L3", "L7"]));
    expect(ids).toEqual(["fortress.level01", "fortress.level03", "fortress.level07"]);
  });

  it("ボス撃破の通算（1・10・25 体）・ノーダメージクリア・撃破 1,000 体", () => {
    const s = fresh();
    expect(achievementIdsForSave(withStats(s, { bossKills: 1 }))).toEqual(["fortress.firstboss"]);
    expect(achievementIdsForSave(withStats(s, { bossKills: 9 }))).toEqual(["fortress.firstboss"]);
    expect(achievementIdsForSave(withStats(s, { bossKills: 10 }))).toEqual(["fortress.firstboss", "fortress.boss10"]);
    expect(achievementIdsForSave(withStats(s, { bossKills: 24 }))).not.toContain("fortress.boss25");
    expect(achievementIdsForSave(withStats(s, { bossKills: 25 }))).toContain("fortress.boss25");
    expect(achievementIdsForSave(withStats(s, { flawlessClears: 1 }))).toEqual(["fortress.flawless"]);
    expect(achievementIdsForSave(withStats(s, { kills: 999 }))).toEqual([]);
    expect(achievementIdsForSave(withStats(s, { kills: 1000 }))).toEqual(["fortress.kills1000"]);
  });

  it("スキルパネルを初めて取ると panel（Lv0 の記録や存在しないノードは数えない）", () => {
    expect(achievementIdsForSave(withTree(fresh(), { root: 0, nope: 3 }))).toEqual([]);
    expect(achievementIdsForSave(withTree(fresh(), { root: 1 }))).toEqual(["fortress.panel"]);
  });

  it("5 種のヒーロー：弓は最初から、雷・結界・炎・採掘の解放パネルをすべて取ると heroes5", () => {
    expect(ROLE_IDS.length).toBe(5);
    expect(UNLOCK_NODES).toHaveLength(4);
    expect(allHeroesUnlocked(fresh())).toBe(false);
    const all = withTree(fresh(), treeWith(UNLOCK_NODES));
    expect(allHeroesUnlocked(all)).toBe(true);
    expect(achievementIdsForSave(all)).toEqual(["fortress.heroes5", "fortress.panel"]);
    for (const missing of UNLOCK_NODES) {
      const s = withTree(fresh(), treeWith(UNLOCK_NODES.filter((id) => id !== missing)));
      expect(allHeroesUnlocked(s)).toBe(false);
    }
  });
});

describe("SPEC-130 その場で送るアチーブメント", () => {
  const last = LEVELS[LEVELS.length - 1].id;
  it("最後のレベルをノーダメージで勝つと l9flawless", () => {
    expect(achievementIdsForRun({ levelId: last, won: true, damageTaken: 0, rtaFinished: false })).toEqual(["fortress.clear", "fortress.l9flawless"]);
    expect(achievementIdsForRun({ levelId: last, won: true, damageTaken: 1, rtaFinished: false })).toEqual(["fortress.clear"]);
    expect(achievementIdsForRun({ levelId: last, won: false, damageTaken: 0, rtaFinished: false })).toEqual([]);
    expect(achievementIdsForRun({ levelId: "L1", won: true, damageTaken: 0, rtaFinished: false })).toEqual(["fortress.level01"]);
  });

  it("RTA を完走すると rta", () => {
    expect(achievementIdsForRun({ levelId: last, won: true, damageTaken: 2, rtaFinished: true })).toEqual(["fortress.clear", "fortress.rta"]);
    expect(achievementIdsForRun({ levelId: "L4", won: false, damageTaken: 2, rtaFinished: false })).toEqual([]);
  });

  it("送る ID はすべて渡された一覧にあり、一覧の ID はどこかで送る", () => {
    const maxed = withStats(withCleared(withTree(fresh(), treeWith(UNLOCK_NODES)), LEVELS.map((l) => l.id)), {
      bossKills: 25,
      flawlessClears: 1,
      kills: 1000,
    });
    const sent = new Set([...achievementIdsForSave(maxed), ...achievementIdsForRun({ levelId: last, won: true, damageTaken: 0, rtaFinished: true })]);
    expect([...sent].sort()).toEqual([...ALL_IDS].sort());
  });
});
