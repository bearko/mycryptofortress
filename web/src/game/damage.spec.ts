import { describe, it, expect } from "vitest";
import { calculateDamage } from "./damage";

/**
 * Unity 版の挙動を踏襲したテスト。注意:
 * 元の `Bullet.cs` の式は `damageCutRate = (100 - def/2)/100` の上限 0.4 でクランプしており、
 * 防御値が大きいほどカット率が下がる（＝より多くダメージが通る）という直感と逆の関係になっている。
 * MVP ではあえてこの挙動をそのまま移植する（修正は別 SPEC）。
 */
describe("calculateDamage (PHY/INT)", () => {
  it("低防御の敵にはカット率上限 0.4 が適用される（PHY）", () => {
    // def=4 → rawCut=(100-2)/100=0.98 → cap=0.4 → multiplier=0.6
    const damage = calculateDamage({
      attackType: "PHY",
      heroPhy: 25,
      heroInt: 0,
      enemyPhyDef: 4,
      enemyIntDef: 999,
    });
    expect(damage).toBeCloseTo(25 * 0.6, 5);
  });

  it("中程度の防御ではカット率がそのまま使われる（PHY）", () => {
    // def=140 → rawCut=(100-70)/100=0.3 → multiplier=0.7
    const damage = calculateDamage({
      attackType: "PHY",
      heroPhy: 100,
      heroInt: 0,
      enemyPhyDef: 140,
      enemyIntDef: 0,
    });
    expect(damage).toBeCloseTo(100 * 0.7, 5);
  });

  it("高防御ではカット率が 0 になり、フルダメージが通る（PHY）", () => {
    // def=200 → rawCut=0 → multiplier=1.0
    const damage = calculateDamage({
      attackType: "PHY",
      heroPhy: 50,
      heroInt: 0,
      enemyPhyDef: 200,
      enemyIntDef: 0,
    });
    expect(damage).toBeCloseTo(50, 5);
  });

  it("damageRate が反映される", () => {
    const damage = calculateDamage({
      attackType: "PHY",
      heroPhy: 100,
      heroInt: 0,
      enemyPhyDef: 140,
      enemyIntDef: 0,
      damageRate: 2,
    });
    // base=200, cut=0.3, total=200*0.7=140
    expect(damage).toBeCloseTo(140, 5);
  });

  it("INT 攻撃は INT 系のステータスを参照する", () => {
    const damage = calculateDamage({
      attackType: "INT",
      heroPhy: 999,
      heroInt: 50,
      enemyPhyDef: 0,
      enemyIntDef: 4,
    });
    expect(damage).toBeCloseTo(50 * 0.6, 5);
  });

  it("カット率が負にならない（極端に大きい防御）", () => {
    const damage = calculateDamage({
      attackType: "PHY",
      heroPhy: 100,
      heroInt: 0,
      enemyPhyDef: 1000,
      enemyIntDef: 0,
    });
    // rawCut=(100-500)/100=-4 → max(0,...) → multiplier=1.0
    expect(damage).toBeCloseTo(100, 5);
  });
});
