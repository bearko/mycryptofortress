import Phaser from "phaser";
import { HEROES, findHero } from "../game/heroData";
import { findEnemy } from "../game/enemyData";
import {
  COLS,
  ROWS,
  STAGE1_ROUTE,
  STAGE1_WAVE,
  TILE_SIZE,
  buildTileMap,
  pixelToTile,
  tileToPixel,
} from "../game/stage";
import type { EnemyDef, HeroDef, SpawnPattern, TilePos } from "../game/types";
import { calculateDamage } from "../game/damage";
import { TEXTURE_KEYS } from "./BootScene";

const HUD_HEIGHT = 96;
const STAGE_WIDTH = COLS * TILE_SIZE;
const STAGE_HEIGHT = ROWS * TILE_SIZE;

interface PlacedHero {
  def: HeroDef;
  tile: TilePos;
  sprite: Phaser.GameObjects.Sprite;
  rangeIndicator: Phaser.GameObjects.Arc;
  lastAttackAt: number;
}

interface ActiveEnemy {
  def: EnemyDef;
  sprite: Phaser.GameObjects.Sprite;
  hpBar: Phaser.GameObjects.Rectangle;
  hpBarBg: Phaser.GameObjects.Rectangle;
  hp: number;
  /** 現在向かっている route index（次のウェイポイント） */
  nextIndex: number;
  goalReached: boolean;
}

interface ActiveBullet {
  sprite: Phaser.GameObjects.Arc;
  target: ActiveEnemy;
  damage: number;
  speed: number;
  done: boolean;
}

export class StageScene extends Phaser.Scene {
  private baseHp = 5;
  private maxBaseHp = 5;
  /** 初期 CE。SPEC-001 §5.3: 開始即座に最低コストのヒーローを配置できる量にする */
  private ce = 20;
  private maxCe = 100;
  private ceProgress = 0;

  private elapsed = 0;
  private waveQueue: SpawnPattern[] = [];
  private spawnedTotal = 0;
  private defeatedTotal = 0;
  private totalToDefeat = 0;

  private selectedHero: HeroDef | null = null;
  private placedHeroes: PlacedHero[] = [];
  private enemies: ActiveEnemy[] = [];
  private bullets: ActiveBullet[] = [];

  private hpText!: Phaser.GameObjects.Text;
  private ceText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private ceBar!: Phaser.GameObjects.Rectangle;
  private heroPaletteEntries: {
    hero: HeroDef;
    container: Phaser.GameObjects.Container;
    border: Phaser.GameObjects.Rectangle;
  }[] = [];

  private endOverlay: Phaser.GameObjects.Container | null = null;
  private gameOver = false;

  // 配置プレビュー（カーソル追従の薄いスプライト）
  private ghostSprite: Phaser.GameObjects.Sprite | null = null;
  private ghostRange: Phaser.GameObjects.Arc | null = null;

  constructor() {
    super("StageScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x141822);
    this.elapsed = 0;
    this.waveQueue = [...STAGE1_WAVE.patterns];
    this.totalToDefeat = STAGE1_WAVE.patterns.length;

    this.drawTilesAndRoute();
    this.drawHud();
    this.bindInput();
  }

  // ========== セットアップ ==========

  private drawTilesAndRoute(): void {
    const tileMap = buildTileMap(STAGE1_ROUTE);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const kind = tileMap[r][c];
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;
        const fill = kind === "path" ? 0x3b2a1a : 0x1f2937;
        const rect = this.add.rectangle(
          x + TILE_SIZE / 2,
          y + TILE_SIZE / 2,
          TILE_SIZE - 2,
          TILE_SIZE - 2,
          fill,
          1,
        );
        rect.setStrokeStyle(1, kind === "path" ? 0x6b4a2a : 0x374151);
      }
    }

    // Route ライン（視覚的にわかりやすくする）
    const g = this.add.graphics();
    g.lineStyle(6, 0xc59b6c, 0.8);
    g.beginPath();
    const start = tileToPixel(STAGE1_ROUTE[0]);
    g.moveTo(start.x, start.y);
    for (let i = 1; i < STAGE1_ROUTE.length; i++) {
      const p = tileToPixel(STAGE1_ROUTE[i]);
      g.lineTo(p.x, p.y);
    }
    g.strokePath();

    // ゴール印
    const goal = tileToPixel(STAGE1_ROUTE[STAGE1_ROUTE.length - 1]);
    this.add
      .text(goal.x, goal.y, "GOAL", {
        fontSize: "14px",
        color: "#fef3c7",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // 開始印
    const start0 = tileToPixel(STAGE1_ROUTE[0]);
    this.add
      .text(start0.x, start0.y, "START", {
        fontSize: "12px",
        color: "#a7f3d0",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
  }

  private drawHud(): void {
    const hudY = STAGE_HEIGHT;
    this.add.rectangle(
      STAGE_WIDTH / 2,
      hudY + HUD_HEIGHT / 2,
      STAGE_WIDTH,
      HUD_HEIGHT,
      0x0b0d12,
      1,
    );
    this.add.line(
      0,
      0,
      0,
      hudY,
      STAGE_WIDTH,
      hudY,
      0x374151,
      1,
    ).setOrigin(0, 0);

    // HP / CE テキスト
    this.hpText = this.add.text(12, hudY + 8, "", {
      fontSize: "16px",
      color: "#fee2e2",
      fontStyle: "bold",
    });
    this.ceText = this.add.text(12, hudY + 32, "", {
      fontSize: "14px",
      color: "#bae6fd",
    });
    this.statusText = this.add.text(12, hudY + 56, "ヒーローを選んでマスをクリック", {
      fontSize: "12px",
      color: "#9ca3af",
    });

    // CE bar 背景
    this.add.rectangle(160, hudY + 38, 200, 8, 0x1f2937).setOrigin(0, 0.5);
    this.ceBar = this.add
      .rectangle(160, hudY + 38, 0, 8, 0x38bdf8)
      .setOrigin(0, 0.5);

    // ヒーローパレット
    const paletteX = 380;
    HEROES.forEach((hero, i) => {
      const cx = paletteX + i * 80;
      const cy = hudY + HUD_HEIGHT / 2;

      const border = this.add.rectangle(cx, cy, 70, 70, 0x111827, 1);
      border.setStrokeStyle(2, 0x4b5563);
      border.setInteractive({ useHandCursor: true });

      const sprite = this.add
        .sprite(cx, cy - 8, TEXTURE_KEYS.hero(hero.id))
        .setDisplaySize(48, 48);
      const costText = this.add
        .text(cx, cy + 22, `CE ${hero.cost}`, {
          fontSize: "11px",
          color: "#fcd34d",
        })
        .setOrigin(0.5);

      const container = this.add.container(0, 0, [sprite, costText]);

      border.on("pointerdown", () => this.onSelectHero(hero));
      this.heroPaletteEntries.push({ hero, container, border });
    });
  }

  private bindInput(): void {
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (this.ghostSprite && this.ghostRange) {
        this.ghostSprite.x = p.worldX;
        this.ghostSprite.y = p.worldY;
        this.ghostRange.x = p.worldX;
        this.ghostRange.y = p.worldY;
      }
    });

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.gameOver) return;
      if (p.y >= STAGE_HEIGHT) return; // HUD クリックは個別ハンドラに任せる

      if (this.selectedHero) {
        this.tryPlaceHero(p.worldX, p.worldY);
      }
    });
  }

  // ========== 操作 ==========

  private onSelectHero(hero: HeroDef): void {
    if (this.gameOver) return;
    if (this.ce < hero.cost) {
      this.statusText.setText(`CE が足りません（必要 ${hero.cost} / 現在 ${Math.floor(this.ce)}）`);
      return;
    }
    this.selectedHero = hero;
    this.statusText.setText(`${hero.name} を配置するマスをクリック（右クリックでキャンセル）`);

    // パレットの選択枠を更新
    for (const entry of this.heroPaletteEntries) {
      entry.border.setStrokeStyle(
        2,
        entry.hero.id === hero.id ? 0xfde047 : 0x4b5563,
      );
    }

    // ゴーストスプライトを生成
    this.clearGhost();
    this.ghostSprite = this.add
      .sprite(-100, -100, TEXTURE_KEYS.hero(hero.id))
      .setDisplaySize(TILE_SIZE - 8, TILE_SIZE - 8)
      .setAlpha(0.6);
    this.ghostRange = this.add.circle(
      -100,
      -100,
      hero.range * TILE_SIZE,
      0xfde047,
      0.12,
    );
    this.ghostRange.setStrokeStyle(2, 0xfde047, 0.5);
    this.ghostSprite.setDepth(50);
    this.ghostRange.setDepth(49);

    // 右クリックでキャンセル
    this.input.once("pointerdown", (pp: Phaser.Input.Pointer) => {
      if (pp.rightButtonDown()) this.cancelSelection();
    });
  }

  private cancelSelection(): void {
    this.selectedHero = null;
    this.statusText.setText("ヒーローを選んでマスをクリック");
    this.clearGhost();
    for (const entry of this.heroPaletteEntries) {
      entry.border.setStrokeStyle(2, 0x4b5563);
    }
  }

  private clearGhost(): void {
    this.ghostSprite?.destroy();
    this.ghostRange?.destroy();
    this.ghostSprite = null;
    this.ghostRange = null;
  }

  private tryPlaceHero(x: number, y: number): void {
    const hero = this.selectedHero;
    if (!hero) return;
    const tile = pixelToTile(x, y);
    if (!tile) return;

    const tileMap = buildTileMap(STAGE1_ROUTE);
    if (tileMap[tile.row][tile.col] !== "placeable") {
      this.statusText.setText("そのマスには置けません（敵の通り道）");
      return;
    }
    if (this.placedHeroes.some((h) => h.tile.col === tile.col && h.tile.row === tile.row)) {
      this.statusText.setText("既にヒーローが居ます");
      return;
    }
    if (this.ce < hero.cost) {
      this.statusText.setText("CE が足りません");
      return;
    }

    this.ce -= hero.cost;

    const px = tileToPixel(tile);
    const sprite = this.add
      .sprite(px.x, px.y, TEXTURE_KEYS.hero(hero.id))
      .setDisplaySize(TILE_SIZE - 8, TILE_SIZE - 8)
      .setDepth(20);
    const range = this.add
      .circle(px.x, px.y, hero.range * TILE_SIZE, 0xfde047, 0.05)
      .setStrokeStyle(1, 0xfde047, 0.4)
      .setDepth(19);

    this.placedHeroes.push({
      def: hero,
      tile,
      sprite,
      rangeIndicator: range,
      lastAttackAt: this.elapsed,
    });

    this.statusText.setText(`${hero.name} を配置しました`);
    this.cancelSelection();
  }

  // ========== ループ ==========

  update(_time: number, delta: number): void {
    if (this.gameOver) return;

    const dt = delta / 1000;
    this.elapsed += dt;

    this.tickCe(dt);
    this.tickWave();
    this.tickEnemies(dt);
    this.tickHeroAttacks();
    this.tickBullets(dt);
    this.refreshHud();
    this.checkEndCondition();
  }

  private tickCe(dt: number): void {
    if (this.ce >= this.maxCe) return;
    // SPEC-001 §5.3 MVP 専用の加速版（2 CE/秒）。
    // Unity 版の 0.12 CE/秒だと MVP プレイテストに向かないため、約 17× に調整。
    this.ceProgress += dt * 2.0;
    while (this.ceProgress >= 1) {
      this.ce = Math.min(this.maxCe, this.ce + 1);
      this.ceProgress -= 1;
    }
  }

  private tickWave(): void {
    while (this.waveQueue.length && this.waveQueue[0].time <= this.elapsed) {
      const pattern = this.waveQueue.shift()!;
      this.spawnEnemy(pattern.enemyId);
    }
  }

  private spawnEnemy(enemyId: number): void {
    const def = findEnemy(enemyId);
    if (!def) return;
    const startTile = STAGE1_ROUTE[0];
    const start = tileToPixel(startTile);

    const sprite = this.add
      .sprite(start.x, start.y, TEXTURE_KEYS.enemy(def.id))
      .setDisplaySize(TILE_SIZE - 16, TILE_SIZE - 16)
      .setDepth(30);
    const hpBg = this.add
      .rectangle(start.x, start.y - 24, 40, 5, 0x111827, 0.9)
      .setDepth(31);
    const hp = this.add
      .rectangle(start.x - 20, start.y - 24, 40, 5, 0xef4444)
      .setOrigin(0, 0.5)
      .setDepth(32);

    this.enemies.push({
      def,
      sprite,
      hp: def.hp,
      hpBar: hp,
      hpBarBg: hpBg,
      nextIndex: 1,
      goalReached: false,
    });
    this.spawnedTotal++;
  }

  private tickEnemies(dt: number): void {
    for (const enemy of this.enemies) {
      if (enemy.goalReached) continue;
      const target = STAGE1_ROUTE[enemy.nextIndex];
      if (!target) {
        this.handleGoal(enemy);
        continue;
      }
      const tp = tileToPixel(target);
      const dx = tp.x - enemy.sprite.x;
      const dy = tp.y - enemy.sprite.y;
      const dist = Math.hypot(dx, dy);
      const step = enemy.def.speed * TILE_SIZE * dt;

      if (dist <= step) {
        enemy.sprite.x = tp.x;
        enemy.sprite.y = tp.y;
        enemy.nextIndex++;
        if (enemy.nextIndex >= STAGE1_ROUTE.length) {
          this.handleGoal(enemy);
        }
      } else {
        enemy.sprite.x += (dx / dist) * step;
        enemy.sprite.y += (dy / dist) * step;
      }

      enemy.hpBarBg.x = enemy.sprite.x;
      enemy.hpBarBg.y = enemy.sprite.y - 24;
      enemy.hpBar.x = enemy.sprite.x - 20;
      enemy.hpBar.y = enemy.sprite.y - 24;
      enemy.hpBar.displayWidth = Math.max(0, 40 * (enemy.hp / enemy.def.hp));
    }

    // ゴール到達済み・撃破済みの後始末
    this.enemies = this.enemies.filter((e) => {
      if (e.goalReached) {
        e.sprite.destroy();
        e.hpBar.destroy();
        e.hpBarBg.destroy();
        return false;
      }
      if (e.hp <= 0) {
        e.sprite.destroy();
        e.hpBar.destroy();
        e.hpBarBg.destroy();
        this.defeatedTotal++;
        return false;
      }
      return true;
    });
  }

  private handleGoal(enemy: ActiveEnemy): void {
    enemy.goalReached = true;
    this.baseHp = Math.max(0, this.baseHp - 1);
  }

  private tickHeroAttacks(): void {
    for (const hero of this.placedHeroes) {
      const interval = 1 / Math.max(0.1, hero.def.agi / 100);
      if (this.elapsed - hero.lastAttackAt < interval) continue;

      const target = this.findNearestEnemyInRange(hero);
      if (!target) continue;

      hero.lastAttackAt = this.elapsed;
      this.fireBullet(hero, target);
    }
  }

  private findNearestEnemyInRange(hero: PlacedHero): ActiveEnemy | null {
    const rangePx = hero.def.range * TILE_SIZE;
    let nearest: ActiveEnemy | null = null;
    let nearestDist = Infinity;
    for (const e of this.enemies) {
      const dx = e.sprite.x - hero.sprite.x;
      const dy = e.sprite.y - hero.sprite.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= rangePx && dist < nearestDist) {
        nearest = e;
        nearestDist = dist;
      }
    }
    return nearest;
  }

  private fireBullet(hero: PlacedHero, target: ActiveEnemy): void {
    const damage = calculateDamage({
      attackType: hero.def.attackType,
      heroPhy: hero.def.phy,
      heroInt: hero.def.int,
      enemyPhyDef: target.def.phyDef,
      enemyIntDef: target.def.intDef,
    });

    const color = hero.def.attackType === "INT" ? 0x60a5fa : 0xfacc15;
    const bulletSprite = this.add
      .circle(hero.sprite.x, hero.sprite.y, 5, color)
      .setDepth(40);
    bulletSprite.setStrokeStyle(1, 0xffffff, 0.8);

    this.bullets.push({
      sprite: bulletSprite,
      target,
      damage,
      speed: 600,
      done: false,
    });
  }

  private tickBullets(dt: number): void {
    for (const b of this.bullets) {
      if (b.done) continue;
      const target = b.target;
      if (!target.sprite.active || target.hp <= 0) {
        b.done = true;
        continue;
      }
      const dx = target.sprite.x - b.sprite.x;
      const dy = target.sprite.y - b.sprite.y;
      const dist = Math.hypot(dx, dy);
      const step = b.speed * dt;
      if (dist <= step) {
        target.hp -= b.damage;
        b.done = true;
      } else {
        b.sprite.x += (dx / dist) * step;
        b.sprite.y += (dy / dist) * step;
      }
    }
    this.bullets = this.bullets.filter((b) => {
      if (b.done) {
        b.sprite.destroy();
        return false;
      }
      return true;
    });
  }

  private refreshHud(): void {
    this.hpText.setText(`BASE HP  ${this.baseHp} / ${this.maxBaseHp}`);
    this.ceText.setText(`CE  ${Math.floor(this.ce)} / ${this.maxCe}`);
    this.ceBar.width = 200 * (this.ce / this.maxCe);

    // パレット枠の色を CE 残量で更新
    for (const entry of this.heroPaletteEntries) {
      const enough = this.ce >= entry.hero.cost;
      const isSelected = this.selectedHero?.id === entry.hero.id;
      const color = isSelected ? 0xfde047 : enough ? 0x4b5563 : 0x1f2937;
      entry.border.setStrokeStyle(2, color);
      entry.container.setAlpha(enough ? 1 : 0.5);
    }
  }

  private checkEndCondition(): void {
    if (this.gameOver) return;
    if (this.baseHp <= 0) {
      this.endGame(false);
      return;
    }
    if (
      this.spawnedTotal >= this.totalToDefeat &&
      this.defeatedTotal + this.enemies.filter((e) => e.goalReached).length >=
        this.totalToDefeat
    ) {
      this.endGame(this.defeatedTotal === this.totalToDefeat);
    }
  }

  private endGame(victory: boolean): void {
    this.gameOver = true;
    this.cancelSelection();

    const overlay = this.add.rectangle(
      STAGE_WIDTH / 2,
      STAGE_HEIGHT / 2,
      STAGE_WIDTH,
      STAGE_HEIGHT,
      0x000000,
      0.6,
    );
    const title = this.add
      .text(
        STAGE_WIDTH / 2,
        STAGE_HEIGHT / 2 - 20,
        victory ? "STAGE CLEAR!" : "FAILED",
        {
          fontSize: "40px",
          color: victory ? "#fde68a" : "#fca5a5",
          fontStyle: "bold",
        },
      )
      .setOrigin(0.5);
    const sub = this.add
      .text(
        STAGE_WIDTH / 2,
        STAGE_HEIGHT / 2 + 28,
        victory
          ? `撃破 ${this.defeatedTotal} / ${this.totalToDefeat}`
          : `BASE HP が 0 になりました`,
        { fontSize: "16px", color: "#e5e7eb" },
      )
      .setOrigin(0.5);
    const btn = this.add
      .text(STAGE_WIDTH / 2, STAGE_HEIGHT / 2 + 70, "[ もう一度 ]", {
        fontSize: "18px",
        color: "#93c5fd",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    btn.on("pointerdown", () => this.scene.restart());

    this.endOverlay = this.add.container(0, 0, [overlay, title, sub, btn]);
    this.endOverlay.setDepth(100);
  }
}

export const STAGE_DIMENSIONS = {
  width: STAGE_WIDTH,
  height: STAGE_HEIGHT + HUD_HEIGHT,
};

// 念のため: HEROES が空でないことを型で保証する補助（インポート時の安全弁）
if (HEROES.length === 0 || !findHero(HEROES[0].id)) {
  // eslint-disable-next-line no-console
  console.warn("HEROES list is empty or inconsistent");
}
