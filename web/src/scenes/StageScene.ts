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
import {
  applyPatternToTile,
  directionFromDelta,
  rotatePattern,
  tileEquals,
  type Direction,
} from "../game/pattern";
import { TEXTURE_KEYS } from "./BootScene";

const HUD_HEIGHT = 96;
const STAGE_WIDTH = COLS * TILE_SIZE;
const STAGE_HEIGHT = ROWS * TILE_SIZE;

interface PlacedHero {
  def: HeroDef;
  tile: TilePos;
  direction: Direction;
  sprite: Phaser.GameObjects.Sprite;
  rangeRects: Phaser.GameObjects.Rectangle[];
  lastAttackAt: number;
}

interface ActiveEnemy {
  def: EnemyDef;
  sprite: Phaser.GameObjects.Sprite;
  hpBar: Phaser.GameObjects.Rectangle;
  hpBarBg: Phaser.GameObjects.Rectangle;
  hp: number;
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

/** 配置フェーズ 1: パレット選択済み（ゴーストがカーソル追従中） */
interface SelectingPhase {
  kind: "selecting";
  hero: HeroDef;
  ghostSprite: Phaser.GameObjects.Sprite;
  rangeRects: Phaser.GameObjects.Rectangle[];
}

/** 配置フェーズ 2: タイル決定済み・向きをカーソルで決める */
interface OrientingPhase {
  kind: "orienting";
  hero: HeroDef;
  tile: TilePos;
  direction: Direction;
  ghostSprite: Phaser.GameObjects.Sprite;
  rangeRects: Phaser.GameObjects.Rectangle[];
}

type PlacementPhase = SelectingPhase | OrientingPhase | null;

export class StageScene extends Phaser.Scene {
  private baseHp = 5;
  private maxBaseHp = 5;
  private ce = 20;
  private maxCe = 100;
  private ceProgress = 0;

  private elapsed = 0;
  private waveQueue: SpawnPattern[] = [];
  private spawnedTotal = 0;
  private defeatedTotal = 0;
  private totalToDefeat = 0;

  private placement: PlacementPhase = null;
  private placedHeroes: PlacedHero[] = [];
  private enemies: ActiveEnemy[] = [];
  private bullets: ActiveBullet[] = [];

  /** SPEC-002 §5.7: 通常時 1.0 / 倍速 2.0、ステータスパネル表示中は 0.1 */
  private playSpeed = 1.0;
  private playSpeedToggle: 1.0 | 2.0 = 1.0;

  private hpText!: Phaser.GameObjects.Text;
  private ceText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private ceBar!: Phaser.GameObjects.Rectangle;
  private heroPaletteEntries: {
    hero: HeroDef;
    container: Phaser.GameObjects.Container;
    border: Phaser.GameObjects.Rectangle;
  }[] = [];
  private speedButtonText!: Phaser.GameObjects.Text;

  private statusPanel: Phaser.GameObjects.Container | null = null;
  private statusPanelHeroId: number | null = null;

  private endOverlay: Phaser.GameObjects.Container | null = null;
  private gameOver = false;

  private cachedTileMap: ReturnType<typeof buildTileMap> | null = null;

  constructor() {
    super("StageScene");
  }

  create(): void {
    // Phaser の scene.restart() は同じインスタンスで create を再実行するため、
    // クラスフィールドの初期化子は走らない。すべての可変状態を明示的にリセットする。
    this.baseHp = 5;
    this.maxBaseHp = 5;
    this.ce = 20;
    this.ceProgress = 0;
    this.elapsed = 0;
    this.spawnedTotal = 0;
    this.defeatedTotal = 0;
    this.totalToDefeat = STAGE1_WAVE.patterns.length;
    this.waveQueue = [...STAGE1_WAVE.patterns];
    this.placement = null;
    this.placedHeroes = [];
    this.enemies = [];
    this.bullets = [];
    this.playSpeed = 1.0;
    this.playSpeedToggle = 1.0;
    this.statusPanel = null;
    this.statusPanelHeroId = null;
    this.endOverlay = null;
    this.gameOver = false;
    this.heroPaletteEntries = [];
    this.cachedTileMap = buildTileMap(STAGE1_ROUTE);

    this.cameras.main.setBackgroundColor(0x141822);
    this.drawTilesAndRoute();
    this.drawHud();
    this.bindInput();
    this.refreshSpeedButton();
  }

  // ========== セットアップ ==========

  private drawTilesAndRoute(): void {
    if (!this.cachedTileMap) return;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const kind = this.cachedTileMap[r][c];
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

    const goal = tileToPixel(STAGE1_ROUTE[STAGE1_ROUTE.length - 1]);
    this.add
      .text(goal.x, goal.y, "GOAL", {
        fontSize: "14px",
        color: "#fef3c7",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
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
    this.add
      .line(0, 0, 0, hudY, STAGE_WIDTH, hudY, 0x374151, 1)
      .setOrigin(0, 0);

    this.hpText = this.add.text(12, hudY + 8, "", {
      fontSize: "16px",
      color: "#fee2e2",
      fontStyle: "bold",
    });
    this.ceText = this.add.text(12, hudY + 32, "", {
      fontSize: "14px",
      color: "#bae6fd",
    });
    this.statusText = this.add.text(
      12,
      hudY + 56,
      "ヒーローを選んでマスをクリック → カーソルで向きを決めて再クリック",
      { fontSize: "11px", color: "#9ca3af" },
    );

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

      border.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (pointer.rightButtonDown()) return;
        this.onSelectHero(hero);
      });
      this.heroPaletteEntries.push({ hero, container, border });
    });

    // 再生速度トグル
    const sx = STAGE_WIDTH - 60;
    const sy = hudY + 18;
    const sBorder = this.add.rectangle(sx, sy, 80, 26, 0x111827, 1);
    sBorder.setStrokeStyle(1, 0x4b5563);
    sBorder.setInteractive({ useHandCursor: true });
    this.speedButtonText = this.add
      .text(sx, sy, "1.0×", {
        fontSize: "12px",
        color: "#bae6fd",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.add.container(0, 0, [sBorder, this.speedButtonText]);
    sBorder.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      this.togglePlaySpeed();
    });
  }

  private bindInput(): void {
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (this.placement?.kind === "selecting") {
        this.placement.ghostSprite.x = p.worldX;
        this.placement.ghostSprite.y = p.worldY;
        this.repositionPatternRects(
          this.placement.rangeRects,
          this.placement.hero.attackPattern,
          { col: 0, row: 0 }, // ghost ベースなので絶対位置は ghost に追従
          "right",
          p.worldX,
          p.worldY,
        );
      } else if (this.placement?.kind === "orienting") {
        const center = tileToPixel(this.placement.tile);
        const dir = directionFromDelta(
          p.worldX - center.x,
          p.worldY - center.y,
        );
        if (dir !== this.placement.direction) {
          this.placement.direction = dir;
          this.repositionPatternRects(
            this.placement.rangeRects,
            this.placement.hero.attackPattern,
            this.placement.tile,
            dir,
          );
        }
      }
    });

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.gameOver) return;
      if (this.statusPanel) return; // パネル表示中は背面入力を無視
      if (p.y >= STAGE_HEIGHT) return;

      // 右クリック: 配置中ならキャンセル、配置済みヒーローなら売却
      if (p.rightButtonDown()) {
        if (this.placement) {
          this.cancelPlacement();
          return;
        }
        const tile = pixelToTile(p.worldX, p.worldY);
        if (tile) this.tryReleaseHeroAt(tile);
        return;
      }

      // 左クリック
      if (this.placement?.kind === "selecting") {
        this.tryCommitPlacement(p.worldX, p.worldY);
        return;
      }
      if (this.placement?.kind === "orienting") {
        this.confirmOrientation();
        return;
      }
      // 配置中でもなく右クリックでもない: 配置済みヒーロークリック → ステータス
      const tile = pixelToTile(p.worldX, p.worldY);
      if (tile) {
        const hero = this.placedHeroes.find((h) => tileEquals(h.tile, tile));
        if (hero) this.openStatusPanel(hero);
      }
    });
  }

  // ========== 配置フロー ==========

  private onSelectHero(hero: HeroDef): void {
    if (this.gameOver || this.statusPanel) return;
    if (this.ce < hero.cost) {
      this.statusText.setText(
        `CE が足りません（必要 ${hero.cost} / 現在 ${Math.floor(this.ce)}）`,
      );
      return;
    }
    this.cancelPlacement(); // 既存選択をクリア

    const ghost = this.add
      .sprite(-100, -100, TEXTURE_KEYS.hero(hero.id))
      .setDisplaySize(TILE_SIZE, TILE_SIZE)
      .setAlpha(0.6)
      .setDepth(50);

    this.placement = {
      kind: "selecting",
      hero,
      ghostSprite: ghost,
      rangeRects: [],
    };

    this.statusText.setText(
      `${hero.name} を配置するマスをクリック（右クリックでキャンセル）`,
    );
    this.refreshPaletteHighlight();
  }

  private tryCommitPlacement(x: number, y: number): void {
    if (this.placement?.kind !== "selecting") return;
    const tile = pixelToTile(x, y);
    if (!tile) return;
    if (!this.cachedTileMap) return;
    if (this.cachedTileMap[tile.row][tile.col] !== "placeable") {
      this.statusText.setText("そのマスには置けません（敵の通り道）");
      return;
    }
    if (this.placedHeroes.some((h) => tileEquals(h.tile, tile))) {
      this.statusText.setText("既にヒーローが居ます");
      return;
    }
    if (this.ce < this.placement.hero.cost) {
      this.statusText.setText("CE が足りません");
      return;
    }

    // 配置タイルが決定したらゴーストを固定し、向き選択フェーズへ
    const px = tileToPixel(tile);
    this.placement.ghostSprite.x = px.x;
    this.placement.ghostSprite.y = px.y;

    const direction: Direction = "right";
    // 既存の range rect を更新
    this.repositionPatternRects(
      this.placement.rangeRects,
      this.placement.hero.attackPattern,
      tile,
      direction,
    );

    this.placement = {
      kind: "orienting",
      hero: this.placement.hero,
      tile,
      direction,
      ghostSprite: this.placement.ghostSprite,
      rangeRects: this.placement.rangeRects,
    };
    this.statusText.setText(
      "カーソル方向で向きを選び、再度クリックで確定（右クリックでキャンセル）",
    );
  }

  private confirmOrientation(): void {
    if (this.placement?.kind !== "orienting") return;
    const { hero, tile, direction, ghostSprite, rangeRects } = this.placement;

    this.ce -= hero.cost;
    ghostSprite.setAlpha(1);
    ghostSprite.setDepth(20);
    // ゴースト → 配置スプライトとして転用
    for (const r of rangeRects) r.setAlpha(0.18);

    this.placedHeroes.push({
      def: hero,
      tile,
      direction,
      sprite: ghostSprite,
      rangeRects,
      lastAttackAt: this.elapsed,
    });

    this.placement = null;
    this.statusText.setText(`${hero.name} を ${direction} 向きで配置しました`);
    this.refreshPaletteHighlight();
  }

  private cancelPlacement(): void {
    if (!this.placement) return;
    this.placement.ghostSprite.destroy();
    for (const r of this.placement.rangeRects) r.destroy();
    this.placement = null;
    this.statusText.setText(
      "ヒーローを選んでマスをクリック → カーソルで向きを決めて再クリック",
    );
    this.refreshPaletteHighlight();
  }

  /** 攻撃範囲タイル群を再配置・必要数まで増減する */
  private repositionPatternRects(
    rects: Phaser.GameObjects.Rectangle[],
    pattern: TilePos[],
    baseTile: TilePos,
    direction: Direction,
    overrideX?: number,
    overrideY?: number,
  ): void {
    const rotated = rotatePattern(pattern, direction);

    // 必要数を確保
    while (rects.length < rotated.length) {
      const r = this.add.rectangle(
        0,
        0,
        TILE_SIZE - 4,
        TILE_SIZE - 4,
        0xfde047,
        0.25,
      );
      r.setStrokeStyle(1, 0xfde047, 0.6);
      r.setDepth(10);
      rects.push(r);
    }
    // 余剰を破棄
    while (rects.length > rotated.length) {
      const dead = rects.pop();
      dead?.destroy();
    }

    rotated.forEach((offset, i) => {
      const r = rects[i];
      let baseX: number, baseY: number;
      if (overrideX != null && overrideY != null) {
        baseX = overrideX;
        baseY = overrideY;
      } else {
        const p = tileToPixel(baseTile);
        baseX = p.x;
        baseY = p.y;
      }
      r.x = baseX + offset.col * TILE_SIZE;
      r.y = baseY + offset.row * TILE_SIZE;
    });
  }

  private refreshPaletteHighlight(): void {
    const selectedId =
      this.placement?.kind === "selecting" || this.placement?.kind === "orienting"
        ? this.placement.hero.id
        : null;
    for (const entry of this.heroPaletteEntries) {
      const enough = this.ce >= entry.hero.cost;
      const isSelected = entry.hero.id === selectedId;
      const color = isSelected ? 0xfde047 : enough ? 0x4b5563 : 0x1f2937;
      entry.border.setStrokeStyle(2, color);
      entry.container.setAlpha(enough || isSelected ? 1 : 0.5);
    }
  }

  // ========== 売却 ==========

  private tryReleaseHeroAt(tile: TilePos): void {
    const idx = this.placedHeroes.findIndex((h) => tileEquals(h.tile, tile));
    if (idx === -1) return;
    const hero = this.placedHeroes[idx];
    const refund = Math.ceil(hero.def.cost / 2);
    this.ce = Math.min(this.maxCe, this.ce + refund);
    hero.sprite.destroy();
    for (const r of hero.rangeRects) r.destroy();
    this.placedHeroes.splice(idx, 1);
    this.statusText.setText(`${hero.def.name} を売却（+${refund} CE）`);
  }

  // ========== ステータスパネル ==========

  private openStatusPanel(hero: PlacedHero): void {
    if (this.statusPanel) return;
    this.statusPanelHeroId = hero.def.id;

    const overlay = this.add.rectangle(
      STAGE_WIDTH / 2,
      STAGE_HEIGHT / 2,
      STAGE_WIDTH,
      STAGE_HEIGHT,
      0x000000,
      0.55,
    );
    overlay.setInteractive({ useHandCursor: true });

    const panel = this.add.rectangle(
      STAGE_WIDTH / 2,
      STAGE_HEIGHT / 2,
      360,
      280,
      0x111827,
      0.98,
    );
    panel.setStrokeStyle(2, 0x4b5563);

    const title = this.add
      .text(STAGE_WIDTH / 2, STAGE_HEIGHT / 2 - 110, hero.def.name, {
        fontSize: "20px",
        color: "#f9fafb",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const portrait = this.add
      .sprite(STAGE_WIDTH / 2 - 130, STAGE_HEIGHT / 2 - 20, TEXTURE_KEYS.hero(hero.def.id))
      .setDisplaySize(96, 96);

    const interval = (1 / Math.max(0.1, hero.def.agi / 100)).toFixed(2);
    const tilesCount = hero.def.attackPattern.length;
    const lines = [
      `属性: ${hero.def.attackType}`,
      `HP : ${hero.def.hp}`,
      `PHY: ${hero.def.phy}`,
      `INT: ${hero.def.int}`,
      `AGI: ${hero.def.agi}`,
      `攻撃間隔: ${interval}s`,
      `攻撃範囲: ${tilesCount} マス（${hero.direction}向き）`,
      `コスト: ${hero.def.cost} CE`,
    ];
    const stats = this.add
      .text(STAGE_WIDTH / 2 - 60, STAGE_HEIGHT / 2 - 70, lines.join("\n"), {
        fontSize: "13px",
        color: "#e5e7eb",
        lineSpacing: 4,
      })
      .setOrigin(0, 0);

    const closeBtn = this.add
      .text(STAGE_WIDTH / 2, STAGE_HEIGHT / 2 + 110, "[ 閉じる ]", {
        fontSize: "16px",
        color: "#93c5fd",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    closeBtn.on("pointerdown", () => this.closeStatusPanel());
    overlay.on("pointerdown", () => this.closeStatusPanel());

    this.statusPanel = this.add.container(0, 0, [
      overlay,
      panel,
      title,
      portrait,
      stats,
      closeBtn,
    ]);
    this.statusPanel.setDepth(100);

    // 配置中の選択ヒーローの range を強調
    for (const r of hero.rangeRects) r.setAlpha(0.35);
    // ゲームほぼ停止
    this.playSpeed = 0.1;
    this.refreshSpeedButton();
  }

  private closeStatusPanel(): void {
    if (!this.statusPanel) return;
    this.statusPanel.destroy(true);
    this.statusPanel = null;
    // range alpha を戻す
    if (this.statusPanelHeroId != null) {
      const hero = this.placedHeroes.find(
        (h) => h.def.id === this.statusPanelHeroId,
      );
      if (hero) for (const r of hero.rangeRects) r.setAlpha(0.18);
    }
    this.statusPanelHeroId = null;
    this.playSpeed = this.playSpeedToggle;
    this.refreshSpeedButton();
  }

  // ========== 再生速度 ==========

  private togglePlaySpeed(): void {
    if (this.statusPanel) return; // パネル中は不可
    this.playSpeedToggle = this.playSpeedToggle === 1.0 ? 2.0 : 1.0;
    this.playSpeed = this.playSpeedToggle;
    this.refreshSpeedButton();
  }

  private refreshSpeedButton(): void {
    this.speedButtonText.setText(`${this.playSpeed.toFixed(1)}×`);
  }

  // ========== ループ ==========

  update(_time: number, delta: number): void {
    if (this.gameOver) return;
    const dt = (delta / 1000) * this.playSpeed;
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
      .setDisplaySize(TILE_SIZE, TILE_SIZE)
      .setDepth(30);
    const hpBg = this.add
      .rectangle(start.x, start.y - 28, 40, 5, 0x111827, 0.9)
      .setDepth(31);
    const hp = this.add
      .rectangle(start.x - 20, start.y - 28, 40, 5, 0xef4444)
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
      enemy.hpBarBg.y = enemy.sprite.y - 28;
      enemy.hpBar.x = enemy.sprite.x - 20;
      enemy.hpBar.y = enemy.sprite.y - 28;
      enemy.hpBar.displayWidth = Math.max(0, 40 * (enemy.hp / enemy.def.hp));
    }

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

      const target = this.findEnemyInPattern(hero);
      if (!target) continue;

      hero.lastAttackAt = this.elapsed;
      this.fireBullet(hero, target);
    }
  }

  private findEnemyInPattern(hero: PlacedHero): ActiveEnemy | null {
    const tiles = applyPatternToTile(
      hero.tile,
      rotatePattern(hero.def.attackPattern, hero.direction),
    );
    let nearest: ActiveEnemy | null = null;
    let nearestDist = Infinity;
    for (const e of this.enemies) {
      const eTile = pixelToTile(e.sprite.x, e.sprite.y);
      if (!eTile) continue;
      if (!tiles.some((t) => tileEquals(t, eTile))) continue;
      const dx = e.sprite.x - hero.sprite.x;
      const dy = e.sprite.y - hero.sprite.y;
      const dist = Math.hypot(dx, dy);
      if (dist < nearestDist) {
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
    this.refreshPaletteHighlight();
  }

  private checkEndCondition(): void {
    if (this.gameOver) return;
    if (this.baseHp <= 0) {
      this.endGame(false);
      return;
    }
    const goalCount = this.enemies.filter((e) => e.goalReached).length;
    if (
      this.spawnedTotal >= this.totalToDefeat &&
      this.defeatedTotal + goalCount >= this.totalToDefeat
    ) {
      this.endGame(this.defeatedTotal === this.totalToDefeat);
    }
  }

  private endGame(victory: boolean): void {
    this.gameOver = true;
    this.cancelPlacement();
    if (this.statusPanel) this.closeStatusPanel();

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

if (HEROES.length === 0 || !findHero(HEROES[0].id)) {
  // eslint-disable-next-line no-console
  console.warn("HEROES list is empty or inconsistent");
}
