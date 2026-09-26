import type { ModifierKey } from "../../sim/modifiers";
import type { RoleId } from "./heroes";

/**
 * SPEC-115: 魔石（Outhold の元素アーティファクト相当）。
 * MCH の素材「魔石」4 種（イフリート / リヴァイアサン / ティアマト / ガルーダ）をそのまま使う。
 * ヒーロー（または幻獣砲）に 1 つ装着すると、その属性の効果が乗り、ロールごとに挙動が変わる。
 * 属性マスに置いたヒーローは魔石なしでその属性を得る。
 */
export const STONE_IDS = ["ifrit", "leviathan", "tiamat", "garuda"] as const;
export type StoneId = (typeof STONE_IDS)[number];

export type StoneTarget = RoleId | "cannon";

export interface StoneDef {
  id: StoneId;
  /** MCH の素材名 */
  name: string;
  /** 属性（UI 表示） */
  element: string;
  imageKey: string;
  color: number;
  /** ツリーで解放するフラグ */
  unlock: ModifierKey;
  /** 装着先ごとの効果（UI 表示。★ = 挙動が変わるもの） */
  effects: Record<StoneTarget, string>;
}

export const STONES: Record<StoneId, StoneDef> = {
  ifrit: {
    id: "ifrit",
    name: "イフリートの魔石",
    element: "炎",
    imageKey: "stone.ifrit",
    color: 0xff6a3d,
    unlock: "stoneIfrit",
    effects: {
      archer: "★火矢: 命中で小爆発（周りに 50%）し、炎上させる",
      lightning: "連鎖した敵すべてを炎上させる",
      pulse: "★炎の結界: 波動を受けた敵すべてを炎上させる",
      fire: "炎上の積み上げ +30%・上限 +50%",
      miner: "★焼き討ち: 通行料を払った敵を炎上させる",
      cannon: "光線が炎上を与える",
    },
  },
  leviathan: {
    id: "leviathan",
    name: "リヴァイアサンの魔石",
    element: "水",
    imageKey: "stone.leviathan",
    color: 0x3db4ff,
    unlock: "stoneLeviathan",
    effects: {
      archer: "命中で鈍足（25%）",
      lightning: "★放電で敵を押し戻す（0.8 マス）",
      pulse: "鈍足 +15%・スタン確率 +10%",
      fire: "★冷炎: 炎を浴びた敵が鈍足になる",
      miner: "★渦潮: 通行料を払った敵が鈍足（35%）になる",
      cannon: "光線が鈍足を与える",
    },
  },
  tiamat: {
    id: "tiamat",
    name: "ティアマトの魔石",
    element: "地",
    imageKey: "stone.tiamat",
    color: 0x9bd35a,
    unlock: "stoneTiamat",
    effects: {
      archer: "命中で必ず毒・攻撃力 +15%",
      lightning: "★毒連鎖: 連鎖した敵すべてに毒",
      pulse: "★毒の結界: 波動を受けた敵すべてに毒",
      fire: "炎の攻撃力 +30%",
      miner: "★地脈: 通行料が 2 倍",
      cannon: "光線が毒を与える",
    },
  },
  garuda: {
    id: "garuda",
    name: "ガルーダの魔石",
    element: "風",
    imageKey: "stone.garuda",
    color: 0xe7f0ff,
    unlock: "stoneGaruda",
    effects: {
      archer: "★疾風: 毎回 2 体に矢を放つ・攻撃速度 +15%",
      lightning: "連鎖 +2・跳ぶ距離 +0.6",
      pulse: "★波動の間隔が 0.6 倍",
      fire: "★十字火球: 攻撃のたびに縦横 4 方向へ貫通する火を放つ",
      miner: "範囲 +0.8・配当 +50%",
      cannon: "光線が太くなる（×1.5）",
    },
  },
};

/** ガルーダ（風）を持つヒーローの射程内では、隠れた敵（カメレオン）が見える */
export const STONE_REVEALS: StoneId = "garuda";

/** 数値（ロジックはここを参照するだけ） */
export const STONE_NUM = {
  ifritSplash: 0.8,
  ifritSplashPct: 0.5,
  ifritBurnPct: 0.3,
  ifritBurnDuration: 3,
  ifritFireBurnMul: 1.3,
  ifritFireCapMul: 1.5,
  ifritMinerBurn: 1.5,
  levSlow: 0.25,
  levSlowDuration: 1.5,
  levKnockback: 0.8,
  levPulseSlow: 0.15,
  levPulseStun: 0.1,
  levFireSlow: 0.2,
  levMinerSlow: 0.35,
  levMinerSlowDuration: 2,
  tiamatArcherDmg: 0.15,
  tiamatFireDmg: 0.3,
  tiamatMinerMul: 2,
  garudaArcherSpeed: 0.15,
  garudaChains: 2,
  garudaJumpRange: 0.6,
  garudaPulseInterval: 0.6,
  garudaCrossDmg: 1.5,
  garudaCrossExtra: 2,
  garudaCrossWidth: 0.4,
  garudaMinerRange: 0.8,
  garudaMinerPayout: 0.5,
  garudaCannonWidth: 1.5,
  cannonSlow: 0.3,
} as const;
