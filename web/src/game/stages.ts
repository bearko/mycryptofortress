import type { MapDef, MapTileType, Wave } from "./types";

/**
 * SPEC-011: ステージ・ワールド階層。
 *
 * ワールド = 時代やテーマで括ったステージ群（最大 5 ステージ）
 * ステージ = 単独のバトルマップ（MapDef + Wave + 開始パラメータ）
 *
 * 設計ドキュメント記載のように、World 1 = 戦国時代 から始める。
 * ヒーロー Attribute によるフィルタやシナリオは SPEC-012 で扱う。
 */
export interface StageDef {
  /** "1-1" "1-2" のような表示用 ID */
  id: string;
  /** 所属する WorldDef.id */
  worldId: string;
  /** "ステージ 1-1" のような表示名 */
  name: string;
  /** 1〜2 行のフレーバー */
  description: string;
  map: MapDef;
  wave: Wave;
  /** 開始 CE。デフォルト 30 */
  startingCe?: number;
  /** ベース HP。デフォルト 5 */
  baseHp?: number;
}

export interface WorldDef {
  id: string;
  name: string;
  era: string;
  description: string;
  stages: StageDef[];
}

// ─── タイル行ヘルパ（10 列幅）
const cols = 10;
const obstacle = (): MapTileType[] => Array(cols).fill("obstacle");
const path = (): MapTileType[] => Array(cols).fill("path");
const wall = (): MapTileType[] => {
  const a: MapTileType[] = Array(cols).fill("wall");
  a[0] = "obstacle";
  a[9] = "obstacle";
  return a;
};

// ─── ステージ 1-1: 訓練場（基本）
const STAGE_1_1_MAP: MapDef = {
  id: "stage-1-1",
  cols,
  rows: 8,
  tiles: [
    obstacle(),
    path(), // route A
    wall(),
    obstacle(),
    obstacle(),
    wall(),
    (() => {
      const a = path();
      a[5] = "poison"; // 中央 1 マス毒沼
      return a;
    })(),
    obstacle(),
  ],
  routes: [
    { id: "A", points: [{ col: 0, row: 1 }, { col: 9, row: 1 }] },
    { id: "B", points: [{ col: 0, row: 6 }, { col: 9, row: 6 }] },
  ],
};

// ─── ステージ 1-2: 単一経路、敵 8 体
const STAGE_1_2_MAP: MapDef = {
  id: "stage-1-2",
  cols,
  rows: 8,
  tiles: [
    obstacle(),
    obstacle(),
    wall(),
    path(), // 中央 1 経路
    path(), // 2 マス幅で path_blocked デモ
    wall(),
    obstacle(),
    obstacle(),
  ],
  routes: [
    { id: "A", points: [{ col: 0, row: 3 }, { col: 9, row: 3 }] },
  ],
};
// row 4 は実際には敵が通らない (Route A は row 3) ので、見栄え用に path_blocked
STAGE_1_2_MAP.tiles[4] = (() => {
  const a: MapTileType[] = Array(cols).fill("path_blocked");
  return a;
})();

// ─── ステージ 1-3: 毒沼地獄、Route 上に poison が 3 マス
const STAGE_1_3_MAP: MapDef = {
  id: "stage-1-3",
  cols,
  rows: 8,
  tiles: [
    obstacle(),
    path(), // route A
    wall(),
    obstacle(),
    obstacle(),
    wall(),
    (() => {
      const a = path();
      a[3] = "poison";
      a[5] = "poison";
      a[7] = "poison";
      return a;
    })(),
    obstacle(),
  ],
  routes: [
    { id: "A", points: [{ col: 0, row: 1 }, { col: 9, row: 1 }] },
    { id: "B", points: [{ col: 0, row: 6 }, { col: 9, row: 6 }] },
  ],
};

// ─── 共通の Wave 定義
// 敵 ID:
//   101 = クリーパー ショート (PHY 標準)
//   104 = クリーパー ヴェンティ (PHY 大型・遅い・タフ)
//   121 = ハートブリード ショート (INT 速い・脆い)
//   131 = メリッサ ショート (INT 標準)

// 訓練用: クリーパー ショート 6 体
const WAVE_BASIC_6: Wave = {
  patterns: [
    { time: 1.0, enemyId: 101, routeId: "A" },
    { time: 2.0, enemyId: 101, routeId: "B" },
    { time: 4.0, enemyId: 101, routeId: "A" },
    { time: 6.0, enemyId: 101, routeId: "B" },
    { time: 8.0, enemyId: 101, routeId: "A" },
    { time: 10.0, enemyId: 101, routeId: "B" },
  ],
};

// 単一通路: クリーパー ヴェンティを 1 体だけ混ぜる（壁を超える）
const WAVE_SOLO_8: Wave = {
  patterns: [
    { time: 1.0, enemyId: 101, routeId: "A" },
    { time: 2.5, enemyId: 101, routeId: "A" },
    { time: 4.0, enemyId: 121, routeId: "A" }, // INT で削れる
    { time: 5.5, enemyId: 101, routeId: "A" },
    { time: 7.0, enemyId: 104, routeId: "A" }, // 中ボス級
    { time: 8.5, enemyId: 101, routeId: "A" },
    { time: 10.0, enemyId: 121, routeId: "A" },
    { time: 11.5, enemyId: 101, routeId: "A" },
  ],
};

// 毒の沼地: ハートブリード / メリッサで INT 攻撃を体験させる
const WAVE_HEAVY_8: Wave = {
  patterns: [
    { time: 1.0, enemyId: 121, routeId: "A" }, // 速い INT
    { time: 2.0, enemyId: 101, routeId: "B" }, // 毒沼で削れる
    { time: 3.0, enemyId: 131, routeId: "A" },
    { time: 4.0, enemyId: 101, routeId: "B" },
    { time: 6.0, enemyId: 121, routeId: "A" },
    { time: 7.0, enemyId: 104, routeId: "B" }, // タフだが毒沼を歩かされる
    { time: 9.0, enemyId: 131, routeId: "A" },
    { time: 10.0, enemyId: 131, routeId: "B" },
  ],
};

// ─── World 1: 戦国時代 — 訓練ワールド
export const WORLD_1: WorldDef = {
  id: "world-1",
  name: "戦国時代",
  era: "戦国",
  description: "戦国の各武将と戦いながら進む訓練ワールド。",
  stages: [
    {
      id: "1-1",
      worldId: "world-1",
      name: "ステージ 1-1 訓練場",
      description: "敵 6 体。上下 2 経路に毒沼が 1 マスある基礎ステージ。",
      map: STAGE_1_1_MAP,
      wave: WAVE_BASIC_6,
    },
    {
      id: "1-2",
      worldId: "world-1",
      name: "ステージ 1-2 単一通路",
      description: "敵 8 体が一本道で押し寄せる。後衛で削り、前衛で食い止める。",
      map: STAGE_1_2_MAP,
      wave: WAVE_SOLO_8,
      startingCe: 25,
    },
    {
      id: "1-3",
      worldId: "world-1",
      name: "ステージ 1-3 毒の沼地",
      description: "Route B に毒沼が 3 マス連続。下ルートはほぼ自滅させられる。",
      map: STAGE_1_3_MAP,
      wave: WAVE_HEAVY_8,
      startingCe: 35,
    },
  ],
};

export const ALL_WORLDS: WorldDef[] = [WORLD_1];

export function findStage(stageId: string): StageDef | undefined {
  for (const w of ALL_WORLDS) {
    const s = w.stages.find((st) => st.id === stageId);
    if (s) return s;
  }
  return undefined;
}

export function findWorld(worldId: string): WorldDef | undefined {
  return ALL_WORLDS.find((w) => w.id === worldId);
}

/** デフォルトで起動するステージ（後方互換: 旧 STAGE1_MAP / STAGE1_WAVE が暗黙的に指していた）*/
export const DEFAULT_STAGE_ID = "1-1";
