import Phaser from "phaser";
import { ALL_WORLDS, type WorldDef } from "../game/stages";
import { SE_KEYS } from "./BootScene";
import { playSe } from "./seUtil";
import { getViewport, onResize } from "./layout";
import { theme, textStyle, hex2css, GAP, setTheme } from "../ui/tokens";
import { ScreenHeader } from "../ui/components";

/**
 * SPEC-011 / SPEC-016 / SPEC-018: ワールド選択シーン。
 * STEEL ONYX デザイントークンに沿ったビジュアルに刷新。
 */
export class WorldSelectScene extends Phaser.Scene {
  constructor() {
    super("WorldSelectScene");
  }

  create(): void {
    // ワールド選択画面に戻るときは onyx テーマに復帰
    setTheme("onyx");
    this.cameras.main.setBackgroundColor(theme.bg.base);
    this.layout();
    onResize(this, () => this.layout());
  }

  private layout(): void {
    this.children.removeAll(true);
    const { width, height, isPortrait } = getViewport(this);

    // ── ヘッダ
    new ScreenHeader(this, {
      x: 0,
      y: 0,
      width,
      enHeading: "WORLD SELECT",
      jpHeading: "ワールド選択",
    });

    // ── ワールドカード一覧（垂直スタック）
    const cardW = Math.min(isPortrait ? width - 24 : 720, width - 24);
    const cardH = isPortrait ? 92 : 140;
    const cardGap = isPortrait ? 12 : 16;
    const startY = 76;
    const padX = (width - cardW) / 2;

    ALL_WORLDS.forEach((world, i) => {
      const cy = startY + i * (cardH + cardGap);
      this.buildWorldCard(world, padX, cy, cardW, cardH);
    });

    // ── フッタクレジット
    this.add
      .text(
        width / 2,
        height - 14,
        "SE: Senses Circuit (hitoshi) — senses-circuit.com  © Senses Circuit",
        {
          ...textStyle("caption", { colorNum: theme.ink.muted }),
          align: "center",
          wordWrap: { width: width - 16, useAdvancedWrap: true },
        },
      )
      .setOrigin(0.5);
  }

  private buildWorldCard(
    world: WorldDef,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const compact = h <= 100; // mobile portrait

    // 背景（surface）
    const bg = this.add
      .rectangle(x, y, w, h, theme.bg.surface, 1)
      .setOrigin(0, 0)
      .setStrokeStyle(1, theme.line.base);
    bg.setInteractive({ useHandCursor: true });

    // 右側のバナーオーバーレイ（縦画面では狭く）
    const bannerWFrac = compact ? 0.32 : 0.45;
    const bannerW = Math.floor(w * bannerWFrac);
    const bannerX = x + w - bannerW;
    this.add
      .rectangle(bannerX, y, bannerW, h, theme.accent.primary, 0.07)
      .setOrigin(0, 0);
    this.add
      .rectangle(bannerX, y, 1, h, theme.line.weak, 1)
      .setOrigin(0, 0);
    this.add
      .text(bannerX + bannerW / 2, y + h / 2, "[Banner Image]", {
        ...textStyle("badge", { colorNum: theme.ink.muted }),
        fontStyle: "",
      })
      .setOrigin(0.5);

    // 左コンテンツ
    const padTop = compact ? 10 : 18;
    const padLeft = compact ? 12 : 22;
    const lx = x + padLeft;
    const latin = {
      en: world.eraEn ?? world.id.toUpperCase(),
      years: world.years ?? "",
    };
    const contentRight = bannerX - GAP.sm;

    // 英字見出し（Orbitron, ALL-CAPS, accent.primary）
    this.add
      .text(lx, y + padTop, latin.en, {
        ...textStyle("badge", { colorNum: theme.accent.primary }),
      })
      .setOrigin(0, 0);

    // 和文ワールド名
    const nameY = y + padTop + 12;
    this.add
      .text(lx, nameY, world.name, {
        fontFamily: "'Zen Kaku Gothic New', 'Noto Sans JP', system-ui, sans-serif",
        fontSize: compact ? "20px" : "28px",
        color: hex2css(theme.ink.primary),
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    // 年代（Orbitron, ink.tertiary）
    if (latin.years) {
      this.add
        .text(lx, nameY + (compact ? 24 : 36), latin.years, {
          ...textStyle("badge", { colorNum: theme.ink.tertiary }),
        })
        .setOrigin(0, 0);
    }

    // ── 下端行: 右に STAGES + ▶、PC では左に説明
    const bottomY = y + h - padTop - 2;
    const stageCount = world.stages.length;

    // 右下: STAGES + chevron
    const chevron = this.add
      .text(contentRight, bottomY, "▶", {
        ...textStyle("body", { colorNum: theme.accent.primary }),
        fontStyle: "bold",
      })
      .setOrigin(1, 1);
    const stageText = this.add
      .text(chevron.x - chevron.width - GAP.sm, bottomY - 2, `${stageCount} STAGES`, {
        ...textStyle("badge", { colorNum: theme.ink.secondary }),
      })
      .setOrigin(1, 1);

    // 説明文は PC のみ（縦画面の細いカードでは省略）
    if (!compact) {
      const descRight = stageText.x - stageText.width - GAP.md;
      this.add
        .text(lx, bottomY, world.description, {
          ...textStyle("small", { colorNum: theme.ink.secondary }),
          wordWrap: { width: descRight - lx, useAdvancedWrap: true },
        })
        .setOrigin(0, 1);
    }

    // 下端 2px の進捗バー（accent.primary, glow 風）
    this.add
      .rectangle(x, y + h - 2, w, 2, theme.accent.primary, 1)
      .setOrigin(0, 0)
      .setAlpha(0.55);

    // hover で線色を bright に
    bg.on("pointerover", () =>
      bg.setStrokeStyle(1, theme.line.strong),
    );
    bg.on("pointerout", () => bg.setStrokeStyle(1, theme.line.base));
    bg.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      playSe(this, SE_KEYS.uiMenu());
      // SPEC-019: ワールドの themeId に応じてテーマを切替（戦国は朱赤）
      if (world.themeId) setTheme(world.themeId);
      this.scene.start("StageSelectScene", { worldId: world.id });
    });
  }
}
