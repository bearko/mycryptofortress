import Phaser from "phaser";
import { findWorld } from "../game/stages";
import { getClearedStageIds } from "../game/progress";

/**
 * SPEC-011: ステージ選択シーン。
 * `worldId` パラメータで受け取ったワールドのステージ一覧を表示し、
 * 選んだステージで StageScene を起動する。
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
    const { width } = this.scale;
    this.cameras.main.setBackgroundColor(0x0e1117);

    const world = findWorld(this.worldId);
    if (!world) {
      this.add
        .text(width / 2, 80, `ワールドが見つかりません: ${this.worldId}`, {
          fontSize: "16px",
          color: "#fca5a5",
        })
        .setOrigin(0.5);
      return;
    }

    this.add
      .text(width / 2, 60, world.name, {
        fontSize: "26px",
        color: "#fde68a",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 92, world.description, {
        fontSize: "12px",
        color: "#cbd5e1",
        align: "center",
        wordWrap: { width: 480, useAdvancedWrap: true },
      })
      .setOrigin(0.5);

    // 戻るボタン
    const backBtn = this.add
      .text(20, 28, "← ワールド選択", {
        fontSize: "14px",
        color: "#93c5fd",
      })
      .setInteractive({ useHandCursor: true });
    backBtn.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      this.scene.start("WorldSelectScene");
    });

    // SPEC-014: クリア済みステージを取得
    const cleared = getClearedStageIds();

    // ステージ一覧を縦並び
    const cardW = 460;
    const cardH = 88;
    const gap = 14;
    const baseY = 140;

    world.stages.forEach((stage, i) => {
      const cy = baseY + (cardH + gap) * i + cardH / 2;
      const cx = width / 2;
      const isCleared = cleared.has(stage.id);

      const bg = this.add.rectangle(cx, cy, cardW, cardH, 0x111827, 0.95);
      bg.setStrokeStyle(2, isCleared ? 0x4ade80 : 0x4b5563);
      bg.setInteractive({ useHandCursor: true });

      // ステージ番号バッジ
      this.add
        .rectangle(cx - cardW / 2 + 32, cy, 48, 48, 0x1e293b, 1)
        .setStrokeStyle(2, isCleared ? 0x4ade80 : 0xfde047);
      this.add
        .text(cx - cardW / 2 + 32, cy, stage.id, {
          fontSize: "16px",
          color: isCleared ? "#a7f3d0" : "#fde68a",
          fontStyle: "bold",
        })
        .setOrigin(0.5);

      this.add
        .text(cx - cardW / 2 + 64, cy - 18, stage.name, {
          fontSize: "16px",
          color: "#f9fafb",
          fontStyle: "bold",
        })
        .setOrigin(0, 0.5);
      this.add
        .text(cx - cardW / 2 + 64, cy + 12, stage.description, {
          fontSize: "11px",
          color: "#cbd5e1",
          wordWrap: { width: cardW - 100, useAdvancedWrap: true },
        })
        .setOrigin(0, 0.5);

      // クリア済みバッジ または ▶
      if (isCleared) {
        this.add
          .text(cx + cardW / 2 - 16, cy - 18, "✓ クリア", {
            fontSize: "11px",
            color: "#4ade80",
            fontStyle: "bold",
          })
          .setOrigin(1, 0.5);
      }
      this.add
        .text(cx + cardW / 2 - 16, cy + 14, "▶", {
          fontSize: "20px",
          color: "#a7f3d0",
        })
        .setOrigin(1, 0.5);

      const baseStroke = isCleared ? 0x4ade80 : 0x4b5563;
      bg.on("pointerover", () => bg.setStrokeStyle(2, 0xfde047));
      bg.on("pointerout", () => bg.setStrokeStyle(2, baseStroke));
      bg.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (pointer.rightButtonDown()) return;
        // SPEC-015: バトル画面に行く前にパーティ編成を挟む
        this.scene.start("PartyFormationScene", { stageId: stage.id });
      });
    });
  }
}
