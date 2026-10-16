import { describe, expect, it } from "vitest";
import { LEVELS } from "../data/levels";
import { LEVEL_TROPHIES, trophyIdsForLevelClear } from "./trophies";

describe("SPEC-120 共通基盤のトロフィー", () => {
  it("L1・L5・L9 のクリアで送る（負け・撤退では送らない）", () => {
    expect(trophyIdsForLevelClear("L1", true)).toEqual(["fortress.level01"]);
    expect(trophyIdsForLevelClear("L5", true)).toEqual(["fortress.level05"]);
    expect(trophyIdsForLevelClear("L9", true)).toEqual(["fortress.clear"]);
    expect(trophyIdsForLevelClear("L2", true)).toEqual([]);
    expect(trophyIdsForLevelClear("L1", false)).toEqual([]);
  });

  it("対応表のレベルはすべて実在し、全クリアは最後のレベル", () => {
    const ids = LEVELS.map((l) => l.id);
    for (const levelId of Object.keys(LEVEL_TROPHIES)) expect(ids).toContain(levelId);
    expect(LEVEL_TROPHIES[ids[ids.length - 1]]).toBe("fortress.clear");
  });
});
