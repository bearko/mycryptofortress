/**
 * SPEC-101 §5.4: タップ / 長押し判定（Phaser 非依存の純ロジック）。
 *
 * - down → up（移動 ≤ moveTolerance、押下 < longPressMs）で "tap"
 * - down のまま longPressMs 経過（移動 ≤ moveTolerance）で "longpress"（1 回だけ。その後の up は無視）
 * - 移動が moveTolerance を超えたらキャンセル（ドラッグ扱い）
 */
export interface PressConfig {
  longPressMs: number;
  /** 論理 px。スマホでは 1 CSS px ≒ 1.8 論理 px なので指のブレを許容できる値にする */
  moveTolerance: number;
}

export const DEFAULT_PRESS_CONFIG: PressConfig = { longPressMs: 450, moveTolerance: 24 };

export type PressResult = "tap" | "longpress" | null;

export class PressDetector {
  private startX = 0;
  private startY = 0;
  private startT = 0;
  private state: "idle" | "pressing" | "fired" | "cancelled" = "idle";

  constructor(private readonly config: PressConfig = DEFAULT_PRESS_CONFIG) {}

  get isPressing(): boolean {
    return this.state === "pressing";
  }

  down(x: number, y: number, t: number): void {
    this.startX = x;
    this.startY = y;
    this.startT = t;
    this.state = "pressing";
  }

  move(x: number, y: number): void {
    if (this.state !== "pressing") return;
    if (Math.hypot(x - this.startX, y - this.startY) > this.config.moveTolerance) {
      this.state = "cancelled";
    }
  }

  /** 毎フレーム呼ぶ。長押し成立の瞬間に 1 回だけ "longpress" を返す */
  tick(t: number): PressResult {
    if (this.state === "pressing" && t - this.startT >= this.config.longPressMs) {
      this.state = "fired";
      return "longpress";
    }
    return null;
  }

  up(x: number, y: number, t: number): PressResult {
    const wasPressing = this.state === "pressing";
    this.move(x, y);
    const result: PressResult =
      wasPressing && this.state === "pressing" && t - this.startT < this.config.longPressMs ? "tap" : null;
    this.state = "idle";
    return result;
  }

  cancel(): void {
    this.state = "idle";
  }
}
