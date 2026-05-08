import type { AttackType } from "./types";

/**
 * SPEC-009 §5.2: ダメージ式（修正版）
 *
 *   PHYダメージ = (攻撃側 PHY 攻撃力 × ダメージ係数) × (1 − 対象 PHY 防御力 / 200)
 *   INTダメージ = (攻撃側 INT 攻撃力 × ダメージ係数) × (1 − 対象 INT 防御力 / 200)
 *
 * SPEC-001 までは Unity 版 `Bullet.cs` の「(100 − def/2)/100 を 0.4 で上限カット」
 * という挙動を踏襲していた。あれは `damageCutRate` 名なのに「高防御 = カット率小」
 * の逆向き定数で、実質「防御値が大きいほど受けるダメージが多い」という原作のバグ。
 * 設計ドキュメントでは「(100% − [def/2]%)」となっており、こちらが正しい意図。
 * SPEC-009 で正式に直す。
 *
 * - クランプ: ダメージ倍率は [0, 1] の範囲（防御 0 で 1.0 倍、防御 200 以上で 0）
 * - `damageRate` はスキル等によるダメージ係数（例: シャーロック・ホームズ 1.5 倍）
 */
export function calculateDamage(params: {
  attackType: AttackType;
  /** 攻撃側 PHY 攻撃力（Unity の `phyAttackHero` / 旧 `heroPhy` に相当） */
  heroPhy: number;
  heroInt: number;
  /** 対象 PHY 防御力（攻撃を受ける側） */
  enemyPhyDef: number;
  enemyIntDef: number;
  damageRate?: number;
}): number {
  const damageRate = params.damageRate ?? 1;
  const def =
    params.attackType === "PHY" ? params.enemyPhyDef : params.enemyIntDef;
  const atk =
    params.attackType === "PHY" ? params.heroPhy : params.heroInt;

  // 防御による被ダメージ率は (1 − def/200) を 0..1 にクランプ
  const damageMultiplier = Math.max(0, Math.min(1, 1 - def / 200));
  return atk * damageRate * damageMultiplier;
}

/**
 * SPEC-009 §5.3: 回復式
 *
 *   INT 回復量 = ((発動側 INT 攻撃力 + 対象 PHY 防御力) / 2) × 回復係数
 *   PHY 回復量 = ((発動側 PHY 攻撃力 + 対象 INT 防御力) / 2) × 回復係数
 *
 * 対象の防御力を「素養」として使う設計（INT 回復は対象の身体的耐久=PHY防御を補う、
 * PHY 回復は対象の精神的耐久=INT防御を補う、というアルケミ風の交差設計）。
 */
export function calculateHeal(params: {
  attackType: AttackType;
  /** 発動側ヒーローの PHY 攻撃力 */
  casterPhy: number;
  /** 発動側ヒーローの INT 攻撃力 */
  casterInt: number;
  /** 回復対象ヒーローの PHY 防御力 */
  targetPhyDef: number;
  /** 回復対象ヒーローの INT 防御力 */
  targetIntDef: number;
  /** 回復係数（1.0 = 100%） */
  healRate?: number;
}): number {
  const rate = params.healRate ?? 1;
  if (params.attackType === "INT") {
    // INT 回復: caster.INT + target.PHY 防御
    return ((params.casterInt + params.targetPhyDef) / 2) * rate;
  } else {
    // PHY 回復: caster.PHY + target.INT 防御
    return ((params.casterPhy + params.targetIntDef) / 2) * rate;
  }
}
