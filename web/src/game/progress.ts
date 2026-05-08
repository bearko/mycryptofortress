/**
 * SPEC-014（軽量版）: クリア記録のセーブ / ロード。
 *
 * シンプルな localStorage バックエンドで、どのステージをクリアしたかを永続化する。
 * 互換性を考えてバージョンを持たせ、将来データ構造が変わっても安全に migrate できる。
 *
 * 後続 (SPEC-014 続編 / SPEC-015 想定):
 *   - クリアタイム / 撃破数 などのスコア
 *   - チーム編成保存
 *   - 設定（速度デフォルト・音量）
 */

const STORAGE_KEY = "fortress.progress.v1";

interface PersistedProgress {
  version: number;
  clearedStageIds: string[];
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
