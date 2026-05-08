import type { HeroDef, TilePos } from "./types";

/**
 * SPEC-003 §5.2: Common レアリティのヒーロー 8 体（mycryptoheroes/Data/Heroes/heroes.json
 * から ID 1001-1010 のうち、職業 8 種を網羅できる組み合わせを採用）。
 *
 * ステータスは `max_level_stats` をそのまま採用（HP / PHY / INT / AGI）。
 * `attackType` / `class` / `cost` / `attackPattern` はゲームバランス用の派生値で、
 * Passive スキル要約と Arknights 流の役割対応から決定している（SPEC-003 表参照）。
 *
 * SPEC-009 §5.4: phyDef / intDef を職業ベースで初期値設定。MCH 公式マスタは攻撃力
 * のみ持つため、設計ドキュメントの想定（[1lRHoKJ5...](https://docs.google.com/spreadsheets/d/1lRHoKJ5AFGh6dCvKJ41dPwnKuJaVmD8Bm7hlSIXe3ow/edit)）を
 * 参考に職業の役割で振り分けている暫定値:
 *
 *   重装 (defender):  phyDef 60 / intDef 30 — 物理タンク
 *   前衛 (guard):     phyDef 35 / intDef 25 — バランス近接
 *   先鋒 (vanguard):  phyDef 25 / intDef 20 — 軽装速攻
 *   特殊 (specialist):phyDef 30 / intDef 30 — 万能
 *   狙撃 (sniper):    phyDef 15 / intDef 10 — 紙装甲
 *   術師 (caster):    phyDef 10 / intDef 35 — INT 寄り
 *   医療 (medic):     phyDef 20 / intDef 30 — 中盤の支援
 *   補助 (supporter): phyDef 15 / intDef 40 — INT に厚い
 */
const HERO_IMAGE_BASE =
  "https://raw.githubusercontent.com/bearko/mycryptoheroes/main/Image/Heroes";

/** 4 マス直線（遠距離） */
const PATTERN_LINE_4: TilePos[] = [
  { col: 1, row: 0 },
  { col: 2, row: 0 },
  { col: 3, row: 0 },
  { col: 4, row: 0 },
];

/** 3 マス直線（中距離） */
const PATTERN_LINE_3: TilePos[] = [
  { col: 1, row: 0 },
  { col: 2, row: 0 },
  { col: 3, row: 0 },
];

/** 1 マス前 縦 3（前衛 / 重装の近接） */
const PATTERN_NEAR_3: TilePos[] = [
  { col: 1, row: -1 },
  { col: 1, row: 0 },
  { col: 1, row: 1 },
];

/** 縦 3 + 中央 1 マス前（前衛拡張） */
const PATTERN_NEAR_FAN: TilePos[] = [
  { col: 1, row: -1 },
  { col: 1, row: 0 },
  { col: 1, row: 1 },
  { col: 2, row: 0 },
];

/** 自身の周囲 8 タイル（補助 / 医療の支援範囲） */
const PATTERN_AROUND: TilePos[] = [
  { col: -1, row: -1 },
  { col: 0, row: -1 },
  { col: 1, row: -1 },
  { col: -1, row: 0 },
  { col: 1, row: 0 },
  { col: -1, row: 1 },
  { col: 0, row: 1 },
  { col: 1, row: 1 },
];

/** 直線 + 1 マス上下（術師の貫通気味） */
const PATTERN_PIERCE: TilePos[] = [
  { col: 1, row: 0 },
  { col: 2, row: 0 },
  { col: 3, row: 0 },
  { col: 1, row: -1 },
  { col: 1, row: 1 },
];

export const HEROES: HeroDef[] = [
  {
    id: 1001,
    name: "コナン・ドイル",
    class: "supporter",
    attackType: "INT",
    cost: 11,
    phy: 25,
    int: 69,
    phyDef: 15,
    intDef: 40,
    hp: 192,
    agi: 138,
    attackPattern: PATTERN_AROUND,
    imageUrl: `${HERO_IMAGE_BASE}/1001.png`,
  },
  {
    id: 1002,
    name: "甲斐姫",
    class: "vanguard",
    attackType: "PHY",
    cost: 9,
    phy: 79,
    int: 45,
    phyDef: 25,
    intDef: 20,
    hp: 162,
    agi: 118,
    attackPattern: PATTERN_NEAR_3,
    imageUrl: `${HERO_IMAGE_BASE}/1002.png`,
  },
  {
    id: 1003,
    name: "張遼",
    class: "sniper",
    attackType: "PHY",
    cost: 14,
    phy: 67,
    int: 62,
    phyDef: 15,
    intDef: 10,
    hp: 222,
    agi: 93,
    attackPattern: PATTERN_LINE_4,
    imageUrl: `${HERO_IMAGE_BASE}/1003.png`,
  },
  {
    id: 1004,
    name: "シートン",
    class: "caster",
    attackType: "INT",
    cost: 30,
    phy: 66,
    int: 69,
    phyDef: 10,
    intDef: 35,
    hp: 345,
    agi: 46,
    attackPattern: PATTERN_PIERCE,
    imageUrl: `${HERO_IMAGE_BASE}/1004.png`,
  },
  {
    id: 1006,
    name: "ピタゴラス",
    class: "guard",
    attackType: "PHY",
    cost: 25,
    phy: 84,
    int: 84,
    phyDef: 35,
    intDef: 25,
    hp: 216,
    agi: 56,
    attackPattern: PATTERN_NEAR_FAN,
    imageUrl: `${HERO_IMAGE_BASE}/1006.png`,
  },
  {
    id: 1007,
    name: "大長今",
    class: "medic",
    attackType: "INT",
    cost: 24,
    phy: 40,
    int: 115,
    phyDef: 20,
    intDef: 30,
    hp: 261,
    agi: 54,
    attackPattern: PATTERN_AROUND,
    imageUrl: `${HERO_IMAGE_BASE}/1007.png`,
  },
  {
    id: 1008,
    name: "ジョン・L・サリバン",
    class: "defender",
    attackType: "PHY",
    cost: 30,
    phy: 85,
    int: 35,
    phyDef: 60,
    intDef: 30,
    hp: 264,
    agi: 88,
    attackPattern: PATTERN_NEAR_3,
    imageUrl: `${HERO_IMAGE_BASE}/1008.png`,
  },
  {
    id: 1009,
    name: "ヘルクレスオオカブト",
    class: "specialist",
    attackType: "INT",
    cost: 26,
    phy: 72,
    int: 71,
    phyDef: 30,
    intDef: 30,
    hp: 267,
    agi: 64,
    attackPattern: PATTERN_LINE_3,
    imageUrl: `${HERO_IMAGE_BASE}/1009.png`,
  },
];

export function findHero(id: number): HeroDef | undefined {
  return HEROES.find((h) => h.id === id);
}
