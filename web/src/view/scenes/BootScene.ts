import Phaser from "phaser";
import { preloadAssets } from "../../data/assets";
import { applyPixelArtFilter, queueAsset } from "../assetLoader";
import { CENTER_X, GAME_HEIGHT } from "../layout";
import { COLORS, textStyle } from "../ui/theme";

/** SPEC-101 §5.7: マニフェストの preload 対象を読み込み、アニメーションを登録する。 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload(): void {
    const barW = 440;
    const y = GAME_HEIGHT / 2;
    this.add.text(CENTER_X, y - 56, "LOADING", textStyle(28, { display: true, color: COLORS.inkDim })).setOrigin(0.5);
    this.add.rectangle(CENTER_X, y, barW, 14, COLORS.panelRaised).setStrokeStyle(2, COLORS.line);
    const bar = this.add.rectangle(CENTER_X - barW / 2, y, 0, 14, COLORS.gold).setOrigin(0, 0.5);
    this.load.on(Phaser.Loader.Events.PROGRESS, (v: number) => bar.setSize(barW * v, 14));

    for (const a of preloadAssets()) queueAsset(this, a);
  }

  create(): void {
    for (const a of preloadAssets()) if (a.type === "image") applyPixelArtFilter(this, a.key);

    this.anims.create({
      key: "navi.idle",
      frames: [
        { key: "chara.navi_ain_11_idle", duration: 600 },
        { key: "chara.navi_ain_12_blink", duration: 150 },
        { key: "chara.navi_ain_13_blink", duration: 150 },
      ],
      repeat: -1,
    });
    this.anims.create({
      key: "navi.greeting",
      frames: [
        { key: "chara.navi_ain_greeting_00_greet_sparkle", duration: 200 },
        { key: "chara.navi_ain_greeting_01_greet_sparkle", duration: 600 },
      ],
      repeat: -1,
    });

    this.scene.start("Title");
  }
}
