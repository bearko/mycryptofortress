import type { HeroClass, MapTileType } from "./types";

/**
 * SPEC-010 §5.4: タイルヘルプ表示用の情報テーブル。
 * プレイヤーがタイルをタップしたときに、名称・効果・配置可能職業を一目でわかる形で
 * 出すためのメタデータ。GAME ロジックには関与しない（純粋に表示専用）。
 */
export interface TileInfo {
  /** 画面に出す日本語名 */
  label: string;
  /** 1〜2 行の効果説明 */
  description: string;
  /** 配置可能な職業（無ければ空配列） */
  placeable: HeroClass[];
  /** ハイライト用カラー（タイル色と揃える） */
  accentColor: string;
}

const PATH_CLASSES: HeroClass[] = ["defender", "guard", "vanguard", "specialist"];
const WALL_CLASSES: HeroClass[] = ["sniper", "caster", "medic", "supporter"];

export const TILE_INFO: Record<MapTileType, TileInfo> = {
  path: {
    label: "床",
    description: "敵が通る通路。近距離タイプのヒーローを配置できる。",
    placeable: PATH_CLASSES,
    accentColor: "#c59b6c",
  },
  wall: {
    label: "高台",
    description: "敵は通らない。遠距離タイプのヒーローを配置できる。",
    placeable: WALL_CLASSES,
    accentColor: "#9ca3af",
  },
  obstacle: {
    label: "壁",
    description: "敵もヒーローも入れない障害物。",
    placeable: [],
    accentColor: "#374151",
  },
  poison: {
    label: "毒沼",
    description: "敵が歩くと毎秒ダメージを受ける。ヒーロー配置は不可。",
    placeable: [],
    accentColor: "#a855f7",
  },
  path_blocked: {
    label: "配置不可な床",
    description: "敵が通る通路だが、ヒーローは設置できない。",
    placeable: [],
    accentColor: "#7c2d12",
  },
};

/** SPEC-010 §5.3: poison タイル上の敵に与えるダメージ（毎秒） */
export const POISON_DAMAGE_PER_SEC = 8;
