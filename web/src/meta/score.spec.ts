import { describe, expect, it } from "vitest";
import { levelScoreMetrics } from "./score";

describe("SPEC-121 総合スコアの成績", () => {
  it("クリアの成績をそのまま送る", () => {
    expect(levelScoreMetrics({ levelId: "L9", won: true, hp: 2, maxHp: 3, heroesUsed: 7, slots: 15 })).toEqual({ levelId: "L9", won: true, hpLeft: 2, maxHp: 3, heroesUsed: 7, slots: 15 });
  });
  it("範囲に収める（クリアなら体力は 1 以上、ヒーローはスロット数まで）", () => {
    const m = levelScoreMetrics({ levelId: "L1", won: true, hp: 0.4, maxHp: 3, heroesUsed: 99, slots: 12 });
    expect([m.hpLeft, m.heroesUsed]).toEqual([1, 12]);
    expect(levelScoreMetrics({ levelId: "L2", won: false, hp: -2, maxHp: 3, heroesUsed: 3, slots: 12 }).hpLeft).toBe(0);
  });
});
