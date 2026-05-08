import type { EnemyDef } from "./types";

const ENEMY_IMAGE_BASE =
  "https://raw.githubusercontent.com/bearko/mycryptoheroes/main/Image/Enemies";

/**
 * SPEC-013（軽量版）: 敵を 4 種類に拡張。
 *
 * 各エネミーは `mycryptoheroes/Data/Enemies/enemies.json` の base_param を基に、
 * Stage1-1 系のバランスに合わせて HP / PHY / INT を 10 倍前後にスケール。
 * 防御値はサイズ感に応じて職業の防御スプレッドシート風に振り分けている。
 *
 * 種別 / 役割:
 *  - 101 クリーパー ショート — PHY タイプ・標準。既存。
 *  - 104 クリーパー ヴェンティ — PHY タイプ・大型。HP / PHY 高、移動遅い。
 *  - 121 ハートブリード ショート — INT タイプ・脆い。HP 低・INT 高・移動速い。
 *  - 131 メリッサ ショート — INT タイプ・標準。バランス寄り。
 */
export const ENEMIES: EnemyDef[] = [
  {
    id: 101,
    name: "クリーパー ショート",
    attackType: "PHY",
    hp: 80,
    phy: 8,
    int: 4,
    phyDef: 4,
    intDef: 4,
    speed: 0.9,
    attackInterval: 1.0,
    imageUrl: `${ENEMY_IMAGE_BASE}/101.png`,
  },
  {
    id: 104,
    name: "クリーパー ヴェンティ",
    attackType: "PHY",
    hp: 140,
    phy: 14,
    int: 8,
    phyDef: 12,
    intDef: 6,
    speed: 0.65, // 大型は遅い
    attackInterval: 1.2,
    imageUrl: `${ENEMY_IMAGE_BASE}/104.png`,
  },
  {
    id: 121,
    name: "ハートブリード ショート",
    attackType: "INT",
    hp: 55,
    phy: 6,
    int: 14,
    phyDef: 2,
    intDef: 8,
    speed: 1.15, // 速い
    attackInterval: 1.0,
    imageUrl: `${ENEMY_IMAGE_BASE}/121.png`,
  },
  {
    id: 131,
    name: "メリッサ ショート",
    attackType: "INT",
    hp: 75,
    phy: 6,
    int: 12,
    phyDef: 4,
    intDef: 10,
    speed: 0.95,
    attackInterval: 1.1,
    imageUrl: `${ENEMY_IMAGE_BASE}/131.png`,
  },
];

export function findEnemy(id: number): EnemyDef | undefined {
  return ENEMIES.find((e) => e.id === id);
}
