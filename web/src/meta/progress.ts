import { TREE, TREE_BY_ID, TREE_VERSION, nodeCost, type TokenId, type TreeNode } from "../data/tree";
import { MILESTONES, isMilestoneReached } from "../data/milestones";
import { LEVELS } from "../data/levels";
import type { LevelDef } from "../sim/level";
import { emptyModifiers, type RunModifiers } from "../sim/modifiers";
import { BUILD_SET_SLOTS, type LevelProgress, type SaveData } from "./save";

/**
 * SPEC-106 / 107 / 108: メタ進行の純粋関数。SaveData を受け取り、新しい SaveData を返す（破壊しない）。
 */

// ─── スキルツリー ─────────────────────────────────────────

export function nodeLevel(save: SaveData, id: string): number {
  const n = TREE_BY_ID.get(id);
  if (!n) return 0;
  return Math.min(n.maxLevel, save.meta.tree[id] ?? 0);
}

export type BuyBlock = "maxed" | "locked" | "tokens" | "unknown";

/** 購入できない理由（できるなら null） */
export function buyBlock(save: SaveData, id: string): BuyBlock | null {
  const n = TREE_BY_ID.get(id);
  if (!n) return "unknown";
  const lv = nodeLevel(save, id);
  if (lv >= n.maxLevel) return "maxed";
  if (n.parent && nodeLevel(save, n.parent) < 1) return "locked";
  if (save.meta.tokens[n.cost.token] < nodeCost(n, lv)) return "tokens";
  return null;
}

/** 親が解放済み（またはルート）で、表示上「手が届く」ノードか */
export function isReachable(save: SaveData, n: TreeNode): boolean {
  return !n.parent || nodeLevel(save, n.parent) >= 1;
}

export function buyNode(save: SaveData, id: string): SaveData {
  if (buyBlock(save, id) !== null) return save;
  const n = TREE_BY_ID.get(id)!;
  const lv = nodeLevel(save, id);
  const cost = nodeCost(n, lv);
  return withMeta(save, {
    tokens: { ...save.meta.tokens, [n.cost.token]: save.meta.tokens[n.cost.token] - cost },
    tree: { ...save.meta.tree, [id]: lv + 1 },
  });
}

/** ノードに使ったトークンの合計（レベル 0..lv-1 の費用） */
export function spentOn(n: TreeNode, lv: number): number {
  let sum = 0;
  for (let i = 0; i < lv; i++) sum += nodeCost(n, i);
  return sum;
}

/** 子孫ノード（自分は含まない） */
export function descendants(id: string): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (pid: string) => {
    for (const c of TREE) if (c.parent === pid) (out.push(c), walk(c.id));
  };
  walk(id);
  return out;
}

/**
 * 1 レベル返金する（無料 = 全額返却）。レベル 0 になる場合、子孫もすべて返金する
 * （親が 0 のノードは効果を持てないため）。
 */
export function refundNode(save: SaveData, id: string): SaveData {
  const n = TREE_BY_ID.get(id);
  const lv = n ? nodeLevel(save, id) : 0;
  if (!n || lv === 0) return save;
  const tree = { ...save.meta.tree };
  const tokens = { ...save.meta.tokens };
  tokens[n.cost.token] += nodeCost(n, lv - 1);
  if (lv - 1 === 0) {
    delete tree[id];
    for (const d of descendants(id)) {
      const dl = nodeLevel(save, d.id);
      if (dl > 0) tokens[d.cost.token] += spentOn(d, dl);
      delete tree[d.id];
    }
  } else {
    tree[id] = lv - 1;
  }
  return withMeta(save, { tokens, tree });
}

/** すべて返金する */
export function refundAll(save: SaveData): SaveData {
  const tokens = { ...save.meta.tokens };
  for (const n of TREE) tokens[n.cost.token] += spentOn(n, nodeLevel(save, n.id));
  return withMeta(save, { tokens, tree: {} });
}

export function totalSpent(save: SaveData, token: TokenId = "ce"): number {
  return TREE.filter((n) => n.cost.token === token).reduce((sum, n) => sum + spentOn(n, nodeLevel(save, n.id)), 0);
}

/**
 * SPEC-108 §1: スキルツリーの構成が変わった（TREE_VERSION が違う）セーブは全返金する。
 * CE はツリーにしか使わないので、所持 = 累計獲得に戻せば全額返金になる。
 */
export function syncTreeVersion(save: SaveData): { save: SaveData; refunded: boolean } {
  if (save.meta.treeVersion === TREE_VERSION) return { save, refunded: false };
  const hadTree = Object.keys(save.meta.tree).length > 0;
  return {
    save: withMeta(save, { tree: {}, tokens: { ...save.meta.tokensEarned }, treeVersion: TREE_VERSION }),
    refunded: hadTree,
  };
}

/** SPEC-108: ツリーからランの補正値を作る（未知の ID は無視、レベルは上限で切る） */
export function computeModifiers(save: SaveData): RunModifiers {
  const mods = emptyModifiers();
  for (const n of TREE) {
    const lv = nodeLevel(save, n.id);
    if (lv === 0 || (n.parent && nodeLevel(save, n.parent) === 0)) continue;
    for (const e of n.effects) mods[e.stat] += e.perLevel * lv;
  }
  // SPEC-116: ランに効くマイルストーン
  for (const m of MILESTONES) if (m.stat && isMilestoneReached(save, m.id)) mods[m.stat] += 1;
  return mods;
}

// ─── ビルドセット（SPEC-116） ─────────────────────────────

/** 今のツリーを枠 i に保存する */
export function saveBuildSet(save: SaveData, index: number, name: string): SaveData {
  if (index < 0 || index >= BUILD_SET_SLOTS) return save;
  const buildSets = [...save.meta.buildSets];
  buildSets[index] = { name, tree: { ...save.meta.tree } };
  return withMeta(save, { buildSets });
}

/**
 * 枠 i のビルドを読み込む: 全返金してから、保存したノードを親から順に買い直す。
 * トークンが足りない分は買えるところまで（戻り値の missing に数を返す）。
 */
export function loadBuildSet(save: SaveData, index: number): { save: SaveData; missing: number } {
  const set = save.meta.buildSets[index];
  if (!set) return { save, missing: 0 };
  let next = refundAll(save);
  let missing = 0;
  // TREE は親が先に並ぶとは限らないので、買えなくなるまで繰り返す
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const n of TREE) {
      const want = Math.min(n.maxLevel, set.tree[n.id] ?? 0);
      while (nodeLevel(next, n.id) < want && buyBlock(next, n.id) === null) {
        next = buyNode(next, n.id);
        progressed = true;
      }
    }
  }
  for (const n of TREE) missing += Math.max(0, Math.min(n.maxLevel, set.tree[n.id] ?? 0) - nodeLevel(next, n.id));
  return { save: next, missing };
}

export function clearBuildSet(save: SaveData, index: number): SaveData {
  const buildSets = [...save.meta.buildSets];
  buildSets[index] = null;
  return withMeta(save, { buildSets });
}

// ─── ラン結果と報酬 ───────────────────────────────────────

export interface RunResult {
  levelId: string;
  won: boolean;
  wavesReached: number;
  wavesCleared: number;
}

export interface RunReward {
  ce: number;
  /** SPEC-116a: 初回クリアのエンブレム */
  emblems: number;
  breakdown: { label: string; ce: number }[];
  firstClear: boolean;
}

/** SPEC-106: CE 報酬。負けても（撤退でも）クリアした Wave 分は必ずもらえる */
export function computeReward(level: LevelDef, result: RunResult, save: SaveData): RunReward {
  const firstClear = result.won && !save.meta.levels[level.id]?.cleared;
  const breakdown: RunReward["breakdown"] = [];
  if (result.wavesCleared > 0)
    breakdown.push({ label: `Wave クリア ×${result.wavesCleared}`, ce: result.wavesCleared * level.reward.perWave });
  if (result.won) breakdown.push({ label: "防衛成功", ce: level.reward.clear });
  if (firstClear) breakdown.push({ label: "初回クリア", ce: level.reward.firstClear });
  return { ce: breakdown.reduce((s, b) => s + b.ce, 0), emblems: firstClear ? (level.reward.emblems ?? 0) : 0, breakdown, firstClear };
}

export function applyRunResult(save: SaveData, result: RunResult, reward: RunReward): SaveData {
  const prev: LevelProgress = save.meta.levels[result.levelId] ?? { cleared: false, bestWave: 0, clears: 0, runs: 0 };
  return withMeta(save, {
    tokens: { ce: save.meta.tokens.ce + reward.ce, emblem: save.meta.tokens.emblem + reward.emblems },
    tokensEarned: { ce: save.meta.tokensEarned.ce + reward.ce, emblem: save.meta.tokensEarned.emblem + reward.emblems },
    levels: {
      ...save.meta.levels,
      [result.levelId]: {
        cleared: prev.cleared || result.won,
        bestWave: Math.max(prev.bestWave, result.wavesReached),
        clears: prev.clears + (result.won ? 1 : 0),
        runs: prev.runs + 1,
      },
    },
  });
}

/** 1 つ前のレベルをクリアしていれば解放（最初のレベルは常に解放） */
export function isLevelUnlocked(save: SaveData, levelId: string): boolean {
  const i = LEVELS.findIndex((l) => l.id === levelId);
  if (i <= 0) return i === 0;
  return !!save.meta.levels[LEVELS[i - 1].id]?.cleared;
}

// ─── 会話の既読 ───────────────────────────────────────────

export function hasSeen(save: SaveData, dialogId: string): boolean {
  return save.meta.seenDialogs.includes(dialogId);
}

export function markSeen(save: SaveData, dialogId: string): SaveData {
  return hasSeen(save, dialogId) ? save : withMeta(save, { seenDialogs: [...save.meta.seenDialogs, dialogId] });
}

function withMeta(save: SaveData, patch: Partial<SaveData["meta"]>): SaveData {
  return { ...save, meta: { ...save.meta, ...patch } };
}
