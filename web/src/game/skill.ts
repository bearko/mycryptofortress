/**
 * SPEC-004: スキルシステム。
 * 各 Common ヒーローに 1 種のアクティブスキルを定義し、ゲージと効果適用を司る。
 *
 * このモジュールは「テスト可能な純粋ロジック」を集約する。Phaser の描画 / 入力 /
 * 音声 / カットインは StageScene 側で担当する。
 */

export type SkillCategory =
  | "single_damage"
  | "area_damage"
  | "heal_resurrection"
  | "buff"
  | "debuff_status_effect";

export type SkillEffectType =
  | "damageMultiplier"
  | "agiBuff"
  | "enemyDefDebuff"
  | "singleStrike"
  /**
   * SPEC-009 §5.5: 範囲回復。発動時、攻撃範囲タイル内に居る味方ヒーロー全員の
   * currentHp を `calculateHeal` の値だけ回復する（maxHp で頭打ち）。
   */
  | "heal";

export interface SkillDef {
  /** ヒーロー ID（heroData.ts の id と一致） */
  heroId: number;
  /** スキル名（MCH DB の passive.name.ja を流用） */
  name: string;
  /** 1 行説明（Arknights 流アレンジ） */
  description: string;
  /** SE 分類 (battle_sound_effects.json の key と一致) */
  seCategory: SkillCategory;
  /** 効果タイプ */
  effectType: SkillEffectType;
  /** 効果倍率（1.5 / 2.0 / 0.5 など） */
  value: number;
  /** 持続秒。`singleStrike` は 0（即発） */
  durationSec: number;
  /** 必要ゲージ。MVP は常に 100 */
  cost: number;
}

/** SPEC-004 §5.2 のテーブル */
export const SKILLS: SkillDef[] = [
  {
    heroId: 1001,
    name: "シャーロック・ホームズ",
    description: "推理が冴え、自身の与ダメージが 1.5 倍に。",
    seCategory: "buff",
    effectType: "damageMultiplier",
    value: 1.5,
    durationSec: 8,
    cost: 100,
  },
  {
    heroId: 1002,
    name: "浪切",
    description: "刀の冴えで攻撃間隔を 1/1.5 に短縮。",
    seCategory: "buff",
    effectType: "agiBuff",
    value: 1.5,
    durationSec: 6,
    cost: 100,
  },
  {
    heroId: 1003,
    name: "遼来遼来",
    description: "進行が最も先の敵 1 体に 3.0× の必殺射撃を放つ。",
    seCategory: "single_damage",
    effectType: "singleStrike",
    value: 3.0,
    durationSec: 0,
    cost: 100,
  },
  {
    heroId: 1004,
    name: "狼王ロボ",
    description: "範囲攻撃のキレが増し、与ダメージが 1.7 倍に。",
    seCategory: "area_damage",
    effectType: "damageMultiplier",
    value: 1.7,
    durationSec: 6,
    cost: 100,
  },
  {
    heroId: 1006,
    name: "テトラクテュス",
    description: "数理の調和で与ダメージが 2.0 倍に。",
    seCategory: "buff",
    effectType: "damageMultiplier",
    value: 2.0,
    durationSec: 5,
    cost: 100,
  },
  {
    heroId: 1007,
    name: "李氏朝鮮、宮廷医女",
    description: "範囲内の味方ヒーローを INT 回復公式で大きく回復する。",
    seCategory: "heal_resurrection",
    effectType: "heal",
    value: 1.5,
    durationSec: 0,
    cost: 100,
  },
  {
    heroId: 1008,
    name: "ボストン・ストロング・ボーイ",
    description: "ボクサーの闘志で与ダメージが 1.8 倍に。",
    seCategory: "buff",
    effectType: "damageMultiplier",
    value: 1.8,
    durationSec: 8,
    cost: 100,
  },
  {
    heroId: 1009,
    name: "ローリングドライバー",
    description: "範囲内の敵の防御を 0.5 倍（半減）に。",
    seCategory: "debuff_status_effect",
    effectType: "enemyDefDebuff",
    value: 0.5,
    durationSec: 6,
    cost: 100,
  },

  // ─── SPEC-015: Uncommon 10 体のスキル ─────────────
  {
    heroId: 2002,
    name: "剣闘士の反乱",
    description: "闘技場の血塗れで自身の与ダメージが 2.2 倍に。",
    seCategory: "buff",
    effectType: "damageMultiplier",
    value: 2.2,
    durationSec: 6,
    cost: 100,
  },
  {
    heroId: 2013,
    name: "虎痴",
    description: "猛虎の咆哮で与ダメージが 2.0 倍に。",
    seCategory: "buff",
    effectType: "damageMultiplier",
    value: 2.0,
    durationSec: 6,
    cost: 100,
  },
  {
    heroId: 2009,
    name: "天下人の使者",
    description: "信長の号令で攻撃間隔が 1/1.6 に短縮。",
    seCategory: "buff",
    effectType: "agiBuff",
    value: 1.6,
    durationSec: 8,
    cost: 100,
  },
  {
    heroId: 2016,
    name: "幻の生存者",
    description: "範囲内の敵の防御を 0.4 倍（60% カット）に。",
    seCategory: "debuff_status_effect",
    effectType: "enemyDefDebuff",
    value: 0.4,
    durationSec: 8,
    cost: 100,
  },
  {
    heroId: 2003,
    name: "ランゲルライン",
    description: "進行が最も先の敵 1 体に 4.0 倍の必殺の刺突。",
    seCategory: "single_damage",
    effectType: "singleStrike",
    value: 4.0,
    durationSec: 0,
    cost: 100,
  },
  {
    heroId: 2006,
    name: "ヘウレーカ！ヘウレーカ！",
    description: "閃きが冴え、与ダメージが 1.8 倍に。",
    seCategory: "area_damage",
    effectType: "damageMultiplier",
    value: 1.8,
    durationSec: 8,
    cost: 100,
  },
  {
    heroId: 2014,
    name: "大政奉還",
    description: "歴史の転換点。与ダメージが 1.7 倍に。",
    seCategory: "area_damage",
    effectType: "damageMultiplier",
    value: 1.7,
    durationSec: 10,
    cost: 100,
  },
  {
    heroId: 2011,
    name: "兵は詭道なり",
    description: "範囲内の敵の防御を 0.4 倍に。戦術の要点で必中。",
    seCategory: "debuff_status_effect",
    effectType: "enemyDefDebuff",
    value: 0.4,
    durationSec: 10,
    cost: 100,
  },
  {
    heroId: 2007,
    name: "プレゼント・フォー・ユー",
    description: "範囲内の味方を INT 回復公式で 2.0 倍係数で回復する。",
    seCategory: "heal_resurrection",
    effectType: "heal",
    value: 2.0,
    durationSec: 0,
    cost: 100,
  },
  {
    heroId: 2010,
    name: "変身",
    description: "蝶の羽ばたき。与ダメージが 1.6 倍に。",
    seCategory: "buff",
    effectType: "damageMultiplier",
    value: 1.6,
    durationSec: 10,
    cost: 100,
  },
];

export function findSkill(heroId: number): SkillDef | undefined {
  return SKILLS.find((s) => s.heroId === heroId);
}

/** ゲージ蓄積パラメータ */
export const GAUGE_TIME_RATE = 5; // per sec
export const GAUGE_PER_ATTACK = 8; // per attack
export const GAUGE_MAX = 100;

/**
 * ゲージを時間で進める純粋関数。返り値は新しいゲージ値（クランプ済）。
 */
export function tickGauge(current: number, dt: number): number {
  return Math.min(GAUGE_MAX, current + dt * GAUGE_TIME_RATE);
}

/** 攻撃発射時にゲージへ加算する純粋関数。 */
export function gainOnAttack(current: number): number {
  return Math.min(GAUGE_MAX, current + GAUGE_PER_ATTACK);
}

/** スキル発動可能か */
export function canActivate(current: number, cost = GAUGE_MAX): boolean {
  return current >= cost;
}

/**
 * ヒーローの「効果状態」スナップショット。StageScene 側で
 * `PlacedHero.activeEffect` にぶら下げて使う想定。
 */
export interface ActiveSkillState {
  skill: SkillDef;
  /** 発動した時の elapsed 値 */
  startedAt: number;
  /** 効果が切れる elapsed 値（singleStrike の場合は startedAt と同じ） */
  endsAt: number;
}

export function startEffect(skill: SkillDef, elapsed: number): ActiveSkillState {
  return {
    skill,
    startedAt: elapsed,
    endsAt: elapsed + skill.durationSec,
  };
}

export function isEffectActive(state: ActiveSkillState | null, elapsed: number): boolean {
  if (!state) return false;
  // 即発系効果（singleStrike / heal）は持続なし
  if (state.skill.effectType === "singleStrike") return false;
  if (state.skill.effectType === "heal") return false;
  return elapsed < state.endsAt;
}

/**
 * `damageMultiplier` 効果を考慮した実効 damageRate を返す。
 * 効果が無い場合は 1.0。
 */
export function effectiveDamageRate(state: ActiveSkillState | null, elapsed: number): number {
  if (!isEffectActive(state, elapsed)) return 1.0;
  if (state!.skill.effectType !== "damageMultiplier") return 1.0;
  return state!.skill.value;
}

/**
 * `agiBuff` 効果を考慮した攻撃間隔の縮尺係数を返す。
 * 通常は 1.0、効果中は `1 / value`（高速化）。
 */
export function intervalScale(state: ActiveSkillState | null, elapsed: number): number {
  if (!isEffectActive(state, elapsed)) return 1.0;
  if (state!.skill.effectType !== "agiBuff") return 1.0;
  return 1 / state!.skill.value;
}
