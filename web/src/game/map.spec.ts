import { describe, it, expect } from "vitest";
import {
  STAGE1_MAP,
  STAGE1_WAVE,
  blockMaxFor,
  canPlaceClassOnTile,
  distanceToGoal,
  findRoute,
  isPathClass,
  placementTileFor,
  pixelToTile,
  routeProgress,
  tileToPixel,
  tileTypeAt,
  TILE_SIZE,
} from "./map";

describe("placementTileFor / blockMaxFor", () => {
  it("path 系職業は path に置け、ブロック数が 1 以上", () => {
    for (const c of ["defender", "guard", "vanguard", "specialist"] as const) {
      expect(placementTileFor(c)).toBe("path");
      expect(blockMaxFor(c)).toBeGreaterThanOrEqual(1);
    }
  });

  it("wall 系職業は wall に置け、ブロック 0", () => {
    for (const c of ["sniper", "caster", "medic", "supporter"] as const) {
      expect(placementTileFor(c)).toBe("wall");
      expect(blockMaxFor(c)).toBe(0);
    }
  });

  it("重装 = 3、前衛 = 2、先鋒 / 特殊 = 1", () => {
    expect(blockMaxFor("defender")).toBe(3);
    expect(blockMaxFor("guard")).toBe(2);
    expect(blockMaxFor("vanguard")).toBe(1);
    expect(blockMaxFor("specialist")).toBe(1);
  });
});

describe("isPathClass (SPEC-005 §5.2)", () => {
  it("path 系職業は true", () => {
    for (const c of ["defender", "guard", "vanguard", "specialist"] as const) {
      expect(isPathClass(c)).toBe(true);
    }
  });
  it("wall 系職業は false", () => {
    for (const c of ["sniper", "caster", "medic", "supporter"] as const) {
      expect(isPathClass(c)).toBe(false);
    }
  });
});

describe("canPlaceClassOnTile マトリクス", () => {
  const cases: { cls: any; tile: any; ok: boolean }[] = [
    { cls: "defender", tile: "path", ok: true },
    { cls: "defender", tile: "wall", ok: false },
    { cls: "defender", tile: "obstacle", ok: false },
    { cls: "sniper", tile: "wall", ok: true },
    { cls: "sniper", tile: "path", ok: false },
    { cls: "vanguard", tile: "path", ok: true },
    { cls: "medic", tile: "obstacle", ok: false },
  ];
  for (const c of cases) {
    it(`${c.cls} on ${c.tile} → ${c.ok}`, () => {
      expect(canPlaceClassOnTile(c.cls, c.tile)).toBe(c.ok);
    });
  }
});

describe("Stage1-1 v2 MapDef", () => {
  it("10 列 × 8 行で、A / B の 2 経路が始端から終端まで通っている", () => {
    expect(STAGE1_MAP.cols).toBe(10);
    expect(STAGE1_MAP.rows).toBe(8);
    expect(STAGE1_MAP.routes.map((r) => r.id).sort()).toEqual(["A", "B"]);
    const a = findRoute(STAGE1_MAP, "A")!;
    const b = findRoute(STAGE1_MAP, "B")!;
    expect(a.points[0]).toEqual({ col: 0, row: 1 });
    expect(a.points[a.points.length - 1]).toEqual({ col: 9, row: 1 });
    expect(b.points[0]).toEqual({ col: 0, row: 6 });
    expect(b.points[b.points.length - 1]).toEqual({ col: 9, row: 6 });
  });

  it("ルート上は path、壁帯 (row 2, 5) は wall、その他は obstacle", () => {
    expect(tileTypeAt(STAGE1_MAP, { col: 5, row: 1 })).toBe("path");
    expect(tileTypeAt(STAGE1_MAP, { col: 5, row: 6 })).toBe("path");
    expect(tileTypeAt(STAGE1_MAP, { col: 5, row: 2 })).toBe("wall");
    expect(tileTypeAt(STAGE1_MAP, { col: 5, row: 5 })).toBe("wall");
    expect(tileTypeAt(STAGE1_MAP, { col: 5, row: 3 })).toBe("obstacle");
    expect(tileTypeAt(STAGE1_MAP, { col: 0, row: 0 })).toBe("obstacle");
  });

  it("壁帯の端 2 マスは obstacle", () => {
    expect(tileTypeAt(STAGE1_MAP, { col: 0, row: 2 })).toBe("obstacle");
    expect(tileTypeAt(STAGE1_MAP, { col: 9, row: 2 })).toBe("obstacle");
  });

  it("範囲外は null", () => {
    expect(tileTypeAt(STAGE1_MAP, { col: -1, row: 0 })).toBeNull();
    expect(tileTypeAt(STAGE1_MAP, { col: 10, row: 0 })).toBeNull();
    expect(tileTypeAt(STAGE1_MAP, { col: 0, row: 8 })).toBeNull();
  });
});

describe("STAGE1_WAVE", () => {
  it("6 体スポーンし、A / B の routeId が振られている", () => {
    expect(STAGE1_WAVE.patterns.length).toBe(6);
    expect(STAGE1_WAVE.patterns.every((p) => p.routeId === "A" || p.routeId === "B")).toBe(true);
  });
});

describe("tile <-> pixel", () => {
  it("中心座標と逆変換が往復する", () => {
    const p = tileToPixel({ col: 4, row: 2 });
    expect(p.x).toBe(4 * TILE_SIZE + TILE_SIZE / 2);
    expect(p.y).toBe(2 * TILE_SIZE + TILE_SIZE / 2);
    const t = pixelToTile(p.x, p.y, 10, 8);
    expect(t).toEqual({ col: 4, row: 2 });
  });

  it("マップ範囲外は null", () => {
    expect(pixelToTile(-10, 0, 10, 8)).toBeNull();
    expect(pixelToTile(0, 8 * TILE_SIZE + 1, 10, 8)).toBeNull();
  });
});

describe("routeProgress", () => {
  const route = findRoute(STAGE1_MAP, "A")!;

  it("開始直後は 0", () => {
    expect(routeProgress(route, 1, route.points[0].col * TILE_SIZE + TILE_SIZE / 2, route.points[0].row * TILE_SIZE + TILE_SIZE / 2)).toBe(0);
  });

  it("最初のセグメントの中央で 0.5 になる", () => {
    const a = tileToPixel(route.points[0]);
    const b = tileToPixel(route.points[1]);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const p = routeProgress(route, 1, mid.x, mid.y);
    expect(p).toBeCloseTo(0.5, 5);
  });

  it("ゴール側に進むほど大きい値", () => {
    const a = tileToPixel(route.points[0]);
    const b = tileToPixel(route.points[1]);
    const near = { x: a.x + (b.x - a.x) * 0.2, y: a.y };
    const far = { x: a.x + (b.x - a.x) * 0.8, y: a.y };
    expect(routeProgress(route, 1, near.x, near.y)).toBeLessThan(
      routeProgress(route, 1, far.x, far.y),
    );
  });
});

describe("distanceToGoal", () => {
  const route = findRoute(STAGE1_MAP, "A")!;

  it("ゴール上では 0、開始上では正の値", () => {
    const goal = tileToPixel(route.points[route.points.length - 1]);
    expect(distanceToGoal(route, route.points.length - 1, goal.x, goal.y)).toBe(0);
    const start = tileToPixel(route.points[0]);
    expect(distanceToGoal(route, 1, start.x, start.y)).toBeGreaterThan(0);
  });
});
