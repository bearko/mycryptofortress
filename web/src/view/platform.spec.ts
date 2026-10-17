import { afterEach, describe, expect, it, vi } from "vitest";
import { abortRta, initPlatform, reportLevelResult, reportScore, rtaCheckpoint, startRta } from "./platform";

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

  it("SPEC-122/123: 総合スコアと RTA。SDK がない・失敗・例外でも止めない", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => reportScore({ levels: {} })).not.toThrow();
    expect(await startRta("fortress-all", 0)).toBe(false);
    expect(() => rtaCheckpoint("L1", 1000)).not.toThrow();
    expect(() => abortRta()).not.toThrow();

    const calls: unknown[][] = [];
    vi.stubGlobal("window", {
      BearkoGames: {
        init: async () => ({ ok: true }),
        unlockTrophy: async () => ({ ok: true }),
        submitScore: async (m: unknown) => (calls.push(["score", m]), { ok: true }),
        rta: {
          start: async (o: unknown) => (calls.push(["start", o]), { ok: true }),
          checkpoint: async (id: string, o: unknown) => (calls.push(["cp", id, o]), { ok: false, error: "order" }),
          abort: () => {
            throw new Error("boom");
          },
        },
      },
    });
    reportScore({ levels: { L1: { hpLeft: 2, maxHp: 3, heroesUsed: 7, slots: 15, earlyBonus: 0 } } });
    expect(await startRta("fortress-all", 0)).toBe(true);
    rtaCheckpoint("L1", 1234);
    expect(() => abortRta()).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toEqual([
      ["score", { levels: { L1: { hpLeft: 2, maxHp: 3, heroesUsed: 7, slots: 15, earlyBonus: 0 } } }],
      ["start", { regulation: "fortress-all", timer: "top", timerOffset: 0 }],
      ["cp", "L1", { igtMs: 1234 }],
    ]);
    (window as unknown as { BearkoGames: { rta: { start: () => never } } }).BearkoGames.rta.start = () => {
      throw new Error("boom");
    };
    expect(await startRta("fortress-all", 0)).toBe(false);
    warn.mockRestore();
  });
});
