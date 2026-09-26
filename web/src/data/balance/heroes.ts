import type { ModifierKey } from "../../sim/modifiers";

/**
 * SPEC-104 §3 / SPEC-110〜113: ヒーロー（ロール）のバランス値。ロジックはここを参照するだけにする。
 * 5 ロール: 弓（ロビンフッド）/ 雷（フランクリン）/ 結界（安倍晴明）/ 炎（猿飛佐助）/ 採掘（サトシ・ナカモト）。
 */
export const ROLE_IDS = ["archer", "lightning", "pulse", "fire", "miner"] as const;
export type RoleId = (typeof ROLE_IDS)[number];

/** ツリーの交代ノードを取ると、見た目と名前が別のヒーローに変わる */
export interface HeroVariant {
  /** この補正値が 1 以上なら交代する */
  flag: ModifierKey;
  heroId: number;
  heroName: string;
  imageKey: string;
}

export interface RoleDef {
  id: RoleId;
  /** ロール名（UI 表示） */
  roleName: string;
  /** 一言説明（配置パネル） */
  blurb: string;
  /** MCH ヒーロー ID と名前（初期形） */
  heroId: number;
  heroName: string;
  imageKey: string;
  /** 後ろほど優先 */
  variants: HeroVariant[];
  /** 解放に必要な補正値（弓は最初から） */
  unlock?: ModifierKey;
  placeCost: number;
  /** levelUpCosts[i] = Lv(i+1) → Lv(i+2) の費用。長さ + 1 が最大レベル */
  levelUpCosts: readonly number[];
  base: { damage: number; interval: number; range: number };
  perLevel: { damageMul: number; intervalMul: number; rangeAdd: number };
  /** 弓: 弾速 */
  projectileSpeed?: number;
  /** 雷: 連鎖（初撃の後に跳ぶ回数・跳ぶ距離・1 跳びごとの減衰）と感電 */
  chain?: { jumps: number; jumpRange: number; falloff: number; shockPerHit: number; shockThreshold: number; stun: number };
  /** 結界: 範囲パルスの鈍足 */
  pulse?: { slow: number; slowDuration: number };
  /** 炎: 命中ごとに積む炎上（毎秒ダメージ）と持続・上限、巻き込み範囲 */
  flame?: { burnPerHit: number; burnDuration: number; burnCapHits: number; splash: number };
  /** 採掘: 範囲を通る敵 1 体ごとの通行料（×レベル）と Wave クリア時の配当（×レベル） */
  miner?: { tollPerLevel: number; payoutPerLevel: number };
}

export const ROLES: Record<RoleId, RoleDef> = {
  archer: {
    id: "archer",
    roleName: "弓",
    blurb: "単体を狙う基本のヒーロー",
    heroId: 3026,
    heroName: "ロビンフッド",
    imageKey: "hero.3026",
    variants: [
      { flag: "archerHeavy", heroId: 4053, heroName: "ウィリアム・テル", imageKey: "hero.4053" },
      { flag: "volley", heroId: 5028, heroName: "那須与一", imageKey: "hero.5028" },
    ],
    placeCost: 50,
    levelUpCosts: [45, 75, 120, 190],
    base: { damage: 5, interval: 0.8, range: 2.6 },
    perLevel: { damageMul: 1.45, intervalMul: 0.92, rangeAdd: 0.2 },
    projectileSpeed: 11,
  },
  lightning: {
    id: "lightning",
    roleName: "雷",
    blurb: "近くの敵に連鎖する雷。感電が溜まると放電して動きを止める",
    heroId: 2041,
    heroName: "ベンジャミン・フランクリン",
    imageKey: "hero.2041",
    variants: [{ flag: "lightningTesla", heroId: 4041, heroName: "ニコラ・テスラ", imageKey: "hero.4041" }],
    unlock: "unlockLightning",
    placeCost: 70,
    levelUpCosts: [60, 100, 160, 250],
    base: { damage: 6, interval: 1.25, range: 2.0 },
    perLevel: { damageMul: 1.45, intervalMul: 0.93, rangeAdd: 0.15 },
    chain: { jumps: 2, jumpRange: 1.6, falloff: 0.35, shockPerHit: 1, shockThreshold: 5, stun: 0.6 },
  },
  pulse: {
    id: "pulse",
    roleName: "結界",
    blurb: "周囲の敵すべてに波動を放ち、鈍足にする",
    heroId: 5021,
    heroName: "安倍晴明",
    imageKey: "hero.5021",
    variants: [{ flag: "pulseZhuge", heroId: 5015, heroName: "諸葛亮", imageKey: "hero.5015" }],
    unlock: "unlockPulse",
    placeCost: 60,
    levelUpCosts: [55, 90, 145, 230],
    base: { damage: 3, interval: 1.6, range: 1.7 },
    perLevel: { damageMul: 1.4, intervalMul: 0.94, rangeAdd: 0.12 },
    pulse: { slow: 0.3, slowDuration: 1.5 },
  },
  fire: {
    id: "fire",
    roleName: "炎",
    blurb: "短い射程で炎を浴びせ、炎上を積み重ねる",
    heroId: 3038,
    heroName: "猿飛佐助",
    imageKey: "hero.3038",
    variants: [{ flag: "fireNero", heroId: 3007, heroName: "皇帝ネロ", imageKey: "hero.3007" }],
    unlock: "unlockFire",
    placeCost: 65,
    levelUpCosts: [60, 95, 155, 240],
    base: { damage: 1, interval: 0.25, range: 1.6 },
    perLevel: { damageMul: 1.45, intervalMul: 0.97, rangeAdd: 0.1 },
    flame: { burnPerHit: 0.8, burnDuration: 3, burnCapHits: 14, splash: 0.6 },
  },
  miner: {
    id: "miner",
    roleName: "採掘",
    blurb: "攻撃しない。近くを通る敵から通行料、Wave クリアで配当の GUM",
    heroId: 2025,
    heroName: "サトシ・ナカモト ALPHA CC",
    imageKey: "hero.2025",
    variants: [{ flag: "minerOmega", heroId: 4034, heroName: "サトシ・ナカモト OMEGA CC", imageKey: "hero.4034" }],
    unlock: "unlockMiner",
    placeCost: 70,
    levelUpCosts: [60, 100, 160, 250],
    base: { damage: 0, interval: 1, range: 1.8 },
    perLevel: { damageMul: 1, intervalMul: 1, rangeAdd: 0.1 },
    miner: { tollPerLevel: 1, payoutPerLevel: 4 },
  },
};

export function maxLevel(role: RoleDef): number {
  return role.levelUpCosts.length + 1;
}

/** レベル lv（1 始まり）の基礎性能（ツリー補正なし） */
export function roleStats(role: RoleDef, lv: number): { damage: number; interval: number; range: number } {
  const n = lv - 1;
  return {
    damage: role.base.damage * role.perLevel.damageMul ** n,
    interval: role.base.interval * role.perLevel.intervalMul ** n,
    range: role.base.range + role.perLevel.rangeAdd * n,
  };
}

/** 補正値の交代フラグに応じたヒーローの見た目・名前 */
export function heroVisual(role: RoleDef, flags: Partial<Record<ModifierKey, number>>): { heroId: number; heroName: string; imageKey: string } {
  const v = [...role.variants].reverse().find((x) => (flags[x.flag] ?? 0) > 0);
  return v ?? { heroId: role.heroId, heroName: role.heroName, imageKey: role.imageKey };
}
