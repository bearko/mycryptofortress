/**
 * SPEC-018: ビジュアル刷新（STEEL ONYX テーマ）の中央トークン。
 *
 * 元データ: `design/design_tokens.txt` / `design/tokens.jsx`
 *
 * - 数値 (`0xRRGGBB`) は `Phaser` の `setFillStyle` / `setStrokeStyle` 等で
 *   そのまま使える形。
 * - テキスト系の `color` プロパティ (`Phaser.GameObjects.Text` の style) は
 *   CSS 風文字列 (`"#rrggbb"`) を要求するので、`hex2css(n)` で変換する。
 *
 * 命名規則のずれ（重要）:
 *   現状コードの `HeroClass` は `defender / guard / vanguard / specialist /
 *   sniper / caster / medic / supporter`。
 *   一方デザインは `defender / vanguard / pioneer / ...` と命名し直している
 *   （日本語ラベルは同じで英字 ID だけ変更）。
 *
 *   日本語ラベル軸でマッピング:
 *     重装  defender   (code: defender)   #4A8FE8
 *     前衛  guard     (code: guard)      #E84A5F  ← design.vanguard
 *     先鋒  vanguard  (code: vanguard)   #F59E0B  ← design.pioneer
 *     特殊  specialist                   #C448E8
 *     狙撃  sniper                       #84CC16
 *     術師  caster                       #06B6D4
 *     医療  medic                        #10B981
 *     補助  supporter                    #EC4899
 *
 *   つまり「英字 ID」は既存コード側を踏襲し、色だけデザイン値を反映する。
 */

import type { AttackType, HeroClass, HeroRarity, MapTileType } from "../game/types";

/** Phaser の数値カラー（0xRRGGBB） */
export type ColorNum = number;

/** CSS 風文字列カラー（#rrggbb） */
export type ColorCss = string;

/** Phaser 数値カラーを CSS 文字列に変換 */
export function hex2css(n: ColorNum): ColorCss {
  return `#${n.toString(16).padStart(6, "0")}`;
}

/** 16 進文字列を Phaser の `0xRRGGBB` に変換（"#" 付きでも可） */
export function css2hex(s: string): ColorNum {
  return parseInt(s.replace(/^#/, ""), 16);
}

// ─────────────────────────────────────────────
// Theme: STEEL ONYX
// ─────────────────────────────────────────────
export interface Theme {
  id: "onyx" | "sengoku";
  name: string;
  bg: {
    base: ColorNum;
    surface: ColorNum;
    raised: ColorNum;
    overlay: ColorNum;
    inset: ColorNum;
  };
  line: {
    weak: ColorNum;
    base: ColorNum;
    strong: ColorNum;
    bright: ColorNum;
  };
  ink: {
    primary: ColorNum;
    secondary: ColorNum;
    tertiary: ColorNum;
    muted: ColorNum;
    inverse: ColorNum;
  };
  accent: {
    primary: ColorNum;
    primaryDk: ColorNum;
    warn: ColorNum;
    danger: ColorNum;
    success: ColorNum;
  };
  /** HUD やカットインで使うアクセント色のショートカット */
  hudTint: ColorNum;
}

/**
 * SPEC-030: MCT (MyCryptoTactics) のビジュアル言語に揃えた "STEEL ONYX" 改訂版。
 *
 * MCT 由来の値:
 *   --bg #121018   → bg.base
 *   --panel #1e1a28 → bg.surface
 *   --map-node #2a2438 → bg.raised
 *   --border #3d3550 → line.base
 *   --text #e6e0f0   → ink.primary
 *   --muted #8a8199  → ink.tertiary
 *   --accent #c4a35a → accent.primary  (gold)
 *   --energy #5ab4c4 → hudTint
 *   --danger #c45c6a → accent.danger
 *   --gain #5ecf8a   → accent.success
 *   --loss #ff6b6b   → 重大な error が必要なときのみ別途使用
 */
export const THEME_ONYX: Theme = {
  id: "onyx",
  name: "STEEL ONYX",
  bg: {
    base: 0x121018,
    surface: 0x1e1a28,
    raised: 0x2a2438,
    overlay: 0x363050,
    inset: 0x0a080f,
  },
  line: {
    weak: 0x2d2640,
    base: 0x3d3550,
    strong: 0x5a4f70,
    bright: 0x7d6d96,
  },
  ink: {
    primary: 0xe6e0f0,
    secondary: 0xb3a8c4,
    tertiary: 0x8a8199,
    muted: 0x564f64,
    inverse: 0x121018,
  },
  accent: {
    primary: 0xc4a35a,
    primaryDk: 0x9a7f3e,
    warn: 0xfdb931,
    danger: 0xc45c6a,
    success: 0x5ecf8a,
  },
  hudTint: 0x5ab4c4,
};

/**
 * STEEL SENGOKU（B 案）。戦国ワールドのみで切り替える想定。今は値だけ保持。
 */
export const THEME_SENGOKU: Theme = {
  id: "sengoku",
  name: "STEEL SENGOKU",
  bg: {
    base: 0x0b0908,
    surface: 0x15110f,
    raised: 0x1d1815,
    overlay: 0x26201c,
    inset: 0x080605,
  },
  line: {
    weak: 0x241d19,
    base: 0x322822,
    strong: 0x43352d,
    bright: 0x6a5447,
  },
  ink: {
    primary: 0xede7dd,
    secondary: 0xa89a8a,
    tertiary: 0x766b5e,
    muted: 0x534a40,
    inverse: 0x0b0908,
  },
  accent: {
    primary: 0xdc2626,
    primaryDk: 0x991b1b,
    warn: 0xd4a24c,
    danger: 0xef4444,
    success: 0x7da84a,
  },
  hudTint: 0xdc2626,
};

export const THEMES = {
  onyx: THEME_ONYX,
  sengoku: THEME_SENGOKU,
} as const;

/**
 * SPEC-019: アクティブテーマ。シーンは `theme.bg.base` のように直接参照する。
 * `setTheme(id)` で内容を入れ替えると同一参照のままフィールド値だけが書き換わるため、
 * 既存 import 箇所はそのままで動的切替できる。ただし既に描画済みの色は
 * 自動更新されないので、シーン側でレイアウト再構築 (`buildLayout` / 再起動)
 * を呼ぶ必要がある。
 */
export const theme: Theme = { ...THEME_ONYX };

export type ThemeId = keyof typeof THEMES;

export function setTheme(id: ThemeId): void {
  const next = THEMES[id];
  // フィールド単位で copy（参照は維持）
  theme.id = next.id;
  theme.name = next.name;
  Object.assign(theme.bg, next.bg);
  Object.assign(theme.line, next.line);
  Object.assign(theme.ink, next.ink);
  Object.assign(theme.accent, next.accent);
  theme.hudTint = next.hudTint;
}

/** 現在のテーマ ID を取得 */
export function getThemeId(): ThemeId {
  return theme.id;
}

// ─────────────────────────────────────────────
// 8 職業カラー（コード上の HeroClass で索引）
// ─────────────────────────────────────────────
export interface ClassToken {
  hex: ColorNum;
  jp: string;
  en: string;
  /** デザイン時の英字 ID（参考。コードの ID とずれている場合あり） */
  designId: string;
}

export const CLASS_COLORS: Record<HeroClass, ClassToken> = {
  defender: { hex: 0x4a8fe8, jp: "重装", en: "DEFENDER", designId: "defender" },
  guard: { hex: 0xe84a5f, jp: "前衛", en: "VANGUARD", designId: "vanguard" },
  vanguard: { hex: 0xf59e0b, jp: "先鋒", en: "PIONEER", designId: "pioneer" },
  specialist: { hex: 0xc448e8, jp: "特殊", en: "SPECIALIST", designId: "specialist" },
  sniper: { hex: 0x84cc16, jp: "狙撃", en: "SNIPER", designId: "sniper" },
  caster: { hex: 0x06b6d4, jp: "術師", en: "CASTER", designId: "caster" },
  medic: { hex: 0x10b981, jp: "医療", en: "MEDIC", designId: "medic" },
  supporter: { hex: 0xec4899, jp: "補助", en: "SUPPORTER", designId: "supporter" },
};

/** 表示順（パレット / フィルタチップなどで使う標準並び） */
export const CLASS_ORDER: HeroClass[] = [
  "defender",
  "guard",
  "vanguard",
  "specialist",
  "sniper",
  "caster",
  "medic",
  "supporter",
];

// ─────────────────────────────────────────────
// Rarity / Attr
// ─────────────────────────────────────────────
/**
 * SPEC-015 / SPEC-019: レアリティのチップ色 (左上 1 文字バッジ)。
 *
 * デザイントークン側では C / U の 2 色のみ定義されているため、Rare 以上は
 * MCH 公式 UI の慣例 (黄 → 水 → 紫 → 橙 → 赤金) を踏襲した派生値。
 * Phaser の `setFillStyle` で直接利用するための 0xRRGGBB 数値で保持。
 */
export const RARITY: Record<HeroRarity, { hex: ColorNum; label: string; name: string }> = {
  common: { hex: 0xfcd34d, label: "C", name: "Common" },
  uncommon: { hex: 0x60a5fa, label: "U", name: "Uncommon" },
  rare: { hex: 0xc084fc, label: "R", name: "Rare" }, // purple
  superRare: { hex: 0xfb923c, label: "SR", name: "SuperRare" }, // orange
  legendary: { hex: 0xfacc15, label: "L", name: "Legendary" }, // gold
};

export const ATTR: Record<AttackType, { hex: ColorNum; label: string }> = {
  PHY: { hex: 0xf87171, label: "PHY" },
  INT: { hex: 0xa78bfa, label: "INT" },
};

// ─────────────────────────────────────────────
// Tile colors
// ─────────────────────────────────────────────
export interface TileToken {
  fill: ColorNum;
  line: ColorNum;
  label: string;
}

export const TILE_COLORS: Record<MapTileType, TileToken> = {
  path: { fill: 0x1a2230, line: 0x2a3344, label: "床" },
  path_blocked: { fill: 0x241a1f, line: 0x3a2a35, label: "通行不可" },
  wall: { fill: 0x0e1118, line: 0x1f2530, label: "壁" },
  obstacle: { fill: 0x181818, line: 0x2a2a2a, label: "障害物" },
  poison: { fill: 0x16231c, line: 0x2d5237, label: "毒沼" },
};

// ─────────────────────────────────────────────
// Typography
// ─────────────────────────────────────────────
export const FONT_FAMILIES = {
  jpHead: "'Zen Kaku Gothic New', 'Noto Sans JP', system-ui, sans-serif",
  jpBody: "'Noto Sans JP', system-ui, sans-serif",
  display: "'Orbitron', 'Audiowide', ui-monospace, monospace",
  mono: "'JetBrains Mono', 'Major Mono Display', ui-monospace, monospace",
} as const;

/**
 * Phaser.GameObjects.Text で使えるスタイルプリセット。
 * 例: `this.add.text(x, y, "...", textStyle("h2"))`
 */
export interface TypeStep {
  px: number;
  /** line-height multiplier（CSS と同じ） */
  lh: number;
  /** font-weight */
  w: 400 | 500 | 600 | 700;
  /** 用途メモ（ログ用） */
  use: string;
  /** デフォルトのフォントファミリー */
  family: string;
}

export const TYPE: Record<
  | "h1"
  | "h2"
  | "h3"
  | "body"
  | "small"
  | "caption"
  | "badge"
  | "hud"
  | "hudL",
  TypeStep
> = {
  h1: { px: 32, lh: 1.25, w: 700, use: "シーンタイトル", family: FONT_FAMILIES.jpHead },
  h2: { px: 24, lh: 1.3, w: 700, use: "セクション見出し", family: FONT_FAMILIES.jpHead },
  h3: { px: 18, lh: 1.35, w: 600, use: "カード/ヒーロー名", family: FONT_FAMILIES.jpHead },
  body: { px: 15, lh: 1.55, w: 400, use: "本文", family: FONT_FAMILIES.jpBody },
  small: { px: 13, lh: 1.45, w: 500, use: "メタ/ステータス", family: FONT_FAMILIES.jpBody },
  caption: { px: 12, lh: 1.4, w: 500, use: "キャプション", family: FONT_FAMILIES.jpBody },
  badge: { px: 11, lh: 1.0, w: 700, use: "英字バッジ ALL-CAPS", family: FONT_FAMILIES.display },
  hud: { px: 20, lh: 1.0, w: 600, use: "HUD 数値", family: FONT_FAMILIES.display },
  hudL: { px: 28, lh: 1.0, w: 700, use: "HUD 大数値", family: FONT_FAMILIES.display },
};

/**
 * SPEC-022: Phaser Text を高解像度で描くためのレンダリング倍率。
 * `Text.setResolution()` に渡す。devicePixelRatio に追従し、Retina 環境で
 * 日本語フォントの粒状感を解消する。
 */
export const TEXT_RESOLUTION = (() => {
  if (typeof window === "undefined") return 2;
  return Math.min(3, Math.max(2, window.devicePixelRatio || 2));
})();

/**
 * Phaser テキストスタイルを生成するヘルパ。
 * `color` は Theme の ink.primary をデフォルトに、上書き可能。
 *
 * SPEC-022: `resolution` プロパティで内部テクスチャを高解像度で描画する。
 */
export function textStyle(
  step: keyof typeof TYPE,
  overrides: Partial<Phaser.Types.GameObjects.Text.TextStyle> & {
    /** 色 (Phaser 数値) を渡せばこちらが優先される */
    colorNum?: ColorNum;
  } = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  const t = TYPE[step];
  const { colorNum, ...rest } = overrides;
  return {
    fontFamily: t.family,
    fontSize: `${t.px}px`,
    fontStyle: t.w >= 600 ? "bold" : "",
    color: colorNum !== undefined ? hex2css(colorNum) : hex2css(theme.ink.primary),
    resolution: TEXT_RESOLUTION,
    ...rest,
  };
}

/**
 * SPEC-022: 既存の `this.add.text(...)` 呼び出しを置き換えるヘルパ。
 * 解像度を高くした Phaser.GameObjects.Text を返す。
 */
export function mkText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  style: Phaser.Types.GameObjects.Text.TextStyle,
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, content, { ...style, resolution: TEXT_RESOLUTION })
    .setResolution(TEXT_RESOLUTION);
}

// ─────────────────────────────────────────────
// Shape / Motion
// ─────────────────────────────────────────────
export const RADIUS = {
  xs: 2,
  sm: 4,
  md: 6,
  lg: 10,
  pill: 999,
} as const;

export const BORDER = {
  hairline: 1,
  base: 1,
  strong: 2,
} as const;

/** 標準スペーシング */
export const GAP = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/**
 * Phaser tween で使う duration / ease。
 *
 * SPEC-030: MCT は subtle (≤180ms) + 報酬モーメントだけ overshoot pop (380ms cubic-bezier)
 * というメリハリのあるリズム。`pop` を追加してモーダル / 解放演出で使う。
 */
export const MOTION = {
  fast: { duration: 120, ease: "Cubic.easeOut" },
  base: { duration: 180, ease: "Sine.easeOut" },
  slow: { duration: 320, ease: "Cubic.easeOut" },
  pop: { duration: 380, ease: "Back.easeOut" },
  cutin: { duration: 560, ease: "Back.easeOut" },
} as const;

// ─────────────────────────────────────────────
// 便利な派生値
// ─────────────────────────────────────────────
/** `theme.ink.primary` を CSS 文字列で取得 */
export const cssInk = (key: keyof Theme["ink"]) => hex2css(theme.ink[key]);
/** `theme.accent.*` を CSS 文字列で取得 */
export const cssAccent = (key: keyof Theme["accent"]) => hex2css(theme.accent[key]);
/** クラス色を CSS 文字列で取得 */
export const cssClass = (cls: HeroClass) => hex2css(CLASS_COLORS[cls].hex);
