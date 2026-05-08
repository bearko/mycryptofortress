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
// ─────────────────────────────────────────────
export type BtnKind = "primary" | "secondary" | "ghost" | "destructive";
export type BtnSize = "sm" | "md";

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
      return {
        bg: theme.accent.primary,
        fg: theme.ink.inverse,
        border: theme.accent.primary,
        hoverBg: theme.accent.primaryDk,
      };
    case "secondary":
      return {
        bg: theme.bg.raised,
        fg: theme.ink.primary,
        border: theme.line.strong,
        hoverBg: theme.bg.overlay,
      };
    case "ghost":
      return {
        bg: theme.bg.surface,
        fg: theme.ink.secondary,
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
    this.btnW = opts.width ?? (sm ? 100 : 160);
    this.btnH = opts.height ?? (sm ? 26 : 36);

    const pal = btnPalette(this.kind, this.disabled);

    this.bg = scene.add
      .rectangle(0, 0, this.btnW, this.btnH, pal.bg, 1)
      .setStrokeStyle(1, pal.border);

    this.label = scene.add
      .text(0, 0, opts.label, {
        ...textStyle(sm ? "small" : "body", { colorNum: pal.fg }),
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
}

export class Tag extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, opts: TagOptions) {
    super(scene, opts.x, opts.y);

    const txt = scene.add
      .text(6, 1, opts.mono ? opts.label.toUpperCase() : opts.label, {
        ...textStyle("badge", {
          colorNum: opts.colorNum ?? theme.ink.secondary,
        }),
        fontFamily: opts.mono ? TYPE.badge.family : TYPE.caption.family,
      })
      .setOrigin(0, 0);

    const padX = 6;
    const w = Math.ceil(txt.width) + padX * 2;
    const h = 16;

    const bg = scene.add
      .rectangle(0, h / 2, w, h, theme.bg.raised, 1)
      .setStrokeStyle(1, opts.colorNum ?? theme.line.base)
      .setOrigin(0, 0.5);

    this.add([bg, txt]);
    scene.add.existing(this);
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
