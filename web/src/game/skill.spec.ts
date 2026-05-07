import { describe, it, expect } from "vitest";
import {
  GAUGE_MAX,
  GAUGE_PER_ATTACK,
  GAUGE_TIME_RATE,
  SKILLS,
  canActivate,
  effectiveDamageRate,
  findSkill,
  gainOnAttack,
  intervalScale,
  isEffectActive,
  startEffect,
  tickGauge,
} from "./skill";

describe("SKILLS テーブル", () => {
  it("Common 8 体ぶんの skill が定義されている", () => {
    expect(SKILLS.length).toBe(8);
    const ids = SKILLS.map((s) => s.heroId).sort();
    expect(ids).toEqual([1001, 1002, 1003, 1004, 1006, 1007, 1008, 1009]);
  });

  it("各 skill は heroId / name / cost が必須", () => {
    for (const s of SKILLS) {
      expect(s.heroId).toBeTypeOf("number");
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.cost).toBe(100);
    }
  });

  it("singleStrike は durationSec=0、それ以外は >0", () => {
    for (const s of SKILLS) {
      if (s.effectType === "singleStrike") expect(s.durationSec).toBe(0);
      else expect(s.durationSec).toBeGreaterThan(0);
    }
  });

  it("findSkill で取得できる", () => {
    expect(findSkill(1001)?.name).toBe("シャーロック・ホームズ");
    expect(findSkill(9999)).toBeUndefined();
  });
});

describe("ゲージ蓄積", () => {
  it("時間で蓄積し、上限 100 でクランプ", () => {
    let g = 0;
    g = tickGauge(g, 1.0); // +5
    expect(g).toBe(5);
    g = tickGauge(g, 100); // jump to 505 → clamp 100
    expect(g).toBe(GAUGE_MAX);
  });

  it("攻撃発射時に固定値が加算される", () => {
    expect(gainOnAttack(0)).toBe(GAUGE_PER_ATTACK);
    expect(gainOnAttack(95)).toBe(GAUGE_MAX);
  });

  it("レート定数の確認", () => {
    expect(GAUGE_TIME_RATE).toBe(5);
    expect(GAUGE_PER_ATTACK).toBe(8);
  });

  it("canActivate は cost を満たす時のみ true", () => {
    expect(canActivate(99)).toBe(false);
    expect(canActivate(100)).toBe(true);
    expect(canActivate(150)).toBe(true);
  });
});

describe("ActiveSkillState の発動と期限", () => {
  it("damageMultiplier 効果が duration の間だけ有効", () => {
    const skill = findSkill(1001)!; // シャーロック・ホームズ 1.5x / 8s
    const state = startEffect(skill, 10);
    expect(state.startedAt).toBe(10);
    expect(state.endsAt).toBe(18);
    expect(isEffectActive(state, 12)).toBe(true);
    expect(isEffectActive(state, 18)).toBe(false); // 切れる瞬間 = false
    expect(isEffectActive(state, 20)).toBe(false);
    expect(effectiveDamageRate(state, 12)).toBe(1.5);
    expect(effectiveDamageRate(state, 20)).toBe(1.0);
  });

  it("agiBuff 効果は intervalScale を 1/value にする", () => {
    const skill = findSkill(1002)!; // 浪切 1.5x / 6s
    const state = startEffect(skill, 0);
    expect(intervalScale(state, 1)).toBeCloseTo(1 / 1.5, 5);
    expect(intervalScale(state, 7)).toBe(1.0); // 切れた後
    expect(effectiveDamageRate(state, 1)).toBe(1.0); // damage は影響なし
  });

  it("singleStrike は isEffectActive が常に false", () => {
    const skill = findSkill(1003)!; // 遼来遼来
    const state = startEffect(skill, 0);
    expect(state.endsAt).toBe(0);
    expect(isEffectActive(state, 0)).toBe(false);
    expect(isEffectActive(state, 0.5)).toBe(false);
  });

  it("state が null のときも安全", () => {
    expect(effectiveDamageRate(null, 0)).toBe(1.0);
    expect(intervalScale(null, 0)).toBe(1.0);
    expect(isEffectActive(null, 0)).toBe(false);
  });
});

describe("職業別スキル割り当て (SPEC-004 §5.2 の検算)", () => {
  it("supporter コナン: damageMultiplier 1.5 / 8s", () => {
    const s = findSkill(1001)!;
    expect(s.effectType).toBe("damageMultiplier");
    expect(s.value).toBe(1.5);
    expect(s.durationSec).toBe(8);
  });
  it("vanguard 甲斐姫: agiBuff 1.5 / 6s", () => {
    const s = findSkill(1002)!;
    expect(s.effectType).toBe("agiBuff");
    expect(s.value).toBe(1.5);
  });
  it("sniper 張遼: singleStrike 3.0", () => {
    const s = findSkill(1003)!;
    expect(s.effectType).toBe("singleStrike");
    expect(s.value).toBe(3.0);
  });
  it("specialist ヘルクレス: enemyDefDebuff 0.5 / 6s", () => {
    const s = findSkill(1009)!;
    expect(s.effectType).toBe("enemyDefDebuff");
    expect(s.value).toBe(0.5);
  });
});
