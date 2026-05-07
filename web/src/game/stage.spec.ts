import { describe, it, expect } from "vitest";
import {
  STAGE1_ROUTE,
  STAGE1_WAVE,
  buildTileMap,
  computePathTiles,
  pixelToTile,
  tileToPixel,
  TILE_SIZE,
  COLS,
  ROWS,
} from "./stage";

describe("computePathTiles", () => {
  it("S 字 Route を正しいタイル集合に展開する", () => {
    const tiles = computePathTiles(STAGE1_ROUTE);
    // Route の端点は必ず含まれる
    expect(tiles.has("0,3")).toBe(true);
    expect(tiles.has("9,4")).toBe(true);
    // 角のタイルは含まれる
    expect(tiles.has("3,1")).toBe(true);
    expect(tiles.has("6,4")).toBe(true);
    // Route 外のタイルは含まれない
    expect(tiles.has("0,0")).toBe(false);
    expect(tiles.has("5,5")).toBe(false);
  });
});

describe("buildTileMap", () => {
  it("Route 上は path、それ以外は placeable", () => {
    const map = buildTileMap(STAGE1_ROUTE);
    expect(map.length).toBe(ROWS);
    expect(map[0].length).toBe(COLS);
    expect(map[3][0]).toBe("path"); // Route 始点
    expect(map[0][0]).toBe("placeable");
  });
});

describe("tileToPixel / pixelToTile", () => {
  it("中心座標と逆変換が往復する", () => {
    const p = tileToPixel({ col: 4, row: 2 });
    expect(p.x).toBe(4 * TILE_SIZE + TILE_SIZE / 2);
    expect(p.y).toBe(2 * TILE_SIZE + TILE_SIZE / 2);
    const t = pixelToTile(p.x, p.y);
    expect(t).toEqual({ col: 4, row: 2 });
  });

  it("範囲外は null を返す", () => {
    expect(pixelToTile(-10, 0)).toBeNull();
    expect(pixelToTile(0, ROWS * TILE_SIZE + 5)).toBeNull();
  });
});

describe("STAGE1_WAVE", () => {
  it("5 体スポーンする", () => {
    expect(STAGE1_WAVE.patterns.length).toBe(5);
    expect(STAGE1_WAVE.patterns.every((p) => p.enemyId === 101)).toBe(true);
  });
});
