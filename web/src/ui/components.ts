/**
 * SPEC-018: 視覚刷新で再利用する Phaser UI ヘルパ。
 *
 * デザイン側の `components.jsx` の挙動を Phaser.GameObjects のサブクラスとして
 * ポート。各ヘルパは `scene.add.existing(this)` 済みなので、`scene.add.X(...)` と
 * 同じ感覚で `new Btn(scene, opts)` で呼び出せる。
 */

import Phaser from "phaser";
import {
  ATTR,
  CLASS_COLORS,
  hex2css,
  RARITY,
  TYPE,
  textStyle,
  theme,
  type ColorNum,
} from "./tokens";
import type { AttackType, HeroClass, HeroRarity } from "../game/types";

// ─────────────────────────────────────────────
// Btn — primary / secondary / ghost / destructive
//
// SPEC-030: MCT 風の "outlined" button が default。primary は gold アウトライン
// + raised 背景、secondary は border 色背景の控えめパターン。
// ─────────────────────────────────────────────
export type BtnKind = "primary" | "secondary" | "ghost" | "destructive" | "solid";
export type BtnSize = "sm" | "md" | "lg";

export interface BtnOptions {
  x: number;
  y: number;
  width?: number;
  height?: number;
  label: string;
  kind?: BtnKind;
  size?: BtnSize;
  onClick?: () => void;
  disabled?: boolean;
  /** ラベル左に置く絵文字 / 1 文字アイコン */
  icon?: string;
}

interface BtnPalette {
  bg: ColorNum;
  fg: ColorNum;
  border: ColorNum;
  hoverBg: ColorNum;
}

function btnPalette(kind: BtnKind, disabled: boolean): BtnPalette {
  if (disabled) {
    return {
      bg: theme.bg.raised,
      fg: theme.ink.muted,
      border: theme.line.base,
      hoverBg: theme.bg.raised,
    };
  }
  switch (kind) {
    case "primary":
      // MCT button.primary: raised bg + gold accent border + gold text
      return {
        bg: theme.bg.raised,
        fg: theme.accent.primary,
        border: theme.accent.primary,
        hoverBg: theme.bg.overlay,
      };
    case "secondary":
      // MCT button.action: surface bg + neutral border
      return {
        bg: theme.bg.surface,
        fg: theme.ink.secondary,
        border: theme.line.base,
        hoverBg: theme.bg.raised,
      };
    case "ghost":
      return {
        bg: theme.bg.surface,
        fg: theme.ink.tertiary,
        border: theme.bg.surface,
        hoverBg: theme.bg.raised,
      };
    case "destructive":
      return {
        bg: theme.bg.raised,
        fg: theme.accent.danger,
        border: theme.accent.danger,
        hoverBg: theme.bg.overlay,
      };
    case "solid":
      // 強い CTA (報酬/開始など) — gold 全塗りで目立たせる
      return {
        bg: theme.accent.primary,
        fg: theme.ink.inverse,
        border: theme.accent.primary,
        hoverBg: theme.accent.primaryDk,
      };
  }
}

export class Btn extends Phaser.GameObjects.Container {
  private bg!: Phaser.GameObjects.Rectangle;
  private label!: Phaser.GameObjects.Text;
  private kind: BtnKind;
  private btnSize: BtnSize;
  private disabled: boolean;
  private btnW: number;
  private btnH: number;

  constructor(scene: Phaser.Scene, opts: BtnOptions) {
    super(scene, opts.x, opts.y);
    this.kind = opts.kind ?? "primary";
    this.btnSize = opts.size ?? "md";
    this.disabled = opts.disabled ?? false;

    const sm = this.btnSize === "sm";
    const lg = this.btnSize === "lg";
    this.btnW = opts.width ?? (sm ? 100 : lg ? 220 : 160);
    this.btnH = opts.height ?? (sm ? 26 : lg ? 44 : 36);

    const pal = btnPalette(this.kind, this.disabled);
    const strokeW = lg ? 2 : 1;

    this.bg = scene.add
      .rectangle(0, 0, this.btnW, this.btnH, pal.bg, 1)
      .setStrokeStyle(strokeW, pal.border);

    const labelText = opts.icon ? `${opts.icon}  ${opts.label}` : opts.label;
    const step: keyof typeof TYPE = sm ? "small" : lg ? "h3" : "body";
    this.label = scene.add
      .text(0, 0, labelText, {
        ...textStyle(step, { colorNum: pal.fg }),
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add([this.bg, this.label]);
    scene.add.existing(this);

    if (!this.disabled) {
      this.bg.setInteractive({ useHandCursor: true });
      this.bg.on("pointerover", () => {
        const p = btnPalette(this.kind, false);
        this.bg.setFillStyle(p.hoverBg, 1);
      });
      this.bg.on("pointerout", () => {
        const p = btnPalette(this.kind, false);
        this.bg.setFillStyle(p.bg, 1);
      });
      if (opts.onClick) {
        this.bg.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
          if (pointer.rightButtonDown()) return;
          opts.onClick?.();
        });
      }
    }
  }

  setEnabled(enabled: boolean): this {
    this.disabled = !enabled;
    const pal = btnPalette(this.kind, this.disabled);
    this.bg.setFillStyle(pal.bg, 1);
    this.bg.setStrokeStyle(1, pal.border);
    this.label.setColor(hex2css(pal.fg));
    if (enabled) {
      this.bg.setInteractive({ useHandCursor: true });
    } else {
      this.bg.disableInteractive();
    }
    return this;
  }

  setLabel(text: string): this {
    this.label.setText(text);
    return this;
  }
}

// ─────────────────────────────────────────────
// Bar — HP / SP / CE ゲージ
// ─────────────────────────────────────────────
export interface BarOptions {
  x: number;
  y: number;
  width: number;
  height?: number;
  value: number;
  max: number;
  /** 進捗の塗り色 (デフォルト accent.primary) */
  color?: ColorNum;
  /** 進捗にグロー */
  glow?: boolean;
  /** 等分セグメント分割線 (例: 5 で 5 分割) */
  segments?: number;
}

export class Bar extends Phaser.GameObjects.Container {
  private track!: Phaser.GameObjects.Rectangle;
  private fillRect!: Phaser.GameObjects.Rectangle;
  private barW: number;
  private barH: number;
  private color: ColorNum;
  private value: number;
  private max: number;

  constructor(scene: Phaser.Scene, opts: BarOptions) {
    super(scene, opts.x, opts.y);
    this.barW = opts.width;
    this.barH = opts.height ?? 8;
    this.color = opts.color ?? theme.accent.primary;
    this.value = opts.value;
    this.max = Math.max(1, opts.max);

    this.track = scene.add
      .rectangle(0, 0, this.barW, this.barH, theme.bg.inset, 1)
      .setStrokeStyle(1, theme.line.weak)
      .setOrigin(0, 0.5);

    const pct = Math.max(0, Math.min(1, this.value / this.max));
    this.fillRect = scene.add
      .rectangle(0, 0, Math.max(0, this.barW * pct - 2), this.barH - 2, this.color, 1)
      .setOrigin(0, 0.5)
      .setX(1);

    this.add([this.track, this.fillRect]);

    if (opts.segments && opts.segments > 1) {
      for (let i = 1; i < opts.segments; i++) {
        const sx = (this.barW * i) / opts.segments;
        const seg = scene.add
          .rectangle(sx, 0, 1, this.barH, theme.bg.inset, 1)
          .setOrigin(0.5, 0.5);
        this.add(seg);
      }
    }

    if (opts.glow) {
      this.fillRect.setStrokeStyle(1, this.color, 0.6);
    }

    scene.add.existing(this);
  }

  setValue(value: number, max?: number): this {
    if (max !== undefined) this.max = Math.max(1, max);
    this.value = value;
    const pct = Math.max(0, Math.min(1, this.value / this.max));
    this.fillRect.width = Math.max(0, this.barW * pct - 2);
    return this;
  }

  setColor(color: ColorNum): this {
    this.color = color;
    this.fillRect.setFillStyle(color, 1);
    return this;
  }
}

// ─────────────────────────────────────────────
// KPI — HUD ラベル + 数値
// ─────────────────────────────────────────────
export interface KPIOptions {
  x: number;
  y: number;
  label: string;
  value: string;
  unit?: string;
  /** 数値部の色 (デフォルト ink.primary) */
  colorNum?: ColorNum;
  size?: "md" | "lg";
}

export class KPI extends Phaser.GameObjects.Container {
  private valueText!: Phaser.GameObjects.Text;
  private unit?: string;

  constructor(scene: Phaser.Scene, opts: KPIOptions) {
    super(scene, opts.x, opts.y);
    const big = opts.size === "lg";

    const labelText = scene.add
      .text(0, 0, opts.label.toUpperCase(), {
        ...textStyle("badge", { colorNum: theme.ink.tertiary }),
        // letter-spacing は Phaser の標準スタイルにないので、見出しの長さで雰囲気を出す
      })
      .setOrigin(0, 0);

    this.valueText = scene.add
      .text(0, big ? 14 : 12, opts.value + (opts.unit ? ` ${opts.unit}` : ""), {
        ...textStyle(big ? "hudL" : "hud", {
          colorNum: opts.colorNum ?? theme.ink.primary,
        }),
      })
      .setOrigin(0, 0);

    this.unit = opts.unit;
    this.add([labelText, this.valueText]);
    scene.add.existing(this);
  }

  setValue(value: string): this {
    this.valueText.setText(value + (this.unit ? ` ${this.unit}` : ""));
    return this;
  }
}

// ─────────────────────────────────────────────
// Tag — PHY/INT/状態系小チップ
// ─────────────────────────────────────────────
export interface TagOptions {
  x: number;
  y: number;
  label: string;
  /** チップの強調色（border / fg）。指定なしは中立色 */
  colorNum?: ColorNum;
  /** display 書体（英字大文字） を使う */
  mono?: boolean;
  /** SPEC-030: フィルタチップ用にトグル可能にする */
  active?: boolean;
  /** クリック時 callback (省略すると静的チップ) */
  onClick?: () => void;
}

/**
 * SPEC-030: 静的バッジ + フィルタチップを兼ねる Tag。
 * `onClick` を渡すと interactive、`active=true` で塗りが反転する (MCT のフィルタ流儀)。
 */
export class Tag extends Phaser.GameObjects.Container {
  private bg!: Phaser.GameObjects.Rectangle;
  private label!: Phaser.GameObjects.Text;
  private accentColor: ColorNum;
  private isActive: boolean;

  constructor(scene: Phaser.Scene, opts: TagOptions) {
    super(scene, opts.x, opts.y);
    this.accentColor = opts.colorNum ?? theme.ink.secondary;
    this.isActive = opts.active ?? false;

    this.label = scene.add
      .text(6, 1, opts.mono ? opts.label.toUpperCase() : opts.label, {
        ...textStyle("badge", {
          colorNum: this.isActive ? theme.ink.inverse : this.accentColor,
        }),
        fontFamily: opts.mono ? TYPE.badge.family : TYPE.caption.family,
      })
      .setOrigin(0, 0);

    const padX = 6;
    const w = Math.ceil(this.label.width) + padX * 2;
    const h = 16;

    this.bg = scene.add
      .rectangle(0, h / 2, w, h, this.isActive ? this.accentColor : theme.bg.raised, 1)
      .setStrokeStyle(1, this.accentColor)
      .setOrigin(0, 0.5);

    this.add([this.bg, this.label]);
    scene.add.existing(this);

    if (opts.onClick) {
      this.bg.setInteractive({ useHandCursor: true });
      this.bg.on("pointerdown", (p: Phaser.Input.Pointer) => {
        if (p.rightButtonDown()) return;
        opts.onClick?.();
      });
    }
  }

  setActive(active: boolean): this {
    this.isActive = active;
    this.bg.setFillStyle(active ? this.accentColor : theme.bg.raised, 1);
    this.label.setColor(hex2css(active ? theme.ink.inverse : this.accentColor));
    return this;
  }
}

// ─────────────────────────────────────────────
// ScreenHeader — 英字 LATIN-only + jp 大見出し
// ─────────────────────────────────────────────
export interface ScreenHeaderOptions {
  x: number;
  y: number;
  width: number;
  /** 例: "WORLD SELECT" — Orbitron, ALL-CAPS, accent 色 */
  enHeading: string;
  /** 例: "ワールド選択" — Zen Kaku Gothic */
  jpHeading: string;
  /** 戻るボタン (省略可) */
  onBack?: () => void;
  backLabel?: string;
}

export class ScreenHeader extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, opts: ScreenHeaderOptions) {
    super(scene, opts.x, opts.y);

    // 区切り線（下端 1px）
    const divider = scene.add
      .rectangle(0, 56, opts.width, 1, theme.line.weak, 1)
      .setOrigin(0, 0.5);
    this.add(divider);

    // 戻るボタン
    if (opts.onBack) {
      const back = new Btn(scene, {
        x: 12 + 36,
        y: 28,
        width: 72,
        height: 22,
        size: "sm",
        kind: "ghost",
        label: opts.backLabel ?? "← Back",
        onClick: opts.onBack,
      });
      this.add(back);
    }

    // 英字見出し（小さく上に）
    const en = scene.add
      .text(opts.width / 2, 14, opts.enHeading.toUpperCase(), {
        ...textStyle("badge", { colorNum: theme.accent.primary }),
      })
      .setOrigin(0.5, 0);

    // 和文見出し（中央に大きく）
    const jp = scene.add
      .text(opts.width / 2, 30, opts.jpHeading, {
        ...textStyle("h3", { colorNum: theme.ink.primary }),
      })
      .setOrigin(0.5, 0);

    this.add([en, jp]);
    scene.add.existing(this);
  }
}

// ─────────────────────────────────────────────
// Panel — 見出し付きの枠
// ─────────────────────────────────────────────
export interface PanelOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  /** 上部に表示する英字見出し (省略可) */
  enTitle?: string;
  /** 上部和文サブ見出し (省略可) */
  jpSubtitle?: string;
}

export class Panel extends Phaser.GameObjects.Container {
  /** タイトル行下端の y。コンテンツはこれより下に置く想定 */
  public readonly contentTop: number;

  constructor(scene: Phaser.Scene, opts: PanelOptions) {
    super(scene, opts.x, opts.y);

    const bg = scene.add
      .rectangle(0, 0, opts.width, opts.height, theme.bg.surface, 1)
      .setStrokeStyle(1, theme.line.base)
      .setOrigin(0, 0);
    this.add(bg);

    let yCursor = 0;
    if (opts.enTitle || opts.jpSubtitle) {
      const headerH = 36;
      if (opts.enTitle) {
        const en = scene.add
          .text(14, 10, opts.enTitle.toUpperCase(), {
            ...textStyle("badge", { colorNum: theme.accent.primary }),
          })
          .setOrigin(0, 0);
        this.add(en);
      }
      if (opts.jpSubtitle) {
        const jp = scene.add
          .text(14, 22, opts.jpSubtitle, {
            ...textStyle("small", { colorNum: theme.ink.secondary }),
          })
          .setOrigin(0, 0);
        this.add(jp);
      }
      const div = scene.add
        .rectangle(0, headerH, opts.width, 1, theme.line.weak, 1)
        .setOrigin(0, 0.5);
      this.add(div);
      yCursor = headerH;
    }

    this.contentTop = yCursor;
    scene.add.existing(this);
  }
}

// ─────────────────────────────────────────────
// Chip — クラス / レアリティ / 属性チップ
// ─────────────────────────────────────────────
export class ClassChip extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    cls: HeroClass,
    size = 24,
  ) {
    super(scene, x, y);
    const c = CLASS_COLORS[cls];
    const bg = scene.add
      .rectangle(0, 0, size, size, c.hex, 0.12)
      .setStrokeStyle(1, c.hex, 0.55)
      .setOrigin(0.5);
    const label = scene.add
      .text(0, 0, c.jp, {
        ...textStyle("caption", { colorNum: c.hex }),
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.add([bg, label]);
    scene.add.existing(this);
  }
}

export class RarityChip extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    rarity: HeroRarity,
    size = 16,
  ) {
    super(scene, x, y);
    const r = RARITY[rarity];
    const bg = scene.add
      .rectangle(0, 0, size, size, r.hex, 1)
      .setStrokeStyle(1, r.hex, 1)
      .setOrigin(0.5);
    const label = scene.add
      .text(0, 0, r.label, {
        fontFamily: TYPE.badge.family,
        fontSize: `${Math.round(size * 0.62)}px`,
        color: hex2css(theme.ink.inverse),
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.add([bg, label]);
    scene.add.existing(this);
  }
}

export class AttrChip extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    attr: AttackType,
  ) {
    super(scene, x, y);
    const a = ATTR[attr];
    const txt = scene.add
      .text(6, 1, a.label, {
        ...textStyle("badge", { colorNum: a.hex }),
      })
      .setOrigin(0, 0);
    const w = Math.ceil(txt.width) + 12;
    const bg = scene.add
      .rectangle(0, 8, w, 16, a.hex, 0.12)
      .setStrokeStyle(1, a.hex, 0.5)
      .setOrigin(0, 0.5);
    this.add([bg, txt]);
    scene.add.existing(this);
  }
}

// ─────────────────────────────────────────────
// SPEC-030: Card / Modal / SidePanel / StatGrid
//
// 主要な surface プリミティブ。MCT の `.panel` (radius 10) / modal (radius 12) を
// Phaser に移植したベース。
// ─────────────────────────────────────────────

export interface CardOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  /** タイトル (省略可) */
  title?: string;
  /** サブタイトル / クラス表示など */
  subtitle?: string;
  /** タイトル色のオーバーライド (default: ink.primary) */
  titleColor?: ColorNum;
  /** サブタイトル色 (default: accent.primary) */
  subtitleColor?: ColorNum;
  /** padding (default: 12) */
  padding?: number;
  /** 透明度 (default: 1) */
  alpha?: number;
}

/**
 * MCT `.panel` / hero card 等の base surface。bg + border + 任意のヘッダ。
 * `contentTop` の Y 値 (origin (0,0) からの相対) より下にコンテンツを置く想定。
 */
export class Card extends Phaser.GameObjects.Container {
  public readonly cardW: number;
  public readonly cardH: number;
  public readonly padding: number;
  /** タイトル行下端の Y。コンテンツ配置の基準 */
  public readonly contentTop: number;

  constructor(scene: Phaser.Scene, opts: CardOptions) {
    super(scene, opts.x, opts.y);
    this.cardW = opts.width;
    this.cardH = opts.height;
    this.padding = opts.padding ?? 12;

    const bg = scene.add
      .rectangle(0, 0, opts.width, opts.height, theme.bg.surface, opts.alpha ?? 1)
      .setStrokeStyle(1, theme.line.base)
      .setOrigin(0, 0);
    this.add(bg);

    let cursor = this.padding;
    if (opts.title) {
      const titleText = scene.add
        .text(opts.width / 2, cursor, opts.title, {
          ...textStyle("h3", {
            colorNum: opts.titleColor ?? theme.ink.primary,
          }),
          align: "center",
          wordWrap: { width: opts.width - this.padding * 2, useAdvancedWrap: true },
        })
        .setOrigin(0.5, 0);
      this.add(titleText);
      cursor += titleText.height + 2;
    }
    if (opts.subtitle) {
      const subText = scene.add
        .text(opts.width / 2, cursor, opts.subtitle, {
          ...textStyle("caption", {
            colorNum: opts.subtitleColor ?? theme.accent.primary,
          }),
        })
        .setOrigin(0.5, 0);
      this.add(subText);
      cursor += subText.height + 6;
    }
    this.contentTop = cursor;
    scene.add.existing(this);
  }
}

// ─────────────────────────────────────────────
// StatGrid — 2 列 (label / value) のステータス行
// ─────────────────────────────────────────────
export interface StatGridOptions {
  x: number;
  y: number;
  width: number;
  rows: Array<[string, string]>;
  /** 行の高さ (default: 16) */
  rowHeight?: number;
  /** 文字サイズ step (default: caption) */
  step?: keyof typeof TYPE;
  /** 左右パディング (default: 4) */
  padX?: number;
}

export class StatGrid extends Phaser.GameObjects.Container {
  public readonly height: number;

  constructor(scene: Phaser.Scene, opts: StatGridOptions) {
    super(scene, opts.x, opts.y);
    const rowH = opts.rowHeight ?? 16;
    const step = opts.step ?? "caption";
    const padX = opts.padX ?? 4;

    opts.rows.forEach((pair, i) => {
      const labelText = scene.add
        .text(padX, i * rowH, pair[0], {
          ...textStyle(step, { colorNum: theme.ink.tertiary }),
        })
        .setOrigin(0, 0);
      const valueText = scene.add
        .text(opts.width - padX, i * rowH, pair[1], {
          ...textStyle(step, { colorNum: theme.ink.primary }),
          fontStyle: "bold",
        })
        .setOrigin(1, 0);
      this.add([labelText, valueText]);
    });

    this.height = opts.rows.length * rowH;
    scene.add.existing(this);
  }
}

// ─────────────────────────────────────────────
// Modal / SidePanel — 共通ベース
// ─────────────────────────────────────────────
export interface ModalOptions {
  /** 中央モーダル (`center`) かサイドパネル (`side-right`) か */
  variant?: "center" | "side-right";
  /** パネル幅 (`center` 時の最大幅 / `side-right` 時の固定幅) */
  width: number;
  /** パネル高さ (省略時は viewport 全高) */
  height?: number;
  /** バックドロップ (黒半透明) を出すか。`side-right` のとき false 推奨 */
  backdrop?: boolean;
  /** バックドロップタップで閉じるか (default: true if backdrop) */
  closeOnBackdrop?: boolean;
  /** モーダル外の close 動作 */
  onClose?: () => void;
}

/**
 * SPEC-030: モーダルの schema を統一。
 *
 * - `variant: "center"` — 画面中央にカード状。backdrop あり推奨。
 * - `variant: "side-right"` — アークナイツ風の右からスライドイン。backdrop なし推奨。
 *
 * 中身は `body` Container に直接 `.add(child)` していく。`open()` で表示アニメーション、
 * `close()` で逆アニメ + 破棄。
 */
export class Modal extends Phaser.GameObjects.Container {
  public readonly panel: Phaser.GameObjects.Container;
  private bg!: Phaser.GameObjects.Rectangle;
  private backdrop?: Phaser.GameObjects.Rectangle;
  private variant: "center" | "side-right";
  private modalW: number;
  private modalH: number;
  private targetX: number;
  private targetY: number;
  private opts: ModalOptions;

  constructor(scene: Phaser.Scene, opts: ModalOptions) {
    super(scene, 0, 0);
    this.opts = opts;
    this.variant = opts.variant ?? "center";
    const vpW = scene.scale.width;
    const vpH = scene.scale.height;
    this.modalW = opts.width;
    this.modalH = opts.height ?? vpH;

    if (opts.backdrop) {
      this.backdrop = scene.add
        .rectangle(vpW / 2, vpH / 2, vpW, vpH, 0x000000, 0.7)
        .setInteractive({ useHandCursor: false });
      if (opts.closeOnBackdrop !== false) {
        this.backdrop.on("pointerdown", () => opts.onClose?.());
      }
      this.add(this.backdrop);
    }

    if (this.variant === "side-right") {
      this.targetX = vpW - this.modalW;
      this.targetY = 0;
      // パネル側自体は origin (0, 0) で配置
      this.bg = scene.add
        .rectangle(0, 0, this.modalW, this.modalH, theme.bg.surface, 0.98)
        .setStrokeStyle(1, theme.line.base)
        .setOrigin(0, 0);
    } else {
      // center
      this.targetX = (vpW - this.modalW) / 2;
      this.targetY = (vpH - this.modalH) / 2;
      this.bg = scene.add
        .rectangle(0, 0, this.modalW, this.modalH, theme.bg.surface, 1)
        .setStrokeStyle(1, theme.line.base)
        .setOrigin(0, 0);
    }

    this.panel = scene.add.container(0, 0, [this.bg]);
    this.add(this.panel);
    scene.add.existing(this);
  }

  /** モーダルを開くアニメーション。`onComplete` で完了時に追加処理可能。 */
  open(onComplete?: () => void): this {
    if (this.variant === "side-right") {
      // 右画面外から targetX へスライドイン
      const vpW = this.scene.scale.width;
      this.panel.x = vpW;
      this.panel.y = this.targetY;
      this.scene.tweens.add({
        targets: this.panel,
        x: this.targetX,
        duration: 220,
        ease: "Sine.easeOut",
        onComplete: () => onComplete?.(),
      });
      if (this.backdrop) {
        this.backdrop.alpha = 0;
        this.scene.tweens.add({
          targets: this.backdrop,
          alpha: 1,
          duration: 180,
        });
      }
    } else {
      // center: scale + fade in (MCT pop)
      this.panel.x = this.targetX;
      this.panel.y = this.targetY + 20;
      this.panel.alpha = 0;
      this.scene.tweens.add({
        targets: this.panel,
        y: this.targetY,
        alpha: 1,
        duration: 220,
        ease: "Sine.easeOut",
        onComplete: () => onComplete?.(),
      });
      if (this.backdrop) {
        this.backdrop.alpha = 0;
        this.scene.tweens.add({
          targets: this.backdrop,
          alpha: 1,
          duration: 180,
        });
      }
    }
    return this;
  }

  /** モーダルを閉じてGameObject を破棄。`onComplete` 後に this.destroy() */
  close(onComplete?: () => void): void {
    if (this.variant === "side-right") {
      const vpW = this.scene.scale.width;
      this.scene.tweens.add({
        targets: this.panel,
        x: vpW,
        duration: 180,
        ease: "Sine.easeIn",
      });
      if (this.backdrop) {
        this.scene.tweens.add({
          targets: this.backdrop,
          alpha: 0,
          duration: 160,
        });
      }
    } else {
      this.scene.tweens.add({
        targets: this.panel,
        alpha: 0,
        y: this.targetY + 20,
        duration: 160,
        ease: "Sine.easeIn",
      });
      if (this.backdrop) {
        this.scene.tweens.add({
          targets: this.backdrop,
          alpha: 0,
          duration: 160,
        });
      }
    }
    this.scene.time.delayedCall(220, () => {
      onComplete?.();
      this.destroy(true);
    });
  }
  /** opts への外部参照 (close 時の追跡用) */
  getOpts(): ModalOptions {
    return this.opts;
  }
}
