import { describe, it, expect, beforeEach } from "vitest";
import {
  clearAllProgress,
  getClearedStageIds,
  isStageCleared,
  markStageCleared,
} from "./progress";

// Vitest は jsdom 環境でない node なので、localStorage の最低限のシムを用意
class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.has(k) ? (this.data.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
  removeItem(k: string): void {
    this.data.delete(k);
  }
  clear(): void {
    this.data.clear();
  }
}

beforeEach(() => {
  // 各テスト前に in-memory localStorage を再注入
  const stub = new MemoryStorage();
  (globalThis as unknown as { localStorage: typeof stub }).localStorage = stub;
});

describe("progress.ts (SPEC-014)", () => {
  it("初期状態ではクリア済みは空", () => {
    expect(getClearedStageIds().size).toBe(0);
    expect(isStageCleared("1-1")).toBe(false);
  });

  it("markStageCleared でステージを記録できる", () => {
    markStageCleared("1-1");
    expect(isStageCleared("1-1")).toBe(true);
    expect(isStageCleared("1-2")).toBe(false);
    expect(getClearedStageIds().has("1-1")).toBe(true);
  });

  it("同じステージを複数回 mark しても重複しない", () => {
    markStageCleared("1-1");
    markStageCleared("1-1");
    markStageCleared("1-1");
    expect(getClearedStageIds().size).toBe(1);
  });

  it("複数ステージを記録できる", () => {
    markStageCleared("1-1");
    markStageCleared("1-2");
    markStageCleared("1-3");
    expect(getClearedStageIds().size).toBe(3);
  });

  it("clearAllProgress で全消去", () => {
    markStageCleared("1-1");
    markStageCleared("1-2");
    clearAllProgress();
    expect(getClearedStageIds().size).toBe(0);
  });

  it("壊れた JSON や古いバージョンは空 progress として扱う", () => {
    localStorage.setItem("fortress.progress.v1", "{not json");
    expect(getClearedStageIds().size).toBe(0);
    localStorage.setItem(
      "fortress.progress.v1",
      JSON.stringify({ version: 0, clearedStageIds: ["1-1"] }),
    );
    expect(getClearedStageIds().size).toBe(0);
  });
});
