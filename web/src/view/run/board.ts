import Phaser from "phaser";
import { getCryptid, type CryptidId } from "../../data/cryptids";
import type { RoleId } from "../../data/balance/heroes";
import { pathCells } from "../../sim/level";
import type { RunSim, SimEvent, StatusState } from "../../sim/run";
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

/** SPEC-109: 敵の頭上に出す状態異常アイコン（表示順） */
const STATUS_ICONS: [(s: StatusState) => boolean, string][] = [
  [(s) => s.burnTime > 0, "icon.battle.bleed"],
  [(s) => s.poisonTime > 0, "icon.battle.poison"],
  [(s) => s.slowTime > 0, "icon.battle.dbf_agi"],
  [(s) => s.stunTime > 0, "icon.battle.sleep"],
  [(s) => s.stunTime <= 0 && s.shock > 0, "icon.battle.confused"],
  [(s) => s.vulnTime > 0, "icon.battle.dbf_phy"],
  [(s) => s.accel > 0, "icon.battle.buf_agi"],
];
const STATUS_ICON_PX = 20;

/** 攻撃演出の色 */
const FX = { lightning: 0x8fe3ff, pulse: 0xc58bff, fire: 0xff8a3d, cannon: 0xfff1a8 } as const;

interface EnemyView {
  sprite: Phaser.GameObjects.Image;
  bar: Phaser.GameObjects.Graphics;
  aura?: Phaser.GameObjects.Arc;
  icons: Phaser.GameObjects.Image[];
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
  private previewRole: RoleId = "archer";
  private readonly lockLabels = new Map<number, Phaser.GameObjects.GameObject[]>();
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
    lv.slots.forEach((s, i) => {
      const { x, y } = toPx(s.col + 0.5, s.row + 0.5);
      this.slotPlus.push(scene.add.text(x, y, "+", textStyle(34, { color: COLORS.inkDim })).setOrigin(0.5).setAlpha(0.7).setDepth(-14));
      // SPEC-113: ロックマスは開放費用を表示
      const cost = sim.slotOpenCost(i);
      if (cost !== null) {
        this.lockLabels.set(i, [
          scene.add.text(x, y - 14, "LOCK", textStyle(15, { display: true, color: COLORS.inkDim })).setOrigin(0.5).setDepth(-14),
          scene.add.image(x - 16, y + 14, "icon.gum").setScale(0.26).setDepth(-14),
          scene.add.text(x + 8, y + 14, String(cost), textStyle(18, { color: COLORS.gold })).setOrigin(0.5).setDepth(-14),
        ]);
      }
    });
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

  /** 配置前の射程プレビューに使うロール */
  setPreviewRole(role: RoleId): void {
    this.previewRole = role;
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
        for (const i of v.icons) i.destroy();
        this.enemies.delete(id);
      }
    }
    for (const e of sim.enemies) {
      let v = this.enemies.get(e.id);
      if (!v) {
        const scale = 0.9 * (e.def.scale ?? 1);
        const sprite = this.scene.add.image(0, 0, e.def.imageKey).setScale(scale).setOrigin(0.5, 0.7).setDepth(10);
        const aura = e.def.boss ? this.scene.add.circle(0, 0, 40 * scale, COLORS.danger, 0.25).setDepth(9) : undefined;
        const icons = STATUS_ICONS.map(([, key]) => {
          const img = this.scene.add.image(0, 0, key).setDepth(21).setVisible(false);
          return img.setScale(STATUS_ICON_PX / img.width);
        });
        v = { sprite, bar: this.scene.add.graphics().setDepth(20), aura, icons };
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
      const top = y - lift - v.sprite.displayHeight * 0.7 - 6;
      if (e.hp < e.maxHp) {
        const w = e.def.boss ? 90 : 48;
        v.bar.fillStyle(0x000000, 0.7).fillRect(x - w / 2 - 1, top - 1, w + 2, 8);
        v.bar.fillStyle(e.def.boss ? COLORS.danger : 0x6be675, 1).fillRect(x - w / 2, top, (w * Math.max(0, e.hp)) / e.maxHp, 6);
      }
      // 状態異常アイコン（HP バーの上に横並び）
      const shown = STATUS_ICONS.map(([on]) => on(e.status));
      const n = shown.filter(Boolean).length;
      let k = 0;
      v.icons.forEach((img, i) => {
        img.setVisible(shown[i]);
        if (!shown[i]) return;
        img.setPosition(x + (k - (n - 1) / 2) * (STATUS_ICON_PX + 2), top - STATUS_ICON_PX / 2 - 4);
        k++;
      });
      // 足止め中は色を落とす（被弾の白フラッシュ中は触らない）
      if (!v.sprite.tintFill) {
        if (e.status.stunTime > 0) v.sprite.setTint(0x8888aa);
        else if (e.status.slowTime > 0) v.sprite.setTint(0xb8c8ff);
        else v.sprite.clearTint();
      }
    }

    // ヒーロー
    for (const h of sim.heroes) {
      let v = this.heroes.get(h.id);
      const { x, y } = toPx(h.x, h.y);
      if (!v) {
        const sprite = this.scene.add.image(x, y, sim.heroVisual(h.role).imageKey).setScale(1.15).setOrigin(0.5, 0.62).setDepth(12);
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
      case "slotOpened":
        this.redrawSlots();
        this.redrawRange();
        break;
      case "chain":
        this.chainFx(e.points);
        break;
      case "pulse": {
        const c = toPx(e.x, e.y);
        const ring = this.scene.add.circle(c.x, c.y, e.r * CELL, FX.pulse, 0.12).setStrokeStyle(4, FX.pulse, 0.9).setDepth(6);
        ring.setScale(0.2);
        this.scene.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 380, ease: "Cubic.easeOut", onComplete: () => ring.destroy() });
        break;
      }
      case "flame": {
        const h = this.heroes.get(e.heroId);
        const t = toPx(e.tx, e.ty);
        if (h) {
          const g = this.scene.add.graphics().setDepth(29);
          g.lineStyle(10, FX.fire, 0.55).lineBetween(h.baseX, h.sprite.y - 6, t.x, t.y - 10);
          g.lineStyle(4, 0xffe08a, 0.9).lineBetween(h.baseX, h.sprite.y - 6, t.x, t.y - 10);
          this.scene.tweens.add({ targets: g, alpha: 0, duration: 140, onComplete: () => g.destroy() });
        }
        break;
      }
      case "discharge":
        this.popText(e.x, e.y, "放電!", FX.lightning);
        break;
      case "combust":
        this.areaFx(e.x, e.y, 0.9);
        this.popText(e.x, e.y, "誘爆!", FX.fire);
        break;
      case "blast":
        this.areaFx(e.x, e.y, e.r * 1.2);
        break;
      case "toll":
        this.popText(e.x, e.y, `+${e.value}`, COLORS.gold, 18);
        break;
      case "payout": {
        const h = this.sim.heroes.find((x) => x.id === e.heroId);
        if (h) this.popText(h.x, h.y - 0.4, `配当 +${e.value}`, COLORS.gold, 22);
        break;
      }
      case "cannon": {
        // 盤面の外（HUD・パネル）には描かない
        const lv = this.sim.level;
        const dx = e.x1 - e.x0;
        const dy = e.y1 - e.y0;
        let t = 1;
        if (dy < 0) t = Math.min(t, (0 - e.y0) / dy);
        if (dy > 0) t = Math.min(t, (lv.rows - e.y0) / dy);
        if (dx < 0) t = Math.min(t, (0 - e.x0) / dx);
        if (dx > 0) t = Math.min(t, (lv.cols - e.x0) / dx);
        const a = toPx(e.x0, e.y0);
        const b = toPx(e.x0 + dx * t, e.y0 + dy * t);
        const g = this.scene.add.graphics().setDepth(31);
        const w = 2 * CELL * (this.sim.mods.cannonWidthAdd + 0.45);
        g.lineStyle(w, this.accent, 0.35).lineBetween(a.x, a.y, b.x, b.y);
        g.lineStyle(w * 0.35, FX.cannon, 0.95).lineBetween(a.x, a.y, b.x, b.y);
        this.scene.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() });
        break;
      }
      case "leak": {
        this.cryptid.flash();
        this.scene.cameras.main.shake(180, 0.006);
        break;
      }
    }
  }

  /** 雷の連鎖: ギザギザの線でヒーロー → 敵 → 敵 … を結ぶ */
  private chainFx(points: { x: number; y: number }[]): void {
    const g = this.scene.add.graphics().setDepth(29);
    for (const [width, color, alpha] of [[8, FX.lightning, 0.35], [3, 0xffffff, 1]] as const) {
      g.lineStyle(width, color, alpha);
      for (let i = 1; i < points.length; i++) {
        const a = toPx(points[i - 1].x, points[i - 1].y - 0.1);
        const b = toPx(points[i].x, points[i].y - 0.1);
        g.beginPath();
        g.moveTo(a.x, a.y);
        for (let k = 1; k < 4; k++) {
          const t = k / 4;
          g.lineTo(a.x + (b.x - a.x) * t + (Math.random() - 0.5) * 18, a.y + (b.y - a.y) * t + (Math.random() - 0.5) * 18);
        }
        g.lineTo(b.x, b.y);
        g.strokePath();
      }
    }
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 180, onComplete: () => g.destroy() });
  }

  private areaFx(x: number, y: number, scale: number): void {
    const p = toPx(x, y);
    const fx = this.scene.add.sprite(p.x, p.y - 10, "fx.single_damage").setScale(scale * 2).setTint(FX.fire).setDepth(28);
    fx.play("fx.kill");
    fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fx.destroy());
  }

  private popText(x: number, y: number, text: string, color: number, size = 20): void {
    const p = toPx(x, y);
    const t = this.scene.add.text(p.x, p.y - 40, text, textStyle(size, { color })).setOrigin(0.5).setDepth(62);
    this.scene.tweens.add({ targets: t, y: t.y - 26, alpha: 0, duration: 600, onComplete: () => t.destroy() });
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
      const locked = !this.sim.isSlotOpen(i);
      for (const o of this.lockLabels.get(i) ?? []) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(locked);
      if (locked) {
        g.fillStyle(0x000000, 0.45).fillRoundedRect(x + 8, y + 8, CELL - 16, CELL - 16, 12);
        g.lineStyle(selected ? 4 : 2, selected ? COLORS.gold : COLORS.inkMuted, selected ? 1 : 0.8).strokeRoundedRect(x + 8, y + 8, CELL - 16, CELL - 16, 12);
        this.slotPlus[i].setVisible(false);
        return;
      }
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
    if (!this.sim.isSlotOpen(this.selectedSlot)) return;
    if (hero) {
      const now = this.sim.heroStats(hero);
      if (this.sim.levelUpCost(hero) !== null) {
        const next = this.sim.heroStats(hero, hero.level + 1);
        g.lineStyle(2, 0xffffff, 0.35).strokeCircle(c.x, c.y, next.range * CELL);
      }
      g.fillStyle(COLORS.gold, 0.08).fillCircle(c.x, c.y, now.range * CELL);
      g.lineStyle(3, COLORS.gold, 0.8).strokeCircle(c.x, c.y, now.range * CELL);
    } else {
      const range = this.sim.statsFor(this.previewRole).range;
      g.fillStyle(0xffffff, 0.06).fillCircle(c.x, c.y, range * CELL);
      g.lineStyle(2, 0xffffff, 0.5).strokeCircle(c.x, c.y, range * CELL);
    }
  }
}
