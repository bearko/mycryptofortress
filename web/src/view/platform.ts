/**
 * SPEC-120: bearko.games 共通基盤（https://bearko.games/sdk/v1.js）への窓口。
 * SDK が読めない・通信に失敗しても何もしない（console.warn だけ）。ゲームの進行は止めない。
 * ログイン状態は共通基盤が持つので、ここではセーブ（localStorage）に触らない。
 */
import { trophyIdsForLevelClear } from "../meta/trophies";
import type { ScoreMetrics } from "../meta/score";

type Result = { ok?: boolean; error?: string } | undefined;
type RtaResult = { ok?: boolean; error?: string; finished?: boolean } | undefined;
interface BearkoGamesSdk {
  init(opts: { game: string; version?: string }): Promise<Result> | Result;
  unlockTrophy(id: string): Promise<Result> | Result;
  submitScore?(metrics: object, opts?: { quiet?: boolean }): Promise<Result> | Result;
  rta?: {
    start(opts: { regulation: string; timer?: "top" | "bottom" | false; timerOffset?: number }): Promise<RtaResult> | RtaResult;
    checkpoint(id: string, opts?: { igtMs?: number }): Promise<RtaResult> | RtaResult;
    abort(): Promise<RtaResult> | RtaResult;
  };
  // SPEC-128: 全体チャット（共通基盤 SPEC-004。SDK 1.6.0 から）
  chat?: { setVisible(on: boolean): void };
  // SPEC-129: bearko.games 共通のアイコンを選ぶ窓（共通基盤 SPEC-005 5.3。SDK 1.7.0 から）
  openAvatarPicker?(): void;
}

const sdk = (): BearkoGamesSdk | undefined =>
  typeof window !== "undefined" ? (window as unknown as { BearkoGames?: BearkoGamesSdk }).BearkoGames : undefined;

let initedWith: string | null | undefined;

export function initPlatform(version?: string): void {
  const bg = sdk();
  if (!bg) {
    // SPEC-121: SDK はゲーム本体のあとに読まれることがあるので、読めたら init する
    if (typeof window !== "undefined" && initedWith === undefined) {
      initedWith = null;
      window.addEventListener("load", () => { initedWith = undefined; if (sdk()) initPlatform(version); }, { once: true });
    }
    return;
  }
  if (initedWith === (version ?? "")) return;
  initedWith = version ?? "";
  try {
    Promise.resolve(bg.init({ game: "fortress", version }))
      .then(() => applyChatVisible())   // SPEC-128: SDK が後から読めたときも、いまの画面の出す／隠すをそろえる
      .catch((e) => console.warn("[platform] init", e));
  } catch (e) {
    console.warn("[platform] init", e);
  }
}

// ---------------------------------------------------------------- SPEC-128: 全体チャットの置き場所
// 窓そのものは SDK が描く（右下の 💬）。ここでは出す・隠すだけ：戦闘（Run）では隠し、それ以外の場面で出す
let chatWanted = true;

function applyChatVisible(): void {
  const bg = sdk();
  if (!bg?.chat || typeof bg.chat.setVisible !== "function") return;
  try {
    bg.chat.setVisible(chatWanted);
  } catch (e) {
    console.warn("[platform] chat", e);
  }
}

/** 💬 を出す（true）／隠す（false）。SDK がない・古い（chat が無い）ときは覚えておいて、読めたときにそろえる */
export function setChatVisible(on: boolean): void {
  chatWanted = on;
  applyChatVisible();
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

/** SPEC-122: レベルごとの自己ベストをまとめて総合スコアに送る（点の計算と前回との束ねは共通基盤） */
export function reportScore(metrics: ScoreMetrics): void {
  const bg = sdk();
  if (!bg || typeof bg.submitScore !== "function") return;
  try {
    Promise.resolve(bg.submitScore(metrics))
      .then((r) => {
        if (!r || !r.ok) console.warn("[platform] score", r?.error);
      })
      .catch((e) => console.warn("[platform] score", e));
  } catch (e) {
    console.warn("[platform] score", e);
  }
}

/** SPEC-125: 共通基盤のタイトル別ランキング */
export const PLATFORM_RANKING_URL = "https://bearko.games/score/?game=fortress";

/** SPEC-125: 共通基盤のランキングを新しいタブで開く（再読み込みすると RTA の計測が消えるため、このタブは残す） */
export function openPlatformRanking(): void {
  try {
    window.open(PLATFORM_RANKING_URL, "_blank", "noopener");
  } catch (e) {
    console.warn("[platform] open ranking", e);
  }
}

// ---------------------------------------------------------------- SPEC-129: bearko.games 共通のアイコン
/** 選ぶ窓を出せるか（SDK が読めて 1.7.0 以上） */
export function canPickAvatar(): boolean {
  const bg = sdk();
  return !!bg && typeof bg.openAvatarPicker === "function";
}
/** アイコンを選ぶ窓（すべてのゲームとチャットで同じ絵になる）。SDK がない・古いときは何もしない */
export function openAvatarPicker(): boolean {
  const bg = sdk();
  if (!bg || typeof bg.openAvatarPicker !== "function") return false;
  try {
    bg.openAvatarPicker();
  } catch (e) {
    console.warn("[platform] avatar", e);
  }
  return true;
}

/** SPEC-123: RTA の計測を始める。SDK がない・通信に失敗したら false（ゲームは RTA なしで続けられる） */
export async function startRta(regulation: string, timerOffset: number): Promise<boolean> {
  const rta = sdk()?.rta;
  if (!rta || typeof rta.start !== "function") return false;
  try {
    const r = await rta.start({ regulation, timer: "top", timerOffset });
    if (!r || !r.ok) console.warn("[platform] rta start", r?.error);
    return !!r && !!r.ok;
  } catch (e) {
    console.warn("[platform] rta start", e);
    return false;
  }
}

/** SPEC-123: 区切りを送る（結果の通知は SDK が出す） */
export function rtaCheckpoint(id: string, igtMs: number): void {
  const rta = sdk()?.rta;
  if (!rta || typeof rta.checkpoint !== "function") return;
  try {
    Promise.resolve(rta.checkpoint(id, { igtMs }))
      .then((r) => {
        if (!r || !r.ok) console.warn("[platform] rta checkpoint", id, r?.error);
      })
      .catch((e) => console.warn("[platform] rta checkpoint", id, e));
  } catch (e) {
    console.warn("[platform] rta checkpoint", id, e);
  }
}

/** SPEC-123: 計測をやめる */
export function abortRta(): void {
  const rta = sdk()?.rta;
  if (!rta || typeof rta.abort !== "function") return;
  try {
    Promise.resolve(rta.abort()).catch((e) => console.warn("[platform] rta abort", e));
  } catch (e) {
    console.warn("[platform] rta abort", e);
  }
}
