import type { AttackType } from "./types";

/**
 * Unity 版 `Bullet.cs` を踏襲したダメージ式。
 *
 * PHY:
 *   damageCutRate = min((100 - enemyPhyDef / 2) / 100, 0.4)
 *   baseDamage    = heroPhy * damageRate
 *   total         = baseDamage * (1 - damageCutRate)
 *
 * INT も同様（PHY を INT に置換）。
 *
 * Unity 版の実装は `(100 - def/2) > 40` を「上限 0.4」で扱っていた。
 * これは「カット率が 40% を超えるなら 40% にクランプ」という挙動なので、
 * `Math.min(rate, 0.4)` で再現する。下限は 0（負のカット率を許さない）。
 */
export function calculateDamage(params: {
  attackType: AttackType;
  heroPhy: number;
  heroInt: number;
  enemyPhyDef: number;
  enemyIntDef: number;
  damageRate?: number;
}): number {
  const damageRate = params.damageRate ?? 1;
  const def =
    params.attackType === "PHY" ? params.enemyPhyDef : params.enemyIntDef;
  const atk =
    params.attackType === "PHY" ? params.heroPhy : params.heroInt;

  const rawCut = (100 - def / 2) / 100;
  const damageCutRate = Math.max(0, Math.min(rawCut, 0.4));
  const baseDamage = atk * damageRate;
  return baseDamage * (1 - damageCutRate);
}
