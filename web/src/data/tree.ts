import type { ModifierKey } from "../sim/modifiers";

/**
 * SPEC-107: スキルツリー v0。ノード名は MCH のスキル名（エクステンションのアクティブスキル /
 * ヒーローのパッシブスキル）。コラボ系列と利用不可素材の名称は使わない。
 */
export type TreeBranch = "core" | "archer" | "lightning" | "pulse" | "fire" | "miner" | "cannon" | "defense" | "economy";

/** ツリーの構成を変えたら上げる。セーブの版と違えば全返金する（SPEC-108 §1） */
export const TREE_VERSION = 4;
export type TokenId = "ce";

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
}

const node = (n: Omit<TreeNode, "cost"> & { base: number; growth?: number }): TreeNode => {
  const { base, growth, ...rest } = n;
  return { ...rest, cost: { token: "ce", base, growth: growth ?? 1.5 } };
};

export const TREE: readonly TreeNode[] = [
  // ─── ルート: 最初に買うのは GUM（序盤は 2 体目のヒーローを置けるかが勝負） ───
  node({ id: "root", name: "黄金の工房", source: "ルーベンスのパッシブ", branch: "core", pos: { x: 0, y: 0 }, parent: null, maxLevel: 5, base: 3, effects: [{ stat: "startGumAdd", perLevel: 20 }], icon: "icon.gum", note: "開始時の GUM が増え、ヒーローを早く増やせる", growth: 1.6 }),

  // ─── 弓（ユミ / マスケット） ───
  node({ id: "yabusame", name: "ヤブサメ", source: "ユミ", branch: "archer", pos: { x: 0, y: -1.1 }, parent: "root", maxLevel: 5, base: 5, effects: [{ stat: "damagePct", perLevel: 0.1 }], icon: "icon.battle.phy" }),
  node({ id: "elite_yabusame", name: "エリートヤブサメ", source: "ユミ", branch: "archer", pos: { x: -1.1, y: -1.8 }, parent: "yabusame", maxLevel: 5, base: 9, effects: [{ stat: "attackSpeedPct", perLevel: 0.06 }], icon: "icon.battle.buf_agi" }),
  node({ id: "brave_yabusame", name: "ブレイブヤブサメ", source: "ユミ", branch: "archer", pos: { x: 1.1, y: -1.8 }, parent: "yabusame", maxLevel: 3, base: 12, effects: [{ stat: "rangeAdd", perLevel: 0.15 }], icon: "icon.battle.buf_int" }),
  node({ id: "brave_shot", name: "ブレイブショット", source: "マスケット", branch: "archer", pos: { x: 0, y: -2.2 }, parent: "yabusame", maxLevel: 3, base: 10, effects: [{ stat: "placeCostFlat", perLevel: 5 }], icon: "icon.gum", note: "弓の配置コストが下がる" }),
  node({ id: "elite_shot", name: "エリートショット", source: "マスケット", branch: "archer", pos: { x: 0, y: -3.3 }, parent: "brave_shot", maxLevel: 4, base: 18, effects: [{ stat: "levelCostPct", perLevel: 0.06 }], icon: "icon.gum", note: "全ヒーローの強化コストが下がる" }),
  node({ id: "kyudo", name: "キュードー", source: "ユミ", branch: "archer", pos: { x: -1.9, y: -2.7 }, parent: "elite_yabusame", maxLevel: 4, base: 15, effects: [{ stat: "critChance", perLevel: 0.05 }], icon: "icon.battle.buf_phy" }),
  node({ id: "kyudo_a", name: "キュードーA", source: "ユミ", branch: "archer", pos: { x: -3.0, y: -3.1 }, parent: "kyudo", maxLevel: 3, base: 25, effects: [{ stat: "critMulAdd", perLevel: 0.25 }], icon: "icon.battle.buf_phy" }),
  node({ id: "dokugiri", name: "忍術・毒霧", source: "霧隠才蔵のパッシブ", branch: "archer", pos: { x: -2.6, y: -4.4 }, parent: "kyudo_a", maxLevel: 3, base: 30, effects: [{ stat: "poisonChance", perLevel: 0.1 }], icon: "icon.battle.poison", note: "矢が命中すると確率で毒（最大 HP に比例したダメージ）" }),
  node({ id: "ogi_otoshi", name: "扇落とし", source: "ユミ", branch: "archer", pos: { x: -1.5, y: -3.8 }, parent: "kyudo", maxLevel: 3, base: 30, effects: [{ stat: "extraShotChance", perLevel: 0.1 }], icon: "icon.battle.decoy", note: "別の敵にもう 1 本の矢を放つ確率" }),
  node({ id: "sanjushi", name: "三銃士の一斉射撃", source: "マスケット", branch: "archer", pos: { x: -1.0, y: -4.9 }, parent: "ogi_otoshi", maxLevel: 1, base: 60, effects: [{ stat: "volley", perLevel: 1 }], icon: "icon.battle.decoy", note: "最大 3 体に同時射撃（1 本 ×0.55）。弓が那須与一に交代" }),
  node({ id: "nue_goroshi", name: "鵺殺し", source: "ユミ", branch: "archer", pos: { x: 1.9, y: -2.7 }, parent: "brave_yabusame", maxLevel: 3, base: 18, effects: [{ stat: "bossDamagePct", perLevel: 0.15 }], icon: "icon.battle.fear" }),
  node({ id: "snipe", name: "スナイプ", source: "マスケット", branch: "archer", pos: { x: 2.0, y: -3.9 }, parent: "nue_goroshi", maxLevel: 1, base: 40, effects: [{ stat: "rangeAdd", perLevel: 0.6 }, { stat: "attackSpeedPct", perLevel: -0.13 }, { stat: "archerHeavy", perLevel: 1 }], icon: "icon.battle.buf_int", note: "射程が大きく伸びる代わりに攻撃が遅くなる。弓がウィリアム・テルに交代" }),
  node({ id: "houjou", name: "崩城の一撃", source: "バリスタ", branch: "archer", pos: { x: 3.0, y: -4.6 }, parent: "snipe", maxLevel: 1, base: 80, effects: [{ stat: "heavyShot", perLevel: 1 }], icon: "icon.battle.phy", note: "弓が一撃特化に。攻撃力 ×5・攻撃間隔 ×3。会心やボス特効と相性抜群" }),

  // ─── 雷（ベンジャミン・フランクリン → ニコラ・テスラ / リング） ───
  node({ id: "raiden", name: "凧とライデン瓶の雷実験", source: "ベンジャミン・フランクリンのパッシブ", branch: "lightning", pos: { x: -3.0, y: -1.4 }, parent: "elite_yabusame", maxLevel: 1, base: 45, effects: [{ stat: "unlockLightning", perLevel: 1 }], icon: "hero.2041", note: "雷ヒーロー（フランクリン）を配置できるようになる" }),
  node({ id: "novice_bright", name: "ノービスブライト", source: "リング", branch: "lightning", pos: { x: -4.2, y: -1.0 }, parent: "raiden", maxLevel: 4, base: 14, effects: [{ stat: "lightningDamagePct", perLevel: 0.15 }], icon: "icon.battle.phy" }),
  node({ id: "elite_bright", name: "エリートブライト", source: "リング", branch: "lightning", pos: { x: -4.0, y: -2.3 }, parent: "raiden", maxLevel: 2, base: 30, effects: [{ stat: "lightningChains", perLevel: 1 }], icon: "icon.battle.decoy", note: "雷が跳ぶ回数 +1" }),
  node({ id: "wisdom_bright", name: "ウィズダムブライト", source: "リング", branch: "lightning", pos: { x: -5.3, y: -1.6 }, parent: "novice_bright", maxLevel: 2, base: 26, effects: [{ stat: "lightningShock", perLevel: 1 }], icon: "icon.battle.confused", note: "1 回の命中で溜まる感電 +1" }),
  node({ id: "tesla_coil", name: "テスラコイル", source: "ニコラ・テスラのパッシブ", branch: "lightning", pos: { x: -5.2, y: -2.9 }, parent: "elite_bright", maxLevel: 1, base: 90, effects: [{ stat: "lightningTesla", perLevel: 1 }, { stat: "lightningChains", perLevel: 1 }, { stat: "lightningDamagePct", perLevel: 0.2 }], icon: "hero.4041", note: "雷ヒーローがニコラ・テスラに交代。連鎖 +1・雷の攻撃力 +20%" }),
  node({ id: "fushigi", name: "不思議な光", source: "リング", branch: "lightning", pos: { x: -6.4, y: -2.2 }, parent: "tesla_coil", maxLevel: 2, base: 40, effects: [{ stat: "dischargeStunAdd", perLevel: 0.3 }], icon: "icon.battle.sleep", note: "放電で止まる時間が延びる" }),
  node({ id: "kibou", name: "希望の燐光", source: "リング", branch: "lightning", pos: { x: -6.5, y: -0.9 }, parent: "wisdom_bright", maxLevel: 1, base: 70, effects: [{ stat: "arcFlash", perLevel: 1 }], icon: "icon.battle.confused", note: "放電の瞬間に大ダメージ（その 1 撃 ×3）" }),

  // ─── 結界（安倍晴明 → 諸葛亮 / スクロール / シールド） ───
  node({ id: "kyukyu", name: "急急如律令", source: "安倍晴明のパッシブ", branch: "pulse", pos: { x: -3.4, y: -0.1 }, parent: "healing", maxLevel: 1, base: 40, effects: [{ stat: "unlockPulse", perLevel: 1 }], icon: "hero.5021", note: "結界ヒーロー（安倍晴明）を配置できるようになる" }),
  node({ id: "tactics", name: "タクティクス", source: "スクロール", branch: "pulse", pos: { x: -4.6, y: 0.2 }, parent: "kyukyu", maxLevel: 3, base: 16, effects: [{ stat: "pulseSlowAdd", perLevel: 0.08 }], icon: "icon.battle.dbf_agi", note: "結界の鈍足が強くなる" }),
  node({ id: "denki", name: "電気伝導", source: "グラファイト", branch: "pulse", pos: { x: -5.3, y: 2.2 }, parent: "goji", maxLevel: 3, base: 26, effects: [{ stat: "pulseHaste", perLevel: 0.1 }], icon: "icon.battle.buf_agi", note: "結界の範囲内にいる他のヒーローの攻撃が速くなる（充電）" }),
  node({ id: "goji", name: "五事七計", source: "スクロール", branch: "pulse", pos: { x: -5.3, y: 1.2 }, parent: "tactics", maxLevel: 3, base: 22, effects: [{ stat: "pulseRangeAdd", perLevel: 0.2 }], icon: "icon.battle.buf_int" }),
  node({ id: "strategy", name: "ストラテジー", source: "スクロール", branch: "pulse", pos: { x: -5.8, y: 0.0 }, parent: "tactics", maxLevel: 4, base: 20, effects: [{ stat: "pulseDamagePct", perLevel: 0.25 }], icon: "icon.battle.phy" }),
  node({ id: "sekika", name: "石化の呪い", source: "シールド", branch: "pulse", pos: { x: -6.5, y: 1.1 }, parent: "goji", maxLevel: 3, base: 32, effects: [{ stat: "pulseStunChance", perLevel: 0.08 }], icon: "icon.battle.sleep", note: "結界の波動で確率スタン" }),
  node({ id: "koumei", name: "死せる孔明生ける仲達を走らす", source: "諸葛亮のパッシブ", branch: "pulse", pos: { x: -7.0, y: -0.1 }, parent: "strategy", maxLevel: 1, base: 90, effects: [{ stat: "pulseZhuge", perLevel: 1 }, { stat: "pulseDamagePct", perLevel: 0.25 }], icon: "hero.5015", note: "結界ヒーローが諸葛亮に交代。波動を受けた敵が脆弱（被ダメージ +15%）" }),
  node({ id: "renkan", name: "連環の計", source: "貂蝉のパッシブ", branch: "pulse", pos: { x: -8.2, y: 0.5 }, parent: "koumei", maxLevel: 3, base: 60, effects: [{ stat: "slowLink", perLevel: 0.1 }], icon: "icon.battle.confused", note: "鈍足中の敵に当てたダメージの一部が、他の鈍足中の敵全員にも伝わる" }),
  node({ id: "medusa", name: "メドゥーサの呪い", source: "シールド", branch: "pulse", pos: { x: -7.4, y: 1.9 }, parent: "sekika", maxLevel: 2, base: 36, effects: [{ stat: "pulseSlowDurAdd", perLevel: 0.5 }], icon: "icon.battle.dbf_agi", note: "鈍足が長く続く" }),

  // ─── 炎（猿飛佐助 → 皇帝ネロ / ドラゴン / タイガー） ───
  node({ id: "jiraika", name: "地雷火", source: "猿飛佐助のパッシブ", branch: "fire", pos: { x: 3.0, y: -1.4 }, parent: "brave_yabusame", maxLevel: 1, base: 50, effects: [{ stat: "unlockFire", perLevel: 1 }], icon: "hero.3038", note: "炎ヒーロー（猿飛佐助）を配置できるようになる" }),
  node({ id: "fukubaku", name: "伏爆の罠", source: "地雷", branch: "fire", pos: { x: 3.0, y: -2.6 }, parent: "jiraika", maxLevel: 3, base: 30, effects: [{ stat: "deathBlastChance", perLevel: 0.1 }], icon: "icon.battle.bleed", note: "撃破した敵が確率で爆発し、周りの敵にその最大 HP の 40% ダメージ（連鎖あり）" }),
  node({ id: "ryuou", name: "龍王の息吹", source: "ドラゴン", branch: "fire", pos: { x: 4.2, y: -1.0 }, parent: "jiraika", maxLevel: 4, base: 16, effects: [{ stat: "fireBurnPct", perLevel: 0.25 }], icon: "icon.battle.bleed", note: "炎上のダメージが増える" }),
  node({ id: "dragon_quake", name: "ドラゴンクエイク", source: "ドラゴン", branch: "fire", pos: { x: 4.0, y: -2.3 }, parent: "jiraika", maxLevel: 3, base: 22, effects: [{ stat: "fireBurnDurAdd", perLevel: 1 }], icon: "icon.battle.bleed", note: "炎上が長く続く" }),
  node({ id: "ryugan", name: "リュウガン", source: "ドラゴン", branch: "fire", pos: { x: 5.3, y: -1.6 }, parent: "ryuou", maxLevel: 2, base: 28, effects: [{ stat: "fireRangeAdd", perLevel: 0.25 }], icon: "icon.battle.buf_int" }),
  node({ id: "bokun", name: "暴君", source: "皇帝ネロのパッシブ", branch: "fire", pos: { x: 5.2, y: -2.9 }, parent: "dragon_quake", maxLevel: 1, base: 95, effects: [{ stat: "fireNero", perLevel: 1 }, { stat: "fireDamagePct", perLevel: 0.3 }, { stat: "fireRangeAdd", perLevel: 0.3 }], icon: "hero.3007", note: "炎ヒーローが皇帝ネロに交代。炎の攻撃力 +30%・射程 +0.3" }),
  node({ id: "tiger_shoot", name: "タイガーシュート", source: "タイガー", branch: "fire", pos: { x: 6.4, y: -2.2 }, parent: "bokun", maxLevel: 1, base: 70, effects: [{ stat: "critCombust", perLevel: 1 }], icon: "icon.battle.bleed", note: "弓の会心で、炎上中の敵が誘爆（炎上ダメージ ×3）" }),
  node({ id: "kenshiko", name: "剣歯虎の一撃", source: "タイガー", branch: "fire", pos: { x: 6.5, y: -0.9 }, parent: "ryugan", maxLevel: 3, base: 34, effects: [{ stat: "fireDamagePct", perLevel: 0.2 }], icon: "icon.battle.phy" }),

  // ─── 幻獣防衛（アーマー / ネックレス / ペン / カブト / シールド） ───
  node({ id: "novice_protection", name: "ノービスプロテクション", source: "アーマー", branch: "defense", pos: { x: -1.2, y: 0.8 }, parent: "root", maxLevel: 5, base: 5, effects: [{ stat: "maxHpAdd", perLevel: 3 }], icon: "icon.battle.hp" }),
  node({ id: "healing", name: "ヒーリング", source: "ネックレス", branch: "defense", pos: { x: -2.4, y: 0.6 }, parent: "novice_protection", maxLevel: 3, base: 10, effects: [{ stat: "healPerWave", perLevel: 1 }], icon: "icon.battle.resurrection", note: "Wave クリアごとに回復" }),
  node({ id: "elite_protection", name: "エリートプロテクション", source: "アーマー", branch: "defense", pos: { x: -1.8, y: 1.9 }, parent: "novice_protection", maxLevel: 3, base: 20, effects: [{ stat: "maxHpAdd", perLevel: 5 }], icon: "icon.battle.hp" }),
  node({ id: "fukutsu", name: "不屈のガンマン", source: "ワイアット・アープのパッシブ", branch: "defense", pos: { x: -2.0, y: 3.1 }, parent: "elite_protection", maxLevel: 3, base: 30, effects: [{ stat: "lostHpDamagePct", perLevel: 0.03 }], icon: "icon.battle.buf_phy", note: "幻獣が失った HP 1 ごとにヒーローの攻撃力アップ（最大 +100%）。HP を増やすほど強くなる" }),
  node({ id: "recovery", name: "リカバリー", source: "ペン", branch: "defense", pos: { x: -3.5, y: 1.1 }, parent: "healing", maxLevel: 3, base: 25, effects: [{ stat: "regenPerSec", perLevel: 0.03 }], icon: "icon.battle.resurrection", note: "時間とともに少しずつ回復" }),
  node({ id: "gunshin", name: "軍神の加護", source: "カブト", branch: "defense", pos: { x: -2.9, y: 2.6 }, parent: "elite_protection", maxLevel: 2, base: 35, effects: [{ stat: "leakIgnoreChance", perLevel: 0.25 }], icon: "icon.battle.dbf_phy", note: "ボス以外の敵の到達ダメージを確率で無効化" }),
  node({ id: "muketsu", name: "無血開城", source: "勝海舟のパッシブ", branch: "defense", pos: { x: -3.2, y: 3.6 }, parent: "gunshin", maxLevel: 2, base: 28, effects: [{ stat: "gumOnLeak", perLevel: 5 }], icon: "icon.gum", note: "敵に到達されるたびに、受けたダメージ 1 あたり 5 GUM を得る" }),
  node({ id: "seijo", name: "聖女の祈り", source: "シールド", branch: "defense", pos: { x: -4.2, y: 2.3 }, parent: "gunshin", maxLevel: 1, base: 80, effects: [{ stat: "lastStand", perLevel: 1 }], icon: "icon.battle.resurrection", note: "ボスの到達を 1 度だけ HP 1 で耐える" }),

  // ─── 幻獣砲（ネックレス / オリフラム） ───
  node({ id: "amenra", name: "アメン・ラーの陽光", source: "ネックレス", branch: "cannon", pos: { x: 0, y: 1.5 }, parent: "root", maxLevel: 1, base: 30, effects: [{ stat: "unlockCannon", perLevel: 1 }], icon: "icon.battle.buf_int", note: "幻獣砲が使えるようになる（GUM を消費して幻獣が光線を放つ）" }),
  node({ id: "taiyo", name: "太陽神の涙", source: "ネックレス", branch: "cannon", pos: { x: 0, y: 2.6 }, parent: "amenra", maxLevel: 4, base: 15, effects: [{ stat: "cannonDamagePct", perLevel: 0.3 }], icon: "icon.battle.phy" }),
  node({ id: "healing_light", name: "ヒーリングライト", source: "ネックレス", branch: "cannon", pos: { x: -1.0, y: 3.3 }, parent: "taiyo", maxLevel: 2, base: 24, effects: [{ stat: "cannonCostDown", perLevel: 1 }], icon: "icon.gum", note: "幻獣砲の消費 GUM -1" }),
  node({ id: "druid", name: "ドルイドの秘法", source: "ネックレス", branch: "cannon", pos: { x: 1.0, y: 3.3 }, parent: "taiyo", maxLevel: 2, base: 24, effects: [{ stat: "cannonWidthAdd", perLevel: 0.15 }], icon: "icon.battle.buf_int", note: "光線が太くなる" }),
  node({ id: "ougon_honoo", name: "黄金の炎", source: "オリフラム", branch: "cannon", pos: { x: 0, y: 4.2 }, parent: "taiyo", maxLevel: 1, base: 50, effects: [{ stat: "cannonBurn", perLevel: 1 }], icon: "icon.battle.bleed", note: "光線が炎上を与える" }),

  // ─── 経済（モアイ / マルクス / モノクル / パロット / ブーツ / ジュエルワームドラゴン / アルケブス） ───
  node({ id: "moai", name: "金箱レースの極意", source: "モアイ", branch: "economy", pos: { x: 1.2, y: 0.8 }, parent: "root", maxLevel: 3, base: 6, effects: [{ stat: "dropValueFlat", perLevel: 1 }], icon: "icon.gum", note: "撃破で落ちる GUM が増える" }),
  node({ id: "shihonron", name: "資本論", source: "マルクスのパッシブ", branch: "economy", pos: { x: 2.4, y: 0.6 }, parent: "moai", maxLevel: 3, base: 12, effects: [{ stat: "waveRewardPct", perLevel: 0.25 }], icon: "icon.gum" }),
  node({ id: "otakara", name: "お宝はいただいた！", source: "モノクル", branch: "economy", pos: { x: 1.8, y: 1.9 }, parent: "moai", maxLevel: 3, base: 8, effects: [{ stat: "collectRadiusAdd", perLevel: 0.2 }], icon: "icon.gum", note: "GUM の回収範囲が広がる" }),
  node({ id: "houseki", name: "宝石の囀り", source: "パロット", branch: "economy", pos: { x: 2.9, y: 2.8 }, parent: "otakara", maxLevel: 3, base: 12, effects: [{ stat: "dropLifetimeAdd", perLevel: 3 }], icon: "icon.gum", note: "GUM が消えるまでの時間が延びる" }),
  node({ id: "daichi_ougon", name: "大地黄金", source: "ブーツ", branch: "economy", pos: { x: 3.5, y: 1.1 }, parent: "shihonron", maxLevel: 3, base: 30, effects: [{ stat: "gumOnHitChance", perLevel: 0.04 }], icon: "icon.gum", note: "矢が命中するたびに確率で 1 GUM" }),
  node({ id: "houki", name: "宝輝創世", source: "ジュエルワームドラゴン", branch: "economy", pos: { x: 4.7, y: 1.5 }, parent: "daichi_ougon", maxLevel: 3, base: 45, effects: [{ stat: "dropValueFlat", perLevel: 1 }], icon: "icon.gum", note: "撃破で落ちる GUM がさらに増える" }),
  node({ id: "mouri", name: "毛利秀包の号令", source: "アルケブス", branch: "economy", pos: { x: 4.0, y: 2.6 }, parent: "shihonron", maxLevel: 3, base: 45, effects: [{ stat: "wealthDamagePct", perLevel: 0.03 }], icon: "icon.battle.phy", note: "所持 GUM 100 ごとに弓の攻撃力アップ（最大 +30%）" }),

  // ─── Wave 繰り上げ・ロックマス（ホース） ───
  node({ id: "ichinichi", name: "一日千里", source: "ホース", branch: "economy", pos: { x: 5.1, y: 2.7 }, parent: "houki", maxLevel: 1, base: 25, effects: [{ stat: "unlockSkip", perLevel: 1 }], icon: "icon.battle.buf_agi", note: "Wave の出現が終わったら次の Wave を繰り上げて呼べる（残りの敵の数だけボーナス GUM）" }),
  node({ id: "shintaku", name: "神託の軍馬", source: "ホース", branch: "economy", pos: { x: 6.2, y: 3.1 }, parent: "ichinichi", maxLevel: 2, base: 30, effects: [{ stat: "skipBonusPct", perLevel: 0.5 }], icon: "icon.gum", note: "繰り上げボーナス +50%" }),
  node({ id: "kihei", name: "騎兵突撃", source: "ホース", branch: "economy", pos: { x: 5.2, y: 3.9 }, parent: "ichinichi", maxLevel: 2, base: 28, effects: [{ stat: "lockedSlotCostPct", perLevel: 0.2 }], icon: "icon.gum", note: "ロックマスの開放費用 -20%" }),

  // ─── 採掘（サトシ・ナカモト / 財布） ───
  node({ id: "mining_alpha", name: "マイニング ALPHA CC", source: "サトシ・ナカモト ALPHA CC のパッシブ", branch: "miner", pos: { x: 3.4, y: -0.1 }, parent: "shihonron", maxLevel: 1, base: 35, effects: [{ stat: "unlockMiner", perLevel: 1 }], icon: "hero.2025", note: "採掘ヒーロー（サトシ・ナカモト ALPHA CC）を配置できるようになる" }),
  node({ id: "mikajime", name: "みかじめ料", source: "財布", branch: "miner", pos: { x: 4.6, y: 0.1 }, parent: "mining_alpha", maxLevel: 3, base: 18, effects: [{ stat: "minerTollAdd", perLevel: 1 }], icon: "icon.gum", note: "採掘の通行料 +1" }),
  node({ id: "shisan", name: "資産凍結", source: "財布", branch: "miner", pos: { x: 5.8, y: 0.5 }, parent: "mikajime", maxLevel: 3, base: 24, effects: [{ stat: "minerPayoutPct", perLevel: 0.5 }], icon: "icon.gum", note: "採掘の Wave 配当 +50%" }),
  node({ id: "mining_omega", name: "マイニング OMEGA CC", source: "サトシ・ナカモト OMEGA CC のパッシブ", branch: "miner", pos: { x: 6.0, y: 1.8 }, parent: "shisan", maxLevel: 1, base: 85, effects: [{ stat: "minerOmega", perLevel: 1 }, { stat: "minerTollAdd", perLevel: 1 }, { stat: "minerPayoutPct", perLevel: 0.5 }], icon: "hero.4034", note: "採掘ヒーローが OMEGA CC に交代。通行料 +1・配当 +50%" }),
  node({ id: "wisdom_shisan", name: "ウィズダム資産凍結", source: "財布", branch: "miner", pos: { x: 7.0, y: 0.9 }, parent: "shisan", maxLevel: 2, base: 30, effects: [{ stat: "minerRangeAdd", perLevel: 0.3 }], icon: "icon.battle.buf_int", note: "採掘の範囲が広がる" }),
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
  startGumAdd: (v) => `開始時の GUM ${signed(v, 0)}`,
  dropValueFlat: (v) => `撃破 GUM ${signed(v, 0)}`,
  collectRadiusAdd: (v) => `GUM 回収範囲 ${signed(v, 1)} マス`,
  dropLifetimeAdd: (v) => `GUM の消滅まで ${signed(v, 0)} 秒`,
  waveRewardPct: (v) => `Wave クリア報酬 ${pct(v)}`,
  gumOnHitChance: (v) => `命中時 ${Math.round(v * 100)}% で +1 GUM`,
};

function pct(v: number): string {
  return `${v >= 0 ? "+" : ""}${Math.round(v * 100)}%`;
}

function signed(v: number, digits: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}`;
}
