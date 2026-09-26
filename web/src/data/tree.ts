import type { ModifierKey } from "../sim/modifiers";

/**
 * SPEC-107: スキルツリー v0。ノード名は MCH のスキル名（エクステンションのアクティブスキル /
 * ヒーローのパッシブスキル）。コラボ系列と利用不可素材の名称は使わない。
 */
export type TreeBranch = "core" | "archer" | "defense" | "economy";
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
  // ─── ルート ───
  node({ id: "root", name: "ノービスショット", source: "マスケット", branch: "core", pos: { x: 0, y: 0 }, parent: null, maxLevel: 3, base: 3, effects: [{ stat: "damagePct", perLevel: 0.05 }], icon: "icon.battle.phy" }),

  // ─── 弓（ユミ / マスケット） ───
  node({ id: "yabusame", name: "ヤブサメ", source: "ユミ", branch: "archer", pos: { x: 0, y: -1.1 }, parent: "root", maxLevel: 5, base: 6, effects: [{ stat: "damagePct", perLevel: 0.1 }], icon: "icon.battle.phy" }),
  node({ id: "elite_yabusame", name: "エリートヤブサメ", source: "ユミ", branch: "archer", pos: { x: -1.1, y: -1.8 }, parent: "yabusame", maxLevel: 5, base: 10, effects: [{ stat: "attackSpeedPct", perLevel: 0.06 }], icon: "icon.battle.buf_agi" }),
  node({ id: "brave_yabusame", name: "ブレイブヤブサメ", source: "ユミ", branch: "archer", pos: { x: 1.1, y: -1.8 }, parent: "yabusame", maxLevel: 3, base: 12, effects: [{ stat: "rangeAdd", perLevel: 0.15 }], icon: "icon.battle.buf_int" }),
  node({ id: "brave_shot", name: "ブレイブショット", source: "マスケット", branch: "archer", pos: { x: 0, y: -2.2 }, parent: "yabusame", maxLevel: 3, base: 12, effects: [{ stat: "placeCostFlat", perLevel: 5 }], icon: "icon.gum" }),
  node({ id: "elite_shot", name: "エリートショット", source: "マスケット", branch: "archer", pos: { x: 0, y: -3.3 }, parent: "brave_shot", maxLevel: 4, base: 18, effects: [{ stat: "levelCostPct", perLevel: 0.06 }], icon: "icon.gum" }),
  node({ id: "kyudo", name: "キュードー", source: "ユミ", branch: "archer", pos: { x: -1.9, y: -2.7 }, parent: "elite_yabusame", maxLevel: 4, base: 15, effects: [{ stat: "critChance", perLevel: 0.05 }], icon: "icon.battle.buf_phy" }),
  node({ id: "kyudo_a", name: "キュードーA", source: "ユミ", branch: "archer", pos: { x: -3.0, y: -3.1 }, parent: "kyudo", maxLevel: 3, base: 25, effects: [{ stat: "critMulAdd", perLevel: 0.25 }], icon: "icon.battle.buf_phy" }),
  node({ id: "ogi_otoshi", name: "扇落とし", source: "ユミ", branch: "archer", pos: { x: -1.5, y: -3.8 }, parent: "kyudo", maxLevel: 3, base: 30, effects: [{ stat: "extraShotChance", perLevel: 0.1 }], icon: "icon.battle.decoy", note: "別の敵にもう 1 本の矢を放つ確率" }),
  node({ id: "sanjushi", name: "三銃士の一斉射撃", source: "マスケット", branch: "archer", pos: { x: -1.0, y: -4.9 }, parent: "ogi_otoshi", maxLevel: 1, base: 60, effects: [{ stat: "volley", perLevel: 1 }], icon: "icon.battle.decoy", note: "最大 3 体に同時射撃。1 本あたりの威力は ×0.55" }),
  node({ id: "nue_goroshi", name: "鵺殺し", source: "ユミ", branch: "archer", pos: { x: 1.9, y: -2.7 }, parent: "brave_yabusame", maxLevel: 3, base: 18, effects: [{ stat: "bossDamagePct", perLevel: 0.15 }], icon: "icon.battle.fear" }),
  node({ id: "snipe", name: "スナイプ", source: "マスケット", branch: "archer", pos: { x: 2.0, y: -3.9 }, parent: "nue_goroshi", maxLevel: 1, base: 40, effects: [{ stat: "rangeAdd", perLevel: 0.6 }, { stat: "attackSpeedPct", perLevel: -0.13 }], icon: "icon.battle.buf_int", note: "射程が大きく伸びる代わりに攻撃が遅くなる" }),

  // ─── 幻獣防衛（アーマー / ネックレス / ペン / カブト / シールド） ───
  node({ id: "novice_protection", name: "ノービスプロテクション", source: "アーマー", branch: "defense", pos: { x: -1.2, y: 0.8 }, parent: "root", maxLevel: 5, base: 5, effects: [{ stat: "maxHpAdd", perLevel: 3 }], icon: "icon.battle.hp" }),
  node({ id: "healing", name: "ヒーリング", source: "ネックレス", branch: "defense", pos: { x: -2.4, y: 0.6 }, parent: "novice_protection", maxLevel: 3, base: 10, effects: [{ stat: "healPerWave", perLevel: 1 }], icon: "icon.battle.resurrection", note: "Wave クリアごとに回復" }),
  node({ id: "elite_protection", name: "エリートプロテクション", source: "アーマー", branch: "defense", pos: { x: -1.8, y: 1.9 }, parent: "novice_protection", maxLevel: 3, base: 20, effects: [{ stat: "maxHpAdd", perLevel: 5 }], icon: "icon.battle.hp" }),
  node({ id: "recovery", name: "リカバリー", source: "ペン", branch: "defense", pos: { x: -3.5, y: 1.1 }, parent: "healing", maxLevel: 3, base: 25, effects: [{ stat: "regenPerSec", perLevel: 0.03 }], icon: "icon.battle.resurrection", note: "時間とともに少しずつ回復" }),
  node({ id: "gunshin", name: "軍神の加護", source: "カブト", branch: "defense", pos: { x: -2.9, y: 2.6 }, parent: "elite_protection", maxLevel: 2, base: 35, effects: [{ stat: "leakIgnoreChance", perLevel: 0.25 }], icon: "icon.battle.dbf_phy", note: "ボス以外の敵の到達ダメージを確率で無効化" }),
  node({ id: "seijo", name: "聖女の祈り", source: "シールド", branch: "defense", pos: { x: -4.2, y: 2.3 }, parent: "gunshin", maxLevel: 1, base: 80, effects: [{ stat: "lastStand", perLevel: 1 }], icon: "icon.battle.resurrection", note: "ボスの到達を 1 度だけ HP 1 で耐える" }),

  // ─── 経済（ヒーローのパッシブ / モノクル / パロット / ブーツ / アルケブス） ───
  node({ id: "golden_atelier", name: "黄金の工房", source: "ルーベンスのパッシブ", branch: "economy", pos: { x: 1.2, y: 0.8 }, parent: "root", maxLevel: 5, base: 5, effects: [{ stat: "startGumAdd", perLevel: 20 }], icon: "icon.gum" }),
  node({ id: "mining", name: "マイニング ALPHA CC", source: "サトシ・ナカモトのパッシブ", branch: "economy", pos: { x: 2.4, y: 0.6 }, parent: "golden_atelier", maxLevel: 5, base: 10, effects: [{ stat: "dropValuePct", perLevel: 0.1 }], icon: "icon.gum", note: "撃破で落ちる GUM が増える" }),
  node({ id: "otakara", name: "お宝はいただいた！", source: "モノクル", branch: "economy", pos: { x: 1.8, y: 1.9 }, parent: "golden_atelier", maxLevel: 3, base: 8, effects: [{ stat: "collectRadiusAdd", perLevel: 0.2 }], icon: "icon.gum", note: "GUM の回収範囲が広がる" }),
  node({ id: "houseki", name: "宝石の囀り", source: "パロット", branch: "economy", pos: { x: 2.9, y: 2.8 }, parent: "otakara", maxLevel: 3, base: 12, effects: [{ stat: "dropLifetimeAdd", perLevel: 3 }], icon: "icon.gum", note: "GUM が消えるまでの時間が延びる" }),
  node({ id: "shihonron", name: "資本論", source: "マルクスのパッシブ", branch: "economy", pos: { x: 3.5, y: 1.1 }, parent: "mining", maxLevel: 3, base: 20, effects: [{ stat: "waveRewardPct", perLevel: 0.25 }], icon: "icon.gum" }),
  node({ id: "daichi_ougon", name: "大地黄金", source: "ブーツ", branch: "economy", pos: { x: 4.4, y: 0.4 }, parent: "shihonron", maxLevel: 3, base: 35, effects: [{ stat: "gumOnHitChance", perLevel: 0.04 }], icon: "icon.gum", note: "矢が命中するたびに確率で 1 GUM" }),
  node({ id: "mouri", name: "毛利秀包の号令", source: "アルケブス", branch: "economy", pos: { x: 4.2, y: 2.2 }, parent: "shihonron", maxLevel: 3, base: 45, effects: [{ stat: "wealthDamagePct", perLevel: 0.03 }], icon: "icon.battle.phy", note: "所持 GUM 100 ごとに攻撃力アップ（最大 +30%）" }),
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
  volley: () => "最大 3 体に同時射撃",
  placeCostFlat: (v) => `配置コスト -${v} GUM`,
  levelCostPct: (v) => `強化コスト -${Math.round(v * 100)}%`,
  wealthDamagePct: (v) => `所持 GUM 100 ごとに攻撃力 ${pct(v)}`,
  maxHpAdd: (v) => `幻獣の最大 HP ${signed(v, 0)}`,
  healPerWave: (v) => `Wave クリア時に HP ${signed(v, 0)} 回復`,
  regenPerSec: (v) => `毎秒 HP ${signed(v, 2)} 回復`,
  leakIgnoreChance: (v) => `通常敵の到達を ${Math.round(v * 100)}% で無効化`,
  lastStand: () => "ボスの到達を 1 度だけ耐える",
  startGumAdd: (v) => `開始時の GUM ${signed(v, 0)}`,
  dropValuePct: (v) => `撃破 GUM ${pct(v)}`,
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
