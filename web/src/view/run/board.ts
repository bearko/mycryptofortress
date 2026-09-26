import Phaser from "phaser";
import { getCryptid, type CryptidId } from "../../data/cryptids";
import { ROLES } from "../../data/balance/heroes";
import { pathCells } from "../../sim/level";
import type { RunSim, SimEvent } from "../../sim/run";
import { GAME_WIDTH } from "../layout";
import { COLORS, textStyle } from "../ui/theme";
import { CryptidDisplay } from "../ui/widgets";

/** SPEC-105 §1: 盤面の配置（論理 px） */
export const CELL = 80;
export const BOARD_TOP = 112;
export const BOARD_BOTTOM = 1072;

export const toPx = (x: number, y: number) => ({ x: x * CELL, y: BOARD_TOP + y * CELL });
export const toCell = (px: number, py: number) => ({ x: px / CELL, y: (py - BOARD_TOP) / CELL });

/** 画像の向き: MCH のヒーローは右向き、エネミーは左向き */
const HERO_FACES_RIGHT = true;
const ENEMY_FACES_RIGHT = false;

interface EnemyView {
  sprite: Phaser.GameObjects.Image;
  bar: Phaser.GameObjects.Graphics;
  aura?: Phaser.GameObjects.Arc;
}

interface HeroView {
  sprite: Phaser.GameObjects.Image;
  badge: Phaser.GameObjects.Text;
  baseX: number;
}

/**
 * SPEC-105 §3: RunSim の状態を毎フレーム描画に同期する。
 * sim は読むだけで、書き換えない。
 */
export class BoardView {
  readonly cryptid: CryptidDisplay;
  private readonly slotGfx: Phaser.GameObjects.Graphics;
  private readonly slotPlus: Phaser.GameObjects.Text[] = [];
  private readonly rangeGfx: Phaser.GameObjects.Graphics;
  private readonly projectileGfx: Phaser.GameObjects.Graphics;
  private readonly enemies = new Map<number, EnemyView>();
  private readonly heroes = new Map<number, HeroView>();
  private readonly drops = new Map<number, Phaser.GameObjects.Image>();
  private selectedSlot: number | null = null;
  private readonly accent: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly sim: RunSim,
    cryptidId: CryptidId,
  ) {
    this.accent = getCryptid(cryptidId).color;
    const lv = sim.level;

    // 背景（画面全体をカバー + 暗幕）
    const bg = scene.add.image(GAME_WIDTH / 2, 640, lv.background).setDepth(-30);
    bg.setScale(Math.max(GAME_WIDTH / bg.width, 1280 / bg.height));
    scene.add.rectangle(0, 0, GAME_WIDTH, 1280, COLORS.bg, 1).setOrigin(0).setAlpha(0.62).setDepth(-29);

    // グリッドと経路
    const ground = scene.add.graphics().setDepth(-20);
    ground.lineStyle(1, 0xffffff, 0.05);
    for (let c = 0; c <= lv.cols; c++) ground.lineBetween(c * CELL, BOARD_TOP, c * CELL, BOARD_BOTTOM);
    for (let r = 0; r <= lv.rows; r++) ground.lineBetween(0, BOARD_TOP + r * CELL, GAME_WIDTH, BOARD_TOP + r * CELL);
    for (const p of lv.paths) {
      for (const c of pathCells(lv, p)) {
        const { x, y } = toPx(c.col, c.row);
        ground.fillStyle(COLORS.bg, 0.6).fillRoundedRect(x + 3, y + 3, CELL - 6, CELL - 6, 10);
      }
    }
    ground.lineStyle(6, this.accent, 0.28);
    for (const p of sim.paths) {
      ground.beginPath();
      p.points.forEach((pt, i) => {
        const { x, y } = toPx(pt.x, pt.y);
        if (i === 0) ground.moveTo(x, y);
        else ground.lineTo(x, y);
      });
      ground.strokePath();
      // 入口マーカー
      const entry = p.sample(0.9);
      const { x, y } = toPx(entry.pos.x, entry.pos.y);
      scene.add.text(x, y, "▶", textStyle(26, { color: COLORS.danger })).setOrigin(0.5).setAngle(Math.atan2(entry.dir.y, entry.dir.x) * (180 / Math.PI)).setDepth(-19);
    }

    // ビルドマス
    this.slotGfx = scene.add.graphics().setDepth(-15);
    for (const s of lv.slots) {
      const { x, y } = toPx(s.col + 0.5, s.row + 0.5);
      this.slotPlus.push(scene.add.text(x, y, "+", textStyle(34, { color: COLORS.inkDim })).setOrigin(0.5).setAlpha(0.7).setDepth(-14));
    }
    this.rangeGfx = scene.add.graphics().setDepth(5);

    // 幻獣（拠点）
    const c = toPx(lv.cryptid.col + 0.5, lv.cryptid.row + 0.5);
    this.cryptid = new CryptidDisplay(scene, c.x, c.y - 6, cryptidId, 0.9);
    this.cryptid.setDepth(8);

    this.projectileGfx = scene.add.graphics().setDepth(30);
    this.redrawSlots();
  }

  setSelectedSlot(index: number | null): void {
    this.selectedSlot = index;
    this.redrawSlots();
    this.redrawRange();
  }

  /** 毎フレーム: sim の状態を表示に反映 */
  sync(time: number): void {
    const sim = this.sim;

    // 敵
    const aliveIds = new Set(sim.enemies.map((e) => e.id));
    for (const [id, v] of this.enemies) {
      if (!aliveIds.has(id)) {
        v.sprite.destroy();
        v.bar.destroy();
        v.aura?.destroy();
        this.enemies.delete(id);
      }
    }
    for (const e of sim.enemies) {
      let v = this.enemies.get(e.id);
      if (!v) {
        const scale = 0.9 * (e.def.scale ?? 1);
        const sprite = this.scene.add.image(0, 0, e.def.imageKey).setScale(scale).setOrigin(0.5, 0.7).setDepth(10);
        const aura = e.def.boss ? this.scene.add.circle(0, 0, 40 * scale, COLORS.danger, 0.25).setDepth(9) : undefined;
        v = { sprite, bar: this.scene.add.graphics().setDepth(20), aura };
        this.enemies.set(e.id, v);
      }
      const { x, y } = toPx(e.x, e.y);
      // 跳躍中は放物線を描いて浮く
      const leap = e.def.leap;
      const lift = leap && e.leapRemaining > 0 ? Math.sin(Math.PI * (1 - e.leapRemaining / leap.duration)) * 34 : 0;
      v.sprite.setPosition(x, y - lift).setDepth(10 + e.y / 100);
      if (e.dirX !== 0) v.sprite.setFlipX(e.dirX > 0 === !ENEMY_FACES_RIGHT);
      v.aura?.setPosition(x, y - 10).setScale(1 + 0.08 * Math.sin(time / 150));
      v.bar.clear();
      if (e.hp < e.maxHp) {
        const w = e.def.boss ? 90 : 48;
        const top = y - v.sprite.displayHeight * 0.7 - 6;
        v.bar.fillStyle(0x000000, 0.7).fillRect(x - w / 2 - 1, top - 1, w + 2, 8);
        v.bar.fillStyle(e.def.boss ? COLORS.danger : 0x6be675, 1).fillRect(x - w / 2, top, (w * Math.max(0, e.hp)) / e.maxHp, 6);
      }
    }

    // ヒーロー
    for (const h of sim.heroes) {
      let v = this.heroes.get(h.id);
      const { x, y } = toPx(h.x, h.y);
      if (!v) {
        const sprite = this.scene.add.image(x, y, ROLES[h.role].imageKey).setScale(1.15).setOrigin(0.5, 0.62).setDepth(12);
        const badge = this.scene.add
          .text(x + 30, y + 30, "", { ...textStyle(18, { color: COLORS.bg }), backgroundColor: "#f5c542", padding: { x: 5, y: 1 } })
          .setOrigin(1, 1)
          .setDepth(13);
        v = { sprite, badge, baseX: x };
        this.heroes.set(h.id, v);
        this.scene.tweens.add({ targets: sprite, scale: { from: 0.4, to: 1.15 }, duration: 220, ease: "Back.easeOut" });
      }
      v.sprite.setFlipX(h.facing === 1 !== HERO_FACES_RIGHT);
      v.badge.setText(`Lv${h.level}`);
    }

    // 弾
    this.projectileGfx.clear();
    for (const p of sim.projectiles) {
      const a = toPx(p.x, p.y);
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const len = Math.hypot(dx, dy) || 1;
      const tail = toPx(p.x - (dx / len) * 0.35, p.y - (dy / len) * 0.35);
      this.projectileGfx.lineStyle(4, COLORS.gold, 1).lineBetween(tail.x, tail.y, a.x, a.y);
      this.projectileGfx.fillStyle(0xffffff, 1).fillCircle(a.x, a.y, 3);
    }

    // GUM ドロップ
    const dropIds = new Set(sim.drops.map((d) => d.id));
    for (const [id, img] of this.drops) {
      if (!dropIds.has(id)) {
        img.destroy();
        this.drops.delete(id);
      }
    }
    for (const d of sim.drops) {
      let img = this.drops.get(d.id);
      const { x, y } = toPx(d.x, d.y);
      if (!img) {
        img = this.scene.add.image(x, y, "icon.gum").setScale(0.42).setDepth(25);
        this.drops.set(d.id, img);
      }
      img.setPosition(x, y - 6 + 4 * Math.sin((time + d.id * 97) / 180));
      img.setAlpha(d.ttl < 2 ? (Math.floor(time / 120) % 2 === 0 ? 1 : 0.3) : 1);
    }
  }

  /** イベントに応じた演出 */
  onEvent(e: SimEvent): void {
    switch (e.type) {
      case "attack": {
        const v = this.heroes.get(e.heroId);
        if (!v) return;
        const dir = Math.sign(toPx(e.tx, 0).x - v.baseX) || 1;
        this.scene.tweens.add({ targets: v.sprite, x: v.baseX + dir * 7, duration: 60, yoyo: true, onComplete: () => v.sprite.setX(v.baseX) });
        break;
      }
      case "hit": {
        const v = this.enemies.get(e.enemyId);
        if (!v) return;
        if (e.crit) {
          const t = this.scene.add.text(v.sprite.x, v.sprite.y - 50, "会心!", textStyle(20, { color: COLORS.gold })).setOrigin(0.5).setDepth(62);
          this.scene.tweens.add({ targets: t, y: t.y - 26, alpha: 0, duration: 500, onComplete: () => t.destroy() });
        }
        v.sprite.setTintFill(0xffffff);
        this.scene.time.delayedCall(60, () => v.sprite.active && v.sprite.clearTint());
        break;
      }
      case "kill": {
        const { x, y } = toPx(e.x, e.y);
        const fx = this.scene.add.sprite(x, y - 10, "fx.single_damage").setScale(e.boss ? 1.8 : 0.9).setDepth(28);
        fx.play("fx.kill");
        fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fx.destroy());
        break;
      }
      case "heroPlaced":
      case "heroLevelUp":
        this.redrawSlots();
        this.redrawRange();
        break;
      case "leak": {
        this.cryptid.flash();
        this.scene.cameras.main.shake(180, 0.006);
        break;
      }
    }
  }

  /** 回収した GUM をスクリーン座標 (tx, ty) へ飛ばす */
  flyGum(x: number, y: number, value: number, tx: number, ty: number): void {
    const p = toPx(x, y);
    const img = this.scene.add.image(p.x, p.y, "icon.gum").setScale(0.42).setDepth(60);
    this.scene.tweens.add({ targets: img, x: tx, y: ty, scale: 0.25, duration: 380, ease: "Cubic.easeIn", onComplete: () => img.destroy() });
    const t = this.scene.add.text(p.x, p.y - 20, `+${value}`, textStyle(24, { color: COLORS.gold })).setOrigin(0.5).setDepth(61);
    this.scene.tweens.add({ targets: t, y: t.y - 36, alpha: 0, duration: 600, onComplete: () => t.destroy() });
  }

  private redrawSlots(): void {
    const g = this.slotGfx.clear();
    this.sim.level.slots.forEach((s, i) => {
      const { x, y } = toPx(s.col, s.row);
      const occupied = !!this.sim.heroAt(i);
      const selected = this.selectedSlot === i;
      g.fillStyle(occupied ? this.accent : 0xffffff, occupied ? 0.14 : 0.06).fillRoundedRect(x + 8, y + 8, CELL - 16, CELL - 16, 12);
      g.lineStyle(selected ? 4 : 2, selected ? COLORS.gold : occupied ? this.accent : COLORS.inkDim, selected ? 1 : 0.55);
      g.strokeRoundedRect(x + 8, y + 8, CELL - 16, CELL - 16, 12);
      this.slotPlus[i].setVisible(!occupied);
    });
  }

  private redrawRange(): void {
    const g = this.rangeGfx.clear();
    if (this.selectedSlot === null) return;
    const hero = this.sim.heroAt(this.selectedSlot);
    const s = this.sim.level.slots[this.selectedSlot];
    const c = toPx(s.col + 0.5, s.row + 0.5);
    if (hero) {
      const now = this.sim.heroStats(hero);
      if (this.sim.levelUpCost(hero) !== null) {
        const next = this.sim.heroStats(hero, hero.level + 1);
        g.lineStyle(2, 0xffffff, 0.35).strokeCircle(c.x, c.y, next.range * CELL);
      }
      g.fillStyle(COLORS.gold, 0.08).fillCircle(c.x, c.y, now.range * CELL);
      g.lineStyle(3, COLORS.gold, 0.8).strokeCircle(c.x, c.y, now.range * CELL);
    } else {
      const range = this.sim.statsFor("archer").range;
      g.fillStyle(0xffffff, 0.06).fillCircle(c.x, c.y, range * CELL);
      g.lineStyle(2, 0xffffff, 0.5).strokeCircle(c.x, c.y, range * CELL);
    }
  }
}
