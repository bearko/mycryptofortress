import Phaser from "phaser";
import { HEROES, findHero } from "../game/heroData";
import { findEnemy } from "../game/enemyData";
import {
  STAGE1_MAP,
  STAGE1_WAVE,
  TILE_SIZE,
  blockMaxFor,
  canPlaceClassOnTile,
  distanceToGoal,
  findRoute,
  pixelToTile,
  placementTileFor,
  routeProgress,
  tileToPixel,
  tileTypeAt,
} from "../game/map";
import type {
  EnemyDef,
  HeroClass,
  HeroDef,
  MapDef,
  RouteDef,
  SpawnPattern,
  TilePos,
} from "../game/types";
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

const CLASS_LABEL: Record<HeroClass, string> = {
  defender: "重装",
  guard: "前衛",
  vanguard: "先鋒",
  specialist: "特殊",
  sniper: "狙撃",
  caster: "術師",
  medic: "医療",
  supporter: "補助",
};

const ROUTE_COLOR: Record<string, number> = {
  A: 0xfacc15,
  B: 0x60a5fa,
};

interface PlacedHero {
  def: HeroDef;
  tile: TilePos;
  direction: Direction;
  sprite: Phaser.GameObjects.Sprite;
  rangeRects: Phaser.GameObjects.Rectangle[];
  lastAttackAt: number;
  blockNum: number;
}

interface ActiveEnemy {
  def: EnemyDef;
  routeId: string;
  sprite: Phaser.GameObjects.Sprite;
  hpBar: Phaser.GameObjects.Rectangle;
  hpBarBg: Phaser.GameObjects.Rectangle;
  hp: number;
  nextIndex: number;
  goalReached: boolean;
  blockedBy: PlacedHero | null;
}

interface ActiveBullet {
  sprite: Phaser.GameObjects.Arc;
  target: ActiveEnemy;
  damage: number;
  speed: number;
  done: boolean;
}

interface SelectingPhase {
  kind: "selecting";
  hero: HeroDef;
  ghostSprite: Phaser.GameObjects.Sprite;
  rangeRects: Phaser.GameObjects.Rectangle[];
  highlightRects: Phaser.GameObjects.Rectangle[];
}

interface OrientingPhase {
  kind: "orienting";
  hero: HeroDef;
  tile: TilePos;
  direction: Direction;
  ghostSprite: Phaser.GameObjects.Sprite;
  rangeRects: Phaser.GameObjects.Rectangle[];
  highlightRects: Phaser.GameObjects.Rectangle[];
}

type PlacementPhase = SelectingPhase | OrientingPhase | null;

export class StageScene extends Phaser.Scene {
  private map: MapDef = STAGE1_MAP;
  private stageWidth = 0;
  private stageHeight = 0;

  private baseHp = 5;
  private maxBaseHp = 5;
  private ce = 30;
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

  /** 既に経路アニメを再生済みの routeId の集合 */
  private routesAnimated = new Set<string>();

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

  constructor() {
    super("StageScene");
  }

  create(): void {
    this.map = STAGE1_MAP;
    this.stageWidth = this.map.cols * TILE_SIZE;
    this.stageHeight = this.map.rows * TILE_SIZE;

    this.baseHp = 5;
    this.maxBaseHp = 5;
    this.ce = 30;
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
    this.routesAnimated = new Set();
    this.playSpeed = 1.0;
    this.playSpeedToggle = 1.0;
    this.statusPanel = null;
    this.statusPanelHeroId = null;
    this.endOverlay = null;
    this.gameOver = false;
    this.heroPaletteEntries = [];

    this.cameras.main.setBackgroundColor(0x0e1117);
    this.drawTiles();
    this.drawHud();
    this.bindInput();
    this.refreshSpeedButton();
  }

  // ========== 描画 ==========

  private drawTiles(): void {
    for (let r = 0; r < this.map.rows; r++) {
      for (let c = 0; c < this.map.cols; c++) {
        const kind = this.map.tiles[r][c];
        const cx = c * TILE_SIZE + TILE_SIZE / 2;
        const cy = r * TILE_SIZE + TILE_SIZE / 2;
        const fill =
          kind === "path" ? 0x3b2a1a : kind === "wall" ? 0x374151 : 0x111827;
        const stroke =
          kind === "path" ? 0x6b4a2a : kind === "wall" ? 0x6b7280 : 0x1f2937;
        const rect = this.add.rectangle(
          cx,
          cy,
          TILE_SIZE - 2,
          TILE_SIZE - 2,
          fill,
          1,
        );
        rect.setStrokeStyle(1, stroke);
        if (kind === "wall") {
          // 壁のテクスチャ感を出す簡易ドット
          this.add
            .rectangle(cx - 14, cy - 14, 4, 4, 0x9ca3af, 0.6)
            .setDepth(2);
          this.add
            .rectangle(cx + 14, cy + 12, 4, 4, 0x9ca3af, 0.6)
            .setDepth(2);
        }
      }
    }

    // ルートの始点と終点だけは常時マークする（経路本体は出現時アニメ）
    for (const route of this.map.routes) {
      const start = tileToPixel(route.points[0]);
      const goal = tileToPixel(route.points[route.points.length - 1]);
      const color = ROUTE_COLOR[route.id] ?? 0xffffff;
      this.add
        .text(start.x, start.y - 22, `IN ${route.id}`, {
          fontSize: "10px",
          color: "#a7f3d0",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.add
        .text(goal.x, goal.y - 22, `OUT ${route.id}`, {
          fontSize: "10px",
          color: "#fef3c7",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      // 出入口にカラーピン
      this.add.circle(start.x, start.y, 5, color, 0.8).setDepth(3);
      this.add.circle(goal.x, goal.y, 5, color, 0.8).setDepth(3);
    }
  }

  private drawHud(): void {
    const hudY = this.stageHeight;
    this.add.rectangle(
      this.stageWidth / 2,
      hudY + HUD_HEIGHT / 2,
      this.stageWidth,
      HUD_HEIGHT,
      0x0b0d12,
      1,
    );
    this.add
      .line(0, 0, 0, hudY, this.stageWidth, hudY, 0x374151, 1)
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
      "ヒーローを選んで配置可能タイルをクリック → 向きを決めて再クリック",
      { fontSize: "11px", color: "#9ca3af" },
    );

    this.add.rectangle(160, hudY + 38, 200, 8, 0x1f2937).setOrigin(0, 0.5);
    this.ceBar = this.add
      .rectangle(160, hudY + 38, 0, 8, 0x38bdf8)
      .setOrigin(0, 0.5);

    // ヒーローパレット (8 体: 横 4 × 縦 2)
    const paletteX = 380;
    const paletteY = hudY + 8;
    HEROES.forEach((hero, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const cx = paletteX + col * 56;
      const cy = paletteY + row * 40;

      const border = this.add.rectangle(cx, cy + 16, 48, 36, 0x111827, 1);
      border.setStrokeStyle(2, 0x4b5563);
      border.setInteractive({ useHandCursor: true });

      const sprite = this.add
        .sprite(cx, cy + 8, TEXTURE_KEYS.hero(hero.id))
        .setDisplaySize(28, 28);
      const labelClass = this.add
        .text(cx, cy + 26, CLASS_LABEL[hero.class], {
          fontSize: "9px",
          color: "#fcd34d",
        })
        .setOrigin(0.5);
      const labelCost = this.add
        .text(cx + 18, cy - 1, `${hero.cost}`, {
          fontSize: "9px",
          color: "#bae6fd",
          fontStyle: "bold",
        })
        .setOrigin(0.5);

      const container = this.add.container(0, 0, [
        sprite,
        labelClass,
        labelCost,
      ]);
      border.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (pointer.rightButtonDown()) return;
        this.onSelectHero(hero);
      });
      this.heroPaletteEntries.push({ hero, container, border });
    });

    // 再生速度トグル
    const sx = this.stageWidth - 50;
    const sy = hudY + 18;
    const sBorder = this.add.rectangle(sx, sy, 70, 26, 0x111827, 1);
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
          { col: 0, row: 0 },
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
      if (this.statusPanel) return;
      if (p.y >= this.stageHeight) return;

      if (p.rightButtonDown()) {
        if (this.placement) {
          this.cancelPlacement();
          return;
        }
        const tile = pixelToTile(
          p.worldX,
          p.worldY,
          this.map.cols,
          this.map.rows,
        );
        if (tile) this.tryReleaseHeroAt(tile);
        return;
      }

      if (this.placement?.kind === "selecting") {
        this.tryCommitPlacement(p.worldX, p.worldY);
        return;
      }
      if (this.placement?.kind === "orienting") {
        this.confirmOrientation();
        return;
      }
      const tile = pixelToTile(
        p.worldX,
        p.worldY,
        this.map.cols,
        this.map.rows,
      );
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
    this.cancelPlacement();

    const ghost = this.add
      .sprite(-100, -100, TEXTURE_KEYS.hero(hero.id))
      .setDisplaySize(TILE_SIZE, TILE_SIZE)
      .setAlpha(0.6)
      .setDepth(50);

    const highlightRects = this.buildHighlightTilesFor(hero.class);

    this.placement = {
      kind: "selecting",
      hero,
      ghostSprite: ghost,
      rangeRects: [],
      highlightRects,
    };

    this.statusText.setText(
      `${CLASS_LABEL[hero.class]}「${hero.name}」を ${
        placementTileFor(hero.class) === "path" ? "道" : "壁"
      } に配置（右クリックでキャンセル）`,
    );
    this.refreshPaletteHighlight();
  }

  private buildHighlightTilesFor(
    cls: HeroClass,
  ): Phaser.GameObjects.Rectangle[] {
    const rects: Phaser.GameObjects.Rectangle[] = [];
    const target = placementTileFor(cls);
    for (let r = 0; r < this.map.rows; r++) {
      for (let c = 0; c < this.map.cols; c++) {
        if (this.map.tiles[r][c] !== target) continue;
        if (this.placedHeroes.some((h) => h.tile.col === c && h.tile.row === r))
          continue;
        const cx = c * TILE_SIZE + TILE_SIZE / 2;
        const cy = r * TILE_SIZE + TILE_SIZE / 2;
        const rect = this.add.rectangle(
          cx,
          cy,
          TILE_SIZE - 6,
          TILE_SIZE - 6,
          0x4ade80,
          0.18,
        );
        rect.setStrokeStyle(1, 0x4ade80, 0.7);
        rect.setDepth(8);
        rects.push(rect);
      }
    }
    return rects;
  }

  private tryCommitPlacement(x: number, y: number): void {
    if (this.placement?.kind !== "selecting") return;
    const tile = pixelToTile(x, y, this.map.cols, this.map.rows);
    if (!tile) return;
    const tileType = tileTypeAt(this.map, tile);
    if (!tileType) return;

    if (!canPlaceClassOnTile(this.placement.hero.class, tileType)) {
      const targetLabel =
        placementTileFor(this.placement.hero.class) === "path" ? "道" : "壁";
      this.statusText.setText(
        `${CLASS_LABEL[this.placement.hero.class]} は ${targetLabel} 専用（このマスは ${
          tileType === "path" ? "道" : tileType === "wall" ? "壁" : "障害"
        }）`,
      );
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

    const px = tileToPixel(tile);
    this.placement.ghostSprite.x = px.x;
    this.placement.ghostSprite.y = px.y;

    const direction: Direction = "right";
    this.repositionPatternRects(
      this.placement.rangeRects,
      this.placement.hero.attackPattern,
      tile,
      direction,
    );

    // 配置可能マスのハイライトはこの段階では消す（向き選択に集中）
    for (const r of this.placement.highlightRects) r.destroy();
    this.placement.highlightRects = [];

    this.placement = {
      kind: "orienting",
      hero: this.placement.hero,
      tile,
      direction,
      ghostSprite: this.placement.ghostSprite,
      rangeRects: this.placement.rangeRects,
      highlightRects: [],
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
    for (const r of rangeRects) r.setAlpha(0.18);

    this.placedHeroes.push({
      def: hero,
      tile,
      direction,
      sprite: ghostSprite,
      rangeRects,
      lastAttackAt: this.elapsed,
      blockNum: 0,
    });

    this.placement = null;
    this.statusText.setText(
      `${CLASS_LABEL[hero.class]} ${hero.name} を ${direction} 向きで配置（block最大 ${blockMaxFor(hero.class)}）`,
    );
    this.refreshPaletteHighlight();
  }

  private cancelPlacement(): void {
    if (!this.placement) return;
    this.placement.ghostSprite.destroy();
    for (const r of this.placement.rangeRects) r.destroy();
    for (const r of this.placement.highlightRects) r.destroy();
    this.placement = null;
    this.statusText.setText(
      "ヒーローを選んで配置可能タイルをクリック → 向きを決めて再クリック",
    );
    this.refreshPaletteHighlight();
  }

  private repositionPatternRects(
    rects: Phaser.GameObjects.Rectangle[],
    pattern: TilePos[],
    baseTile: TilePos,
    direction: Direction,
    overrideX?: number,
    overrideY?: number,
  ): void {
    const rotated = rotatePattern(pattern, direction);
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
    // ブロック中の敵を解放
    for (const e of this.enemies) {
      if (e.blockedBy === hero) e.blockedBy = null;
    }
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
      this.stageWidth / 2,
      this.stageHeight / 2,
      this.stageWidth,
      this.stageHeight,
      0x000000,
      0.55,
    );
    overlay.setInteractive({ useHandCursor: true });

    const panel = this.add.rectangle(
      this.stageWidth / 2,
      this.stageHeight / 2,
      400,
      300,
      0x111827,
      0.98,
    );
    panel.setStrokeStyle(2, 0x4b5563);

    const title = this.add
      .text(
        this.stageWidth / 2,
        this.stageHeight / 2 - 120,
        `[${CLASS_LABEL[hero.def.class]}] ${hero.def.name}`,
        { fontSize: "20px", color: "#f9fafb", fontStyle: "bold" },
      )
      .setOrigin(0.5);

    const portrait = this.add
      .sprite(
        this.stageWidth / 2 - 145,
        this.stageHeight / 2 - 30,
        TEXTURE_KEYS.hero(hero.def.id),
      )
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
      `攻撃範囲: ${tilesCount} マス（${hero.direction} 向き）`,
      `ブロック: ${hero.blockNum} / ${blockMaxFor(hero.def.class)}`,
      `コスト: ${hero.def.cost} CE`,
    ];
    const stats = this.add
      .text(this.stageWidth / 2 - 70, this.stageHeight / 2 - 80, lines.join("\n"), {
        fontSize: "13px",
        color: "#e5e7eb",
        lineSpacing: 4,
      })
      .setOrigin(0, 0);

    const closeBtn = this.add
      .text(this.stageWidth / 2, this.stageHeight / 2 + 120, "[ 閉じる ]", {
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

    for (const r of hero.rangeRects) r.setAlpha(0.35);
    this.playSpeed = 0.1;
    this.refreshSpeedButton();
  }

  private closeStatusPanel(): void {
    if (!this.statusPanel) return;
    this.statusPanel.destroy(true);
    this.statusPanel = null;
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
    if (this.statusPanel) return;
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
      this.spawnEnemy(pattern);
    }
  }

  private spawnEnemy(pattern: SpawnPattern): void {
    const def = findEnemy(pattern.enemyId);
    if (!def) return;
    const route = findRoute(this.map, pattern.routeId);
    if (!route) return;

    // 初出現ルートはアニメ表示
    if (!this.routesAnimated.has(route.id)) {
      this.routesAnimated.add(route.id);
      this.playRouteAnimation(route);
    }

    const start = tileToPixel(route.points[0]);
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
      routeId: route.id,
      sprite,
      hp: def.hp,
      hpBar: hp,
      hpBarBg: hpBg,
      nextIndex: 1,
      goalReached: false,
      blockedBy: null,
    });
    this.spawnedTotal++;
  }

  /** SPEC-003 §5.5: 出現直前にルートを 1.8 秒だけ光らせる。 */
  private playRouteAnimation(route: RouteDef): void {
    const color = ROUTE_COLOR[route.id] ?? 0xffffff;
    const g = this.add.graphics();
    g.setDepth(5);
    g.lineStyle(6, color, 0.0);
    g.beginPath();
    const pts = route.points.map(tileToPixel);
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.strokePath();
    // フェードイン → キープ → フェードアウト
    this.tweens.add({
      targets: g,
      alpha: { from: 0, to: 0.85 },
      duration: 600,
      onComplete: () => {
        this.tweens.add({
          targets: g,
          alpha: 0.85,
          duration: 600,
          onComplete: () => {
            this.tweens.add({
              targets: g,
              alpha: 0,
              duration: 600,
              onComplete: () => g.destroy(),
            });
          },
        });
      },
    });
  }

  private tickEnemies(dt: number): void {
    for (const enemy of this.enemies) {
      if (enemy.goalReached) continue;
      // ブロック中は移動しない
      if (enemy.blockedBy) continue;

      const route = findRoute(this.map, enemy.routeId)!;
      const target = route.points[enemy.nextIndex];
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
        if (enemy.nextIndex >= route.points.length) {
          this.handleGoal(enemy);
        }
      } else {
        enemy.sprite.x += (dx / dist) * step;
        enemy.sprite.y += (dy / dist) * step;
      }

      // 同タイルにいる前衛系ヒーローによるブロック判定
      this.tryBlockEnemy(enemy);

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
        if (e.blockedBy) {
          e.blockedBy.blockNum = Math.max(0, e.blockedBy.blockNum - 1);
          e.blockedBy = null;
        }
        e.sprite.destroy();
        e.hpBar.destroy();
        e.hpBarBg.destroy();
        this.defeatedTotal++;
        return false;
      }
      return true;
    });
  }

  private tryBlockEnemy(enemy: ActiveEnemy): void {
    if (enemy.blockedBy) return;
    const eTile = pixelToTile(
      enemy.sprite.x,
      enemy.sprite.y,
      this.map.cols,
      this.map.rows,
    );
    if (!eTile) return;
    const hero = this.placedHeroes.find((h) => tileEquals(h.tile, eTile));
    if (!hero) return;
    const max = blockMaxFor(hero.def.class);
    if (max <= 0) return;
    if (hero.blockNum >= max) return;
    enemy.blockedBy = hero;
    hero.blockNum += 1;
  }

  private handleGoal(enemy: ActiveEnemy): void {
    enemy.goalReached = true;
    this.baseHp = Math.max(0, this.baseHp - 1);
  }

  private tickHeroAttacks(): void {
    for (const hero of this.placedHeroes) {
      const interval = 1 / Math.max(0.1, hero.def.agi / 100);
      if (this.elapsed - hero.lastAttackAt < interval) continue;
      const target = this.findTargetByRouteProgress(hero);
      if (!target) continue;
      hero.lastAttackAt = this.elapsed;
      this.fireBullet(hero, target);
    }
  }

  /**
   * SPEC-003 §5.7: 攻撃範囲タイルに重なる敵から
   *   1. ルート進行度が最大
   *   2. ゴールまでの距離が最小
   *   3. 配列順
   * の順で 1 体選ぶ。
   */
  private findTargetByRouteProgress(hero: PlacedHero): ActiveEnemy | null {
    const tiles = applyPatternToTile(
      hero.tile,
      rotatePattern(hero.def.attackPattern, hero.direction),
    );
    let best: ActiveEnemy | null = null;
    let bestProgress = -Infinity;
    let bestDistanceToGoal = Infinity;
    for (const e of this.enemies) {
      const eTile = pixelToTile(
        e.sprite.x,
        e.sprite.y,
        this.map.cols,
        this.map.rows,
      );
      if (!eTile) continue;
      if (!tiles.some((t) => tileEquals(t, eTile))) continue;
      const route = findRoute(this.map, e.routeId);
      if (!route) continue;
      const progress = routeProgress(route, e.nextIndex, e.sprite.x, e.sprite.y);
      const dToGoal = distanceToGoal(
        route,
        e.nextIndex,
        e.sprite.x,
        e.sprite.y,
      );
      const better =
        progress > bestProgress ||
        (progress === bestProgress && dToGoal < bestDistanceToGoal);
      if (better) {
        best = e;
        bestProgress = progress;
        bestDistanceToGoal = dToGoal;
      }
    }
    return best;
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
      this.stageWidth / 2,
      this.stageHeight / 2,
      this.stageWidth,
      this.stageHeight,
      0x000000,
      0.6,
    );
    const title = this.add
      .text(
        this.stageWidth / 2,
        this.stageHeight / 2 - 20,
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
        this.stageWidth / 2,
        this.stageHeight / 2 + 28,
        victory
          ? `撃破 ${this.defeatedTotal} / ${this.totalToDefeat}`
          : "BASE HP が 0 になりました",
        { fontSize: "16px", color: "#e5e7eb" },
      )
      .setOrigin(0.5);
    const btn = this.add
      .text(this.stageWidth / 2, this.stageHeight / 2 + 70, "[ もう一度 ]", {
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
  width: STAGE1_MAP.cols * TILE_SIZE,
  height: STAGE1_MAP.rows * TILE_SIZE + HUD_HEIGHT,
};

if (HEROES.length === 0 || !findHero(HEROES[0].id)) {
  // eslint-disable-next-line no-console
  console.warn("HEROES list is empty or inconsistent");
}
