import Phaser from "phaser";
import { ALL_WORLDS } from "../game/stages";
import { SE_KEYS } from "./BootScene";
import { playSe } from "./seUtil";
import { getViewport, onResize } from "./layout";

/**
 * SPEC-011 / SPEC-016: ワールド選択シーン。
 * 起動時の最初のシーンで、ワールド一覧（カード）を表示する。
 * カードをタップするとそのワールドのステージ選択 (StageSelectScene) へ遷移。
 *
 * SPEC-016 でビューポートサイズに追従するレイアウトに変更。
 */
export class WorldSelectScene extends Phaser.Scene {
  constructor() {
    super("WorldSelectScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x0e1117);
    this.layout();
    onResize(this, () => this.layout());
  }

  private layout(): void {
    this.children.removeAll(true);
    const { width, height, isPortrait } = getViewport(this);

    const titleY = isPortrait ? 70 : 60;
    const subY = isPortrait ? 108 : 100;

    this.add
      .text(width / 2, titleY, "MyCryptoFortress", {
        fontSize: isPortrait ? "28px" : "32px",
        color: "#fde68a",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, subY, "ワールドを選んでください", {
        fontSize: "14px",
        color: "#bae6fd",
      })
      .setOrigin(0.5);

    const cardW = Math.min(420, width - 32);
    const cardH = 110;
    const gap = 18;
    const baseY = subY + 28;

    ALL_WORLDS.forEach((world, i) => {
      const cy = baseY + (cardH + gap) * i + cardH / 2;
      const cx = width / 2;

      const bg = this.add.rectangle(cx, cy, cardW, cardH, 0x111827, 0.95);
      bg.setStrokeStyle(2, 0x4b5563);
      bg.setInteractive({ useHandCursor: true });

      this.add
        .text(cx - cardW / 2 + 16, cy - 36, `[${world.era}]`, {
          fontSize: "11px",
          color: "#fcd34d",
        })
        .setOrigin(0, 0.5);

      this.add
        .text(cx - cardW / 2 + 16, cy - 14, world.name, {
          fontSize: "20px",
          color: "#f9fafb",
          fontStyle: "bold",
        })
        .setOrigin(0, 0.5);

      this.add
        .text(cx - cardW / 2 + 16, cy + 14, world.description, {
          fontSize: "12px",
          color: "#cbd5e1",
          wordWrap: { width: cardW - 32, useAdvancedWrap: true },
        })
        .setOrigin(0, 0.5);

      this.add
        .text(
          cx + cardW / 2 - 16,
          cy + 36,
          `▶ ${world.stages.length} ステージ`,
          {
            fontSize: "11px",
            color: "#a7f3d0",
          },
        )
        .setOrigin(1, 0.5);

      bg.on("pointerover", () => bg.setStrokeStyle(2, 0xfde047));
      bg.on("pointerout", () => bg.setStrokeStyle(2, 0x4b5563));
      bg.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (pointer.rightButtonDown()) return;
        playSe(this, SE_KEYS.uiMenu());
        this.scene.start("StageSelectScene", { worldId: world.id });
      });
    });

    // SE クレジット表記（画面下部）
    this.add
      .text(
        width / 2,
        height - 14,
        "SE: Senses Circuit (hitoshi) — https://www.senses-circuit.com/  © Senses Circuit",
        {
          fontSize: "10px",
          color: "#6b7280",
          align: "center",
          wordWrap: { width: width - 16, useAdvancedWrap: true },
        },
      )
      .setOrigin(0.5);
  }
}
