import { describe, it, expect } from "vitest";
import {
  STAGE1_MAP,
  STAGE1_WAVE,
  pixelToTile,
  tileToPixel,
  TILE_SIZE,
  COLS,
  ROWS,
} from "./stage";

/**
 * SPEC-003 で MapDef ベースに移行した後の sanity check。
 * 詳細な行列テストは map.spec.ts に集約しているため、ここでは最低限の re-export 確認のみ。
 */
describe("stage re-exports (SPEC-003 互換)", () => {
  it("旧 COLS / ROWS が MapDef の値と一致する", () => {
    expect(COLS).toBe(STAGE1_MAP.cols);
    expect(ROWS).toBe(STAGE1_MAP.rows);
  });

  it("STAGE1_WAVE の各 pattern に routeId が振られている", () => {
    expect(STAGE1_WAVE.patterns.length).toBeGreaterThan(0);
    expect(
      STAGE1_WAVE.patterns.every((p) => p.routeId === "A" || p.routeId === "B"),
    ).toBe(true);
  });

  it("tileToPixel と pixelToTile が往復する", () => {
    const p = tileToPixel({ col: 4, row: 2 });
    expect(p.x).toBe(4 * TILE_SIZE + TILE_SIZE / 2);
    expect(p.y).toBe(2 * TILE_SIZE + TILE_SIZE / 2);
    const t = pixelToTile(p.x, p.y, COLS, ROWS);
    expect(t).toEqual({ col: 4, row: 2 });
  });
});
