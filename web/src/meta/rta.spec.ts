import { describe, expect, it } from "vitest";
import { DIALOGS } from "../data/dialogs";
import { LEVELS } from "../data/levels";
import { createNewSave } from "./save";
import { checkpointFor, isFinished, newRtaState, recordRun, rtaSave, RTA_REGULATION, RTA_SPEED } from "./rta";

describe("SPEC-123 RTA（レベル 01〜09）", () => {
  it("レギュレーションと倍速", () => {
    expect(RTA_REGULATION).toBe("fortress-all");
    expect(RTA_SPEED).toBe(3);
  });

  it("区切りは各レベルの最初のクリア。順番どおりで、最後は clear", () => {
    let st = newRtaState();
    const sent: string[] = [];
    const play = (levelId: string, won: boolean) => {
      const r = recordRun(st, levelId, won, 60_000);
      st = r.state;
      if (r.checkpoint) sent.push(r.checkpoint);
    };
    play("L1", false); // 負けは送らない
    play("L1", true);
    play("L1", true); // 2 回目のクリアは送らない
    play("L3", true); // 順番どおりでない
    for (const l of LEVELS.slice(1)) play(l.id, true);
    expect(sent).toEqual(["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "clear"]);
    expect(isFinished(st)).toBe(true);
    expect(st.igtMs).toBe((4 + LEVELS.length - 1) * 60_000); // 負けたランも IGT に入る
    expect(checkpointFor(st, "L9")).toBeNull();
  });

  it("RTA のセーブは引き継ぎなし（音量と幻獣だけ引き継ぎ、会話は既読）", () => {
    const from = createNewSave();
    from.settings.bgmVolume = 0;
    from.settings.testSpeed = true;
    from.profile.cryptidId = "grape";
    from.meta.tokens.ce = 999;
    from.meta.tree = { root: 1 };
    from.meta.levels = { L1: { cleared: true, bestWave: 10, clears: 1, runs: 1 } };
    const s = rtaSave(from);
    expect(s.settings.bgmVolume).toBe(0);
    expect(s.settings.testSpeed).toBeUndefined();
    expect(s.profile.cryptidId).toBe(from.profile.cryptidId);
    expect([s.meta.tokens.ce, s.meta.tree, s.meta.levels]).toEqual([0, {}, {}]);
    expect(s.meta.seenDialogs).toEqual(Object.keys(DIALOGS));
  });
});
