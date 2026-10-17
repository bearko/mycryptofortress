/**
 * SPEC-123: RTA「レベル 01〜09」（bearko.games 共通基盤のレギュレーション fortress-all）。
 * 純関数（Phaser・window に依存しない）。計測そのもの（実時間・区間タイム・無操作）は共通基盤の SDK が持つ。
 */
import { DIALOGS } from "../data/dialogs";
import { LEVELS } from "../data/levels";
import { createNewSave, type SaveData } from "./save";

export const RTA_REGULATION = "fortress-all";
/** RTA 中の倍速（作者の決定 2026-10-17：3 倍に固定。テスト用の 5 倍速は使えない） */
export const RTA_SPEED = 3;

export interface RtaState {
  /** 次に区切りを送るレベルの番号（0 始まり）。LEVELS.length で完走 */
  next: number;
  /** IGT：レベルを遊んだゲーム内時間の合計（負け・撤退も含む。ミリ秒） */
  igtMs: number;
}

export const newRtaState = (): RtaState => ({ next: 0, igtMs: 0 });

/** レベルのクリアを区切りの ID にする。最後のレベルは 'clear'。順番どおりでなければ null（同じレベルの 2 回目のクリアなど） */
export function checkpointFor(state: RtaState, levelId: string): string | null {
  const level = LEVELS[state.next];
  if (!level || level.id !== levelId) return null;
  return state.next === LEVELS.length - 1 ? "clear" : level.id;
}

/** 1 回のランが終わった：IGT を足し、クリアが次の区切りなら進める。送る区切りを返す */
export function recordRun(state: RtaState, levelId: string, won: boolean, runMs: number): { state: RtaState; checkpoint: string | null } {
  const igtMs = state.igtMs + Math.max(0, Math.round(runMs));
  const checkpoint = won ? checkpointFor(state, levelId) : null;
  return { state: { next: checkpoint ? state.next + 1 : state.next, igtMs }, checkpoint };
}

export const isFinished = (state: RtaState): boolean => state.next >= LEVELS.length;

/**
 * RTA 用の新しいセーブ（引き継ぎなし）。音量と幻獣の見た目だけ引き継ぐ。
 * 会話はすべて既読にする（読み飛ばす手間を全員そろえる。遊び方は変わらない）
 */
export function rtaSave(from: SaveData, now: Date = new Date()): SaveData {
  const fresh = createNewSave(now);
  return {
    ...fresh,
    settings: { ...fresh.settings, bgmVolume: from.settings.bgmVolume, seVolume: from.settings.seVolume },
    profile: { ...from.profile },
    meta: { ...fresh.meta, seenDialogs: Object.keys(DIALOGS) },
  };
}
