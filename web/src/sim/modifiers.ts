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
  /** 一撃特化（フラグ）: 弓の攻撃力 ×HEAVY_SHOT_DAMAGE・攻撃間隔 ×HEAVY_SHOT_INTERVAL */
  heavyShot: number;
  /** SPEC-119 印: 矢が当たった敵に MARK_DURATION 秒の印。印の敵はヒーローから受けるダメージ +この割合 */
  markPct: number;
  /** SPEC-119 自動マーク（フラグ）: ボスとトール級（到達 2 以上）に常に印 */
  autoMark: number;
  /** SPEC-119 弱点を突く: 敵の状態異常 1 種類ごとにヒーローからのダメージ +この割合 */
  weaknessPct: number;
  /** SPEC-119 多重会心: 会心がもう一度会心になる確率 */
  multiCritChance: number;
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
  /** 充電: 結界の範囲内にいる他のヒーローの攻撃間隔を短縮（割合、上限 HASTE_CAP） */
  pulseHaste: number;
  /** ダメージリンク: 鈍足中の敵へのヒーローの命中ダメージのうち、この割合を他の鈍足中の敵全員にも与える */
  slowLink: number;
  // 炎（SPEC-112）
  unlockFire: number;
  fireNero: number;
  fireDamagePct: number;
  fireBurnPct: number;
  fireBurnDurAdd: number;
  fireRangeAdd: number;
  /** 弓の会心で、炎上中の敵が誘爆（炎上の毎秒ダメージ × COMBUST_MUL） */
  critCombust: number;
  /** 撃破した敵が確率で爆発し、周りの敵に最大 HP × BLAST_PCT のダメージ */
  deathBlastChance: number;
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
  /** 失った幻獣 HP 1 あたりのヒーローの攻撃力補正（上限 LOST_HP_CAP） */
  lostHpDamagePct: number;
  /** 敵の到達で受けたダメージ 1 あたりに得る GUM */
  gumOnLeak: number;
  /** SPEC-119 報復の炎: 到達されたとき、幻獣の周りの敵に最大 HP × この割合（ボスは ×VENGEANCE_BOSS） */
  vengeancePct: number;
  // GUM
  startGumAdd: number;
  /** 撃破時の GUM に加算（小さな報酬でも効くよう固定値） */
  dropValueFlat: number;
  collectRadiusAdd: number;
  dropLifetimeAdd: number;
  waveRewardPct: number;
  gumOnHitChance: number;
  /** SPEC-119 利息: Wave クリア時に所持 GUM × この割合（上限 INTEREST_CAP） */
  interestPct: number;
  /** SPEC-119: 丸パネル「世に盗人の種は尽くまじ」（GUM 自動回収、旧マイルストーン） */
  autoCollect: number;
  /** SPEC-115: 魔石の解放（フラグ） */
  stoneIfrit: number;
  stoneLeviathan: number;
  stoneTiamat: number;
  stoneGaruda: number;
}

export type ModifierKey = keyof RunModifiers;

export const VOLLEY_TARGETS = 3;
export const VOLLEY_DAMAGE = 0.55;
export const WEALTH_CAP = 0.3;
export const BASE_CRIT_MUL = 2;
export const COMBUST_MUL = 3;
export const HEAVY_SHOT_DAMAGE = 5;
export const HEAVY_SHOT_INTERVAL = 3;
export const HASTE_CAP = 0.5;
export const BLAST_PCT = 0.4;
export const BLAST_RADIUS = 1.2;
export const LOST_HP_CAP = 1;
export const MARK_DURATION = 4;
export const WEAKNESS_MAX_STATUS = 5;
export const VENGEANCE_RADIUS = 2.5;
export const VENGEANCE_BOSS = 0.2;
export const INTEREST_CAP = 60;

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
    heavyShot: 0,
    markPct: 0,
    autoMark: 0,
    weaknessPct: 0,
    multiCritChance: 0,
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
    slowLink: 0,
    pulseHaste: 0,
    unlockFire: 0,
    fireNero: 0,
    fireDamagePct: 0,
    fireBurnPct: 0,
    fireBurnDurAdd: 0,
    fireRangeAdd: 0,
    critCombust: 0,
    deathBlastChance: 0,
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
    lostHpDamagePct: 0,
    gumOnLeak: 0,
    vengeancePct: 0,
    startGumAdd: 0,
    dropValueFlat: 0,
    collectRadiusAdd: 0,
    dropLifetimeAdd: 0,
    waveRewardPct: 0,
    gumOnHitChance: 0,
    interestPct: 0,
    autoCollect: 0,
    stoneIfrit: 0,
    stoneLeviathan: 0,
    stoneTiamat: 0,
    stoneGaruda: 0,
  };
  return zero;
}

export const MODIFIER_KEYS = Object.keys(emptyModifiers()) as ModifierKey[];
