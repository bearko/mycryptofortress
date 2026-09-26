import type { ModifierKey } from "../sim/modifiers";

/**
 * SPEC-107: スキルツリー v0。ノード名は MCH のスキル名（エクステンションのアクティブスキル /
 * ヒーローのパッシブスキル）。コラボ系列と利用不可素材の名称は使わない。
 */
export type TreeBranch = "core" | "archer" | "lightning" | "pulse" | "fire" | "miner" | "cannon" | "defense" | "economy" | "stone";

/** ツリーの構成を変えたら上げる。セーブの版と違えば全返金する（SPEC-108 §1） */
export const TREE_VERSION = 6;
/**
 * SPEC-116a: トークン。CE = 能力値の強化（ラン報酬）、エンブレム = 新しい能力の解放（初回クリア報酬）。
 * Outhold の三角トークン / 星トークンに相当する。
 */
export const TOKEN_IDS = ["ce", "emblem"] as const;
export type TokenId = (typeof TOKEN_IDS)[number];
export const TOKEN_LABEL: Record<TokenId, string> = { ce: "CE", emblem: "エンブレム" };
export const TOKEN_ICON: Record<TokenId, string> = { ce: "icon.ce", emblem: "icon.emblem" };

/**
 * SPEC-119: 条件つきパネル（丸）の判定に使う累計記録。セーブの meta.stats と
 * 既存の記録（累計 CE・クリア済みレベル数）から求める。
 */
export const CONDITION_STATS = ["kills", "bossKills", "gumCollected", "wavesCleared", "flawlessClears", "runs", "levelsCleared", "ceEarned"] as const;
export type ConditionStat = (typeof CONDITION_STATS)[number];

export const CONDITION_LABEL: Record<ConditionStat, { name: string; unit: string }> = {
  kills: { name: "累計撃破数", unit: "体" },
  bossKills: { name: "ボス撃破数", unit: "体" },
  gumCollected: { name: "累計獲得 GUM", unit: "GUM" },
  wavesCleared: { name: "累計クリア Wave", unit: "Wave" },
  flawlessClears: { name: "ノーダメージクリア", unit: "回" },
  runs: { name: "挑戦回数", unit: "回" },
  levelsCleared: { name: "クリアしたノード", unit: "個" },
  ceEarned: { name: "累計獲得 CE", unit: "CE" },
};

/** SPEC-119: ラン中の効果ではなく、画面の機能を解放するパネル（旧マイルストーン） */
export type FeatureId = "buildSets" | "speed3x" | "autoLevel";
export const FEATURE_LABEL: Record<FeatureId, string> = {
  buildSets: "ビルドセットを解放",
  speed3x: "3 倍速を解放",
  autoLevel: "オートレベルを解放",
};

export interface TreeEffect {
  stat: ModifierKey;
  /** 1 レベルあたりの加算値 */
  perLevel: number;
}

export interface TreeNode {
  id: string;
  /** MCH のスキル名 */
  name: string;
  /** 名前の出典（UI 表示） */
  source: string;
  branch: TreeBranch;
  /** ツリー座標（1 = 120 論理 px）。中心 (0, 0) がルート */
  pos: { x: number; y: number };
  /** 親ノード（ルートは null）。親を 1 レベル以上にすると購入できる */
  parent: string | null;
  maxLevel: number;
  cost: { token: TokenId; base: number; growth: number };
  effects: TreeEffect[];
  /** アイコン（マニフェストのキー） */
  icon: string;
  /** 補足説明（任意） */
  note?: string;
  /**
   * SPEC-119: 条件つきパネル（丸）。記録がしきい値に届くたびに無料で 1 レベル上がる
   * （maxLevel = thresholds.length、買えない・返金されない）。親が未解放でも効く。
   */
  condition?: { stat: ConditionStat; thresholds: number[] };
  /** SPEC-119: 解放する画面の機能 */
  feature?: FeatureId;
}

/** 条件つき（丸）パネルか */
export const isConditional = (n: TreeNode): boolean => !!n.condition;

const node = (n: Omit<TreeNode, "cost"> & { base: number; growth?: number; token?: TokenId }): TreeNode => {
  const { base, growth, token, ...rest } = n;
  return { ...rest, cost: { token: token ?? "ce", base, growth: growth ?? 1.5 } };
};

/** SPEC-119: 条件つきパネル（丸）。費用なし、レベル数 = しきい値の数 */
const free = (n: Omit<TreeNode, "cost" | "maxLevel" | "condition"> & { stat: ConditionStat; thresholds: number[] }): TreeNode => {
  const { stat, thresholds, ...rest } = n;
  return { ...rest, maxLevel: thresholds.length, cost: { token: "ce", base: 0, growth: 1 }, condition: { stat, thresholds } };
};

export const TREE: readonly TreeNode[] = [
  // ─── ルート: 最初に買うのは GUM（序盤は 2 体目のヒーローを置けるかが勝負） ───
  node({ id: "root", name: "黄金の工房", source: "ルーベンスのパッシブ", branch: "core", pos: { x: 0.0, y: 0.0 }, parent: null, maxLevel: 5, base: 3, effects: [{ stat: "startGumAdd", perLevel: 20 }], icon: "icon.gum", note: "開始時の GUM が増え、ヒーローを早く増やせる", growth: 1.6 }),

  // ─── 弓（ユミ / マスケット） ───
  node({ id: "yabusame", name: "ヤブサメ", source: "ユミ", branch: "archer", pos: { x: 0.0, y: -1.32 }, parent: "root", maxLevel: 5, base: 5, effects: [{ stat: "damagePct", perLevel: 0.1 }], icon: "icon.battle.phy" }),
  node({ id: "elite_yabusame", name: "エリートヤブサメ", source: "ユミ", branch: "archer", pos: { x: -1.32, y: -2.16 }, parent: "yabusame", maxLevel: 5, base: 9, effects: [{ stat: "attackSpeedPct", perLevel: 0.06 }], icon: "icon.battle.buf_agi" }),
  node({ id: "brave_yabusame", name: "ブレイブヤブサメ", source: "ユミ", branch: "archer", pos: { x: 1.32, y: -2.16 }, parent: "yabusame", maxLevel: 3, base: 12, effects: [{ stat: "rangeAdd", perLevel: 0.15 }], icon: "icon.battle.buf_int" }),
  node({ id: "brave_shot", name: "ブレイブショット", source: "マスケット", branch: "archer", pos: { x: 0.0, y: -2.64 }, parent: "yabusame", maxLevel: 3, base: 10, effects: [{ stat: "placeCostFlat", perLevel: 5 }], icon: "icon.gum", note: "弓の配置コストが下がる" }),
  node({ id: "elite_shot", name: "エリートショット", source: "マスケット", branch: "archer", pos: { x: 0.0, y: -3.96 }, parent: "brave_shot", maxLevel: 4, base: 18, effects: [{ stat: "levelCostPct", perLevel: 0.06 }], icon: "icon.gum", note: "全ヒーローの強化コストが下がる" }),
  node({ id: "kyudo", name: "キュードー", source: "ユミ", branch: "archer", pos: { x: -2.28, y: -3.24 }, parent: "elite_yabusame", maxLevel: 4, base: 15, effects: [{ stat: "critChance", perLevel: 0.05 }], icon: "icon.battle.buf_phy" }),
  node({ id: "kyudo_a", name: "キュードーA", source: "ユミ", branch: "archer", pos: { x: -3.6, y: -3.72 }, parent: "kyudo", maxLevel: 3, base: 25, effects: [{ stat: "critMulAdd", perLevel: 0.25 }], icon: "icon.battle.buf_phy" }),
  node({ id: "dokugiri", name: "忍術・毒霧", source: "霧隠才蔵のパッシブ", branch: "archer", pos: { x: -3.12, y: -5.28 }, parent: "kyudo_a", maxLevel: 3, base: 30, effects: [{ stat: "poisonChance", perLevel: 0.1 }], icon: "icon.battle.poison", note: "矢が命中すると確率で毒（最大 HP に比例したダメージ）" }),
  node({ id: "ogi_otoshi", name: "扇落とし", source: "ユミ", branch: "archer", pos: { x: -1.8, y: -4.56 }, parent: "kyudo", maxLevel: 3, base: 30, effects: [{ stat: "extraShotChance", perLevel: 0.1 }], icon: "icon.battle.decoy", note: "別の敵にもう 1 本の矢を放つ確率" }),
  node({ id: "sanjushi", name: "三銃士の一斉射撃", source: "マスケット", branch: "archer", pos: { x: -1.2, y: -5.88 }, parent: "ogi_otoshi", maxLevel: 1, base: 2, token: "emblem", effects: [{ stat: "volley", perLevel: 1 }], icon: "icon.battle.decoy", note: "最大 3 体に同時射撃（1 本 ×0.55）。弓が那須与一に交代" }),
  node({ id: "nue_goroshi", name: "鵺殺し", source: "ユミ", branch: "archer", pos: { x: 2.28, y: -3.24 }, parent: "brave_yabusame", maxLevel: 3, base: 18, effects: [{ stat: "bossDamagePct", perLevel: 0.15 }], icon: "icon.battle.fear" }),
  node({ id: "snipe", name: "スナイプ", source: "マスケット", branch: "archer", pos: { x: 2.4, y: -4.68 }, parent: "nue_goroshi", maxLevel: 1, base: 2, token: "emblem", effects: [{ stat: "rangeAdd", perLevel: 0.6 }, { stat: "attackSpeedPct", perLevel: -0.13 }, { stat: "archerHeavy", perLevel: 1 }], icon: "icon.battle.buf_int", note: "射程が大きく伸びる代わりに攻撃が遅くなる。弓がウィリアム・テルに交代" }),
  node({ id: "houjou", name: "崩城の一撃", source: "バリスタ", branch: "archer", pos: { x: 3.6, y: -5.52 }, parent: "snipe", maxLevel: 1, base: 80, effects: [{ stat: "heavyShot", perLevel: 1 }], icon: "icon.battle.phy", note: "弓が一撃特化に。攻撃力 ×5・攻撃間隔 ×3。会心やボス特効と相性抜群" }),

  // ─── 雷（ベンジャミン・フランクリン → ニコラ・テスラ / リング） ───
  node({ id: "raiden", name: "凧とライデン瓶の雷実験", source: "ベンジャミン・フランクリンのパッシブ", branch: "lightning", pos: { x: -3.6, y: -1.68 }, parent: "elite_yabusame", maxLevel: 1, base: 1, token: "emblem", effects: [{ stat: "unlockLightning", perLevel: 1 }], icon: "hero.2041", note: "雷ヒーロー（フランクリン）を配置できるようになる" }),
  node({ id: "novice_bright", name: "ノービスブライト", source: "リング", branch: "lightning", pos: { x: -5.04, y: -1.2 }, parent: "raiden", maxLevel: 4, base: 14, effects: [{ stat: "lightningDamagePct", perLevel: 0.15 }], icon: "icon.battle.phy" }),
  node({ id: "elite_bright", name: "エリートブライト", source: "リング", branch: "lightning", pos: { x: -4.8, y: -2.76 }, parent: "raiden", maxLevel: 2, base: 30, effects: [{ stat: "lightningChains", perLevel: 1 }], icon: "icon.battle.decoy", note: "雷が跳ぶ回数 +1" }),
  node({ id: "wisdom_bright", name: "ウィズダムブライト", source: "リング", branch: "lightning", pos: { x: -6.36, y: -1.92 }, parent: "novice_bright", maxLevel: 2, base: 26, effects: [{ stat: "lightningShock", perLevel: 1 }], icon: "icon.battle.confused", note: "1 回の命中で溜まる感電 +1" }),
  node({ id: "tesla_coil", name: "テスラコイル", source: "ニコラ・テスラのパッシブ", branch: "lightning", pos: { x: -6.24, y: -3.48 }, parent: "elite_bright", maxLevel: 1, base: 2, token: "emblem", effects: [{ stat: "lightningTesla", perLevel: 1 }, { stat: "lightningChains", perLevel: 1 }, { stat: "lightningDamagePct", perLevel: 0.2 }], icon: "hero.4041", note: "雷ヒーローがニコラ・テスラに交代。連鎖 +1・雷の攻撃力 +20%" }),
  node({ id: "fushigi", name: "不思議な光", source: "リング", branch: "lightning", pos: { x: -7.68, y: -2.64 }, parent: "tesla_coil", maxLevel: 2, base: 40, effects: [{ stat: "dischargeStunAdd", perLevel: 0.3 }], icon: "icon.battle.sleep", note: "放電で止まる時間が延びる" }),
  node({ id: "kibou", name: "希望の燐光", source: "リング", branch: "lightning", pos: { x: -7.8, y: -1.08 }, parent: "wisdom_bright", maxLevel: 1, base: 70, effects: [{ stat: "arcFlash", perLevel: 1 }], icon: "icon.battle.confused", note: "放電の瞬間に大ダメージ（その 1 撃 ×3）" }),

  // ─── 結界（安倍晴明 → 諸葛亮 / スクロール / シールド） ───
  node({ id: "kyukyu", name: "急急如律令", source: "安倍晴明のパッシブ", branch: "pulse", pos: { x: -4.08, y: -0.12 }, parent: "healing", maxLevel: 1, base: 1, token: "emblem", effects: [{ stat: "unlockPulse", perLevel: 1 }], icon: "hero.5021", note: "結界ヒーロー（安倍晴明）を配置できるようになる" }),
  node({ id: "tactics", name: "タクティクス", source: "スクロール", branch: "pulse", pos: { x: -5.52, y: 0.24 }, parent: "kyukyu", maxLevel: 3, base: 16, effects: [{ stat: "pulseSlowAdd", perLevel: 0.08 }], icon: "icon.battle.dbf_agi", note: "結界の鈍足が強くなる" }),
  node({ id: "denki", name: "電気伝導", source: "グラファイト", branch: "pulse", pos: { x: -6.36, y: 2.64 }, parent: "goji", maxLevel: 3, base: 26, effects: [{ stat: "pulseHaste", perLevel: 0.1 }], icon: "icon.battle.buf_agi", note: "結界の範囲内にいる他のヒーローの攻撃が速くなる（充電）" }),
  node({ id: "goji", name: "五事七計", source: "スクロール", branch: "pulse", pos: { x: -6.36, y: 1.44 }, parent: "tactics", maxLevel: 3, base: 22, effects: [{ stat: "pulseRangeAdd", perLevel: 0.2 }], icon: "icon.battle.buf_int" }),
  node({ id: "strategy", name: "ストラテジー", source: "スクロール", branch: "pulse", pos: { x: -6.96, y: 0.0 }, parent: "tactics", maxLevel: 4, base: 20, effects: [{ stat: "pulseDamagePct", perLevel: 0.25 }], icon: "icon.battle.phy" }),
  node({ id: "sekika", name: "石化の呪い", source: "シールド", branch: "pulse", pos: { x: -7.8, y: 1.32 }, parent: "goji", maxLevel: 3, base: 32, effects: [{ stat: "pulseStunChance", perLevel: 0.08 }], icon: "icon.battle.sleep", note: "結界の波動で確率スタン" }),
  node({ id: "koumei", name: "死せる孔明生ける仲達を走らす", source: "諸葛亮のパッシブ", branch: "pulse", pos: { x: -8.4, y: -0.12 }, parent: "strategy", maxLevel: 1, base: 2, token: "emblem", effects: [{ stat: "pulseZhuge", perLevel: 1 }, { stat: "pulseDamagePct", perLevel: 0.25 }], icon: "hero.5015", note: "結界ヒーローが諸葛亮に交代。波動を受けた敵が脆弱（被ダメージ +15%）" }),
  node({ id: "renkan", name: "連環の計", source: "貂蝉のパッシブ", branch: "pulse", pos: { x: -9.84, y: 0.6 }, parent: "koumei", maxLevel: 3, base: 60, effects: [{ stat: "slowLink", perLevel: 0.1 }], icon: "icon.battle.confused", note: "鈍足中の敵に当てたダメージの一部が、他の鈍足中の敵全員にも伝わる" }),
  node({ id: "medusa", name: "メドゥーサの呪い", source: "シールド", branch: "pulse", pos: { x: -8.88, y: 2.28 }, parent: "sekika", maxLevel: 2, base: 36, effects: [{ stat: "pulseSlowDurAdd", perLevel: 0.5 }], icon: "icon.battle.dbf_agi", note: "鈍足が長く続く" }),

  // ─── 炎（猿飛佐助 → 皇帝ネロ / ドラゴン / タイガー） ───
  node({ id: "jiraika", name: "地雷火", source: "猿飛佐助のパッシブ", branch: "fire", pos: { x: 3.6, y: -1.68 }, parent: "brave_yabusame", maxLevel: 1, base: 1, token: "emblem", effects: [{ stat: "unlockFire", perLevel: 1 }], icon: "hero.3038", note: "炎ヒーロー（猿飛佐助）を配置できるようになる" }),
  node({ id: "fukubaku", name: "伏爆の罠", source: "地雷", branch: "fire", pos: { x: 3.6, y: -3.12 }, parent: "jiraika", maxLevel: 3, base: 30, effects: [{ stat: "deathBlastChance", perLevel: 0.1 }], icon: "icon.battle.bleed", note: "撃破した敵が確率で爆発し、周りの敵にその最大 HP の 40% ダメージ（連鎖あり）" }),
  node({ id: "ryuou", name: "龍王の息吹", source: "ドラゴン", branch: "fire", pos: { x: 5.04, y: -1.2 }, parent: "jiraika", maxLevel: 4, base: 16, effects: [{ stat: "fireBurnPct", perLevel: 0.25 }], icon: "icon.battle.bleed", note: "炎上のダメージが増える" }),
  node({ id: "dragon_quake", name: "ドラゴンクエイク", source: "ドラゴン", branch: "fire", pos: { x: 4.8, y: -2.76 }, parent: "jiraika", maxLevel: 3, base: 22, effects: [{ stat: "fireBurnDurAdd", perLevel: 1 }], icon: "icon.battle.bleed", note: "炎上が長く続く" }),
  node({ id: "ryugan", name: "リュウガン", source: "ドラゴン", branch: "fire", pos: { x: 6.36, y: -1.92 }, parent: "ryuou", maxLevel: 2, base: 28, effects: [{ stat: "fireRangeAdd", perLevel: 0.25 }], icon: "icon.battle.buf_int" }),
  node({ id: "bokun", name: "暴君", source: "皇帝ネロのパッシブ", branch: "fire", pos: { x: 6.24, y: -3.48 }, parent: "dragon_quake", maxLevel: 1, base: 2, token: "emblem", effects: [{ stat: "fireNero", perLevel: 1 }, { stat: "fireDamagePct", perLevel: 0.3 }, { stat: "fireRangeAdd", perLevel: 0.3 }], icon: "hero.3007", note: "炎ヒーローが皇帝ネロに交代。炎の攻撃力 +30%・射程 +0.3" }),
  node({ id: "tiger_shoot", name: "タイガーシュート", source: "タイガー", branch: "fire", pos: { x: 7.68, y: -2.64 }, parent: "bokun", maxLevel: 1, base: 70, effects: [{ stat: "critCombust", perLevel: 1 }], icon: "icon.battle.bleed", note: "弓の会心で、炎上中の敵が誘爆（炎上ダメージ ×3）" }),
  node({ id: "kenshiko", name: "剣歯虎の一撃", source: "タイガー", branch: "fire", pos: { x: 7.8, y: -1.08 }, parent: "ryugan", maxLevel: 3, base: 34, effects: [{ stat: "fireDamagePct", perLevel: 0.2 }], icon: "icon.battle.phy" }),

  // ─── 幻獣防衛（アーマー / ネックレス / ペン / カブト / シールド） ───
  node({ id: "novice_protection", name: "ノービスプロテクション", source: "アーマー", branch: "defense", pos: { x: -1.44, y: 0.96 }, parent: "root", maxLevel: 5, base: 5, effects: [{ stat: "maxHpAdd", perLevel: 3 }], icon: "icon.battle.hp" }),
  node({ id: "healing", name: "ヒーリング", source: "ネックレス", branch: "defense", pos: { x: -2.88, y: 0.72 }, parent: "novice_protection", maxLevel: 3, base: 10, effects: [{ stat: "healPerWave", perLevel: 1 }], icon: "icon.battle.resurrection", note: "Wave クリアごとに回復" }),
  node({ id: "elite_protection", name: "エリートプロテクション", source: "アーマー", branch: "defense", pos: { x: -2.16, y: 2.28 }, parent: "novice_protection", maxLevel: 3, base: 20, effects: [{ stat: "maxHpAdd", perLevel: 5 }], icon: "icon.battle.hp" }),
  node({ id: "fukutsu", name: "不屈のガンマン", source: "ワイアット・アープのパッシブ", branch: "defense", pos: { x: -2.4, y: 3.72 }, parent: "elite_protection", maxLevel: 3, base: 30, effects: [{ stat: "lostHpDamagePct", perLevel: 0.03 }], icon: "icon.battle.buf_phy", note: "幻獣が失った HP 1 ごとにヒーローの攻撃力アップ（最大 +100%）。HP を増やすほど強くなる" }),
  node({ id: "recovery", name: "リカバリー", source: "ペン", branch: "defense", pos: { x: -4.2, y: 1.32 }, parent: "healing", maxLevel: 3, base: 25, effects: [{ stat: "regenPerSec", perLevel: 0.03 }], icon: "icon.battle.resurrection", note: "時間とともに少しずつ回復" }),
  node({ id: "gunshin", name: "軍神の加護", source: "カブト", branch: "defense", pos: { x: -3.48, y: 3.12 }, parent: "elite_protection", maxLevel: 2, base: 35, effects: [{ stat: "leakIgnoreChance", perLevel: 0.1 }], icon: "icon.battle.dbf_phy", note: "ボス以外の敵の到達ダメージを確率で無効化" }),
  node({ id: "muketsu", name: "無血開城", source: "勝海舟のパッシブ", branch: "defense", pos: { x: -3.84, y: 4.32 }, parent: "gunshin", maxLevel: 2, base: 28, effects: [{ stat: "gumOnLeak", perLevel: 5 }], icon: "icon.gum", note: "敵に到達されるたびに、受けたダメージ 1 あたり 5 GUM を得る" }),
  node({ id: "seijo", name: "聖女の祈り", source: "シールド", branch: "defense", pos: { x: -5.04, y: 2.76 }, parent: "gunshin", maxLevel: 1, base: 80, effects: [{ stat: "lastStand", perLevel: 1 }], icon: "icon.battle.resurrection", note: "ボスの到達を 1 度だけ HP 1 で耐える" }),

  // ─── 幻獣砲（ネックレス / オリフラム） ───
  node({ id: "amenra", name: "アメン・ラーの陽光", source: "ネックレス", branch: "cannon", pos: { x: 0.0, y: 1.8 }, parent: "root", maxLevel: 1, base: 1, token: "emblem", effects: [{ stat: "unlockCannon", perLevel: 1 }], icon: "icon.battle.buf_int", note: "幻獣砲が使えるようになる（GUM を消費して幻獣が光線を放つ）" }),
  node({ id: "taiyo", name: "太陽神の涙", source: "ネックレス", branch: "cannon", pos: { x: 0.0, y: 3.12 }, parent: "amenra", maxLevel: 4, base: 15, effects: [{ stat: "cannonDamagePct", perLevel: 0.3 }], icon: "icon.battle.phy" }),
  node({ id: "healing_light", name: "ヒーリングライト", source: "ネックレス", branch: "cannon", pos: { x: -1.2, y: 3.96 }, parent: "taiyo", maxLevel: 2, base: 24, effects: [{ stat: "cannonCostDown", perLevel: 1 }], icon: "icon.gum", note: "幻獣砲の消費 GUM -1" }),
  node({ id: "druid", name: "ドルイドの秘法", source: "ネックレス", branch: "cannon", pos: { x: 1.2, y: 3.96 }, parent: "taiyo", maxLevel: 2, base: 24, effects: [{ stat: "cannonWidthAdd", perLevel: 0.15 }], icon: "icon.battle.buf_int", note: "光線が太くなる" }),
  node({ id: "ougon_honoo", name: "黄金の炎", source: "オリフラム", branch: "cannon", pos: { x: 0.0, y: 5.04 }, parent: "taiyo", maxLevel: 1, base: 50, effects: [{ stat: "cannonBurn", perLevel: 1 }], icon: "icon.battle.bleed", note: "光線が炎上を与える" }),

  // ─── 経済（モアイ / マルクス / モノクル / パロット / ブーツ / ジュエルワームドラゴン / アルケブス） ───
  node({ id: "moai", name: "金箱レースの極意", source: "モアイ", branch: "economy", pos: { x: 1.44, y: 0.96 }, parent: "root", maxLevel: 3, base: 6, effects: [{ stat: "dropValueFlat", perLevel: 1 }], icon: "icon.gum", note: "撃破で落ちる GUM が増える" }),
  node({ id: "shihonron", name: "資本論", source: "マルクスのパッシブ", branch: "economy", pos: { x: 2.88, y: 0.72 }, parent: "moai", maxLevel: 3, base: 12, effects: [{ stat: "waveRewardPct", perLevel: 0.25 }], icon: "icon.gum" }),
  node({ id: "otakara", name: "お宝はいただいた！", source: "モノクル", branch: "economy", pos: { x: 2.16, y: 2.28 }, parent: "moai", maxLevel: 3, base: 8, effects: [{ stat: "collectRadiusAdd", perLevel: 0.2 }], icon: "icon.gum", note: "GUM の回収範囲が広がる" }),
  node({ id: "houseki", name: "宝石の囀り", source: "パロット", branch: "economy", pos: { x: 3.48, y: 3.36 }, parent: "otakara", maxLevel: 3, base: 12, effects: [{ stat: "dropLifetimeAdd", perLevel: 3 }], icon: "icon.gum", note: "GUM が消えるまでの時間が延びる" }),
  node({ id: "daichi_ougon", name: "大地黄金", source: "ブーツ", branch: "economy", pos: { x: 4.2, y: 1.32 }, parent: "shihonron", maxLevel: 3, base: 30, effects: [{ stat: "gumOnHitChance", perLevel: 0.04 }], icon: "icon.gum", note: "矢が命中するたびに確率で 1 GUM" }),
  node({ id: "houki", name: "宝輝創世", source: "ジュエルワームドラゴン", branch: "economy", pos: { x: 5.64, y: 1.8 }, parent: "daichi_ougon", maxLevel: 3, base: 45, effects: [{ stat: "dropValueFlat", perLevel: 1 }], icon: "icon.gum", note: "撃破で落ちる GUM がさらに増える" }),
  node({ id: "mouri", name: "毛利秀包の号令", source: "アルケブス", branch: "economy", pos: { x: 4.8, y: 3.12 }, parent: "shihonron", maxLevel: 3, base: 45, effects: [{ stat: "wealthDamagePct", perLevel: 0.03 }], icon: "icon.battle.phy", note: "所持 GUM 100 ごとに弓の攻撃力アップ（最大 +30%）" }),

  // ─── Wave 繰り上げ・ロックマス（ホース） ───
  node({ id: "ichinichi", name: "一日千里", source: "ホース", branch: "economy", pos: { x: 6.12, y: 3.24 }, parent: "houki", maxLevel: 1, base: 1, token: "emblem", effects: [{ stat: "unlockSkip", perLevel: 1 }], icon: "icon.battle.buf_agi", note: "Wave の出現が終わったら次の Wave を繰り上げて呼べる（残りの敵の数だけボーナス GUM）" }),
  node({ id: "shintaku", name: "神託の軍馬", source: "ホース", branch: "economy", pos: { x: 7.44, y: 3.72 }, parent: "ichinichi", maxLevel: 2, base: 30, effects: [{ stat: "skipBonusPct", perLevel: 0.5 }], icon: "icon.gum", note: "繰り上げボーナス +50%" }),
  node({ id: "kihei", name: "騎兵突撃", source: "ホース", branch: "economy", pos: { x: 6.24, y: 4.68 }, parent: "ichinichi", maxLevel: 2, base: 28, effects: [{ stat: "lockedSlotCostPct", perLevel: 0.2 }], icon: "icon.gum", note: "ロックマスの開放費用 -20%" }),

  // ─── 採掘（サトシ・ナカモト / 財布） ───
  node({ id: "mining_alpha", name: "マイニング ALPHA CC", source: "サトシ・ナカモト ALPHA CC のパッシブ", branch: "miner", pos: { x: 4.08, y: -0.12 }, parent: "shihonron", maxLevel: 1, base: 1, token: "emblem", effects: [{ stat: "unlockMiner", perLevel: 1 }], icon: "hero.2025", note: "採掘ヒーロー（サトシ・ナカモト ALPHA CC）を配置できるようになる" }),
  node({ id: "mikajime", name: "みかじめ料", source: "財布", branch: "miner", pos: { x: 5.52, y: 0.12 }, parent: "mining_alpha", maxLevel: 3, base: 18, effects: [{ stat: "minerTollAdd", perLevel: 1 }], icon: "icon.gum", note: "採掘の通行料 +1" }),
  node({ id: "shisan", name: "資産凍結", source: "財布", branch: "miner", pos: { x: 6.96, y: 0.6 }, parent: "mikajime", maxLevel: 3, base: 24, effects: [{ stat: "minerPayoutPct", perLevel: 0.5 }], icon: "icon.gum", note: "採掘の Wave 配当 +50%" }),
  node({ id: "mining_omega", name: "マイニング OMEGA CC", source: "サトシ・ナカモト OMEGA CC のパッシブ", branch: "miner", pos: { x: 7.2, y: 2.16 }, parent: "shisan", maxLevel: 1, base: 2, token: "emblem", effects: [{ stat: "minerOmega", perLevel: 1 }, { stat: "minerTollAdd", perLevel: 1 }, { stat: "minerPayoutPct", perLevel: 0.5 }], icon: "hero.4034", note: "採掘ヒーローが OMEGA CC に交代。通行料 +1・配当 +50%" }),
  node({ id: "wisdom_shisan", name: "ウィズダム資産凍結", source: "財布", branch: "miner", pos: { x: 8.4, y: 1.08 }, parent: "shisan", maxLevel: 2, base: 30, effects: [{ stat: "minerRangeAdd", perLevel: 0.3 }], icon: "icon.battle.buf_int", note: "採掘の範囲が広がる" }),
  // ─── Phase 4: 魔石（SPEC-115）と追加の強化 ───
  node({ id: "stone_ifrit", name: "全ての炎を司りし者", source: "フラマ・ファクス", branch: "stone", pos: { x: 1.08, y: -3.36 }, parent: "brave_yabusame", maxLevel: 1, base: 1, token: "emblem", effects: [{ stat: "stoneIfrit", perLevel: 1 }], icon: "stone.ifrit", note: "イフリートの魔石を解放。ラン中にヒーローか幻獣砲へ装着すると炎の力が宿る" }),
  node({ id: "stone_garuda", name: "風の光", source: "シルフ", branch: "stone", pos: { x: -1.08, y: -3.36 }, parent: "elite_yabusame", maxLevel: 1, base: 1, token: "emblem", effects: [{ stat: "stoneGaruda", perLevel: 1 }], icon: "stone.garuda", note: "ガルーダの魔石を解放。風の力で攻撃が変わり、隠れた敵も見抜く" }),
  node({ id: "stone_leviathan", name: "リヴァイアサン", source: "大航海の舵輪", branch: "stone", pos: { x: -2.88, y: -0.48 }, parent: "healing", maxLevel: 1, base: 1, token: "emblem", effects: [{ stat: "stoneLeviathan", perLevel: 1 }], icon: "stone.leviathan", note: "リヴァイアサンの魔石を解放。水の力で敵を押し戻し、足を止める" }),
  node({ id: "stone_tiamat", name: "大地の女帝", source: "ゴーレムクイーン", branch: "stone", pos: { x: 2.4, y: 3.96 }, parent: "otakara", maxLevel: 1, base: 1, token: "emblem", effects: [{ stat: "stoneTiamat", perLevel: 1 }], icon: "stone.tiamat", note: "ティアマトの魔石を解放。大地の力で毒を広げ、採掘を倍にする" }),
  node({ id: "eiyu", name: "英雄の一撃", source: "MCHブレード", branch: "archer", pos: { x: -4.68, y: -4.32 }, parent: "kyudo_a", maxLevel: 3, base: 40, effects: [{ stat: "damagePct", perLevel: 0.1 }], icon: "icon.battle.phy" }),
  node({ id: "ten_ichigeki", name: "天の一撃", source: "真・MCHブレード", branch: "archer", pos: { x: -5.76, y: -4.92 }, parent: "eiyu", maxLevel: 2, base: 70, effects: [{ stat: "critMulAdd", perLevel: 0.3 }], icon: "icon.battle.buf_phy" }),
  node({ id: "kouya", name: "荒野の一撃", source: "ドラグーン", branch: "archer", pos: { x: 1.2, y: -4.56 }, parent: "nue_goroshi", maxLevel: 3, base: 45, effects: [{ stat: "bossDamagePct", perLevel: 0.15 }], icon: "icon.battle.fear" }),
  node({ id: "shiden", name: "紫電一閃", source: "魔法剣・双極", branch: "lightning", pos: { x: -8.88, y: -2.4 }, parent: "kibou", maxLevel: 3, base: 40, effects: [{ stat: "lightningDamagePct", perLevel: 0.15 }], icon: "icon.battle.phy" }),
  node({ id: "raiju", name: "雷獣の嘶き", source: "雷鼓", branch: "lightning", pos: { x: -7.44, y: -3.84 }, parent: "wisdom_bright", maxLevel: 2, base: 55, effects: [{ stat: "dischargeStunAdd", perLevel: 0.2 }], icon: "icon.battle.sleep" }),
  node({ id: "sanchujin", name: "攻符　三柱陣", source: "降神召符", branch: "pulse", pos: { x: -9.0, y: -1.2 }, parent: "strategy", maxLevel: 3, base: 45, effects: [{ stat: "pulseDamagePct", perLevel: 0.2 }], icon: "icon.battle.phy" }),
  node({ id: "jujutsu", name: "呪術の叡智", source: "マンドラゴラ賢者", branch: "pulse", pos: { x: -10.08, y: 2.64 }, parent: "medusa", maxLevel: 2, base: 55, effects: [{ stat: "pulseSlowDurAdd", perLevel: 0.4 }], icon: "icon.battle.dbf_agi" }),
  node({ id: "ryuen", name: "竜炎知識の解放", source: "レッドドラゴンの右腕標本", branch: "fire", pos: { x: 6.48, y: -0.72 }, parent: "ryuou", maxLevel: 3, base: 45, effects: [{ stat: "fireBurnPct", perLevel: 0.2 }], icon: "icon.battle.bleed" }),
  node({ id: "shinen", name: "神炎", source: "真・メギド", branch: "fire", pos: { x: 9.0, y: -1.44 }, parent: "kenshiko", maxLevel: 2, base: 70, effects: [{ stat: "fireBurnDurAdd", perLevel: 1 }], icon: "icon.battle.bleed" }),
  node({ id: "kinjo", name: "錦城の女主", source: "茶々のパッシブ", branch: "defense", pos: { x: -2.64, y: 4.92 }, parent: "elite_protection", maxLevel: 2, base: 40, effects: [{ stat: "maxHpAdd", perLevel: 5 }], icon: "icon.battle.hp", note: "幻獣の最大 HP がさらに増える" }),
  node({ id: "seimei_ju", name: "生命の樹の恩寵", source: "ユグドラシル盆栽", branch: "defense", pos: { x: -5.16, y: 3.96 }, parent: "recovery", maxLevel: 2, base: 50, effects: [{ stat: "regenPerSec", perLevel: 0.03 }], icon: "icon.battle.resurrection" }),
  node({ id: "suijin", name: "水神の恩寵", source: "九頭龍大神の大好物", branch: "defense", pos: { x: -6.36, y: 3.84 }, parent: "seijo", maxLevel: 2, base: 60, effects: [{ stat: "healPerWave", perLevel: 1 }], icon: "icon.battle.resurrection" }),
  node({ id: "kaijin", name: "海神の食卓", source: "バミューダトライアングル寿司", branch: "economy", pos: { x: 4.08, y: 4.44 }, parent: "houseki", maxLevel: 3, base: 40, effects: [{ stat: "waveRewardPct", perLevel: 0.2 }], icon: "icon.gum" }),
  node({ id: "kaizoku", name: "女王直属海賊", source: "フランシス・ドレークのパッシブ", branch: "economy", pos: { x: 5.16, y: 5.28 }, parent: "mouri", maxLevel: 2, base: 70, effects: [{ stat: "dropValueFlat", perLevel: 1 }], icon: "icon.gum", note: "撃破で落ちる GUM がさらに増える" }),
  node({ id: "hyoga", name: "黄金氷河期", source: "絶対零度ゴールデンスノーマン", branch: "cannon", pos: { x: 1.2, y: 5.16 }, parent: "taiyo", maxLevel: 3, base: 40, effects: [{ stat: "cannonDamagePct", perLevel: 0.3 }], icon: "icon.battle.phy" }),
  node({ id: "magellan", name: "マゼラン海峡", source: "ビクトリア号", branch: "miner", pos: { x: 9.6, y: 1.44 }, parent: "wisdom_shisan", maxLevel: 2, base: 50, effects: [{ stat: "minerPayoutPct", perLevel: 0.3 }], icon: "icon.gum" }),
  // ─── SPEC-119: 条件つきパネル（丸・無料）と Outhold 由来の強化 ───
  free({ id: "ms_auto_collect", name: "世に盗人の種は尽くまじ", source: "石川五右衛門のパッシブ", branch: "economy", pos: { x: 0.9, y: -0.5 }, parent: "root", stat: "ceEarned", thresholds: [120], effects: [{ stat: "autoCollect", perLevel: 1 }], icon: "icon.gum", note: "落ちた GUM が 0.5 秒後に自動で集まる" }),
  free({ id: "ms_build_sets", name: "大日本沿海輿地全図", source: "伊能忠敬のパッシブ", branch: "core", pos: { x: -0.9, y: -0.5 }, parent: "root", stat: "ceEarned", thresholds: [300], effects: [], feature: "buildSets", icon: "icon.ce", note: "スキルツリーの配置を 5 つまで保存し、ワンタップで切り替えられる" }),
  free({ id: "ms_speed3x", name: "ライトフライヤー号", source: "ライト兄弟のパッシブ", branch: "archer", pos: { x: 1.8, y: -1.0 }, parent: "ms_auto_collect", stat: "ceEarned", thresholds: [600], effects: [], feature: "speed3x", icon: "icon.battle.buf_agi", note: "ラン中の速度ボタンに 3 倍速が加わる" }),
  free({ id: "ms_auto_level", name: "種の起源", source: "ダーウィンのパッシブ", branch: "archer", pos: { x: -1.9, y: -0.7 }, parent: "ms_build_sets", stat: "ceEarned", thresholds: [1000], effects: [], feature: "autoLevel", icon: "icon.battle.buf_phy", note: "ラン中、余った GUM で一番低いレベルのヒーローを自動で強化する（一時停止メニューで切替）" }),
  free({ id: "f_kills", name: "神箭手", source: "黄忠のパッシブ", branch: "archer", pos: { x: 0.0, y: -5.0 }, parent: "elite_shot", stat: "kills", thresholds: [300, 1500, 6000], effects: [{ stat: "damagePct", perLevel: 0.05 }], icon: "icon.battle.phy", note: "敵を倒した数で強くなる" }),
  free({ id: "f_boss", name: "ワンホールショット", source: "ビリー・ザ・キッドのパッシブ", branch: "archer", pos: { x: 4.1, y: -6.4 }, parent: "houjou", stat: "bossKills", thresholds: [3, 10, 25], effects: [{ stat: "bossDamagePct", perLevel: 0.1 }], icon: "icon.battle.fear", note: "ボスを倒した数で強くなる" }),
  free({ id: "f_gum", name: "功名立志伝", source: "豊臣秀吉のパッシブ", branch: "economy", pos: { x: 1.3, y: 2.9 }, parent: "otakara", stat: "gumCollected", thresholds: [1500, 6000, 20000], effects: [{ stat: "startGumAdd", perLevel: 10 }], icon: "icon.gum", note: "ランで手に入れた GUM の累計で開始 GUM が増える" }),
  free({ id: "f_waves", name: "おくのほそ道", source: "松尾芭蕉のパッシブ", branch: "economy", pos: { x: 3.8, y: 5.4 }, parent: "kaijin", stat: "wavesCleared", thresholds: [40, 150, 400], effects: [{ stat: "waveRewardPct", perLevel: 0.1 }], icon: "icon.gum", note: "クリアした Wave の累計で Wave 報酬が増える" }),
  free({ id: "f_flawless", name: "弁慶の立往生", source: "武蔵坊弁慶のパッシブ", branch: "defense", pos: { x: -2.4, y: 5.9 }, parent: "kinjo", stat: "flawlessClears", thresholds: [1, 4, 10], effects: [{ stat: "maxHpAdd", perLevel: 2 }], icon: "icon.battle.hp", note: "一度も到達されずにクリアした回数で幻獣の HP が増える" }),
  free({ id: "f_runs", name: "うさぎとかめ", source: "イソップのパッシブ", branch: "core", pos: { x: -1.0, y: 2.1 }, parent: "root", stat: "runs", thresholds: [10, 35, 80], effects: [{ stat: "levelCostPct", perLevel: 0.03 }], icon: "icon.gum", note: "挑戦した回数で、ヒーローの強化コストが下がる（負けても進む）" }),
  free({ id: "f_levels", name: "天下布武", source: "織田信長のパッシブ", branch: "archer", pos: { x: -4.3, y: -5.3 }, parent: "kyudo_a", stat: "levelsCleared", thresholds: [3, 6, 9], effects: [{ stat: "critChance", perLevel: 0.03 }], icon: "icon.battle.buf_phy", note: "ノードをクリアして進むほど会心が出やすくなる" }),
  node({ id: "mark", name: "アイ・オブ・ザ・デイ", source: "マタ・ハリのパッシブ", branch: "archer", pos: { x: 0.0, y: -6.0 }, parent: "f_kills", maxLevel: 3, base: 40, effects: [{ stat: "markPct", perLevel: 0.1 }], icon: "icon.battle.fear", note: "矢が当たった敵に 4 秒の印。印のある敵は全ヒーローから受けるダメージが増える" }),
  node({ id: "auto_mark", name: "独眼竜", source: "伊達政宗のパッシブ", branch: "archer", pos: { x: -0.5, y: -6.9 }, parent: "mark", maxLevel: 1, base: 90, effects: [{ stat: "autoMark", perLevel: 1 }], icon: "icon.battle.fear", note: "ボスとトール級（到達 2 以上）の敵には最初から印がつく" }),
  node({ id: "weakness", name: "兵は詭道なり", source: "孫子のパッシブ", branch: "archer", pos: { x: 0.5, y: -6.9 }, parent: "mark", maxLevel: 3, base: 50, effects: [{ stat: "weaknessPct", perLevel: 0.05 }], icon: "icon.battle.confused", note: "敵にかかっている状態異常（炎上・毒・鈍足・感電 / スタン・脆弱）1 種類ごとに、ヒーローから受けるダメージが増える" }),
  node({ id: "multi_crit", name: "燕返し", source: "佐々木小次郎のパッシブ", branch: "archer", pos: { x: -6.3, y: -5.8 }, parent: "ten_ichigeki", maxLevel: 3, base: 45, effects: [{ stat: "multiCritChance", perLevel: 0.15 }], icon: "icon.battle.buf_phy", note: "会心がさらにもう一度会心になる（ダメージ倍率が 2 回かかる）" }),
  node({ id: "vengeance", name: "首塚伝説", source: "平将門のパッシブ", branch: "defense", pos: { x: -1.6, y: 4.9 }, parent: "fukutsu", maxLevel: 3, base: 40, effects: [{ stat: "vengeancePct", perLevel: 0.15 }], icon: "icon.battle.bleed", note: "敵に到達されるたび、幻獣の周り（2.5 マス）の敵に最大 HP に比例した炎のダメージ（ボスは ×0.2）" }),
  node({ id: "interest", name: "大一大万大吉", source: "石田三成のパッシブ", branch: "economy", pos: { x: 1.0, y: 1.9 }, parent: "f_gum", maxLevel: 3, base: 30, effects: [{ stat: "interestPct", perLevel: 0.03 }], icon: "icon.gum", note: "Wave クリアごとに所持 GUM の利息（1 Wave 最大 60 GUM）" }),
];

export const TREE_BY_ID: ReadonlyMap<string, TreeNode> = new Map(TREE.map((n) => [n.id, n]));

/** 現在レベル lv から次のレベルへの費用 */
export function nodeCost(n: TreeNode, lv: number): number {
  return Math.round(n.cost.base * n.cost.growth ** lv);
}

/** 補正値の表示用ラベル */
export const STAT_LABEL: Record<ModifierKey, (v: number) => string> = {
  damagePct: (v) => `弓の攻撃力 ${pct(v)}`,
  attackSpeedPct: (v) => `弓の攻撃速度 ${pct(v)}`,
  rangeAdd: (v) => `弓の射程 ${signed(v, 2)} マス`,
  critChance: (v) => `会心率 ${pct(v)}`,
  critMulAdd: (v) => `会心ダメージ ${pct(v)}`,
  extraShotChance: (v) => `追加の矢 ${pct(v)}`,
  bossDamagePct: (v) => `ボスへのダメージ ${pct(v)}`,
  volley: () => "最大 3 体に同時射撃（那須与一に交代）",
  archerHeavy: () => "弓がウィリアム・テルに交代",
  placeCostFlat: (v) => `弓の配置コスト -${v} GUM`,
  levelCostPct: (v) => `強化コスト -${Math.round(v * 100)}%`,
  wealthDamagePct: (v) => `所持 GUM 100 ごとに弓の攻撃力 ${pct(v)}`,
  poisonChance: (v) => `命中時 ${Math.round(v * 100)}% で毒`,
  heavyShot: () => "弓が一撃特化（攻撃力 ×5・攻撃間隔 ×3）",
  markPct: (v) => `印の敵への被ダメージ ${pct(v)}`,
  autoMark: () => "ボスとトール級に最初から印",
  weaknessPct: (v) => `状態異常 1 種ごとに被ダメージ ${pct(v)}`,
  multiCritChance: (v) => `会心が再び会心になる確率 ${Math.round(v * 100)}%`,
  unlockLightning: () => "雷ヒーローを解放",
  lightningTesla: () => "雷ヒーローがニコラ・テスラに交代",
  lightningDamagePct: (v) => `雷の攻撃力 ${pct(v)}`,
  lightningChains: (v) => `雷の連鎖 ${signed(v, 0)}`,
  lightningShock: (v) => `感電の蓄積 ${signed(v, 0)}`,
  dischargeStunAdd: (v) => `放電スタン ${signed(v, 1)} 秒`,
  arcFlash: () => "放電時に大ダメージ",
  unlockPulse: () => "結界ヒーローを解放",
  pulseZhuge: () => "結界ヒーローが諸葛亮に交代（脆弱付与）",
  pulseDamagePct: (v) => `結界の攻撃力 ${pct(v)}`,
  pulseSlowAdd: (v) => `結界の鈍足 ${pct(v)}`,
  pulseSlowDurAdd: (v) => `鈍足の持続 ${signed(v, 1)} 秒`,
  pulseRangeAdd: (v) => `結界の範囲 ${signed(v, 1)} マス`,
  pulseStunChance: (v) => `結界で ${Math.round(v * 100)}% スタン`,
  pulseHaste: (v) => `結界の範囲内のヒーローの攻撃間隔 -${Math.round(v * 100)}%`,
  slowLink: (v) => `鈍足中の敵への命中の ${Math.round(v * 100)}% を他の鈍足中の敵にも`,
  unlockFire: () => "炎ヒーローを解放",
  fireNero: () => "炎ヒーローが皇帝ネロに交代",
  fireDamagePct: (v) => `炎の攻撃力 ${pct(v)}`,
  fireBurnPct: (v) => `炎上ダメージ ${pct(v)}`,
  fireBurnDurAdd: (v) => `炎上の持続 ${signed(v, 1)} 秒`,
  fireRangeAdd: (v) => `炎の射程 ${signed(v, 2)} マス`,
  critCombust: () => "弓の会心で炎上中の敵が誘爆",
  deathBlastChance: (v) => `撃破した敵が ${Math.round(v * 100)}% で爆発`,
  unlockMiner: () => "採掘ヒーローを解放",
  minerOmega: () => "採掘ヒーローが OMEGA CC に交代",
  minerTollAdd: (v) => `通行料 ${signed(v, 0)} GUM`,
  minerPayoutPct: (v) => `Wave 配当 ${pct(v)}`,
  minerRangeAdd: (v) => `採掘の範囲 ${signed(v, 1)} マス`,
  unlockSkip: () => "Wave の繰り上げ呼び出しを解放",
  skipBonusPct: (v) => `繰り上げボーナス ${pct(v)}`,
  lockedSlotCostPct: (v) => `ロックマス開放 -${Math.round(v * 100)}%`,
  unlockCannon: () => "幻獣砲を解放",
  cannonDamagePct: (v) => `幻獣砲の威力 ${pct(v)}`,
  cannonCostDown: (v) => `幻獣砲の消費 -${v} GUM`,
  cannonWidthAdd: (v) => `光線の太さ ${signed(v, 2)} マス`,
  cannonBurn: () => "光線が炎上を与える",
  maxHpAdd: (v) => `幻獣の最大 HP ${signed(v, 0)}`,
  healPerWave: (v) => `Wave クリア時に HP ${signed(v, 0)} 回復`,
  regenPerSec: (v) => `毎秒 HP ${signed(v, 2)} 回復`,
  leakIgnoreChance: (v) => `通常敵の到達を ${Math.round(v * 100)}% で無効化`,
  lastStand: () => "ボスの到達を 1 度だけ耐える",
  lostHpDamagePct: (v) => `失った HP 1 ごとに攻撃力 +${Math.round(v * 100)}%`,
  gumOnLeak: (v) => `到達ダメージ 1 ごとに ${v} GUM`,
  vengeancePct: (v) => `到達されると周りの敵に最大 HP の ${Math.round(v * 100)}%`,
  autoCollect: () => "GUM を自動回収",
  stoneIfrit: () => "イフリートの魔石を解放",
  stoneLeviathan: () => "リヴァイアサンの魔石を解放",
  stoneTiamat: () => "ティアマトの魔石を解放",
  stoneGaruda: () => "ガルーダの魔石を解放",
  startGumAdd: (v) => `開始時の GUM ${signed(v, 0)}`,
  dropValueFlat: (v) => `撃破 GUM ${signed(v, 0)}`,
  collectRadiusAdd: (v) => `GUM 回収範囲 ${signed(v, 1)} マス`,
  dropLifetimeAdd: (v) => `GUM の消滅まで ${signed(v, 0)} 秒`,
  waveRewardPct: (v) => `Wave クリア報酬 ${pct(v)}`,
  gumOnHitChance: (v) => `命中時 ${Math.round(v * 100)}% で +1 GUM`,
  interestPct: (v) => `Wave クリアで所持 GUM の ${Math.round(v * 100)}% の利息`,
};

function pct(v: number): string {
  return `${v >= 0 ? "+" : ""}${Math.round(v * 100)}%`;
}

function signed(v: number, digits: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}`;
}
