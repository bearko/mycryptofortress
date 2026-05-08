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
    description: "自身のHPが70%未満の時に100%の確率で1回だけ発動 / 先頭の味方のINTを自身のINTの30%アップ",
    seCategory: "buff",
    effectType: "damageMultiplier",
    value: 1.5,
    durationSec: 8,
    cost: 100,
  },
  {
    heroId: 1002,
    name: "浪切",
    description: "自身がActive Skillを使用した後に40%の確率で発動 / 先頭の味方のPHYを自身のPHYの15%ダウン / 先頭の敵に自身のPHYの50%ダメージ",
    seCategory: "buff",
    effectType: "agiBuff",
    value: 1.5,
    durationSec: 6,
    cost: 100,
  },
  {
    heroId: 1003,
    name: "遼来遼来",
    description: "自身がActive Skillでダメージを受けた後に90%の確率で発動 / 最後尾の敵に自身のPHYの20%ダメージ",
    seCategory: "single_damage",
    effectType: "singleStrike",
    value: 3.0,
    durationSec: 0,
    cost: 100,
  },
  {
    heroId: 1004,
    name: "狼王ロボ",
    description: "バトル開始時に100%の確率で発動 / PHYが最も高い敵に自身のINTの40%ダメージ / PHYが最も高い敵に100%の確率で出血を付与",
    seCategory: "area_damage",
    effectType: "damageMultiplier",
    value: 1.7,
    durationSec: 6,
    cost: 100,
  },
  {
    heroId: 1006,
    name: "テトラクテュス",
    description: "自身のHPが40%未満の時に100%の確率で1回だけ発動 / PHYが最も高い味方のPHYを自身のINTの28%アップ / INTが最も高い味方のINTを自身のPHYの28%アップ",
    seCategory: "buff",
    effectType: "damageMultiplier",
    value: 2.0,
    durationSec: 5,
    cost: 100,
  },
  {
    heroId: 1007,
    name: "李氏朝鮮、宮廷医女",
    description: "自身がActive Skillを使用した後に20%の確率で発動 / HPが最も低い味方のHPを回復係数の15%回復",
    seCategory: "heal_resurrection",
    effectType: "heal",
    value: 1.5,
    durationSec: 0,
    cost: 100,
  },
  {
    heroId: 1008,
    name: "ボストン・ストロング・ボーイ",
    description: "自身がActive Skillでダメージを受けた後に25%の確率で発動 / 自身のチャージを自身のHP減少量の100 ~ 250%アップ",
    seCategory: "buff",
    effectType: "damageMultiplier",
    value: 1.8,
    durationSec: 8,
    cost: 100,
  },
  {
    heroId: 1009,
    name: "ローリングドライバー",
    description: "バトル開始時に100%の確率で発動 / INTが最も高い敵のINTを自身のINTの64%ダウン / INTが最も低い敵のINTを対象のPHYの100%アップ",
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
    description: "自身のHPが60%未満の時に100%の確率で1回だけ発動 / 自身のPHYを敵全体のINT増加量合計の100%アップ / 「INTが最も高い敵に自身のPHYの30 ~ 50%ダメージ」を2回繰り返す / 自身のPHYを敵全体のINT増加量合計の100%ダウン",
    seCategory: "buff",
    effectType: "damageMultiplier",
    value: 2.2,
    durationSec: 6,
    cost: 100,
  },
  {
    heroId: 2013,
    name: "虎痴",
    description: "自身がActive Skillを使用した後に65%の確率で発動 / 自身のINTを自身のINT減少量の45%アップ / 自身のPHYを自身のINT減少量の200%アップ / 自身のAGIを自身のINT減少量の100%アップ / 自身のINTを70ダウン",
    seCategory: "buff",
    effectType: "damageMultiplier",
    value: 2.0,
    durationSec: 6,
    cost: 100,
  },
  {
    heroId: 2009,
    name: "天下人の使者",
    description: "敵の誰かがActive Skillを使用した後に25%の確率で発動 / AGIが最も高い敵のAGIを自身の最大HPの25%アップ / AGIが最も高い敵のAGIを対象のAGIの40%ダウン / AGIが最も高い敵に100%の確率でバインドを付与",
    seCategory: "buff",
    effectType: "agiBuff",
    value: 1.6,
    durationSec: 8,
    cost: 100,
  },
  {
    heroId: 2016,
    name: "幻の生存者",
    description: "自身のHPが50%未満の時に100%の確率で1回だけ発動 / 敵全体のINTを自身のINTの30 ~ 40%ダウン / 敵全体に対象のINT減少量の50%ダメージ / 味方全体のPHYを自身のINTの20%ダウン",
    seCategory: "debuff_status_effect",
    effectType: "enemyDefDebuff",
    value: 0.4,
    durationSec: 8,
    cost: 100,
  },
  {
    heroId: 2003,
    name: "ランゲルライン",
    description: "自身がActive Skillを使用した後に100%の確率で発動 / 最後尾の敵に自身のPHY減少量の80%ダメージ / 最後尾の敵に自身のPHYの20%ダメージ / 中衛の味方のPHYを自身のINTの20%ダウン / 自身のAGIを自身のAGIの5%アップ",
    seCategory: "single_damage",
    effectType: "singleStrike",
    value: 4.0,
    durationSec: 0,
    cost: 100,
  },
  {
    heroId: 2006,
    name: "ヘウレーカ！ヘウレーカ！",
    description: "バトル開始時に100%の確率で発動 / 自身のシールドを対象の最大HPの100%に更新",
    seCategory: "area_damage",
    effectType: "damageMultiplier",
    value: 1.8,
    durationSec: 8,
    cost: 100,
  },
  {
    heroId: 2014,
    name: "大政奉還",
    description: "自身がActive Skillを使用した後に50%の確率で発動 / 自身のINTを自身のINT減少量の30%アップ / 敵全体のPHYを自身のINTの15%ダウン / 敵全体のINTを自身のINTの15%ダウン / 自身のINTを自身のINTの40%ダウン",
    seCategory: "area_damage",
    effectType: "damageMultiplier",
    value: 1.7,
    durationSec: 10,
    cost: 100,
  },
  {
    heroId: 2011,
    name: "兵は詭道なり",
    description: "バトル開始時に100%の確率で発動 / 敵全体のAGIを自身のINTの15 ~ 20%ダウン / 味方全体のAGIを自身のINTの10%ダウン",
    seCategory: "debuff_status_effect",
    effectType: "enemyDefDebuff",
    value: 0.4,
    durationSec: 10,
    cost: 100,
  },
  {
    heroId: 2007,
    name: "プレゼント・フォー・ユー",
    description: "自身がActive Skillを使用した後に30%の確率で発動 / 「HPが最も低い味方のHPを回復係数の12 ~ 25%回復」を3回繰り返す",
    seCategory: "heal_resurrection",
    effectType: "heal",
    value: 2.0,
    durationSec: 0,
    cost: 100,
  },
  {
    heroId: 2010,
    name: "変身",
    description: "バトル開始時に100%の確率で発動 / 味方全体のHPを回復係数の30%回復 / 味方全体のAGIを自身のAGIの10%アップ",
    seCategory: "buff",
    effectType: "damageMultiplier",
    value: 1.6,
    durationSec: 10,
    cost: 100,
  },

  // ─── SPEC-021: Rare 8 体のスキル（MCH 公式 passiveName / passiveDesc を尊重）
  // MCH 本家のパッシブ説明を、TD のスキル機構（damageMultiplier / singleStrike /
  // agiBuff / enemyDefDebuff / heal）に翻訳。effectType は本家 passive の主目的に
  // 沿わせ、value は職業バランス上の値。
  {
    heroId: 3001,
    name: "キャリスラッシュ",
    description: "敵の誰かがActive Skillを使用した後に0%の確率で発動 / 自身のPHYを自身のPHY減少量の70%アップ / 先頭の敵に自身のPHYの70%ダメージ",
    seCategory: "buff",
    effectType: "damageMultiplier",
    value: 2.5,
    durationSec: 8,
    cost: 100,
  },
  {
    heroId: 3002,
    name: "ワンフォーオール・オールフォーワン",
    description: "バトル開始時に100%の確率で発動 / 味方全体のPHYを自身のINTの10%アップ / 味方全体のINTを自身のINTの10%アップ",
    seCategory: "buff",
    effectType: "damageMultiplier",
    value: 2.0,
    durationSec: 10,
    cost: 100,
  },
  {
    heroId: 3003,
    name: "エレキテル",
    description: "自身のHPが60%未満の時に100%の確率で1回だけ発動 / 自身のINTを自身のINT減少量の90%アップ / 敵全体に自身のINTの40%ダメージ",
    seCategory: "buff",
    effectType: "agiBuff",
    value: 1.7,
    durationSec: 10,
    cost: 100,
  },
  {
    heroId: 3004,
    name: "アイ・オブ・ザ・デイ",
    description: "自身がActive Skillを使用した後に60%の確率で発動 / INTが最も低い敵のINTを自身のINTの10%ダウン / INTが最も低い敵に自身のINTの20%ダメージ / INTが最も低い敵に100%の確率でバインドを付与",
    seCategory: "debuff_status_effect",
    effectType: "enemyDefDebuff",
    value: 0.35,
    durationSec: 10,
    cost: 100,
  },
  {
    heroId: 3005,
    name: "オムノンタクティクス",
    description: "自身がActive Skillを使用した後かつ自身のHPが75%未満の時に40%の確率で発動 / 自身のINTを自身のINT減少量の50%アップ / 自身のAGIを自身のAGI減少量の50%アップ / 先頭の敵に自身のINTの50%ダメージ",
    seCategory: "buff",
    effectType: "damageMultiplier",
    value: 2.3,
    durationSec: 10,
    cost: 100,
  },
  {
    heroId: 3006,
    name: "ミントルアート",
    description: "自身がActive Skillを使用した後に40%の確率で発動 / 味方全体のPHYを対象のPHY減少量の50%アップ / 味方全体のINTを対象のINT減少量の50%アップ / 味方全体のHPを回復係数の30%回復",
    seCategory: "heal_resurrection",
    effectType: "heal",
    value: 2.5,
    durationSec: 0,
    cost: 100,
  },
  {
    heroId: 3007,
    name: "暴君",
    description: "自身がActive Skillでダメージを受けた後に0%の確率で発動 / 自身のINTを受けたダメージの50%アップ / 自身のHPを自身のINTの40%回復 / 味方全体のPHYを自身のINTの30%ダウン",
    seCategory: "buff",
    effectType: "damageMultiplier",
    value: 2.4,
    durationSec: 10,
    cost: 100,
  },
  {
    heroId: 3008,
    name: "大予言",
    description: "自身のHPが50%未満の時に100%の確率で1回だけ発動 / 敵全体に100%の確率で混乱を付与 / 敵全体のPHY/INT/AGIの最も高い方を対象のPHY/INT/AGI増加量合計の100%ダウン",
    seCategory: "single_damage",
    effectType: "singleStrike",
    value: 4.5,
    durationSec: 0,
    cost: 100,
  },

  // ─── SPEC-021: SuperRare 8 体のスキル（MCH "Epic" tier）
  {
    heroId: 4001,
    name: "一騎当千",
    description: "自身が死亡した後に100%の確率で1回だけ発動 / 自身を自身の最大HPの50%回復した状態で復活",
    seCategory: "buff",
    effectType: "damageMultiplier",
    value: 3.0,
    durationSec: 12,
    cost: 100,
  },
  {
    heroId: 4002,
    name: "白衣の天使",
    description: "自身がActive Skillを使用した後かつ自身のHPが60%未満の時に70%の確率で発動 / 味方全体のHPを回復係数の100%回復",
    seCategory: "heal_resurrection",
    effectType: "heal",
    value: 3.0,
    durationSec: 0,
    cost: 100,
  },
  {
    heroId: 4003,
    name: "歓喜の歌",
    description: "自身のHPが50%未満の時に100%の確率で1回だけ発動 / 敵全体のPHYを自身のINTの25%ダウン / 敵全体のINTを自身のINTの25%ダウン / 敵全体のAGIを自身のINTの25%ダウン",
    seCategory: "debuff_status_effect",
    effectType: "enemyDefDebuff",
    value: 0.25,
    durationSec: 12,
    cost: 100,
  },
  {
    heroId: 4004,
    name: "燕返し",
    description: "自身がActive Skillを使用した後に100%の確率で発動 / 自身のAGIを自身のAGIの10%アップ / 自身のPHY/INTの低い方を自身のAGIの5 ~ 8%アップ / 中衛の敵のPHY/INTの高い方を自身のAGIの5 ~ 8%ダウン",
    seCategory: "buff",
    effectType: "agiBuff",
    value: 2.0,
    durationSec: 10,
    cost: 100,
  },
  {
    heroId: 4005,
    name: "無血開城",
    description: "自身がActive Skillを使用した後かつ自身のHPが60%未満の時に45%の確率で発動 / 味方全体のPHYを自身のINTの30%アップ / 味方全体のINTを自身のINTの30%アップ",
    seCategory: "buff",
    effectType: "damageMultiplier",
    value: 2.6,
    durationSec: 12,
    cost: 100,
  },
  {
    heroId: 4006,
    name: "ワンホールショット",
    description: "自身がActive Skillでダメージを受けた後に100%の確率で発動 / 先頭の敵に自身のINTの40%ダメージ",
    seCategory: "single_damage",
    effectType: "singleStrike",
    value: 5.0,
    durationSec: 0,
    cost: 100,
  },
  {
    heroId: 4007,
    name: "エジソン・エフェクト",
    description: "自身がActive Skillを使用した後に35%の確率で発動 / 味方全体のINTを自身のINTの30%アップ",
    seCategory: "buff",
    effectType: "damageMultiplier",
    value: 2.8,
    durationSec: 10,
    cost: 100,
  },
  {
    heroId: 4008,
    name: "東方見聞録",
    description: "自身が死亡した後に100%の確率で1回だけ発動 / 味方全体のHPを回復係数の70%回復 / 自身を自身の最大HPの30%回復した状態で復活 / PHYが最も高い敵のPHYを対象のPHYの40%ダウン",
    seCategory: "heal_resurrection",
    effectType: "heal",
    value: 2.7,
    durationSec: 0,
    cost: 100,
  },

  // ─── SPEC-021: Legendary 4 体のスキル（MCH 本家データのパッシブを採用）
  {
    heroId: 5001,
    name: "天下布武",
    description: "自身がActive Skillを使用した後に25%の確率で発動 / 先頭の敵に自身のPHYの150 ~ 200%ダメージ",
    seCategory: "single_damage",
    effectType: "singleStrike",
    value: 6.0,
    durationSec: 0,
    cost: 100,
  },
  {
    heroId: 5002,
    name: "コルシカの悪魔",
    description: "自身がActive Skillを使用した後に25%の確率で発動 / 先頭の敵に自身のINTの150 ~ 200%ダメージ",
    seCategory: "single_damage",
    effectType: "singleStrike",
    value: 6.5,
    durationSec: 0,
    cost: 100,
  },
  {
    heroId: 5003,
    name: "乱世の奸雄",
    description: "自身がActive Skillを使用した後に100%の確率で発動 / PHYが最も高い味方のPHYを自身のPHYの10%アップ / 自身のPHYを自身のPHYの15%アップ / 自身のHPを自身のPHYの30%回復",
    seCategory: "buff",
    effectType: "damageMultiplier",
    value: 3.5,
    durationSec: 12,
    cost: 100,
  },
  {
    heroId: 5004,
    name: "1stプレジデント",
    description: "自身がActive Skillを使用した後に35%の確率で発動 / 味方全体のINTを自身のINTの30%アップ / 味方全体のAGIを自身のINTの30%アップ",
    seCategory: "buff",
    effectType: "agiBuff",
    value: 2.2,
    durationSec: 12,
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
