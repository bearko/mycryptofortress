import type { HeroDef } from "./types";

/**
 * MVP で使用するヒーロー 3 体。
 * ステータスは [bearko/mycryptoheroes](https://github.com/bearko/mycryptoheroes) の
 * Data/Heroes/heroes.json から、`max_level_stats` をベースに採用している（一部丸め）。
 *
 * 画像は同リポジトリの raw URL を直接読み込む（CORS 許可済み）。
 * 失敗時は BootScene 側でカラープレースホルダにフォールバック。
 */
const HERO_IMAGE_BASE =
  "https://raw.githubusercontent.com/bearko/mycryptoheroes/main/Image/Heroes";

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
    range: 2.5,
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
    range: 2,
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
    range: 1.4,
    imageUrl: `${HERO_IMAGE_BASE}/4003.png`,
  },
];

export function findHero(id: number): HeroDef | undefined {
  return HEROES.find((h) => h.id === id);
}
