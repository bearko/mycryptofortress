import { HEROES } from "./heroData";

/**
 * SPEC-014 / SPEC-015: クリア記録 + パーティ編成のセーブ / ロード。
 *
 * シンプルな localStorage バックエンドで、
 *   - どのステージをクリアしたか
 *   - どのヒーローをパーティに編成しているか
 * を永続化する。
 *
 * 互換性を考えてバージョンを持たせ、将来データ構造が変わっても安全に migrate できる。
 * SPEC-015 で `partyHeroIds` を追加（旧データには無いので fallback で初期 8 体を返す）。
 */

const STORAGE_KEY = "fortress.progress.v1";

/** SPEC-015: パーティ枠の上限 */
export const PARTY_LIMIT = 10;

interface PersistedProgress {
  version: number;
  clearedStageIds: string[];
  /** SPEC-015: 編成中のパーティ（hero ID の配列、最大 PARTY_LIMIT 体） */
  partyHeroIds?: number[];
}

const CURRENT_VERSION = 1;

function emptyProgress(): PersistedProgress {
  return { version: CURRENT_VERSION, clearedStageIds: [] };
}

function readRaw(): PersistedProgress {
  if (typeof localStorage === "undefined") return emptyProgress();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw) as PersistedProgress;
    if (!parsed || parsed.version !== CURRENT_VERSION) return emptyProgress();
    if (!Array.isArray(parsed.clearedStageIds)) return emptyProgress();
    return {
      version: parsed.version,
      clearedStageIds: parsed.clearedStageIds.filter(
        (id): id is string => typeof id === "string",
      ),
      partyHeroIds: Array.isArray(parsed.partyHeroIds)
        ? parsed.partyHeroIds.filter((id): id is number => typeof id === "number")
        : undefined,
    };
  } catch {
    return emptyProgress();
  }
}

function writeRaw(p: PersistedProgress): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // QuotaExceeded 等は無視（次回起動時には fresh）
  }
}

/** 全クリア済みステージ ID（重複排除済み） */
export function getClearedStageIds(): Set<string> {
  return new Set(readRaw().clearedStageIds);
}

/** 当該ステージがクリア済みか */
export function isStageCleared(stageId: string): boolean {
  return readRaw().clearedStageIds.includes(stageId);
}

/** ステージクリア記録を追加（重複は無視） */
export function markStageCleared(stageId: string): void {
  const p = readRaw();
  if (p.clearedStageIds.includes(stageId)) return;
  p.clearedStageIds.push(stageId);
  writeRaw(p);
}

/** すべての記録を消去（テスト用 / リセット用） */
export function clearAllProgress(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 読み取り専用環境などでは何もしない
  }
}

// ────────────────────────── SPEC-015: パーティ編成 ──────────────────────────

/**
 * 初期パーティ。HEROES の先頭 8 体（Common 全員）。
 * 既存 storage に partyHeroIds が無い場合のデフォルトとして使う。
 */
function defaultPartyIds(): number[] {
  return HEROES.slice(0, 8).map((h) => h.id);
}

/**
 * 現在のパーティ ID リストを返す。
 * - 保存値が無ければ defaultPartyIds() を返す。
 * - 保存値の中で「現存しない hero ID」「重複」「PARTY_LIMIT 超過」は除外する。
 */
export function getPartyHeroIds(): number[] {
  const raw = readRaw();
  if (!raw.partyHeroIds || raw.partyHeroIds.length === 0) {
    return defaultPartyIds();
  }
  const validIds = new Set(HEROES.map((h) => h.id));
  const seen = new Set<number>();
  const result: number[] = [];
  for (const id of raw.partyHeroIds) {
    if (!validIds.has(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= PARTY_LIMIT) break;
  }
  return result.length > 0 ? result : defaultPartyIds();
}

/**
 * パーティ ID リストを保存。
 * - PARTY_LIMIT を超えた分は切り捨て。
 * - 重複はその場で排除。
 * - HEROES に存在しない ID は無視。
 */
export function setPartyHeroIds(ids: number[]): void {
  const validIds = new Set(HEROES.map((h) => h.id));
  const seen = new Set<number>();
  const filtered: number[] = [];
  for (const id of ids) {
    if (!validIds.has(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    filtered.push(id);
    if (filtered.length >= PARTY_LIMIT) break;
  }
  const p = readRaw();
  p.partyHeroIds = filtered;
  writeRaw(p);
}
