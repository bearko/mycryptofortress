import Phaser from "phaser";
import { playSe } from "../audio";
import { MIN_TAP } from "../layout";
import { COLORS, textStyle } from "./theme";
import { stepVolume, volumeLabel } from "./volume";
import { Button } from "./widgets";

export interface VolumeStepperOptions {
  width: number;
  /** 行の左に出す名前（"BGM" / "SE"） */
  label: string;
  /** いまの値（0..1） */
  value: number;
  /** 値が変わったとき（保存と反映は呼び出し側）。タップ音はそのあとで鳴らす */
  onChange: (value: number) => void;
}

/**
 * SPEC-127: 音量を「−」「＋」で 5% ずつ上げ下げする行。0 は OFF、端で止まる。
 * タップ音は値が変わったあとに鳴らすので、SE の行では新しい大きさの試し聞きになる。
 */
export class VolumeStepper extends Phaser.GameObjects.Container {
  private value: number;
  private readonly valueText: Phaser.GameObjects.Text;
  private readonly minus: Button;
  private readonly plus: Button;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: VolumeStepperOptions) {
    super(scene, x, y);
    this.value = opts.value;
    const half = opts.width / 2;
    const btnW = MIN_TAP;
    const valueW = 128;
    const gap = 12;
    const plusX = half - btnW / 2;
    const valueX = plusX - btnW / 2 - gap - valueW / 2;
    const minusX = valueX - valueW / 2 - gap - btnW / 2;

    const label = scene.add.text(-half, 0, opts.label, textStyle(28)).setOrigin(0, 0.5);
    this.valueText = scene.add.text(valueX, 0, "", textStyle(30, { display: true, color: COLORS.gold })).setOrigin(0.5);
    const step = (dir: 1 | -1) => {
      const next = stepVolume(this.value, dir);
      if (next === this.value) return;
      this.value = next;
      this.refresh();
      opts.onChange(next);
      playSe(scene, "se.crash");
    };
    this.minus = new Button(scene, minusX, 0, { width: btnW, label: "−", silent: true, onTap: () => step(-1) });
    this.plus = new Button(scene, plusX, 0, { width: btnW, label: "＋", silent: true, onTap: () => step(1) });
    this.add([label, this.valueText, this.minus, this.plus]);
    this.setSize(opts.width, MIN_TAP);
    this.refresh();
    scene.add.existing(this);
  }

  private refresh(): void {
    this.valueText.setText(volumeLabel(this.value));
    this.minus.setKind(this.value <= 0 ? "locked" : "secondary");
    this.plus.setKind(this.value >= 1 ? "locked" : "secondary");
  }
}
