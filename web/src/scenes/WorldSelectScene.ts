import Phaser from "phaser";
import { ALL_WORLDS } from "../game/stages";

/**
 * SPEC-011: ワールド選択シーン。
 * 起動時の最初のシーンで、ワールド一覧（カード）を表示する。
 * カードをタップするとそのワールドのステージ選択 (StageSelectScene) へ遷移。
 */
export class WorldSelectScene extends Phaser.Scene {
  constructor() {
    super("WorldSelectScene");
  }

  create(): void {
    const { width } = this.scale;
    this.cameras.main.setBackgroundColor(0x0e1117);

    this.add
      .text(width / 2, 60, "MyCryptoFortress", {
        fontSize: "32px",
        color: "#fde68a",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 100, "ワールドを選んでください", {
        fontSize: "16px",
        color: "#bae6fd",
      })
      .setOrigin(0.5);

    // ワールドカードを縦に並べる
    const cardW = 360;
    const cardH = 110;
    const gap = 18;
    const baseY = 170;

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
        .text(cx + cardW / 2 - 16, cy + 36, `▶ ${world.stages.length} ステージ`, {
          fontSize: "11px",
          color: "#a7f3d0",
        })
        .setOrigin(1, 0.5);

      bg.on("pointerover", () => bg.setStrokeStyle(2, 0xfde047));
      bg.on("pointerout", () => bg.setStrokeStyle(2, 0x4b5563));
      bg.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (pointer.rightButtonDown()) return;
        this.scene.start("StageSelectScene", { worldId: world.id });
      });
    });
  }
}
