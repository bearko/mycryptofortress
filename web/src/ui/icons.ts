/**
 * SPEC-019: 8 職業 + 主要状態系のアイコンを Phaser.GameObjects.Graphics で描画。
 *
 * 元データ: `design/icons.jsx` の SVG (24×24 viewBox / stroke 1.5 / currentColor)。
 * Phaser 側ではテクスチャを生成せず、必要な箇所で `drawClassIcon(g, cls, size)`
 * を呼び出して既存 Graphics に描画させる方針（色は後から変えられる）。
 *
 * 設計の `vanguard` (前衛) は code 側で `guard`、`pioneer` (先鋒) は
 * `vanguard` と命名されているため、ここでも HeroClass キーで索引する。
 */

import Phaser from "phaser";
import type { HeroClass } from "../game/types";

/** すべての関数の共通: SVG 24×24 viewBox を size に拡大する係数 */
const VB = 24;

/**
 * 共通の描画ヘルパ。`Graphics.lineStyle` を呼んだ状態で、
 * 各関数を順に呼び出してパスを引く。アイコンは中心 (0,0) から
 * `[-size/2, +size/2]` の範囲に描画される。
 */
function setup(
  g: Phaser.GameObjects.Graphics,
  size: number,
  color: number,
  thickness = 1.5,
): { s: number; c: (x: number) => number } {
  g.lineStyle(thickness, color, 1);
  const s = size / VB;
  // viewBox 0..24 を中心 (0,0) 基準に置き換え
  const c = (n: number) => (n - VB / 2) * s;
  return { s, c };
}

/** ラインを 1 本引く（viewBox 座標系） */
function L(
  g: Phaser.GameObjects.Graphics,
  c: (n: number) => number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  g.beginPath();
  g.moveTo(c(x1), c(y1));
  g.lineTo(c(x2), c(y2));
  g.strokePath();
}

/** 矩形を引く（線のみ） */
function R(
  g: Phaser.GameObjects.Graphics,
  c: (n: number) => number,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  g.strokeRect(c(x), c(y), w * (c(1) - c(0)), h * (c(1) - c(0)));
}

/** 円を引く（線のみ） */
function C(
  g: Phaser.GameObjects.Graphics,
  c: (n: number) => number,
  cx: number,
  cy: number,
  r: number,
): void {
  const sx = c(cx);
  const sy = c(cy);
  const sr = r * (c(1) - c(0));
  g.strokeCircle(sx, sy, sr);
}

/** 円を塗りつぶす */
function FC(
  g: Phaser.GameObjects.Graphics,
  c: (n: number) => number,
  cx: number,
  cy: number,
  r: number,
  color: number,
): void {
  g.fillStyle(color, 1);
  g.fillCircle(c(cx), c(cy), r * (c(1) - c(0)));
}

// ─────────────────────────────────────────────
// 8 職業アイコン
// ─────────────────────────────────────────────

/** 重装 Defender — シールド + 内部十字 */
function drawDefender(g: Phaser.GameObjects.Graphics, size: number, color: number): void {
  const { c } = setup(g, size, color, 1.6);
  // シールドの簡易形: 上端ピーク (12,2) → 左 (4,5) → 下 (12,21) → 右 (20,5) → 戻る
  g.beginPath();
  g.moveTo(c(12), c(2.5));
  g.lineTo(c(4), c(5));
  g.lineTo(c(4), c(11.5));
  g.lineTo(c(12), c(21));
  g.lineTo(c(20), c(11.5));
  g.lineTo(c(20), c(5));
  g.closePath();
  g.strokePath();
  // 内部十字
  L(g, c, 12, 7, 12, 16.5);
  L(g, c, 8, 11, 16, 11);
}

/** 前衛 Guard (design.vanguard) — クロスソード (X) */
function drawGuard(g: Phaser.GameObjects.Graphics, size: number, color: number): void {
  const { c } = setup(g, size, color, 1.6);
  L(g, c, 4, 4, 13, 13);
  L(g, c, 20, 4, 11, 13);
  L(g, c, 4, 20, 9, 15);
  L(g, c, 20, 20, 15, 15);
  // 中央菱形（簡易）
  g.beginPath();
  g.moveTo(c(12), c(10));
  g.lineTo(c(15), c(13));
  g.lineTo(c(12), c(16));
  g.lineTo(c(9), c(13));
  g.closePath();
  g.strokePath();
}

/** 先鋒 Vanguard (design.pioneer) — 旗ポール */
function drawVanguard(g: Phaser.GameObjects.Graphics, size: number, color: number): void {
  const { c } = setup(g, size, color, 1.6);
  // ポール
  L(g, c, 5, 3, 5, 21);
  // 旗の三角弧 (5,4) → (17,4) → (14,8) → (17,12) → (5,12)
  g.beginPath();
  g.moveTo(c(5), c(4));
  g.lineTo(c(17), c(4));
  g.lineTo(c(14), c(8));
  g.lineTo(c(17), c(12));
  g.lineTo(c(5), c(12));
  g.strokePath();
  // 旗の中央バー
  L(g, c, 9, 8, 13, 8);
}

/** 特殊 Specialist — ダイヤ + 内部十字 */
function drawSpecialist(g: Phaser.GameObjects.Graphics, size: number, color: number): void {
  const { c } = setup(g, size, color, 1.6);
  // ダイヤ
  g.beginPath();
  g.moveTo(c(12), c(3));
  g.lineTo(c(19), c(12));
  g.lineTo(c(12), c(21));
  g.lineTo(c(5), c(12));
  g.closePath();
  g.strokePath();
  // 内部 +
  L(g, c, 12, 8, 12, 16);
  L(g, c, 9, 12, 15, 12);
}

/** 狙撃 Sniper — 照準 (クロスヘア) */
function drawSniper(g: Phaser.GameObjects.Graphics, size: number, color: number): void {
  const { c } = setup(g, size, color, 1.6);
  C(g, c, 12, 12, 7);
  // 4 方向の短線
  L(g, c, 12, 2, 12, 6);
  L(g, c, 12, 18, 12, 22);
  L(g, c, 2, 12, 6, 12);
  L(g, c, 18, 12, 22, 12);
  // 中央ドット
  FC(g, c, 12, 12, 1.5, color);
}

/** 術師 Caster — 三角形 + オーブ */
function drawCaster(g: Phaser.GameObjects.Graphics, size: number, color: number): void {
  const { c } = setup(g, size, color, 1.6);
  // 三角形
  g.beginPath();
  g.moveTo(c(12), c(3));
  g.lineTo(c(21), c(19));
  g.lineTo(c(3), c(19));
  g.closePath();
  g.strokePath();
  // 中央オーブ
  C(g, c, 12, 14, 2.4);
  L(g, c, 12, 8, 12, 11.6);
}

/** 医療 Medic — 十字 (赤十字) */
function drawMedic(g: Phaser.GameObjects.Graphics, size: number, color: number): void {
  const { c } = setup(g, size, color, 1.6);
  // 縦長 + 横長の組合せの 6 角ライン
  g.beginPath();
  g.moveTo(c(4), c(8));
  g.lineTo(c(10), c(8));
  g.lineTo(c(10), c(4));
  g.lineTo(c(14), c(4));
  g.lineTo(c(14), c(8));
  g.lineTo(c(20), c(8));
  g.lineTo(c(20), c(12));
  g.lineTo(c(14), c(12));
  g.lineTo(c(14), c(20));
  g.lineTo(c(10), c(20));
  g.lineTo(c(10), c(12));
  g.lineTo(c(4), c(12));
  g.closePath();
  g.strokePath();
}

/** 補助 Supporter — 中央円 + 4 方向ライン */
function drawSupporter(g: Phaser.GameObjects.Graphics, size: number, color: number): void {
  const { c } = setup(g, size, color, 1.6);
  C(g, c, 12, 12, 3);
  // 4 方向直線
  L(g, c, 12, 4, 12, 7);
  L(g, c, 12, 17, 12, 20);
  L(g, c, 4, 12, 7, 12);
  L(g, c, 17, 12, 20, 12);
  // 4 方向斜め
  L(g, c, 6.5, 6.5, 8.5, 8.5);
  L(g, c, 15.5, 15.5, 17.5, 17.5);
  L(g, c, 17.5, 6.5, 15.5, 8.5);
  L(g, c, 8.5, 15.5, 6.5, 17.5);
}

const CLASS_ICON_DRAWERS: Record<
  HeroClass,
  (g: Phaser.GameObjects.Graphics, size: number, color: number) => void
> = {
  defender: drawDefender,
  guard: drawGuard,
  vanguard: drawVanguard,
  specialist: drawSpecialist,
  sniper: drawSniper,
  caster: drawCaster,
  medic: drawMedic,
  supporter: drawSupporter,
};

/**
 * 既存の Graphics に職業アイコンを描画する。
 * Graphics の中心 (0,0) を基点として `size×size` の領域に描く。
 */
export function drawClassIcon(
  g: Phaser.GameObjects.Graphics,
  cls: HeroClass,
  size: number,
  color: number,
): void {
  CLASS_ICON_DRAWERS[cls](g, size, color);
}

/**
 * シーンに新しい Graphics を作って職業アイコンを描き、コンテナにラップして返す。
 * 戻り値は通常の `add.x()` と同じ感覚で位置設定可能。
 */
export function makeClassIcon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  cls: HeroClass,
  size: number,
  color: number,
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  drawClassIcon(g, cls, size, color);
  c.add(g);
  return c;
}

// ─────────────────────────────────────────────
// 状態系アイコン (必要分だけ)
// ─────────────────────────────────────────────

/** Lock — ステージ未開放など */
export function drawIconLock(
  g: Phaser.GameObjects.Graphics,
  size: number,
  color: number,
): void {
  const { c } = setup(g, size, color, 1.6);
  R(g, c, 6, 11, 12, 9);
  // 上のシャックル
  g.beginPath();
  g.moveTo(c(9), c(11));
  g.lineTo(c(9), c(8));
  // 半円シャックル: 簡易 4 段直線
  g.lineTo(c(10.5), c(6.5));
  g.lineTo(c(13.5), c(6.5));
  g.lineTo(c(15), c(8));
  g.lineTo(c(15), c(11));
  g.strokePath();
}

/** Pause */
export function drawIconPause(
  g: Phaser.GameObjects.Graphics,
  size: number,
  color: number,
): void {
  const { c } = setup(g, size, color, 1.8);
  L(g, c, 7, 5, 7, 19);
  L(g, c, 17, 5, 17, 19);
}

/** Fast-forward (>>) */
export function drawIconFastForward(
  g: Phaser.GameObjects.Graphics,
  size: number,
  color: number,
): void {
  const { c } = setup(g, size, color, 1.6);
  g.beginPath();
  g.moveTo(c(3), c(5));
  g.lineTo(c(3), c(19));
  g.lineTo(c(12), c(12));
  g.closePath();
  g.strokePath();
  g.beginPath();
  g.moveTo(c(13), c(5));
  g.lineTo(c(13), c(19));
  g.lineTo(c(22), c(12));
  g.closePath();
  g.strokePath();
}
