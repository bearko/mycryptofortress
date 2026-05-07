import type { TilePos } from "./types";

export type Direction = "right" | "down" | "left" | "up";

/** 4 方向すべて */
export const DIRECTIONS: Direction[] = ["right", "down", "left", "up"];

/**
 * 攻撃パターン（タイルオフセット集合）。
 * `right` 向きを正規形とし、各エントリはヒーロータイルからの相対オフセット（col, row）。
 *
 * 例:
 *   `[(1,0),(2,0),(3,0)]` … 右 3 マス直線
 *   `[(1,-1),(1,0),(1,1)]` … 1 マス前の縦 3 マス
 */
export type AttackPattern = TilePos[];

/**
 * パターンを 4 方向に回転する。
 *
 * 画面座標は +x 右、+y 下なので、screen-CW（時計回り）の回転を使う:
 *   right (canonical): (c, r) → (c, r)
 *   down  (90° CW)   : (c, r) → (-r, c)
 *   left  (180°)     : (c, r) → (-c, -r)
 *   up    (270° CW)  : (c, r) → (r, -c)
 */
/** 単項マイナスは -0 を生成し toEqual で食い違うため、ゼロを正規化する */
const norm = (n: number): number => (n === 0 ? 0 : n);

export function rotatePattern(
  pattern: AttackPattern,
  dir: Direction,
): AttackPattern {
  return pattern.map((p) => {
    switch (dir) {
      case "right":
        return { col: p.col, row: p.row };
      case "down":
        return { col: norm(-p.row), row: p.col };
      case "left":
        return { col: norm(-p.col), row: norm(-p.row) };
      case "up":
        return { col: p.row, row: norm(-p.col) };
    }
  });
}

/**
 * カーソルとヒーロー中心の差分ベクトルから、4 方向にスナップする。
 * 同点の場合は水平を優先（プレイヤーの直感に合わせて）。
 */
export function directionFromDelta(dx: number, dy: number): Direction {
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "down" : "up";
}

/**
 * パターンに含まれる絶対タイル一覧（ヒーロータイル + 各オフセット）を返す。
 */
export function applyPatternToTile(
  heroTile: TilePos,
  pattern: AttackPattern,
): TilePos[] {
  return pattern.map((p) => ({
    col: heroTile.col + p.col,
    row: heroTile.row + p.row,
  }));
}

/**
 * タイル等価判定（Set 用キーが面倒なので関数で）。
 */
export function tileEquals(a: TilePos, b: TilePos): boolean {
  return a.col === b.col && a.row === b.row;
}

/**
 * パターンの境界ボックス（描画レイアウト計算用）。
 */
export function patternBounds(pattern: AttackPattern): {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
} {
  if (pattern.length === 0) {
    return { minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 };
  }
  let minCol = Infinity,
    maxCol = -Infinity,
    minRow = Infinity,
    maxRow = -Infinity;
  for (const p of pattern) {
    if (p.col < minCol) minCol = p.col;
    if (p.col > maxCol) maxCol = p.col;
    if (p.row < minRow) minRow = p.row;
    if (p.row > maxRow) maxRow = p.row;
  }
  return { minCol, maxCol, minRow, maxRow };
}
