/**
 * SPEC-122: bearko.games 共通基盤の総合スコア（v2：レベルごとの自己ベストの合計）。
 * 純関数（Phaser・window に依存しない）。点の計算の正は共通基盤（bearko/mycryptoportfolio の SPEC-002 3.3、fortress.v2.js）。
 * ここでは「どのクリアがそのレベルの自己ベストか」を決めるために同じ式を持つ（式を変えるときは両方を直す）。
 */
import type { LevelBest, LevelProgress, SaveData } from "./save";

/** 早呼びのボーナス 1 GUM ＝ 1 点 */
export const EARLY_POINT = 1;
/** ふつうのクリア（体力 2/3 が残る・15 スロットに 7 体）で成績の点 ＝ 重み */
export const TYPICAL = 1.2;

/** レベルの重み（節目の点）。L1 ＝ 500、L2〜L9 ＝ 562.5（9 レベルで 5,000） */
export const levelWeight = (levelId: string): number => (levelId === "L1" ? 500 : 562.5);

export interface ClearInput {
  hp: number; // 終わったときの体力
  maxHp: number;
  heroesUsed: number; // 置いたヒーローの数
  slots: number; // そのレベルのスロット数
  earlyBonus: number; // 早呼びのボーナス GUM の合計
}

/** クリアしたときの成績を、送る形（整数・範囲内）にする */
export function levelBestOf(i: ClearInput): LevelBest {
  const maxHp = Math.max(1, Math.round(i.maxHp));
  const slots = Math.max(1, Math.round(i.slots));
  return {
    hpLeft: Math.max(1, Math.min(maxHp, Math.round(i.hp))), // クリアしたなら体力は 1 以上
    maxHp,
    heroesUsed: Math.max(0, Math.min(slots, Math.round(i.heroesUsed))),
    slots,
    earlyBonus: Math.max(0, Math.round(i.earlyBonus)),
  };
}

/** 1 レベルの点（節目 ＋ 成績） */
export function levelPoints(levelId: string, b: LevelBest): number {
  const w = levelWeight(levelId);
  return w + (w * (b.hpLeft / b.maxHp + (b.slots - b.heroesUsed) / b.slots)) / TYPICAL + b.earlyBonus * EARLY_POINT;
}

/** クリアの成績をセーブの自己ベストに反映する。点が上がったときだけ improved */
export function applyLevelBest(save: SaveData, levelId: string, best: LevelBest): { save: SaveData; improved: boolean } {
  const prev: LevelProgress | undefined = save.meta.levels[levelId];
  if (!prev) return { save, improved: false };
  if (prev.best && levelPoints(levelId, prev.best) >= levelPoints(levelId, best)) return { save, improved: false };
  const levels = { ...save.meta.levels, [levelId]: { ...prev, best } };
  return { save: { ...save, meta: { ...save.meta, levels } }, improved: true };
}

export interface ScoreMetrics {
  levels: Record<string, LevelBest>;
}

/** 共通基盤に送る成績：セーブにあるレベルごとの自己ベスト（クリアしたレベルだけ） */
export function scoreMetrics(save: SaveData): ScoreMetrics {
  const levels: Record<string, LevelBest> = {};
  for (const [id, p] of Object.entries(save.meta.levels)) if (p.cleared && p.best) levels[id] = p.best;
  return { levels };
}

/** 自己ベストの合計（画面に出す目安。共通基盤の点と同じ式） */
export function totalPoints(save: SaveData): number {
  return Math.round(Object.entries(scoreMetrics(save).levels).reduce((s, [id, b]) => s + levelPoints(id, b), 0));
}
