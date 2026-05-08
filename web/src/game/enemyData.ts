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

  // ─── SPEC-019: 拡張エネミー 6 種 ─────────────────────────
  // ステージ 1-4 以降 / World 2 で使う、より多彩な役割を持つ敵。
  // 高速ラッシャー / タンク / 高 HP / レンジ攻撃などをカバー。
  {
    id: 105,
    name: "クリーパー ロード",
    attackType: "PHY",
    hp: 220,
    phy: 22,
    int: 10,
    phyDef: 24,
    intDef: 12,
    speed: 0.55, // 超大型は超低速
    attackInterval: 1.4,
    imageUrl: `${ENEMY_IMAGE_BASE}/105.png`,
  },
  {
    id: 122,
    name: "ハートブリード ヴェンティ",
    attackType: "INT",
    hp: 110,
    phy: 8,
    int: 22,
    phyDef: 5,
    intDef: 18,
    speed: 0.9,
    attackInterval: 1.0,
    imageUrl: `${ENEMY_IMAGE_BASE}/122.png`,
  },
  {
    id: 132,
    name: "メリッサ クイーン",
    attackType: "INT",
    hp: 180,
    phy: 9,
    int: 28,
    phyDef: 8,
    intDef: 20,
    speed: 0.7,
    attackInterval: 1.3,
    imageUrl: `${ENEMY_IMAGE_BASE}/132.png`,
  },
  {
    id: 141,
    name: "シャドウ ストライダー",
    attackType: "PHY",
    hp: 60,
    phy: 18,
    int: 6,
    phyDef: 3,
    intDef: 3,
    speed: 1.45, // 高速ラッシャー
    attackInterval: 0.85,
    imageUrl: `${ENEMY_IMAGE_BASE}/141.png`,
  },
  {
    id: 151,
    name: "アイアン ガーディアン",
    attackType: "PHY",
    hp: 320,
    phy: 16,
    int: 6,
    phyDef: 36,
    intDef: 14,
    speed: 0.5, // タンク
    attackInterval: 1.5,
    imageUrl: `${ENEMY_IMAGE_BASE}/151.png`,
  },
  {
    id: 161,
    name: "ヴォイド スペクター",
    attackType: "INT",
    hp: 95,
    phy: 4,
    int: 30,
    phyDef: 6,
    intDef: 28,
    speed: 1.0,
    attackInterval: 0.9,
    imageUrl: `${ENEMY_IMAGE_BASE}/161.png`,
  },
];

export function findEnemy(id: number): EnemyDef | undefined {
  return ENEMIES.find((e) => e.id === id);
}
