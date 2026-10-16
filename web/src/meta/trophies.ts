/**
 * SPEC-120: bearko.games 共通基盤のトロフィー。クリアしたレベル → 送るトロフィー ID。
 * 純関数（Phaser・window に依存しない）。実際に送るのは view/platform.ts。
 */
export const LEVEL_TROPHIES: Readonly<Record<string, string>> = {
  L1: "fortress.level01",
  L5: "fortress.level05",
  L9: "fortress.clear", // L9 は L8 をクリアしないと解放されないので、L9 クリア＝全レベルクリア
};

export function trophyIdsForLevelClear(levelId: string, won: boolean): string[] {
  if (!won) return [];
  const id = LEVEL_TROPHIES[levelId];
  return id ? [id] : [];
}
