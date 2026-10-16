import { afterEach, describe, expect, it, vi } from "vitest";
import { initPlatform, reportLevelResult } from "./platform";

describe("SPEC-120 共通基盤 SDK への窓口", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("SDK がなくても例外を出さない", () => {
    expect(() => initPlatform("0.2.0")).not.toThrow();
    expect(() => reportLevelResult("L1", true)).not.toThrow();
  });

  it("SDK があれば unlockTrophy を呼び、失敗・例外でもゲームを止めない", async () => {
    const sent: string[] = [];
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("window", {
      BearkoGames: {
        init: async () => ({ ok: true }),
        unlockTrophy: async (id: string) => (sent.push(id), { ok: id !== "fortress.clear", error: "network" }),
      },
    });
    initPlatform("0.2.0");
    reportLevelResult("L1", true);
    reportLevelResult("L9", true);
    reportLevelResult("L5", false);
    await new Promise((r) => setTimeout(r, 0));
    expect(sent).toEqual(["fortress.level01", "fortress.clear"]);
    expect(warn).toHaveBeenCalled();
    (window as unknown as { BearkoGames: { unlockTrophy: () => never } }).BearkoGames.unlockTrophy = () => {
      throw new Error("boom");
    };
    expect(() => reportLevelResult("L1", true)).not.toThrow();
    warn.mockRestore();
  });
});
