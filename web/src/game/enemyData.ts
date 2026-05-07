import type { EnemyDef } from "./types";

const ENEMY_IMAGE_BASE =
  "https://raw.githubusercontent.com/bearko/mycryptoheroes/main/Image/Enemies";

/**
 * MVP で使用する敵。1 種類のみ。
 * ステータスは mycryptoheroes/Data/Enemies/enemies.json の base_param + 簡易成長補正。
 */
export const ENEMIES: EnemyDef[] = [
  {
    id: 101,
    name: "クリーパー ショート",
    attackType: "PHY",
    hp: 80, // base 8 + trend 42/10 ≒ 12 を Stage1-1 用に少しタフ目に補正
    phy: 8,
    int: 4,
    phyDef: 4,
    intDef: 4,
    speed: 0.9,
    imageUrl: `${ENEMY_IMAGE_BASE}/101.png`,
  },
];

export function findEnemy(id: number): EnemyDef | undefined {
  return ENEMIES.find((e) => e.id === id);
}
