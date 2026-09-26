import { TREE, TREE_BY_ID, TREE_VERSION, isConditional, nodeCost, type ConditionStat, type FeatureId, type TokenId, type TreeNode } from "../data/tree";
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
  // SPEC-119: 条件つきパネルは記録から決まる（届いたしきい値の数）
  if (n.condition) {
    const v = conditionValue(save, n.condition.stat);
    return n.condition.thresholds.filter((t) => v >= t).length;
  }
  return Math.min(n.maxLevel, save.meta.tree[id] ?? 0);
}

/** SPEC-119: 条件つきパネルの判定に使う記録の現在値 */
export function conditionValue(save: SaveData, stat: ConditionStat): number {
  if (stat === "ceEarned") return save.meta.tokensEarned.ce;
  if (stat === "levelsCleared") return Object.values(save.meta.levels).filter((p) => p.cleared).length;
  return save.meta.stats[stat];
}

/** 条件つきパネルの次のしきい値（最大なら null） */
export function nextThreshold(save: SaveData, n: TreeNode): number | null {
  if (!n.condition) return null;
  return n.condition.thresholds[nodeLevel(save, n.id)] ?? null;
}

/** SPEC-119: 画面の機能（ビルドセット・3 倍速・オートレベル）が解放済みか */
export function isFeatureUnlocked(save: SaveData, feature: FeatureId): boolean {
  return TREE.some((n) => n.feature === feature && nodeLevel(save, n.id) > 0);
}

/** 条件つきパネルのレベルを並べたもの（リザルトで新しく届いたパネルを知らせるため） */
export function conditionalLevels(save: SaveData): Record<string, number> {
  const out: Record<string, number> = {};
  for (const n of TREE) if (n.condition) out[n.id] = nodeLevel(save, n.id);
  return out;
}

/** before → after で上がった条件つきパネル */
export function newlyUnlocked(before: Record<string, number>, after: SaveData): { node: TreeNode; level: number }[] {
  return TREE.filter((n) => n.condition && nodeLevel(after, n.id) > (before[n.id] ?? 0)).map((n) => ({ node: n, level: nodeLevel(after, n.id) }));
}

/** SPEC-119: 次のしきい値に一番近い条件つきパネル（進み具合 0〜1 が最大のもの） */
export function closestUnlock(save: SaveData): { node: TreeNode; remaining: number; progress: number } | null {
  let best: { node: TreeNode; remaining: number; progress: number } | null = null;
  for (const n of TREE) {
    const next = nextThreshold(save, n);
    if (!n.condition || next === null) continue;
    const lv = nodeLevel(save, n.id);
    const prev = lv > 0 ? n.condition.thresholds[lv - 1] : 0;
    const v = conditionValue(save, n.condition.stat);
    const progress = Math.max(0, Math.min(1, (v - prev) / (next - prev)));
    if (!best || progress > best.progress) best = { node: n, remaining: next - v, progress };
  }
  return best;
}

export type BuyBlock = "maxed" | "locked" | "tokens" | "condition" | "unknown";

/** 購入できない理由（できるなら null） */
export function buyBlock(save: SaveData, id: string): BuyBlock | null {
  const n = TREE_BY_ID.get(id);
  if (!n) return "unknown";
  const lv = nodeLevel(save, id);
  if (lv >= n.maxLevel) return "maxed";
  if (n.condition) return "condition";
  if (n.parent && nodeLevel(save, n.parent) < 1) return "locked";
  if (save.meta.tokens[n.cost.token] < nodeCost(n, lv)) return "tokens";
  return null;
}

/** 親が解放済み（またはルート）で、表示上「手が届く」ノードか */
export function isReachable(save: SaveData, n: TreeNode): boolean {
  return !n.parent || isConditional(n) || nodeLevel(save, n.parent) >= 1;
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
  if (n.condition) return 0;
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
  if (!n || lv === 0 || n.condition) return save;
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
  return TREE.filter((n) => !n.condition && n.cost.token === token).reduce((sum, n) => sum + spentOn(n, nodeLevel(save, n.id)), 0);
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
    // 条件つきパネルは親が未解放でも効く（SPEC-119）
    if (lv === 0 || (!n.condition && n.parent && nodeLevel(save, n.parent) === 0)) continue;
    for (const e of n.effects) mods[e.stat] += e.perLevel * lv;
  }
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
  /** SPEC-119: 累計記録に足すラン中の記録（省略時は 0 扱い） */
  kills?: number;
  bossKills?: number;
  gumCollected?: number;
  damageTaken?: number;
}

/** RunSim の記録から RunResult を作る */
export function runResultOf(
  levelId: string,
  won: boolean,
  stats: { wavesReached: number; wavesCleared: number; kills: number; bossKills: number; gumEarned: number; damageTaken: number },
): RunResult {
  return {
    levelId,
    won,
    wavesReached: stats.wavesReached,
    wavesCleared: stats.wavesCleared,
    kills: stats.kills,
    bossKills: stats.bossKills,
    gumCollected: stats.gumEarned,
    damageTaken: stats.damageTaken,
  };
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
  const st = save.meta.stats;
  return withMeta(save, {
    stats: {
      kills: st.kills + (result.kills ?? 0),
      bossKills: st.bossKills + (result.bossKills ?? 0),
      gumCollected: st.gumCollected + Math.round(result.gumCollected ?? 0),
      wavesCleared: st.wavesCleared + result.wavesCleared,
      flawlessClears: st.flawlessClears + (result.won && (result.damageTaken ?? 0) === 0 ? 1 : 0),
      runs: st.runs + 1,
    },
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

/**
 * 次に挑むノード: from がまだ未クリアならそのまま（再挑戦）、クリア済みなら
 * その先で最初の未クリア（解放済み）のノード。すべてクリア済みなら from。
 */
export function nextChallengeLevel(save: SaveData, fromId: string): string {
  if (!save.meta.levels[fromId]?.cleared) return fromId;
  const i = LEVELS.findIndex((l) => l.id === fromId);
  const next = LEVELS.slice(i + 1).find((l) => isLevelUnlocked(save, l.id) && !save.meta.levels[l.id]?.cleared);
  return next?.id ?? fromId;
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
