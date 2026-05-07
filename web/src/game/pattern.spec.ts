import { describe, it, expect } from "vitest";
import {
  rotatePattern,
  directionFromDelta,
  applyPatternToTile,
  patternBounds,
  type AttackPattern,
} from "./pattern";

const LINE: AttackPattern = [
  { col: 1, row: 0 },
  { col: 2, row: 0 },
  { col: 3, row: 0 },
];

const FAN: AttackPattern = [
  { col: 1, row: -1 },
  { col: 1, row: 0 },
  { col: 1, row: 1 },
];

describe("rotatePattern", () => {
  it("right は正規形そのまま", () => {
    expect(rotatePattern(LINE, "right")).toEqual(LINE);
  });

  it("down は (c, r) → (-r, c)", () => {
    expect(rotatePattern(LINE, "down")).toEqual([
      { col: 0, row: 1 },
      { col: 0, row: 2 },
      { col: 0, row: 3 },
    ]);
  });

  it("left は 180°回転", () => {
    expect(rotatePattern(LINE, "left")).toEqual([
      { col: -1, row: 0 },
      { col: -2, row: 0 },
      { col: -3, row: 0 },
    ]);
  });

  it("up は (c, r) → (r, -c)", () => {
    expect(rotatePattern(LINE, "up")).toEqual([
      { col: 0, row: -1 },
      { col: 0, row: -2 },
      { col: 0, row: -3 },
    ]);
  });

  it("ファン形パターンも 4 方向で整合する", () => {
    expect(rotatePattern(FAN, "down")).toEqual([
      { col: 1, row: 1 },
      { col: 0, row: 1 },
      { col: -1, row: 1 },
    ]);
    expect(rotatePattern(FAN, "left")).toEqual([
      { col: -1, row: 1 },
      { col: -1, row: 0 },
      { col: -1, row: -1 },
    ]);
    expect(rotatePattern(FAN, "up")).toEqual([
      { col: -1, row: -1 },
      { col: 0, row: -1 },
      { col: 1, row: -1 },
    ]);
  });

  it("4 回回転すると元に戻る", () => {
    const rotated4x = rotatePattern(
      rotatePattern(rotatePattern(rotatePattern(LINE, "down"), "down"), "down"),
      "down",
    );
    // 4 回 90°回転 = 元
    expect(rotated4x).toEqual(LINE);
  });
});

describe("directionFromDelta", () => {
  it("右が水平に大きいときは right", () => {
    expect(directionFromDelta(50, 10)).toBe("right");
  });
  it("左が水平に大きいときは left", () => {
    expect(directionFromDelta(-50, 10)).toBe("left");
  });
  it("下が垂直に大きいときは down", () => {
    expect(directionFromDelta(5, 80)).toBe("down");
  });
  it("上が垂直に大きいときは up", () => {
    expect(directionFromDelta(5, -80)).toBe("up");
  });
  it("水平と垂直が同じなら水平を優先（right/left）", () => {
    expect(directionFromDelta(30, 30)).toBe("right");
    expect(directionFromDelta(-30, -30)).toBe("left");
  });
  it("ゼロベクトルでも例外を投げず right にスナップ", () => {
    expect(directionFromDelta(0, 0)).toBe("right");
  });
});

describe("applyPatternToTile", () => {
  it("ヒーロータイルにオフセットを足した絶対座標を返す", () => {
    const tiles = applyPatternToTile({ col: 5, row: 3 }, LINE);
    expect(tiles).toEqual([
      { col: 6, row: 3 },
      { col: 7, row: 3 },
      { col: 8, row: 3 },
    ]);
  });
});

describe("patternBounds", () => {
  it("空パターンなら全 0", () => {
    expect(patternBounds([])).toEqual({
      minCol: 0,
      maxCol: 0,
      minRow: 0,
      maxRow: 0,
    });
  });
  it("ファン形のバウンディング", () => {
    expect(patternBounds(FAN)).toEqual({
      minCol: 1,
      maxCol: 1,
      minRow: -1,
      maxRow: 1,
    });
  });
});
