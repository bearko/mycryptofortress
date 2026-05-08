import { describe, it, expect } from "vitest";
import { calculateDamage, calculateHeal } from "./damage";

/**
 * SPEC-009 §5.2 で式が修正された後のテスト。
 * 旧テストは Unity 版の「高防御 = 多ダメ」逆転バグを検証していたが、
 * 新仕様では `(1 − def/200)` の素直なダメージ率になっている。
 */
describe("calculateDamage (SPEC-009 直接式)", () => {
  it("防御 0 ではフルダメージが通る", () => {
    const damage = calculateDamage({
      attackType: "PHY",
      heroPhy: 25,
      heroInt: 0,
      enemyPhyDef: 0,
      enemyIntDef: 0,
    });
    expect(damage).toBeCloseTo(25, 5);
  });

  it("防御 100 でダメージは半減する", () => {
    const damage = calculateDamage({
      attackType: "PHY",
      heroPhy: 100,
      heroInt: 0,
      enemyPhyDef: 100,
      enemyIntDef: 0,
    });
    // 100 * (1 − 100/200) = 50
    expect(damage).toBeCloseTo(50, 5);
  });

  it("防御 200 以上で被ダメージ 0 にクランプ", () => {
    const d200 = calculateDamage({
      attackType: "PHY",
      heroPhy: 100,
      heroInt: 0,
      enemyPhyDef: 200,
      enemyIntDef: 0,
    });
    expect(d200).toBe(0);
    const d999 = calculateDamage({
      attackType: "PHY",
      heroPhy: 100,
      heroInt: 0,
      enemyPhyDef: 999,
      enemyIntDef: 0,
    });
    expect(d999).toBe(0);
  });

  it("防御 60 でも 70% は通る", () => {
    const damage = calculateDamage({
      attackType: "PHY",
      heroPhy: 100,
      heroInt: 0,
      enemyPhyDef: 60,
      enemyIntDef: 0,
    });
    // 100 * (1 − 60/200) = 70
    expect(damage).toBeCloseTo(70, 5);
  });

  it("damageRate が反映される", () => {
    const damage = calculateDamage({
      attackType: "PHY",
      heroPhy: 100,
      heroInt: 0,
      enemyPhyDef: 100,
      enemyIntDef: 0,
      damageRate: 1.5,
    });
    // 100 * 1.5 * 0.5 = 75
    expect(damage).toBeCloseTo(75, 5);
  });

  it("INT 攻撃は INT 系のステータスを参照する", () => {
    const damage = calculateDamage({
      attackType: "INT",
      heroPhy: 999,
      heroInt: 50,
      enemyPhyDef: 0,
      enemyIntDef: 100,
    });
    // 50 * (1 − 100/200) = 25 — INT 防御のみ参照
    expect(damage).toBeCloseTo(25, 5);
  });

  it("負のダメージにならない（防御 > 200 でも 0）", () => {
    const damage = calculateDamage({
      attackType: "PHY",
      heroPhy: 100,
      heroInt: 0,
      enemyPhyDef: 1000,
      enemyIntDef: 0,
    });
    expect(damage).toBeGreaterThanOrEqual(0);
  });
});

describe("calculateHeal (SPEC-009 §5.3)", () => {
  it("INT 回復は (caster.INT + target.PHY 防御) / 2 を基準にする", () => {
    const heal = calculateHeal({
      attackType: "INT",
      casterPhy: 0,
      casterInt: 100,
      targetPhyDef: 60,
      targetIntDef: 999,
    });
    // (100 + 60) / 2 = 80
    expect(heal).toBeCloseTo(80, 5);
  });

  it("PHY 回復は (caster.PHY + target.INT 防御) / 2 を基準にする", () => {
    const heal = calculateHeal({
      attackType: "PHY",
      casterPhy: 50,
      casterInt: 999,
      targetPhyDef: 999,
      targetIntDef: 30,
    });
    // (50 + 30) / 2 = 40
    expect(heal).toBeCloseTo(40, 5);
  });

  it("healRate が反映される", () => {
    const heal = calculateHeal({
      attackType: "INT",
      casterPhy: 0,
      casterInt: 100,
      targetPhyDef: 0,
      targetIntDef: 0,
      healRate: 0.5,
    });
    // (100 + 0) / 2 * 0.5 = 25
    expect(heal).toBeCloseTo(25, 5);
  });
});
