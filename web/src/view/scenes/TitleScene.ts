import Phaser from "phaser";
import { playBgm, playSe } from "../audio";
import { CENTER_X, GAME_HEIGHT, GAME_WIDTH } from "../layout";
import { session } from "../session";
import { COLORS, textStyle } from "../ui/theme";
import { CryptidDisplay, LandBackground } from "../ui/widgets";

/** SPEC-101 §5.7: タイトル。初回タップで音声をアンロックして BGM を開始し、ホームへ。 */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super("Title");
  }

  create(): void {
    const cryptidId = session.data.profile.cryptidId;
    void new LandBackground(this, 0.5).show(cryptidId);

    const logo = this.add.image(CENTER_X, 170, "logo.mch");
    logo.setScale(Math.min(1, 460 / logo.width));
    this.add.text(CENTER_X, 262, "MyCryptoFortress", textStyle(46, { display: true })).setOrigin(0.5);
    this.add
      .text(CENTER_X, 318, "幻獣防衛戦 ─ TOWER DEFENSE × INCREMENTAL", textStyle(20, { color: COLORS.inkDim }))
      .setOrigin(0.5);

    new CryptidDisplay(this, CENTER_X, 620, cryptidId, 2.6);

    // ナビゲーター: マインちゃん（SPEC-100 §4.1）
    this.add.sprite(150, 1000, "chara.navi_ain_greeting_00_greet_sparkle").setScale(2).play("navi.greeting");
    this.speechBubble(440, 930, "ようこそ！\nヒーローたちと一緒に\n幻獣を守りましょう！");

    const tap = this.add.text(CENTER_X, 1170, "TAP TO START", textStyle(34, { display: true, color: COLORS.gold })).setOrigin(0.5);
    this.tweens.add({ targets: tap, alpha: 0.25, duration: 800, yoyo: true, repeat: -1 });

    this.add
      .text(CENTER_X, GAME_HEIGHT - 28, "Assets © My Crypto Heroes ／ ドット絵：こじもこ", textStyle(16, { weight: 500, color: COLORS.inkDim }))
      .setOrigin(0.5);

    this.input.once(Phaser.Input.Events.POINTER_UP, () => {
      playSe(this, "se.ui.tap");
      playBgm(this, "bgm.land");
      this.cameras.main.fadeOut(250, 11, 13, 18);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start("Home"));
    });
  }

  private speechBubble(x: number, y: number, message: string): void {
    const text = this.add.text(0, 0, message, textStyle(22, { color: COLORS.bg })).setOrigin(0.5);
    const w = Math.min(GAME_WIDTH - x - 24 + 150, text.width + 40);
    const h = text.height + 32;
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.95).fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    g.fillTriangle(-w / 2 + 10, h / 2 - 30, -w / 2 - 26, h / 2 - 4, -w / 2 + 10, h / 2 - 8);
    this.add.container(x, y, [g, text]);
  }
}
