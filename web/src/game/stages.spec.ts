import { describe, it, expect } from "vitest";
import {
  ALL_WORLDS,
  DEFAULT_STAGE_ID,
  WORLD_1,
  findStage,
  findWorld,
} from "./stages";

describe("stages.ts (SPEC-011)", () => {
  it("World 1 戦国時代 が存在し、5 以下のステージを持つ", () => {
    expect(WORLD_1.id).toBe("world-1");
    expect(WORLD_1.era).toBe("戦国");
    expect(WORLD_1.stages.length).toBeGreaterThan(0);
    expect(WORLD_1.stages.length).toBeLessThanOrEqual(5);
  });

  it("ALL_WORLDS で全ワールドにアクセス可能", () => {
    expect(ALL_WORLDS.length).toBeGreaterThan(0);
    expect(ALL_WORLDS).toContain(WORLD_1);
  });

  it("findStage で id 検索ができる", () => {
    expect(findStage("1-1")?.name).toContain("1-1");
    expect(findStage("1-2")?.name).toContain("1-2");
    expect(findStage("does-not-exist")).toBeUndefined();
  });

  it("findWorld で id 検索ができる", () => {
    expect(findWorld("world-1")?.name).toBe("戦国時代");
    expect(findWorld("world-99")).toBeUndefined();
  });

  it("各ステージが MapDef + Wave + worldId を持つ", () => {
    for (const w of ALL_WORLDS) {
      for (const s of w.stages) {
        expect(s.worldId).toBe(w.id);
        expect(s.map.cols).toBeGreaterThan(0);
        expect(s.map.rows).toBeGreaterThan(0);
        expect(s.wave.patterns.length).toBeGreaterThan(0);
      }
    }
  });

  it("DEFAULT_STAGE_ID で findStage が成功する", () => {
    expect(findStage(DEFAULT_STAGE_ID)).toBeDefined();
  });

  it("ステージ 1-3 は毒沼 3 マスを Route B に持つ", () => {
    const s = findStage("1-3");
    expect(s).toBeDefined();
    if (!s) return;
    const row6 = s.map.tiles[6];
    expect(row6[3]).toBe("poison");
    expect(row6[5]).toBe("poison");
    expect(row6[7]).toBe("poison");
  });
});
