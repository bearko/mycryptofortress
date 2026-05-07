export type AttackType = "PHY" | "INT";

export interface HeroDef {
  /** mycryptoheroes ID（数値） */
  id: number;
  /** 表示名（日本語） */
  name: string;
  /** 攻撃属性 */
  attackType: AttackType;
  /** コスト（CE） */
  cost: number;
  /** 物理攻撃力 */
  phy: number;
  /** 知力攻撃力 */
  int: number;
  /** 物理防御力（攻撃を受ける側で使用） */
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
  imageUrl: string;
}

/** Wave のスポーンパターン */
export interface SpawnPattern {
  /** ステージ開始からの秒数 */
  time: number;
  enemyId: number;
}

export interface Wave {
  patterns: SpawnPattern[];
}

/** タイル座標 (col, row) */
export interface TilePos {
  col: number;
  row: number;
}

export type TileKind = "path" | "placeable" | "blocked";
