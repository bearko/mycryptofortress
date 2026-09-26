import { getAsset } from "../data/assets";
import { LEVELS, getLevel } from "../data/levels";
import { pathCells, validateLevel, type LevelDef } from "./level";

const clone = (): LevelDef => structuredClone(getLevel("L1"));

describe("validateLevel (SPEC-103)", () => {
  it.each(LEVELS.map((l) => [l.id, l] as const))("%s は検査を通り、背景がマニフェストにある", (_, lv) => {
    expect(validateLevel(lv)).toEqual([]);
    expect(getAsset(lv.background).type).toBe("image");
  });

  it("斜めの経路を検出", () => {
    const lv = clone();
    lv.paths[0].points[1] = [2, 3];
    expect(validateLevel(lv).some((e) => e.includes("斜め"))).toBe(true);
  });

  it("終点が幻獣でない経路を検出", () => {
    const lv = clone();
    lv.paths[0].points.push([4, 11]);
    expect(validateLevel(lv).some((e) => e.includes("終点"))).toBe(true);
  });

  it("経路上・重複・盤面外のスロットを検出", () => {
    const lv = clone();
    lv.slots.push({ col: 3, row: 1 }, { ...lv.slots[0] }, { col: 20, row: 0 });
    const errs = validateLevel(lv).join("\n");
    expect(errs).toMatch(/経路上/);
    expect(errs).toMatch(/重複/);
    expect(errs).toMatch(/盤面外/);
  });

  it("未知の敵・経路と不正な数値を検出", () => {
    const lv = clone();
    lv.waves[0].groups.push({ enemy: "nope", count: 0, interval: 0, path: "nowhere", delay: -1 });
    const errs = validateLevel(lv).join("\n");
    for (const m of ["未知の敵", "未知の経路", "count", "interval", "delay"]) expect(errs).toContain(m);
  });

  it("pathCells は折れ線上のマスを重複なく返す（盤面外を除く）", () => {
    const cells = pathCells({ cols: 9, rows: 12 }, { id: "p", points: [[-1, 1], [1, 1], [1, 3]] });
    expect(cells).toEqual([
      { col: 0, row: 1 },
      { col: 1, row: 1 },
      { col: 1, row: 2 },
      { col: 1, row: 3 },
    ]);
  });
});
