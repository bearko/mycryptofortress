import type { HeroDef, TilePos } from "./types";

/**
 * MVP で使用するヒーロー 3 体。
 * ステータスは [bearko/mycryptoheroes](https://github.com/bearko/mycryptoheroes) の
 * Data/Heroes/heroes.json から、`max_level_stats` をベースに採用している（一部丸め）。
 *
 * 画像は同リポジトリの raw URL を直接読み込む（CORS 許可済み）。
 * 失敗時は BootScene 側でカラープレースホルダにフォールバック。
 *
 * SPEC-002: `range`（円）から `attackPattern`（タイル集合・右向き正規形）に置き換え。
 */
const HERO_IMAGE_BASE =
  "https://raw.githubusercontent.com/bearko/mycryptoheroes/main/Image/Heroes";

/** 4 タイル直線（INT 系・遠距離） */
const PATTERN_LINE_4: TilePos[] = [
  { col: 1, row: 0 },
  { col: 2, row: 0 },
  { col: 3, row: 0 },
  { col: 4, row: 0 },
];

/** 3 タイル幅 × 2 列 + 先端 1 タイル（PHY 系・中距離） */
const PATTERN_FAN_3: TilePos[] = [
  { col: 1, row: -1 },
  { col: 1, row: 0 },
  { col: 1, row: 1 },
  { col: 2, row: -1 },
  { col: 2, row: 0 },
  { col: 2, row: 1 },
  { col: 3, row: 0 },
];

/** 1 タイル前 縦 3（PHY 系・近距離） */
const PATTERN_NEAR_3: TilePos[] = [
  { col: 1, row: -1 },
  { col: 1, row: 0 },
  { col: 1, row: 1 },
];

export const HEROES: HeroDef[] = [
  {
    id: 1001,
    name: "コナン・ドイル",
    attackType: "INT",
    cost: 30,
    phy: 25,
    int: 69,
    phyDef: 0,
    intDef: 0,
    hp: 192,
    agi: 138,
    attackPattern: PATTERN_LINE_4,
    imageUrl: `${HERO_IMAGE_BASE}/1001.png`,
  },
  {
    id: 3009,
    name: "ヒーロー#3009",
    attackType: "PHY",
    cost: 25,
    phy: 60,
    int: 20,
    phyDef: 0,
    intDef: 0,
    hp: 240,
    agi: 110,
    attackPattern: PATTERN_FAN_3,
    imageUrl: `${HERO_IMAGE_BASE}/3009.png`,
  },
  {
    id: 4003,
    name: "ヒーロー#4003",
    attackType: "PHY",
    cost: 20,
    phy: 75,
    int: 10,
    phyDef: 0,
    intDef: 0,
    hp: 320,
    agi: 90,
    attackPattern: PATTERN_NEAR_3,
    imageUrl: `${HERO_IMAGE_BASE}/4003.png`,
  },
];

export function findHero(id: number): HeroDef | undefined {
  return HEROES.find((h) => h.id === id);
}
