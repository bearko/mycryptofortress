import type Phaser from "phaser";

/** v2 UI の配色。ランドカラー（data/cryptids.ts）をアクセントに重ねる前提の暗色ベース。 */
export const COLORS = {
  bg: 0x0b0d12,
  panel: 0x141925,
  panelRaised: 0x1d2433,
  line: 0x2c3548,
  ink: 0xe7eaf0,
  inkDim: 0x9aa3b5,
  inkMuted: 0x5d6678,
  gold: 0xf5c542,
  danger: 0xe0485a,
} as const;

/**
 * 日本語フォントのスタック。Phaser のテキストは DOM 外の canvas に描かれ `lang="ja"` を継承しないため、
 * フォント名を明示しないと環境によって中国語フォント（字形が異なる）にフォールバックする。
 * Windows → macOS / iOS → その他（Noto / 源ノ角 / IPA）の順に日本語フォントを並べる。
 */
export const FONT_JA = [
  '"Meiryo UI"',
  "Meiryo",
  '"Yu Gothic UI"',
  "YuGothic",
  '"Yu Gothic"',
  '"Hiragino Sans"',
  '"Hiragino Kaku Gothic ProN"',
  '"BIZ UDPGothic"',
  '"Noto Sans JP"',
  '"Noto Sans CJK JP"',
  '"Source Han Sans JP"',
  "IPAPGothic",
  "IPAexGothic",
  "sans-serif",
].join(", ");

export const FONT_FAMILY = FONT_JA;
/** 英数字の見出し用（Orbitron はバンドル同梱。日本語が混ざった場合は FONT_JA で描く） */
export const FONT_DISPLAY = `"Orbitron", ${FONT_JA}`;

export const css = (n: number): string => `#${n.toString(16).padStart(6, "0")}`;

/** Retina で文字が粗くならないよう、テキストテクスチャを高解像度で作る */
const TEXT_RESOLUTION = Math.min(3, Math.max(2, globalThis.devicePixelRatio || 2));

export function textStyle(
  size: number,
  opts: { color?: number; weight?: 500 | 700 | 900; display?: boolean; align?: "left" | "center" | "right" } = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: opts.display ? FONT_DISPLAY : FONT_FAMILY,
    fontSize: `${size}px`,
    fontStyle: String(opts.weight ?? 700),
    color: css(opts.color ?? COLORS.ink),
    align: opts.align ?? "left",
    resolution: TEXT_RESOLUTION,
  };
}
