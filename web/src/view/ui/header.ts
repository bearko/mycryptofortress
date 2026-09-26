import Phaser from "phaser";
import { GAME_WIDTH, MARGIN } from "../layout";
import { COLORS, textStyle } from "./theme";
import { Button } from "./widgets";

export const HEADER_H = 112;

/** 戻るボタン・タイトル・CE 残高のヘッダー */
export class Header {
  private readonly ceText: Phaser.GameObjects.Text;
  private readonly ceIcon: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, title: string, onBack: () => void, depth = 80) {
    scene.add.rectangle(0, 0, GAME_WIDTH, HEADER_H, COLORS.bg, 0.9).setOrigin(0).setDepth(depth);
    scene.add.rectangle(0, HEADER_H - 2, GAME_WIDTH, 2, COLORS.line).setOrigin(0).setDepth(depth);
    new Button(scene, MARGIN + 50, HEADER_H / 2, { width: 100, label: "←", onTap: onBack }).setDepth(depth + 1);
    scene.add.text(MARGIN + 124, HEADER_H / 2, title, textStyle(30)).setOrigin(0, 0.5).setDepth(depth + 1);
    this.ceText = scene.add.text(GAME_WIDTH - MARGIN, HEADER_H / 2, "", textStyle(30, { display: true, color: COLORS.gold })).setOrigin(1, 0.5).setDepth(depth + 1);
    this.ceIcon = scene.add.image(0, HEADER_H / 2, "icon.ce").setScale(0.6).setDepth(depth + 1);
  }

  setCe(ce: number): this {
    this.ceText.setText(String(ce));
    this.ceIcon.setX(this.ceText.x - this.ceText.width - 26);
    return this;
  }
}

/** ゲーム内の画面遷移（フェード付き） */
export function goTo(scene: Phaser.Scene, key: string, data?: object): void {
  scene.cameras.main.fadeOut(180, 11, 13, 18);
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => scene.scene.start(key, data));
}
