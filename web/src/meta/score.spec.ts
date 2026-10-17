import { describe, expect, it } from "vitest";
import { LEVELS } from "../data/levels";
import { applyRunResult } from "./progress";
import { createNewSave, type LevelBest, type SaveData } from "./save";
import { applyLevelBest, levelBestOf, levelPoints, scoreMetrics, totalPoints } from "./score";

const TYPICAL: LevelBest = { hpLeft: 2, maxHp: 3, heroesUsed: 7, slots: 15, earlyBonus: 0 };
const cleared = (save: SaveData, levelId: string): SaveData =>
  applyRunResult(save, { levelId, won: true, wavesReached: 10, wavesCleared: 10 }, { ce: 0, emblems: 0, breakdown: [], firstClear: false });

describe("SPEC-122 総合スコア v2（レベルごとの自己ベスト）", () => {
  it("クリアの成績を範囲に収める（体力は 1 以上、ヒーローはスロット数まで、ボーナスは整数）", () => {
    expect(levelBestOf({ hp: 0.4, maxHp: 3, heroesUsed: 99, slots: 12, earlyBonus: 10.6 })).toEqual({ hpLeft: 1, maxHp: 3, heroesUsed: 12, slots: 12, earlyBonus: 11 });
  });

  it("点は共通基盤（fortress.v2.js）と同じ：ふつうのクリアで L1 は 1,000、全レベルで 10,000", () => {
    expect(Math.round(levelPoints("L1", TYPICAL))).toBe(1000);
    const all = LEVELS.reduce((s, l) => s + levelPoints(l.id, TYPICAL), 0);
    expect(Math.round(all)).toBe(10000);
    expect(levelPoints("L3", { ...TYPICAL, earlyBonus: 300 }) - levelPoints("L3", TYPICAL)).toBe(300);
  });

  it("点が上がったときだけ自己ベストを書きかえ、送る成績はクリアしたレベルの自己ベストだけ", () => {
    let save = cleared(cleared(createNewSave(), "L1"), "L2");
    expect(scoreMetrics(save)).toEqual({ levels: {} }); // v6 のころのクリア（成績なし）は送らない
    let r = applyLevelBest(save, "L1", TYPICAL);
    expect(r.improved).toBe(true);
    save = r.save;
    r = applyLevelBest(save, "L1", { ...TYPICAL, hpLeft: 1 });
    expect(r.improved).toBe(false);
    r = applyLevelBest(save, "L1", { ...TYPICAL, earlyBonus: 50 });
    expect(r.improved).toBe(true);
    save = r.save;
    expect(scoreMetrics(save)).toEqual({ levels: { L1: { ...TYPICAL, earlyBonus: 50 } } });
    expect(totalPoints(save)).toBe(1050);
    expect(applyLevelBest(save, "L5", TYPICAL).improved).toBe(false); // 遊んでいないレベルには付けない
  });

  it("ランの結果を反映しても自己ベストは消えない", () => {
    const save = cleared(applyLevelBest(cleared(createNewSave(), "L1"), "L1", TYPICAL).save, "L1");
    expect(save.meta.levels.L1.best).toEqual(TYPICAL);
    expect(save.meta.levels.L1.clears).toBe(2);
  });
});
