/**
 * SPEC-121: bearko.games 共通基盤の総合スコア。1 回のレベルの成績（共通基盤に送る形）。
 * 純関数（Phaser・window に依存しない）。点の計算は共通基盤（bearko/mycryptoportfolio の SPEC-002 3.3）。
 *   残り体力の割合 ＋ 空きスロットの割合（少ないヒーローでクリアするほど高い）で、クリアの成績を測る
 */
export interface LevelScoreInput {
  levelId: string;
  won: boolean;
  hp: number; // 終わったときの体力
  maxHp: number;
  heroesUsed: number; // 置いたヒーローの数
  slots: number; // そのレベルのスロット数
}

export interface LevelScoreMetrics {
  levelId: string;
  won: boolean;
  hpLeft: number;
  maxHp: number;
  heroesUsed: number;
  slots: number;
}

export function levelScoreMetrics(i: LevelScoreInput): LevelScoreMetrics {
  const maxHp = Math.max(1, Math.round(i.maxHp));
  const slots = Math.max(1, Math.round(i.slots));
  return {
    levelId: i.levelId,
    won: i.won,
    hpLeft: Math.max(i.won ? 1 : 0, Math.min(maxHp, Math.round(i.hp))),
    maxHp,
    heroesUsed: Math.max(0, Math.min(slots, Math.round(i.heroesUsed))),
    slots,
  };
}
