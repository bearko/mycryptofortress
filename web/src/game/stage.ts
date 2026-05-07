import type { TileKind, TilePos, Wave } from "./types";

export const TILE_SIZE = 64;
export const COLS = 10;
export const ROWS = 6;

/**
 * Stage1-1 のシンプルな S 字型 Route。
 * ウェイポイントはタイル中心座標（col, row）で定義する。
 */
export const STAGE1_ROUTE: TilePos[] = [
  { col: 0, row: 3 },
  { col: 3, row: 3 },
  { col: 3, row: 1 },
  { col: 6, row: 1 },
  { col: 6, row: 4 },
  { col: 9, row: 4 },
];

/**
 * Route 上のタイルセット（配置不可マス）を計算する。
 * 各セグメントは縦か横かのどちらかしか想定しない（斜め非対応）。
 */
export function computePathTiles(route: TilePos[]): Set<string> {
  const set = new Set<string>();
  const key = (c: number, r: number) => `${c},${r}`;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    if (a.col === b.col) {
      const [r0, r1] = [Math.min(a.row, b.row), Math.max(a.row, b.row)];
      for (let r = r0; r <= r1; r++) set.add(key(a.col, r));
    } else if (a.row === b.row) {
      const [c0, c1] = [Math.min(a.col, b.col), Math.max(a.col, b.col)];
      for (let c = c0; c <= c1; c++) set.add(key(c, a.row));
    }
  }
  return set;
}

/**
 * 全タイルの種別マップを返す。
 * Route 上は path、それ以外は placeable（MVP では blocked タイルなし）。
 */
export function buildTileMap(route: TilePos[]): TileKind[][] {
  const path = computePathTiles(route);
  const map: TileKind[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: TileKind[] = [];
    for (let c = 0; c < COLS; c++) {
      row.push(path.has(`${c},${r}`) ? "path" : "placeable");
    }
    map.push(row);
  }
  return map;
}

/**
 * Stage1-1 の MVP 用 Wave 定義。
 * 5 体のクリーパーを 2 秒間隔で出現させる。
 */
export const STAGE1_WAVE: Wave = {
  patterns: [
    { time: 1.0, enemyId: 101 },
    { time: 3.0, enemyId: 101 },
    { time: 5.0, enemyId: 101 },
    { time: 7.0, enemyId: 101 },
    { time: 9.0, enemyId: 101 },
  ],
};

/** タイル座標 → ピクセル中心座標 */
export function tileToPixel(pos: TilePos): { x: number; y: number } {
  return {
    x: pos.col * TILE_SIZE + TILE_SIZE / 2,
    y: pos.row * TILE_SIZE + TILE_SIZE / 2,
  };
}

/** ピクセル → タイル座標（範囲外なら null） */
export function pixelToTile(x: number, y: number): TilePos | null {
  const col = Math.floor(x / TILE_SIZE);
  const row = Math.floor(y / TILE_SIZE);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
  return { col, row };
}
