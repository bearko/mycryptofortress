/**
 * SPEC-120: bearko.games 共通基盤（https://bearko.games/sdk/v1.js）への窓口。
 * SDK が読めない・通信に失敗しても何もしない（console.warn だけ）。ゲームの進行は止めない。
 * ログイン状態は共通基盤が持つので、ここではセーブ（localStorage）に触らない。
 */
import { trophyIdsForLevelClear } from "../meta/trophies";

type Result = { ok?: boolean; error?: string } | undefined;
interface BearkoGamesSdk {
  init(opts: { game: string; version?: string }): Promise<Result> | Result;
  unlockTrophy(id: string): Promise<Result> | Result;
}

const sdk = (): BearkoGamesSdk | undefined =>
  typeof window !== "undefined" ? (window as unknown as { BearkoGames?: BearkoGamesSdk }).BearkoGames : undefined;

export function initPlatform(version?: string): void {
  const bg = sdk();
  if (!bg) return;
  try {
    Promise.resolve(bg.init({ game: "fortress", version })).catch((e) => console.warn("[platform] init", e));
  } catch (e) {
    console.warn("[platform] init", e);
  }
}

export function reportLevelResult(levelId: string, won: boolean): void {
  const bg = sdk();
  if (!bg) return;
  for (const id of trophyIdsForLevelClear(levelId, won)) {
    try {
      Promise.resolve(bg.unlockTrophy(id))
        .then((r) => {
          if (!r || !r.ok) console.warn("[platform] trophy", id, r?.error);
        })
        .catch((e) => console.warn("[platform] trophy", id, e));
    } catch (e) {
      console.warn("[platform] trophy", id, e);
    }
  }
}
