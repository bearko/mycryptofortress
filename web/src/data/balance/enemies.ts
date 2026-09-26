/** SPEC-104 §4: エネミーのバランス値。名前と画像は MCH マスタ、数値は独自。 */
export interface EnemyDef {
  id: string;
  name: string;
  imageKey: string;
  hp: number;
  /** マス / 秒 */
  speed: number;
  /** 撃破時の GUM */
  reward: number;
  /** 幻獣に到達した時のダメージ */
  leak: number;
  boss?: boolean;
  /** 表示倍率 */
  scale?: number;
}

const defs: EnemyDef[] = [
  { id: "byte_s", name: "バイトバンディット ショート", imageKey: "enemy.161", hp: 12, speed: 1.0, reward: 3, leak: 1 },
  { id: "byte_t", name: "バイトバンディット トール", imageKey: "enemy.162", hp: 20, speed: 0.95, reward: 4, leak: 1 },
  { id: "byte_g", name: "バイトバンディット グランデ", imageKey: "enemy.163", hp: 34, speed: 0.9, reward: 6, leak: 2, scale: 1.1 },
  { id: "rabbit_s", name: "ラビット ショート", imageKey: "enemy.386", hp: 7, speed: 1.8, reward: 3, leak: 1 },
  { id: "rabbit_t", name: "ラビット トール", imageKey: "enemy.387", hp: 12, speed: 1.9, reward: 4, leak: 1 },
  {
    id: "boss_nobunaga",
    name: "ゴースト・織田信長",
    imageKey: "enemy.450",
    hp: 600,
    speed: 0.45,
    reward: 60,
    leak: 99,
    boss: true,
    scale: 1.6,
  },
];

export const ENEMIES: Readonly<Record<string, EnemyDef>> = Object.fromEntries(defs.map((d) => [d.id, d]));
