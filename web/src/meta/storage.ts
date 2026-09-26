/** SPEC-101 §5.5: localStorage 互換の最小インターフェース（テストで差し替える）。 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

/**
 * ブラウザの localStorage を返す。プライベートモード等で使えない場合は
 * メモリストレージにフォールバックする（その場合リロードで消える）。
 */
export function getBrowserStorage(): { storage: StorageLike; persistent: boolean } {
  try {
    const ls = globalThis.localStorage;
    const probe = "__mcf_probe__";
    ls.setItem(probe, "1");
    ls.removeItem(probe);
    return { storage: ls, persistent: true };
  } catch {
    return { storage: createMemoryStorage(), persistent: false };
  }
}
