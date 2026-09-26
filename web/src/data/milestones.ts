import type { ModifierKey } from "../sim/modifiers";
import type { SaveData } from "../meta/save";

/**
 * SPEC-116: マイルストーン。累計獲得 CE が閾値に達すると無料で解放される自動化・便利機能
 * （Outhold の Free Milestones 相当）。ツリーの枠を使わず、返金の対象にもならない。
 */
export type MilestoneId = "autoCollect" | "buildSets" | "speed3x" | "autoLevel";

export interface Milestone {
  id: MilestoneId;
  name: string;
  description: string;
  /** 累計獲得 CE */
  threshold: number;
  icon: string;
  /** ランに効くものは補正値のフラグで渡す */
  stat?: ModifierKey;
}

export const MILESTONES: readonly Milestone[] = [
  { id: "autoCollect", name: "GUM 自動回収", description: "落ちた GUM が自動で幻獣のもとへ集まる", threshold: 120, icon: "icon.gum", stat: "autoCollect" },
  { id: "buildSets", name: "ビルドセット", description: "スキルツリーの配置を 5 つまで保存し、ワンタップで切り替えられる", threshold: 300, icon: "icon.ce" },
  { id: "speed3x", name: "倍速 3x", description: "ラン中の速度に 3 倍速が加わる", threshold: 600, icon: "icon.battle.buf_agi" },
  { id: "autoLevel", name: "オートレベル", description: "ラン中、余った GUM で一番低いレベルのヒーローを自動で強化する（切り替え可）", threshold: 1000, icon: "icon.battle.buf_phy" },
];

export const MILESTONE_BY_ID: ReadonlyMap<MilestoneId, Milestone> = new Map(MILESTONES.map((m) => [m.id, m]));

export function isMilestoneReached(save: SaveData, id: MilestoneId): boolean {
  const m = MILESTONE_BY_ID.get(id);
  return !!m && save.meta.tokensEarned.ce >= m.threshold;
}

/** 累計 CE が before → after に増えたときに新しく届いたマイルストーン */
export function newlyReached(before: number, after: number): Milestone[] {
  return MILESTONES.filter((m) => before < m.threshold && after >= m.threshold);
}
