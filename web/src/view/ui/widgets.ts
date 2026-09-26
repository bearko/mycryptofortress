import Phaser from "phaser";
import { getCryptid, type CryptidId } from "../../data/cryptids";
import { assetUrl, getAsset } from "../../data/assets";
import { ensureImage } from "../assetLoader";
import { playSe } from "../audio";
import { bindPress } from "../input/press";
import { GAME_HEIGHT, GAME_WIDTH, MIN_TAP } from "../layout";
import { COLORS, textStyle } from "./theme";

export type ButtonKind = "primary" | "secondary" | "locked";

export interface ButtonOptions {
  width: number;
  height?: number;
  label: string;
  sub?: string;
  kind?: ButtonKind;
  /** primary の塗り色（既定: ゴールド） */
  accent?: number;
  onTap?: () => void;
}

/** 角丸ボタン。最小タップ領域 MIN_TAP を保証し、押下中は縮む。 */
export class Button extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly labelText: Phaser.GameObjects.Text;
  private readonly subText?: Phaser.GameObjects.Text;
  private opts: Required<Omit<ButtonOptions, "sub" | "onTap">> & Pick<ButtonOptions, "sub" | "onTap">;

  constructor(scene: Phaser.Scene, x: number, y: number, options: ButtonOptions) {
    super(scene, x, y);
    this.opts = {
      height: MIN_TAP,
      kind: "secondary",
      accent: COLORS.gold,
      ...options,
    };
    const h = Math.max(MIN_TAP, this.opts.height);
    this.bg = scene.add.graphics();
    this.labelText = scene.add.text(0, this.opts.sub ? -12 : 0, this.opts.label, textStyle(30)).setOrigin(0.5);
    this.add([this.bg, this.labelText]);
    if (this.opts.sub) {
      this.subText = scene.add.text(0, 22, this.opts.sub, textStyle(18, { weight: 500 })).setOrigin(0.5);
      this.add(this.subText);
    }
    this.setSize(this.opts.width, h);
    this.setInteractive({ useHandCursor: true });
    bindPress(this, {
      onPressChange: (pressed) => this.setScale(pressed ? 0.96 : 1),
      onTap: () => {
        playSe(scene, "se.ui.tap");
        this.opts.onTap?.();
      },
    });
    this.redraw();
    scene.add.existing(this);
  }

  setLabel(label: string): this {
    this.labelText.setText(label);
    return this;
  }

  setKind(kind: ButtonKind): this {
    this.opts.kind = kind;
    this.redraw();
    return this;
  }

  private redraw(): void {
    const { width, kind, accent } = this.opts;
    const h = this.height;
    const fill = kind === "primary" ? accent : kind === "locked" ? COLORS.panel : COLORS.panelRaised;
    const ink = kind === "primary" ? COLORS.bg : kind === "locked" ? COLORS.inkMuted : COLORS.ink;
    this.bg.clear();
    this.bg.fillStyle(fill, kind === "locked" ? 0.85 : 1);
    this.bg.fillRoundedRect(-width / 2, -h / 2, width, h, 18);
    this.bg.lineStyle(2, kind === "primary" ? 0xffffff : COLORS.line, kind === "primary" ? 0.35 : 1);
    this.bg.strokeRoundedRect(-width / 2, -h / 2, width, h, 18);
    this.labelText.setColor(`#${ink.toString(16).padStart(6, "0")}`);
    this.subText?.setColor(`#${(kind === "primary" ? COLORS.panel : COLORS.inkDim).toString(16).padStart(6, "0")}`);
  }
}

let activeToast: Phaser.GameObjects.Container | null = null;

/** 画面下部に一時メッセージを出す（同時に 1 つ） */
export function showToast(scene: Phaser.Scene, message: string): void {
  activeToast?.destroy();
  const text = scene.add.text(0, 0, message, textStyle(24, { align: "center" })).setOrigin(0.5);
  const w = Math.min(GAME_WIDTH - 64, text.width + 56);
  const h = text.height + 32;
  const bg = scene.add.graphics();
  bg.fillStyle(COLORS.panelRaised, 0.96).fillRoundedRect(-w / 2, -h / 2, w, h, 16);
  bg.lineStyle(2, COLORS.gold, 0.8).strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
  const toast = scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT - 300, [bg, text]).setDepth(1000).setAlpha(0);
  activeToast = toast;
  scene.tweens.add({ targets: toast, alpha: 1, y: toast.y - 12, duration: 160 });
  scene.time.delayedCall(1800, () => {
    scene.tweens.add({ targets: toast, alpha: 0, duration: 220, onComplete: () => toast.destroy() });
  });
  toast.once(Phaser.GameObjects.Events.DESTROY, () => {
    if (activeToast === toast) activeToast = null;
  });
}

/** 長押しで出す詳細ツールチップ。指を離すと消える */
export function showTooltip(scene: Phaser.Scene, x: number, y: number, title: string, body: string): void {
  const w = 420;
  const titleText = scene.add.text(-w / 2 + 20, 0, title, textStyle(26)).setOrigin(0, 0);
  const bodyText = scene.add
    .text(-w / 2 + 20, 0, body, { ...textStyle(20, { weight: 500, color: COLORS.inkDim }), wordWrap: { width: w - 40, useAdvancedWrap: true } })
    .setOrigin(0, 0);
  const h = 20 + titleText.height + 8 + bodyText.height + 20;
  titleText.setY(-h / 2 + 20);
  bodyText.setY(titleText.y + titleText.height + 8);
  const bg = scene.add.graphics();
  bg.fillStyle(COLORS.bg, 0.95).fillRoundedRect(-w / 2, -h / 2, w, h, 14);
  bg.lineStyle(2, COLORS.line, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
  const cx = Phaser.Math.Clamp(x, w / 2 + 16, GAME_WIDTH - w / 2 - 16);
  const cy = Phaser.Math.Clamp(y - h / 2 - 90, h / 2 + 16, GAME_HEIGHT - h / 2 - 16);
  const tip = scene.add.container(cx, cy, [bg, titleText, bodyText]).setDepth(1100);
  scene.input.once(Phaser.Input.Events.POINTER_UP, () => tip.destroy());
}

/**
 * ランドノード背景（縦長 1000×1500）を画面全体にカバー表示し、暗幕を重ねる。
 * 背景は preload しないため、読み込み完了後にフェードインで差し替える。
 */
export class LandBackground {
  private image?: Phaser.GameObjects.Image;
  private requested?: CryptidId;

  constructor(private readonly scene: Phaser.Scene, shadeAlpha = 0.55) {
    scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 1).setOrigin(0).setDepth(-10).setAlpha(shadeAlpha);
  }

  async show(id: CryptidId): Promise<void> {
    this.requested = id;
    const key = getCryptid(id).backgroundKey;
    await ensureImage(this.scene, key);
    if (this.requested !== id || !this.scene.sys.isActive() || !this.scene.textures.exists(key)) return;
    const prev = this.image;
    const img = this.scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, key).setDepth(-20).setAlpha(0);
    img.setScale(Math.max(GAME_WIDTH / img.width, GAME_HEIGHT / img.height));
    this.image = img;
    this.scene.tweens.add({ targets: img, alpha: 1, duration: 300, onComplete: () => prev?.destroy() });
    setPageBackground(assetUrl(getAsset(key)));
  }
}

/**
 * 縦長でない端末（縦長スマホの上下 / PC の左右）に出るレターボックスを、
 * 同じ背景を暗くしたページ背景で埋める。
 */
function setPageBackground(url: string): void {
  const body = globalThis.document?.body;
  if (!body) return;
  body.style.backgroundImage = `linear-gradient(rgba(11,13,18,0.82), rgba(11,13,18,0.82)), url("${url}")`;
  body.style.backgroundSize = "cover";
  body.style.backgroundPosition = "center";
}

/** 浮遊する幻獣 + ランドカラーのオーラ */
export class CryptidDisplay extends Phaser.GameObjects.Container {
  private readonly aura: Phaser.GameObjects.Graphics;
  private readonly sprite: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number, id: CryptidId, private readonly spriteScale: number) {
    super(scene, x, y);
    this.aura = scene.add.graphics();
    this.sprite = scene.add.image(0, 0, getCryptid(id).imageKey).setScale(spriteScale);
    this.add([this.aura, this.sprite]);
    this.setCryptid(id);
    scene.tweens.add({ targets: this.sprite, y: -14, duration: 1600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    scene.tweens.add({ targets: this.aura, scale: 1.08, alpha: 0.7, duration: 1600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    scene.add.existing(this);
  }

  setCryptid(id: CryptidId): void {
    const c = getCryptid(id);
    this.sprite.setTexture(c.imageKey);
    const r = 64 * this.spriteScale * 0.78;
    this.aura.clear();
    for (let i = 0; i < 6; i++) {
      this.aura.fillStyle(c.color, 0.06 + i * 0.015);
      this.aura.fillCircle(0, 10, r * (1.25 - i * 0.08));
    }
  }
}
