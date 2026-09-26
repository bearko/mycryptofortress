import Phaser from "phaser";
import { getCryptid, type CryptidId } from "../../data/cryptids";
import type { RunSim } from "../../sim/run";
import { GAME_WIDTH } from "../layout";
import { COLORS, textStyle } from "../ui/theme";

const BAR_X = 96;
const BAR_W = 250;

/** SPEC-105 §1: 上部 HUD（幻獣 HP / Wave / GUM） */
export class Hud {
  private readonly hpBar: Phaser.GameObjects.Graphics;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly waveText: Phaser.GameObjects.Text;
  private readonly gumText: Phaser.GameObjects.Text;
  /** GUM アイコンの位置（回収演出の飛び先） */
  readonly gumTarget = { x: 548, y: 56 };
  private shownGum = -1;

  constructor(scene: Phaser.Scene, cryptidId: CryptidId) {
    scene.add.rectangle(0, 0, GAME_WIDTH, 112, COLORS.bg, 0.88).setOrigin(0).setDepth(90);
    scene.add.rectangle(0, 111, GAME_WIDTH, 2, COLORS.line).setOrigin(0).setDepth(90);
    scene.add.image(48, 56, getCryptid(cryptidId).imageKey).setScale(0.5).setDepth(91);
    this.hpBar = scene.add.graphics().setDepth(91);
    this.hpText = scene.add.text(BAR_X, 40, "", textStyle(20)).setOrigin(0, 0.5).setDepth(92);
    this.waveText = scene.add.text(BAR_X, 84, "", textStyle(24, { display: true, color: COLORS.inkDim })).setOrigin(0, 0.5).setDepth(91);
    scene.add.image(this.gumTarget.x, this.gumTarget.y, "icon.gum").setScale(0.7).setDepth(91);
    this.gumText = scene.add.text(GAME_WIDTH - 28, 56, "", textStyle(40, { display: true, color: COLORS.gold })).setOrigin(1, 0.5).setDepth(91);
  }

  update(sim: RunSim): void {
    const ratio = sim.hp / sim.maxHp;
    this.hpBar.clear();
    this.hpBar.fillStyle(0x000000, 0.6).fillRoundedRect(BAR_X - 2, 26, BAR_W + 4, 28, 8);
    this.hpBar.fillStyle(ratio > 0.5 ? 0x6be675 : ratio > 0.25 ? COLORS.gold : COLORS.danger, 1);
    if (ratio > 0) this.hpBar.fillRoundedRect(BAR_X, 28, Math.max(12, BAR_W * ratio), 24, 7);
    this.hpText.setText(` HP ${Math.ceil(sim.hp)} / ${sim.maxHp}`);
    const wave = Math.max(0, sim.waveIndex + 1);
    this.waveText.setText(`WAVE ${wave} / ${sim.wavesTotal}`);
    if (sim.gum !== this.shownGum) {
      this.shownGum = sim.gum;
      this.gumText.setText(String(sim.gum));
    }
  }
}
