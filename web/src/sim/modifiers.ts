/**
 * SPEC-108: スキルツリーからランに持ち込む補正値。すべて加算で合成する。
 * 0 のとき「補正なし」。RunSim はこの値だけを見る（ツリーの構造は知らない）。
 */
export interface RunModifiers {
  // 弓
  damagePct: number;
  attackSpeedPct: number;
  rangeAdd: number;
  critChance: number;
  critMulAdd: number;
  extraShotChance: number;
  bossDamagePct: number;
  /** 1 以上で「最大 3 体に同時射撃（1 本あたり ×VOLLEY_DAMAGE）」 */
  volley: number;
  placeCostFlat: number;
  levelCostPct: number;
  /** 所持 GUM 100 ごとの攻撃力補正（上限 WEALTH_CAP） */
  wealthDamagePct: number;
  // 幻獣
  maxHpAdd: number;
  healPerWave: number;
  regenPerSec: number;
  leakIgnoreChance: number;
  /** 1 以上で「ボスの到達を 1 回だけ HP 1 で耐える」 */
  lastStand: number;
  // 経済
  startGumAdd: number;
  /** 撃破時の GUM に加算（小さな報酬でも効くよう固定値） */
  dropValueFlat: number;
  collectRadiusAdd: number;
  dropLifetimeAdd: number;
  waveRewardPct: number;
  gumOnHitChance: number;
}

export type ModifierKey = keyof RunModifiers;

export const VOLLEY_TARGETS = 3;
export const VOLLEY_DAMAGE = 0.55;
export const WEALTH_CAP = 0.3;
export const BASE_CRIT_MUL = 2;

export function emptyModifiers(): RunModifiers {
  return {
    damagePct: 0,
    attackSpeedPct: 0,
    rangeAdd: 0,
    critChance: 0,
    critMulAdd: 0,
    extraShotChance: 0,
    bossDamagePct: 0,
    volley: 0,
    placeCostFlat: 0,
    levelCostPct: 0,
    wealthDamagePct: 0,
    maxHpAdd: 0,
    healPerWave: 0,
    regenPerSec: 0,
    leakIgnoreChance: 0,
    lastStand: 0,
    startGumAdd: 0,
    dropValueFlat: 0,
    collectRadiusAdd: 0,
    dropLifetimeAdd: 0,
    waveRewardPct: 0,
    gumOnHitChance: 0,
  };
}
