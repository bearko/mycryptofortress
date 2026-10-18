/**
 * SPEC-120 / SPEC-130: bearko.games 共通基盤のアチーブメント（旧トロフィー）。送る ID の判定。
 * 純関数（Phaser・window に依存しない）。実際に送るのは view/platform.ts。
 */
import { ROLE_IDS, ROLES } from "../data/balance/heroes";
import { LEVELS } from "../data/levels";
import { TREE } from "../data/tree";
import { computeModifiers, nodeLevel } from "./progress";
import type { SaveData } from "./save";

/** クリアしたレベル → アチーブメント ID（名鑑 No.056・057・060・062・063） */
export const LEVEL_TROPHIES: Readonly<Record<string, string>> = {
  L1: "fortress.level01",
  L3: "fortress.level03",
  L5: "fortress.level05",
  L7: "fortress.level07",
  L9: "fortress.clear", // L9 は L8 をクリアしないと解放されないので、L9 クリア＝全レベルクリア
};

/** SPEC-130: ボス撃破の通算（初めて・10 体・25 体） */
export const BOSS_TROPHIES: readonly { at: number; id: string }[] = [
  { at: 1, id: "fortress.firstboss" },
  { at: 10, id: "fortress.boss10" },
  { at: 25, id: "fortress.boss25" },
];
export const KILLS_TROPHY = { at: 1000, id: "fortress.kills1000" } as const;

/** 最後のレベル（ノーダメージクリアの l9flawless の対象） */
const LAST_LEVEL_ID = LEVELS[LEVELS.length - 1].id;

export function trophyIdsForLevelClear(levelId: string, won: boolean): string[] {
  if (!won) return [];
  const id = LEVEL_TROPHIES[levelId];
  return id ? [id] : [];
}

/** SPEC-130: 5 種類のヒーロー（ロール）をすべて配置できるか。ラン中の RunSim.isRoleUnlocked と同じ判定 */
export function allHeroesUnlocked(save: SaveData): boolean {
  const mods = computeModifiers(save);
  return ROLE_IDS.every((r) => {
    const key = ROLES[r].unlock;
    return !key || mods[key] > 0;
  });
}

/**
 * SPEC-130: セーブに残る値から「いま満たしているもの」。起動時・ランの結果のあと・ツリーでパネルを取ったあとに送る。
 * 前から遊んでいる人にも付く（同じ起動で 2 回送らないのは platform.ts）
 */
export function achievementIdsForSave(save: SaveData): string[] {
  const ids: string[] = [];
  const { levels, stats } = save.meta;
  for (const [levelId, id] of Object.entries(LEVEL_TROPHIES)) if (levels[levelId]?.cleared) ids.push(id);
  if (allHeroesUnlocked(save)) ids.push("fortress.heroes5");
  for (const b of BOSS_TROPHIES) if (stats.bossKills >= b.at) ids.push(b.id);
  if (stats.flawlessClears >= 1) ids.push("fortress.flawless");
  if (stats.kills >= KILLS_TROPHY.at) ids.push(KILLS_TROPHY.id);
  if (TREE.some((n) => nodeLevel(save, n.id) > 0)) ids.push("fortress.panel");
  return ids;
}

/**
 * SPEC-130: セーブに残らないもの（その場で送る）。ランの結果のあとに呼ぶ。
 * - レベルのクリア（従来どおり。セーブ判定と同じ ID）
 * - 最後のレベルをノーダメージでクリア（l9flawless）
 * - RTA「レベル 01〜09」の完走（rta）
 */
export function achievementIdsForRun(run: { levelId: string; won: boolean; damageTaken: number; rtaFinished: boolean }): string[] {
  const ids = trophyIdsForLevelClear(run.levelId, run.won);
  if (run.won && run.levelId === LAST_LEVEL_ID && run.damageTaken === 0) ids.push("fortress.l9flawless");
  if (run.rtaFinished) ids.push("fortress.rta");
  return ids;
}
