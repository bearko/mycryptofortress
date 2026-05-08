import { describe, it, expect } from "vitest";
import { POISON_DAMAGE_PER_SEC, TILE_INFO } from "./tileInfo";
import type { MapTileType } from "./types";

describe("TILE_INFO (SPEC-010 §5.4)", () => {
  const allTypes: MapTileType[] = [
    "path",
    "wall",
    "obstacle",
    "poison",
    "path_blocked",
  ];

  it("全タイル種別にエントリがある", () => {
    for (const t of allTypes) {
      expect(TILE_INFO[t]).toBeDefined();
      expect(TILE_INFO[t].label.length).toBeGreaterThan(0);
      expect(TILE_INFO[t].description.length).toBeGreaterThan(0);
    }
  });

  it("path / wall は配置可能職業を持つ、特殊タイルは持たない", () => {
    expect(TILE_INFO.path.placeable.length).toBe(4);
    expect(TILE_INFO.wall.placeable.length).toBe(4);
    expect(TILE_INFO.obstacle.placeable.length).toBe(0);
    expect(TILE_INFO.poison.placeable.length).toBe(0);
    expect(TILE_INFO.path_blocked.placeable.length).toBe(0);
  });

  it("path 系職業 4 種は path にだけ含まれる", () => {
    const pathClasses = TILE_INFO.path.placeable;
    expect(pathClasses).toEqual(
      expect.arrayContaining(["defender", "guard", "vanguard", "specialist"]),
    );
    expect(TILE_INFO.wall.placeable).not.toEqual(
      expect.arrayContaining(["defender"]),
    );
  });

  it("POISON_DAMAGE_PER_SEC は正の数", () => {
    expect(POISON_DAMAGE_PER_SEC).toBeGreaterThan(0);
  });
});
