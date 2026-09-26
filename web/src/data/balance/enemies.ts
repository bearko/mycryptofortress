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
  /** 跳躍（Leaper）: interval 秒ごとに duration 秒かけて経路上を distance マス前進する */
  leap?: { interval: number; distance: number; duration: number };
  /** 状態異常への耐性（0〜1）。鈍足・スタンの効き目と炎上・毒のダメージを (1 - resist) 倍にする。ボスの既定は 0.5 */
  resist?: number;
  /** 分裂: 撃破時に同じ位置から敵を出す */
  split?: { enemy: string; count: number };
  /** 双子: 同じグループの片方が倒れると、残りが永続的に加速する */
  twinGroup?: string;
}

/** 双子の片割れが倒れた時の加速 */
export const TWIN_ENRAGE = 0.6;

export function resistOf(def: EnemyDef): number {
  return def.resist ?? (def.boss ? 0.5 : 0);
}

const defs: EnemyDef[] = [
  { id: "byte_s", name: "バイトバンディット ショート", imageKey: "enemy.161", hp: 12, speed: 1.0, reward: 3, leak: 1 },
  { id: "byte_t", name: "バイトバンディット トール", imageKey: "enemy.162", hp: 20, speed: 0.95, reward: 4, leak: 1 },
  { id: "byte_g", name: "バイトバンディット グランデ", imageKey: "enemy.163", hp: 34, speed: 0.9, reward: 6, leak: 2, scale: 1.1 },
  { id: "rabbit_s", name: "ラビット ショート", imageKey: "enemy.386", hp: 7, speed: 1.8, reward: 3, leak: 1 },
  { id: "rabbit_t", name: "ラビット トール", imageKey: "enemy.387", hp: 12, speed: 1.9, reward: 4, leak: 1 },
  { id: "creeper_s", name: "クリーパー ショート", imageKey: "enemy.101", hp: 14, speed: 0.8, reward: 4, leak: 1, leap: { interval: 4, distance: 2.5, duration: 0.5 } },
  { id: "creeper_t", name: "クリーパー トール", imageKey: "enemy.102", hp: 24, speed: 0.8, reward: 5, leak: 1, leap: { interval: 3.5, distance: 2.5, duration: 0.5 } },
  { id: "bagle_s", name: "ベーグル ショート", imageKey: "enemy.181", hp: 40, speed: 0.6, reward: 7, leak: 2, resist: 0.5, scale: 1.1 },
  { id: "bagle_t", name: "ベーグル トール", imageKey: "enemy.182", hp: 70, speed: 0.55, reward: 10, leak: 3, resist: 0.5, scale: 1.2 },
  { id: "love_mini", name: "ラブレター ショート", imageKey: "enemy.397", hp: 8, speed: 1.3, reward: 1, leak: 1, scale: 0.8 },
  { id: "love_t", name: "ラブレター トール", imageKey: "enemy.398", hp: 30, speed: 0.9, reward: 4, leak: 1, split: { enemy: "love_mini", count: 2 } },
  { id: "love_g", name: "ラブレター グランデ", imageKey: "enemy.399", hp: 55, speed: 0.85, reward: 6, leak: 2, split: { enemy: "love_t", count: 2 }, scale: 1.15 },
  {
    id: "boss_kenshin",
    name: "ゴースト・上杉謙信",
    imageKey: "enemy.425",
    hp: 2200,
    speed: 0.42,
    reward: 140,
    leak: 99,
    boss: true,
    scale: 1.6,
  },
  {
    id: "boss_grimm",
    name: "ゴースト・グリム兄弟",
    imageKey: "enemy.421",
    hp: 1500,
    speed: 0.45,
    reward: 90,
    leak: 99,
    boss: true,
    scale: 1.5,
    twinGroup: "brothers",
  },
  {
    id: "boss_wright",
    name: "ゴースト・ライト兄弟",
    imageKey: "enemy.725",
    hp: 1500,
    speed: 0.45,
    reward: 90,
    leak: 99,
    boss: true,
    scale: 1.5,
    twinGroup: "brothers",
  },
  {
    id: "boss_shingen",
    name: "ゴースト・武田信玄",
    imageKey: "enemy.519",
    hp: 3600,
    speed: 0.4,
    reward: 180,
    leak: 99,
    boss: true,
    resist: 0.8,
    scale: 1.7,
  },
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
  {
    id: "boss_himiko",
    name: "ゴースト・卑弥呼",
    imageKey: "enemy.448",
    hp: 1400,
    speed: 0.42,
    reward: 90,
    leak: 99,
    boss: true,
    scale: 1.6,
  },
  {
    id: "boss_napoleon",
    name: "ゴースト・ナポレオン・ボナパルト",
    imageKey: "enemy.445",
    hp: 1750,
    speed: 0.4,
    reward: 130,
    leak: 99,
    boss: true,
    scale: 1.6,
  },
];

export const ENEMIES: Readonly<Record<string, EnemyDef>> = Object.fromEntries(defs.map((d) => [d.id, d]));
