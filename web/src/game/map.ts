import type {
  HeroClass,
  MapDef,
  MapTileType,
  RouteDef,
  TilePos,
  Wave,
} from "./types";

export const TILE_SIZE = 64;

/**
 * 職業 → 配置できるタイル種別。SPEC-003 §5.1。
 */
const CLASS_PLACEMENT_TILE: Record<HeroClass, MapTileType> = {
  defender: "path",
  guard: "path",
  vanguard: "path",
  specialist: "path",
  sniper: "wall",
  caster: "wall",
  medic: "wall",
  supporter: "wall",
};

/** 職業 → ブロック上限。SPEC-003 §5.1 / §5.6。 */
const CLASS_BLOCK_MAX: Record<HeroClass, number> = {
  defender: 3,
  guard: 2,
  vanguard: 1,
  specialist: 1,
  sniper: 0,
  caster: 0,
  medic: 0,
  supporter: 0,
};

export function placementTileFor(cls: HeroClass): MapTileType {
  return CLASS_PLACEMENT_TILE[cls];
}

export function blockMaxFor(cls: HeroClass): number {
  return CLASS_BLOCK_MAX[cls];
}

export function canPlaceClassOnTile(
  cls: HeroClass,
  tile: MapTileType,
): boolean {
  return CLASS_PLACEMENT_TILE[cls] === tile;
}

/** タイル座標 → ピクセル中心座標 */
export function tileToPixel(pos: TilePos): { x: number; y: number } {
  return {
    x: pos.col * TILE_SIZE + TILE_SIZE / 2,
    y: pos.row * TILE_SIZE + TILE_SIZE / 2,
  };
}

/** ピクセル → タイル座標。マップ範囲外は null。 */
export function pixelToTile(
  x: number,
  y: number,
  cols: number,
  rows: number,
): TilePos | null {
  const col = Math.floor(x / TILE_SIZE);
  const row = Math.floor(y / TILE_SIZE);
  if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
  return { col, row };
}

export function tileTypeAt(map: MapDef, tile: TilePos): MapTileType | null {
  if (
    tile.row < 0 ||
    tile.row >= map.rows ||
    tile.col < 0 ||
    tile.col >= map.cols
  ) {
    return null;
  }
  return map.tiles[tile.row][tile.col];
}

export function findRoute(map: MapDef, routeId: string): RouteDef | undefined {
  return map.routes.find((r) => r.id === routeId);
}

/**
 * Stage1-1 v2 のマップ。SPEC-003 §5.3。
 * 12 列 × 8 行。上下に 2 経路（A: row 1, B: row 6）、中段は壁帯と障害。
 */
const ROW_OBSTACLE: MapTileType[] = Array(12).fill("obstacle");
const ROW_PATH: MapTileType[] = Array(12).fill("path");
const ROW_WALL: MapTileType[] = (() => {
  const a: MapTileType[] = Array(12).fill("wall");
  // 端 2 マスは obstacle にして見栄えを整える
  a[0] = "obstacle";
  a[11] = "obstacle";
  return a;
})();

export const STAGE1_MAP: MapDef = {
  id: "stage-1-1-v2",
  cols: 12,
  rows: 8,
  tiles: [
    ROW_OBSTACLE.slice(),
    ROW_PATH.slice(), // row 1: route A
    ROW_WALL.slice(),
    ROW_OBSTACLE.slice(),
    ROW_OBSTACLE.slice(),
    ROW_WALL.slice(),
    ROW_PATH.slice(), // row 6: route B
    ROW_OBSTACLE.slice(),
  ],
  routes: [
    {
      id: "A",
      points: [
        { col: 0, row: 1 },
        { col: 11, row: 1 },
      ],
    },
    {
      id: "B",
      points: [
        { col: 0, row: 6 },
        { col: 11, row: 6 },
      ],
    },
  ],
};

/** Stage1-1 v2 用 Wave。SPEC-003 §5.3。6 体、A/B 交互。 */
export const STAGE1_WAVE: Wave = {
  patterns: [
    { time: 1.0, enemyId: 101, routeId: "A" },
    { time: 2.0, enemyId: 101, routeId: "B" },
    { time: 4.0, enemyId: 101, routeId: "A" },
    { time: 6.0, enemyId: 101, routeId: "B" },
    { time: 8.0, enemyId: 101, routeId: "A" },
    { time: 10.0, enemyId: 101, routeId: "B" },
  ],
};

/**
 * ルート進行度 (route progress)。`nextIndex` は次に向かうウェイポイント、
 * `currentX/Y` は敵の現在位置（ピクセル）。
 *
 * 進行度 = (nextIndex - 1) + 直前点からの距離 / セグメント長。
 * 開始直前は 0、ゴール到達で `points.length - 1` になる。
 */
export function routeProgress(
  route: RouteDef,
  nextIndex: number,
  currentX: number,
  currentY: number,
): number {
  if (nextIndex <= 0) return 0;
  if (nextIndex >= route.points.length) return route.points.length - 1;
  const prev = tileToPixel(route.points[nextIndex - 1]);
  const next = tileToPixel(route.points[nextIndex]);
  const segLen = Math.hypot(next.x - prev.x, next.y - prev.y);
  if (segLen === 0) return nextIndex - 1;
  const traveled = Math.hypot(currentX - prev.x, currentY - prev.y);
  return nextIndex - 1 + Math.min(1, traveled / segLen);
}

/** ゴールまでの残り距離（ピクセル換算）。同点進行度を tie-break するのに使う。 */
export function distanceToGoal(
  route: RouteDef,
  nextIndex: number,
  currentX: number,
  currentY: number,
): number {
  if (nextIndex >= route.points.length) return 0;
  const next = tileToPixel(route.points[nextIndex]);
  let dist = Math.hypot(next.x - currentX, next.y - currentY);
  for (let i = nextIndex; i < route.points.length - 1; i++) {
    const a = tileToPixel(route.points[i]);
    const b = tileToPixel(route.points[i + 1]);
    dist += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return dist;
}
