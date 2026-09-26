/**
 * SPEC-108: スキルツリーからランに持ち込む補正値。すべて加算で合成する。
 * 0 のとき「補正なし」。RunSim はこの値だけを見る（ツリーの構造は知らない）。
 * フラグ系（解放・交代など）は 1 以上で有効。
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
  /** 最大 3 体に同時射撃（1 本あたり ×VOLLEY_DAMAGE）。那須与一に交代 */
  volley: number;
  /** ウィリアム・テルに交代（フラグ） */
  archerHeavy: number;
  placeCostFlat: number;
  levelCostPct: number;
  /** 所持 GUM 100 ごとの攻撃力補正（上限 WEALTH_CAP） */
  wealthDamagePct: number;
  /** 命中時に毒を与える確率 */
  poisonChance: number;
  // 雷（SPEC-110）
  unlockLightning: number;
  lightningTesla: number;
  lightningDamagePct: number;
  lightningChains: number;
  lightningShock: number;
  dischargeStunAdd: number;
  /** 放電時に追加ダメージ（その雷の 1 撃 × 3） */
  arcFlash: number;
  // 結界（SPEC-111）
  unlockPulse: number;
  pulseZhuge: number;
  pulseDamagePct: number;
  pulseSlowAdd: number;
  pulseSlowDurAdd: number;
  pulseRangeAdd: number;
  pulseStunChance: number;
  // 炎（SPEC-112）
  unlockFire: number;
  fireNero: number;
  fireDamagePct: number;
  fireBurnPct: number;
  fireBurnDurAdd: number;
  fireRangeAdd: number;
  /** 弓の会心で、炎上中の敵が誘爆（炎上の毎秒ダメージ × COMBUST_MUL） */
  critCombust: number;
  // 採掘・経済（SPEC-113）
  unlockMiner: number;
  minerOmega: number;
  minerTollAdd: number;
  minerPayoutPct: number;
  minerRangeAdd: number;
  unlockSkip: number;
  skipBonusPct: number;
  lockedSlotCostPct: number;
  // 幻獣砲（SPEC-114）
  unlockCannon: number;
  cannonDamagePct: number;
  cannonCostDown: number;
  cannonWidthAdd: number;
  cannonBurn: number;
  // 幻獣
  maxHpAdd: number;
  healPerWave: number;
  regenPerSec: number;
  leakIgnoreChance: number;
  /** ボスの到達を 1 回だけ HP 1 で耐える */
  lastStand: number;
  // GUM
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
export const COMBUST_MUL = 3;

export function emptyModifiers(): RunModifiers {
  // 型で網羅を強制する（キーを足し忘れるとコンパイルエラー）
  const zero: RunModifiers = {
    damagePct: 0,
    attackSpeedPct: 0,
    rangeAdd: 0,
    critChance: 0,
    critMulAdd: 0,
    extraShotChance: 0,
    bossDamagePct: 0,
    volley: 0,
    archerHeavy: 0,
    placeCostFlat: 0,
    levelCostPct: 0,
    wealthDamagePct: 0,
    poisonChance: 0,
    unlockLightning: 0,
    lightningTesla: 0,
    lightningDamagePct: 0,
    lightningChains: 0,
    lightningShock: 0,
    dischargeStunAdd: 0,
    arcFlash: 0,
    unlockPulse: 0,
    pulseZhuge: 0,
    pulseDamagePct: 0,
    pulseSlowAdd: 0,
    pulseSlowDurAdd: 0,
    pulseRangeAdd: 0,
    pulseStunChance: 0,
    unlockFire: 0,
    fireNero: 0,
    fireDamagePct: 0,
    fireBurnPct: 0,
    fireBurnDurAdd: 0,
    fireRangeAdd: 0,
    critCombust: 0,
    unlockMiner: 0,
    minerOmega: 0,
    minerTollAdd: 0,
    minerPayoutPct: 0,
    minerRangeAdd: 0,
    unlockSkip: 0,
    skipBonusPct: 0,
    lockedSlotCostPct: 0,
    unlockCannon: 0,
    cannonDamagePct: 0,
    cannonCostDown: 0,
    cannonWidthAdd: 0,
    cannonBurn: 0,
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
  return zero;
}

export const MODIFIER_KEYS = Object.keys(emptyModifiers()) as ModifierKey[];
