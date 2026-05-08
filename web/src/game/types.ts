export type AttackType = "PHY" | "INT";

/**
 * Arknights 風職業 (SPEC-003)。
 * - path 系: defender / guard / vanguard / specialist
 * - wall 系: sniper / caster / medic / supporter
 */
export type HeroClass =
  | "defender"
  | "guard"
  | "vanguard"
  | "specialist"
  | "sniper"
  | "caster"
  | "medic"
  | "supporter";

export interface HeroDef {
  /** mycryptoheroes ID（数値） */
  id: number;
  /** 表示名（日本語） */
  name: string;
  /** Arknights 風職業 (SPEC-003) */
  class: HeroClass;
  /** 攻撃属性 */
  attackType: AttackType;
  /** コスト（CE） */
  cost: number;
  /** 物理攻撃力 */
  phy: number;
  /** 知力攻撃力 */
  int: number;
  /** 物理防御力 */
  phyDef: number;
  /** 知力防御力 */
  intDef: number;
  /** 最大 HP */
  hp: number;
  /** 攻撃間隔の元となる素早さ。AGI=100 で 1 秒、200 で 0.5 秒 */
  agi: number;
  /**
   * 攻撃範囲パターン（タイルベース）。`right` 向きを正規形とし、
   * `pattern.ts` の `rotatePattern` で他 3 方向に回転して使う。
   * SPEC-002 で導入。
   */
  attackPattern: TilePos[];
  /** 画像 URL（読み込み失敗時はプレースホルダにフォールバック） */
  imageUrl: string;
}

export interface EnemyDef {
  id: number;
  name: string;
  attackType: AttackType;
  hp: number;
  phy: number;
  int: number;
  phyDef: number;
  intDef: number;
  /** 1 秒あたりの移動マス数 */
  speed: number;
  /**
   * SPEC-009 §5.6: 攻撃間隔（秒）。Unity 版 EnemyRange.ShotInterval = 1.0/PlaySpeed
   * を踏襲し、デフォルト 1.0。種類ごとに早い/遅い敵を表現可能。
   */
  attackInterval: number;
  imageUrl: string;
}

/** Wave のスポーンパターン (SPEC-003 で routeId を追加) */
export interface SpawnPattern {
  /** ステージ開始からの秒数 */
  time: number;
  enemyId: number;
  /** どの Route を辿るか（MapDef の routes[].id を参照） */
  routeId: string;
}

export interface Wave {
  patterns: SpawnPattern[];
}

/** タイル座標 (col, row) */
export interface TilePos {
  col: number;
  row: number;
}

/**
 * SPEC-003 のマップタイル種別。
 * - `path`: 敵が通る。重装 / 前衛 / 先鋒 / 特殊（path 系職業）が配置可能。
 * - `wall`: 敵は通らない。狙撃 / 術師 / 医療 / 補助（wall 系職業）が配置可能。
 * - `obstacle`: 何も置けない、敵も通れない（飾り / 障害物）。
 */
export type MapTileType = "path" | "wall" | "obstacle";

/** ルート定義（敵が辿るウェイポイント列）。最後の点がゴール。 */
export interface RouteDef {
  id: string;
  points: TilePos[];
}

/** マップ全体定義 */
export interface MapDef {
  id: string;
  cols: number;
  rows: number;
  /** [row][col] のタイル種別 */
  tiles: MapTileType[][];
  /** 経路の集合 */
  routes: RouteDef[];
}

/** SPEC-002 で残していた古い API 互換用。SPEC-003 では MapDef の `tiles` 直接使用を推奨。 */
export type TileKind = MapTileType | "placeable";
