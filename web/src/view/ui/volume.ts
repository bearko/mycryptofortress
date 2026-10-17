/**
 * SPEC-127: 音量の 20 段階。0〜100% を 5% 刻みで持つ（0・5・…・100 の 21 の位置。0 は OFF）。
 * セーブの settings.bgmVolume / seVolume（0..1）をそのまま使い、ここでは丸めと表示だけを受け持つ。
 * Phaser に依存しない（volume.spec.ts）。
 */
export const VOLUME_STEP = 0.05;

/** 0..1 を 5% 刻みに丸め、範囲外は 0..1 に収める。数でなければ 0 */
export function snapVolume(v: number): number {
  if (!Number.isFinite(v)) return 0;
  const pct = Math.round(Math.min(1, Math.max(0, v)) * 100);
  return (Math.round(pct / 5) * 5) / 100;
}

/** 1 段上げる（dir = 1）/ 下げる（dir = -1）。端で止まる */
export function stepVolume(v: number, dir: 1 | -1): number {
  return snapVolume(snapVolume(v) + dir * VOLUME_STEP);
}

/** 画面に出す段階。0 は「OFF」、ほかは「65%」 */
export function volumeLabel(v: number): string {
  const pct = Math.round(snapVolume(v) * 100);
  return pct === 0 ? "OFF" : `${pct}%`;
}
