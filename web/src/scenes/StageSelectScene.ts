import Phaser from "phaser";
import { findWorld, type StageDef } from "../game/stages";
import { getClearedStageIds } from "../game/progress";
import { SE_KEYS } from "./BootScene";
import { playSe } from "./seUtil";
import { getViewport, onResize } from "./layout";
import { theme, textStyle, GAP } from "../ui/tokens";
import { ScreenHeader, Tag } from "../ui/components";

/**
 * SPEC-011 / SPEC-016 / SPEC-018: ステージ選択シーン。
 * STEEL ONYX デザイントークンに沿ったビジュアルに刷新。
 *
 * 現在のステージデータには difficulty / star ratings が無いので、当面は
 * クリア済みフラグ + ステージ番号 + name + description のみ表示。
 * 後続 SPEC で `StageDef.difficulty` / `cleared.stars` を導入したら拡張する。
 */
export class StageSelectScene extends Phaser.Scene {
  private worldId = "world-1";

  constructor() {
    super("StageSelectScene");
  }

  init(data: { worldId?: string }): void {
    if (data.worldId) this.worldId = data.worldId;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(theme.bg.base);
    this.layout();
    onResize(this, () => this.layout());
  }

  private layout(): void {
    this.children.removeAll(true);
    const { width, isPortrait } = getViewport(this);
    const world = findWorld(this.worldId);
    if (!world) {
      this.add
        .text(width / 2, 80, `ワールドが見つかりません: ${this.worldId}`, {
          ...textStyle("body", { colorNum: theme.accent.danger }),
        })
        .setOrigin(0.5);
      return;
    }

    new ScreenHeader(this, {
      x: 0,
      y: 0,
      width,
      enHeading: "STAGE SELECT",
      jpHeading: `${world.name}  /  ステージ`,
      onBack: () => {
        playSe(this, SE_KEYS.uiMenu());
        this.scene.start("WorldSelectScene");
      },
    });

    const cleared = getClearedStageIds();
    const clearedCount = world.stages.filter((s) => cleared.has(s.id)).length;

    // クリア進捗バッジ（右寄せ）
    this.add
      .text(
        width - 14,
        18,
        `${clearedCount} / ${world.stages.length} CLEARED`,
        {
          ...textStyle("badge", { colorNum: theme.ink.secondary }),
        },
      )
      .setOrigin(1, 0);

    // ── ステージカード grid
    const padX = isPortrait ? 12 : 24;
    const gap = isPortrait ? 10 : 14;
    const cols = isPortrait ? 1 : 2;
    const startY = 76;
    const totalW = width - padX * 2;
    const cardW = (totalW - gap * (cols - 1)) / cols;
    const cardH = isPortrait ? 86 : 96;

    world.stages.forEach((stage, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = padX + col * (cardW + gap);
      const cy = startY + row * (cardH + gap);
      this.buildStageCard(stage, cleared.has(stage.id), cx, cy, cardW, cardH);
    });
  }

  private buildStageCard(
    stage: StageDef,
    isCleared: boolean,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const borderColor = isCleared ? theme.accent.success : theme.line.base;

    const bg = this.add
      .rectangle(x, y, w, h, theme.bg.surface, 1)
      .setOrigin(0, 0)
      .setStrokeStyle(1, borderColor);
    bg.setInteractive({ useHandCursor: true });

    const padTop = 12;
    const padLeft = 14;

    // ステージ番号（Orbitron, 22px）
    const numColor = isCleared ? theme.accent.success : theme.ink.secondary;
    const stageNum = this.add
      .text(x + padLeft, y + padTop, stage.id, {
        ...textStyle("h2", { colorNum: numColor }),
      })
      .setOrigin(0, 0);

    // ステージ名 (jp h3)
    this.add
      .text(stageNum.x + stageNum.width + GAP.md, y + padTop + 4, stage.name, {
        ...textStyle("h3", { colorNum: theme.ink.primary }),
      })
      .setOrigin(0, 0);

    // 難易度タグ（暫定: クリア済 = NORMAL/CLEARED, 未クリア = NEW）
    // 将来 stage.difficulty が入ったら本物の値に差し替え
    const tagColor = isCleared ? theme.accent.success : theme.accent.primary;
    const tagLabel = isCleared ? "CLEARED" : "NEW";
    new Tag(this, {
      x: stageNum.x + stageNum.width + GAP.md,
      y: y + padTop + 26,
      label: tagLabel,
      colorNum: tagColor,
      mono: true,
    });

    // 右上のクリアバッジ（✓）
    if (isCleared) {
      this.add
        .text(x + w - 12, y + 10, "✓", {
          ...textStyle("body", { colorNum: theme.accent.success }),
          fontStyle: "bold",
        })
        .setOrigin(1, 0);
    }

    // 説明 / メタ（下段）
    this.add
      .text(x + padLeft, y + h - 12, stage.description, {
        ...textStyle("caption", { colorNum: theme.ink.tertiary }),
        wordWrap: { width: w - padLeft - 12, useAdvancedWrap: true },
      })
      .setOrigin(0, 1);

    // 右下: ▶
    this.add
      .text(x + w - 12, y + h - 12, "▶", {
        ...textStyle("body", { colorNum: theme.accent.primary }),
        fontStyle: "bold",
      })
      .setOrigin(1, 1);

    // hover で線色を bright に
    bg.on("pointerover", () => {
      bg.setStrokeStyle(1, theme.line.strong);
    });
    bg.on("pointerout", () => {
      bg.setStrokeStyle(1, borderColor);
    });
    bg.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      playSe(this, SE_KEYS.uiMenu());
      this.scene.start("PartyFormationScene", { stageId: stage.id });
    });
  }
}
