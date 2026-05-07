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
  isPathClass,
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
  DIRECTIONS,
  rotatePattern,
  tileEquals,
  type Direction,
} from "../game/pattern";
import {
  ActiveSkillState,
  GAUGE_MAX,
  canActivate,
  effectiveDamageRate,
  findSkill,
  gainOnAttack,
  intervalScale,
  isEffectActive,
  startEffect,
  tickGauge,
  type SkillDef,
} from "../game/skill";
import { SE_KEYS, TEXTURE_KEYS } from "./BootScene";

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

/** SPEC-004 §5.6: 職業ごとのカットイン色 */
const CLASS_AURA_COLOR: Record<HeroClass, number> = {
  defender: 0x60a5fa,
  guard: 0xfacc15,
  vanguard: 0xf472b6,
  specialist: 0xa78bfa,
  sniper: 0xfb923c,
  caster: 0x22d3ee,
  medic: 0x4ade80,
  supporter: 0xfde047,
};

interface DebuffSnapshot {
  enemy: ActiveEnemy;
  origPhyDef: number;
  origIntDef: number;
}

interface PlacedHero {
  def: HeroDef;
  skill: SkillDef | null;
  tile: TilePos;
  direction: Direction;
  sprite: Phaser.GameObjects.Sprite;
  rangeRects: Phaser.GameObjects.Rectangle[];
  lastAttackAt: number;
  blockNum: number;
  /** SPEC-004 §5.3 スキルゲージ（0..100） */
  skillGauge: number;
  /** ゲージ満タン時に頭上に出すリング（null=未表示） */
  readyRing: Phaser.GameObjects.Arc | null;
  /** ゲージバー背景 / 進捗 */
  gaugeBg: Phaser.GameObjects.Rectangle;
  gaugeFill: Phaser.GameObjects.Rectangle;
  /** 発動中の効果（null=非発動） */
  activeEffect: ActiveSkillState | null;
  /** 発動中に表示するオーラ */
  aura: Phaser.GameObjects.Arc | null;
  /** enemyDefDebuff のスナップショット（期限切れ時に巻き戻す） */
  debuffSnapshots: DebuffSnapshot[];
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
  /** SPEC-004 §5.5 enemyDefDebuff: 1.0 が通常、debuff 中は < 1.0 */
  phyDefMul: number;
  intDefMul: number;
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
  /** SPEC-005 §5.6: 向きを指定する誘導 UI。各方向のチェブロン記号を hero 周囲に配置。 */
  directionArrows: Map<Direction, Phaser.GameObjects.Text>;
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
  /** SPEC-005 §5.1: ゴール到達した敵の総数（クリア判定で使う） */
  private escapedTotal = 0;
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

  /** 表示中のカットイン（同時 1 個だけ） */
  private currentCutIn: Phaser.GameObjects.Container | null = null;

  /** SPEC-005 §5.4: 戦闘 BGM の再生インスタンス（停止用に保持） */
  private bgm: Phaser.Sound.BaseSound | null = null;

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
    this.escapedTotal = 0;
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
    this.currentCutIn = null;
    this.heroPaletteEntries = [];

    this.cameras.main.setBackgroundColor(0x0e1117);
    this.drawTiles();
    this.drawHud();
    this.bindInput();
    this.refreshSpeedButton();
    this.startBgm();
  }

  /**
   * SPEC-005 §5.4: 戦闘 BGM をループ再生する。
   * 多くのブラウザは「ユーザーがページに最初にインタラクトするまで」音を出せない仕様
   * なので、一度クリックされたタイミングでも再開できるよう shutdown / 再起動を扱う。
   */
  private startBgm(): void {
    if (this.bgm) {
      this.bgm.stop();
      this.bgm.destroy();
      this.bgm = null;
    }
    const key = SE_KEYS.bgmBattle();
    if (!this.cache.audio.exists(key)) return;
    try {
      this.bgm = this.sound.add(key, { loop: true, volume: 0.4 });
      const playWhenAllowed = () => {
        if (!this.bgm) return;
        try {
          this.bgm.play();
        } catch (_) {
          // 再生に失敗（autoplay block 等）。ユーザー操作後に再試行。
        }
      };
      playWhenAllowed();
      // 自動再生がブロックされた場合、最初の入力で再生開始
      if (this.bgm && !(this.bgm as Phaser.Sound.BaseSound & { isPlaying?: boolean }).isPlaying) {
        const onceListener = () => playWhenAllowed();
        this.input.once("pointerdown", onceListener);
      }
    } catch (_) {
      // 失敗時はミュートのまま継続
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.bgm?.stop();
      this.bgm?.destroy();
      this.bgm = null;
    });
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
          this.visualPattern(this.placement.hero),
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
            this.visualPattern(this.placement.hero),
            this.placement.tile,
            dir,
          );
          this.updateDirectionArrows(dir);
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
        if (hero) {
          // SPEC-005 §5.5: タップしたら必ず詳細パネルを開く（スキル発動はパネル内ボタン）
          this.playUiSe(SE_KEYS.uiTap());
          this.openStatusPanel(hero);
        }
      }
    });
  }

  // ========== 配置フロー ==========

  /**
   * SPEC-005 §5.2: path 職業は表示用パターンにも自タイル (0,0) を含める。
   */
  private visualPattern(hero: HeroDef): TilePos[] {
    const base = hero.attackPattern;
    if (!isPathClass(hero.class)) return base;
    if (base.some((p) => p.col === 0 && p.row === 0)) return base;
    return [...base, { col: 0, row: 0 }];
  }

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
    // SPEC-005 §5.6: 配置中はじっくり考えられるよう 0.1× に減速
    this.setPlacementSpeed(true);
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
      this.visualPattern(this.placement.hero),
      tile,
      direction,
    );

    // 配置可能マスのハイライトはこの段階では消す（向き選択に集中）
    for (const r of this.placement.highlightRects) r.destroy();
    this.placement.highlightRects = [];

    // SPEC-005 §5.6: 上下左右に向きチェブロンを表示
    const directionArrows = this.buildDirectionArrows(px.x, px.y, direction);

    this.placement = {
      kind: "orienting",
      hero: this.placement.hero,
      tile,
      direction,
      ghostSprite: this.placement.ghostSprite,
      rangeRects: this.placement.rangeRects,
      highlightRects: [],
      directionArrows,
    };
    this.statusText.setText(
      "上下左右の矢印が向きを示しています。カーソルで方向を変え、クリックで確定（右クリックでキャンセル）",
    );
  }

  private buildDirectionArrows(
    centerX: number,
    centerY: number,
    activeDir: Direction,
  ): Map<Direction, Phaser.GameObjects.Text> {
    const arrows = new Map<Direction, Phaser.GameObjects.Text>();
    const offset = TILE_SIZE * 0.5; // タイル端まで
    const placement: Record<Direction, [string, number, number]> = {
      up: ["▲", centerX, centerY - offset],
      down: ["▼", centerX, centerY + offset],
      left: ["◀", centerX - offset, centerY],
      right: ["▶", centerX + offset, centerY],
    };
    for (const dir of DIRECTIONS) {
      const [glyph, ax, ay] = placement[dir];
      const isActive = dir === activeDir;
      const arrow = this.add
        .text(ax, ay, glyph, {
          fontSize: "22px",
          color: isActive ? "#fde047" : "#9ca3af",
          fontStyle: "bold",
          stroke: "#0b0d12",
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(60);
      arrow.setScale(isActive ? 1.25 : 1.0);
      arrows.set(dir, arrow);
    }
    return arrows;
  }

  private updateDirectionArrows(activeDir: Direction): void {
    if (this.placement?.kind !== "orienting") return;
    for (const dir of DIRECTIONS) {
      const arrow = this.placement.directionArrows.get(dir);
      if (!arrow) continue;
      const isActive = dir === activeDir;
      arrow.setColor(isActive ? "#fde047" : "#9ca3af");
      arrow.setScale(isActive ? 1.25 : 1.0);
    }
  }

  private confirmOrientation(): void {
    if (this.placement?.kind !== "orienting") return;
    const { hero, tile, direction, ghostSprite, rangeRects, directionArrows } =
      this.placement;
    // SPEC-005 §5.6: 矢印 UI は確定で消す
    for (const arrow of directionArrows.values()) arrow.destroy();

    this.ce -= hero.cost;
    ghostSprite.setAlpha(1);
    ghostSprite.setDepth(20);
    for (const r of rangeRects) r.setAlpha(0.18);

    const px = tileToPixel(tile);
    const gaugeW = 40;
    const gaugeH = 4;
    const gaugeY = px.y - 32;
    const gaugeBg = this.add
      .rectangle(px.x, gaugeY, gaugeW, gaugeH, 0x111827, 0.9)
      .setDepth(33);
    const gaugeFill = this.add
      .rectangle(px.x - gaugeW / 2, gaugeY, 0, gaugeH, 0xfacc15)
      .setOrigin(0, 0.5)
      .setDepth(34);

    this.placedHeroes.push({
      def: hero,
      skill: findSkill(hero.id) ?? null,
      tile,
      direction,
      sprite: ghostSprite,
      rangeRects,
      lastAttackAt: this.elapsed,
      blockNum: 0,
      skillGauge: 0,
      readyRing: null,
      gaugeBg,
      gaugeFill,
      activeEffect: null,
      aura: null,
      debuffSnapshots: [],
    });

    this.placement = null;
    this.playUiSe(SE_KEYS.uiPlace());
    this.statusText.setText(
      `${CLASS_LABEL[hero.class]} ${hero.name} を ${direction} 向きで配置（block最大 ${blockMaxFor(hero.class)}）`,
    );
    this.refreshPaletteHighlight();
    // SPEC-005 §5.6: 配置完了で通常速度に戻す
    this.setPlacementSpeed(false);
  }

  private cancelPlacement(): void {
    if (!this.placement) return;
    this.placement.ghostSprite.destroy();
    for (const r of this.placement.rangeRects) r.destroy();
    for (const r of this.placement.highlightRects) r.destroy();
    if (this.placement.kind === "orienting") {
      for (const arrow of this.placement.directionArrows.values()) {
        arrow.destroy();
      }
    }
    this.placement = null;
    this.statusText.setText(
      "ヒーローを選んで配置可能タイルをクリック → 向きを決めて再クリック",
    );
    this.refreshPaletteHighlight();
    // SPEC-005 §5.6: 配置キャンセルで通常速度に戻す
    this.setPlacementSpeed(false);
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
    // デバフを巻き戻す
    this.revertDebuffs(hero);
    const refund = Math.ceil(hero.def.cost / 2);
    this.ce = Math.min(this.maxCe, this.ce + refund);
    hero.sprite.destroy();
    for (const r of hero.rangeRects) r.destroy();
    hero.gaugeBg.destroy();
    hero.gaugeFill.destroy();
    hero.readyRing?.destroy();
    hero.aura?.destroy();
    this.placedHeroes.splice(idx, 1);
    this.statusText.setText(`${hero.def.name} を売却（+${refund} CE）`);
  }

  private revertDebuffs(hero: PlacedHero): void {
    for (const snap of hero.debuffSnapshots) {
      if (snap.enemy.hp <= 0 || snap.enemy.goalReached) continue;
      snap.enemy.phyDefMul = snap.origPhyDef;
      snap.enemy.intDefMul = snap.origIntDef;
    }
    hero.debuffSnapshots = [];
  }

  // ========== スキル ==========

  private tryActivateSkill(hero: PlacedHero): boolean {
    if (this.gameOver) return false;
    if (!hero.skill) return false;
    if (!canActivate(hero.skillGauge)) return false;

    const skill = hero.skill;
    hero.skillGauge = 0;
    hero.activeEffect = startEffect(skill, this.elapsed);
    this.applySkillStart(hero);
    this.playCutIn(hero);
    this.playSe(skill.seCategory);
    this.statusText.setText(`スキル発動: ${skill.name}（${hero.def.name}）`);
    return true;
  }

  private applySkillStart(hero: PlacedHero): void {
    if (!hero.skill || !hero.activeEffect) return;
    const skill = hero.skill;

    // オーラ表示（持続効果のみ）
    if (skill.effectType !== "singleStrike") {
      hero.aura?.destroy();
      const aura = this.add.circle(
        hero.sprite.x,
        hero.sprite.y,
        TILE_SIZE * 0.7,
        CLASS_AURA_COLOR[hero.def.class],
        0.18,
      );
      aura.setStrokeStyle(2, CLASS_AURA_COLOR[hero.def.class], 0.6);
      aura.setDepth(15);
      hero.aura = aura;
    }

    switch (skill.effectType) {
      case "damageMultiplier":
      case "agiBuff":
        // 効果は activeEffect 経由で参照される。追加処理なし。
        break;
      case "enemyDefDebuff": {
        const targets = this.findAllEnemiesInPattern(hero);
        for (const e of targets) {
          hero.debuffSnapshots.push({
            enemy: e,
            origPhyDef: e.phyDefMul,
            origIntDef: e.intDefMul,
          });
          e.phyDefMul *= skill.value;
          e.intDefMul *= skill.value;
        }
        break;
      }
      case "singleStrike": {
        const target = this.findTargetByRouteProgress(hero);
        if (target) {
          this.fireBullet(hero, target, skill.value);
        }
        break;
      }
    }
  }

  private endSkillEffect(hero: PlacedHero): void {
    hero.aura?.destroy();
    hero.aura = null;
    this.revertDebuffs(hero);
    hero.activeEffect = null;
  }

  /**
   * SPEC-005 §5.3 カットイン演出（MCH パッシブスキル風）。
   *
   * 元の MCH 演出は CSS の `transform: skewY(-10deg)` で平行四辺形バンドを作り、
   * `linear-gradient(to right bottom, #609da8 50%, #282b33 50%)` で 2 色対角分割し、
   * 右からスライドイン → ホールド → 左へスライドアウトする。
   * Phaser には skew が無いので、コンテナを `setAngle(-10)` で代用しつつ、
   * 背景は Graphics で 2 色の三角形を重ねて分割を表現する。
   * シャインは alpha 0.3 ↔ 0.8 を 0.5 秒で yoyo して再現する。
   */
  private playCutIn(hero: PlacedHero): void {
    if (!hero.skill) return;
    if (this.currentCutIn) {
      this.currentCutIn.destroy(true);
      this.currentCutIn = null;
    }

    const stageW = this.stageWidth;
    const stageH = this.stageHeight;
    const cx = stageW / 2;
    const cy = stageH / 2;
    // バンドはステージ幅より広く、左右にはみ出るサイズで作る（スライド時の見切れ防止）
    const bandW = stageW * 1.4;
    const bandH = 120;

    // ── 背景バンド（2 色対角分割）
    // ally 色: 青系 / opponent 色: 赤系。マイクリでは「自分のヒーロー＝ally」で青系。
    // ここではプレイヤーのヒーロー＝ ally として固定。
    const LIGHT = 0x609da8;
    const DARK = 0x282b33;
    const SHINE = 0x05599a; // shine animation の上塗り色

    const bg = this.add.graphics();
    bg.fillStyle(DARK, 1);
    bg.fillRect(-bandW / 2, -bandH / 2, bandW, bandH);
    // 左下三角形（top-left → top-right → bottom-left の領域 = "to right bottom" の前半 50%）
    bg.fillStyle(LIGHT, 1);
    bg.fillTriangle(
      -bandW / 2,
      -bandH / 2,
      bandW / 2,
      -bandH / 2,
      -bandW / 2,
      bandH / 2,
    );

    // ── シャイン（薄いブルーが点滅して動感を出す）
    const shine = this.add.graphics();
    shine.fillStyle(SHINE, 0.5);
    shine.fillRect(-bandW / 2, -bandH / 2, bandW, bandH);
    shine.setAlpha(0.3);

    // ── 三角形の装飾片（mix-blend-mode:color-dodge の代わりに加算ぽい色で 2 個だけ置く）
    const tri1 = this.add.graphics();
    tri1.fillStyle(0x80c8d8, 0.8);
    tri1.fillTriangle(-bandW * 0.25, 0, -bandW * 0.18, -bandH / 2, -bandW * 0.32, -bandH / 2);
    const tri2 = this.add.graphics();
    tri2.fillStyle(0x80c8d8, 0.6);
    tri2.fillTriangle(bandW * 0.18, 0, bandW * 0.28, bandH / 2, bandW * 0.10, bandH / 2);

    // ── ヒーロー portrait（image-rendering: pixelated を効かすため scale を整数で）
    // CSS は max-width 128px / scale(2) なので実効 256px。Phaser 側では 96 にしておく。
    const portraitX = -bandW * 0.32;
    const portrait = this.add
      .sprite(portraitX, 0, TEXTURE_KEYS.hero(hero.def.id))
      .setDisplaySize(96, 96);

    // ── スキル名 + ヒーロー名
    const skillName = this.add
      .text(bandW * 0.05, -14, hero.skill.name, {
        fontSize: "30px",
        color: "#fde68a",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    const heroName = this.add
      .text(bandW * 0.05, 22, `${CLASS_LABEL[hero.def.class]}・${hero.def.name}`, {
        fontSize: "14px",
        color: "#e5e7eb",
      })
      .setOrigin(0.5);

    // ── コンテナにまとめて、中心へ配置 + 10° 回転（skewY 代用）
    const container = this.add.container(cx, cy, [
      bg,
      shine,
      tri1,
      tri2,
      portrait,
      skillName,
      heroName,
    ]);
    container.setAngle(-10);
    container.setDepth(95);

    // 初期位置: 右側からスライドイン
    container.x = cx + stageW;
    this.currentCutIn = container;

    // シャイン点滅（持続中ずっと動かす）
    const shineTween = this.tweens.add({
      targets: shine,
      alpha: { from: 0.3, to: 0.85 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // スライドイン → ホールド → スライドアウト の 3 段
    this.tweens.add({
      targets: container,
      x: cx,
      duration: 220,
      ease: "Sine.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: container,
          x: cx,
          duration: 600,
          onComplete: () => {
            this.tweens.add({
              targets: container,
              x: cx - stageW,
              duration: 220,
              ease: "Sine.easeIn",
              onComplete: () => {
                shineTween.stop();
                if (this.currentCutIn === container) this.currentCutIn = null;
                container.destroy(true);
              },
            });
          },
        });
      },
    });
  }

  private playSe(category: string): void {
    const key = SE_KEYS.category(category as Parameters<typeof SE_KEYS.category>[0]);
    if (!this.cache.audio.exists(key)) return;
    try {
      this.sound.play(key, { volume: 0.6 });
    } catch (_) {
      // 音声再生に失敗しても続行
    }
  }

  /** SPEC-005 §5.5: UI 系 SE（タップ／配置／攻撃）の汎用再生 */
  private playUiSe(key: string, volume = 0.6): void {
    if (!this.cache.audio.exists(key)) return;
    try {
      this.sound.play(key, { volume });
    } catch (_) {
      // 音声再生に失敗しても続行
    }
  }

  private findAllEnemiesInPattern(hero: PlacedHero): ActiveEnemy[] {
    const tiles = this.effectiveAttackTiles(hero);
    return this.enemies.filter((e) => {
      const eTile = pixelToTile(e.sprite.x, e.sprite.y, this.map.cols, this.map.rows);
      if (!eTile) return false;
      return tiles.some((t) => tileEquals(t, eTile));
    });
  }

  // ========== ヒーロー詳細パネル ==========

  /**
   * SPEC-005 §5.5 仕様変更:
   * - 半透明オーバーレイで背景バトル画面が透けて見える
   * - パネル表示中はゲームを 0.1× 速度で進行（完全停止ではない）
   * - スキル発動ボタンを内蔵し、ゲージ満タン時にのみ押下可能
   * - 発動後はパネルを閉じてカットイン → スキル開始へ
   */
  private openStatusPanel(hero: PlacedHero): void {
    if (this.statusPanel) return;
    this.statusPanelHeroId = hero.def.id;

    const cx = this.stageWidth / 2;
    const cy = this.stageHeight / 2;

    // 半透明オーバーレイ（背景バトルが見える程度の透過に下げる）
    const overlay = this.add.rectangle(
      cx,
      cy,
      this.stageWidth,
      this.stageHeight,
      0x000000,
      0.45,
    );
    overlay.setInteractive({ useHandCursor: true });

    // 大きめのパネル（420×340）
    const panel = this.add.rectangle(cx, cy, 460, 360, 0x111827, 0.92);
    panel.setStrokeStyle(2, 0x4b5563);

    const title = this.add
      .text(cx, cy - 150, `[${CLASS_LABEL[hero.def.class]}] ${hero.def.name}`, {
        fontSize: "20px",
        color: "#f9fafb",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const portrait = this.add
      .sprite(cx - 175, cy - 60, TEXTURE_KEYS.hero(hero.def.id))
      .setDisplaySize(96, 96);

    const interval = (1 / Math.max(0.1, hero.def.agi / 100)).toFixed(2);
    const tilesCount = hero.def.attackPattern.length;
    const statLines = [
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
      .text(cx - 100, cy - 110, statLines.join("\n"), {
        fontSize: "13px",
        color: "#e5e7eb",
        lineSpacing: 4,
      })
      .setOrigin(0, 0);

    // ── スキル情報セクション
    const skillTitle = this.add
      .text(cx - 200, cy + 36, "[ スキル ]", {
        fontSize: "13px",
        color: "#fcd34d",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    const skillName = hero.skill
      ? this.add
          .text(cx - 200, cy + 56, hero.skill.name, {
            fontSize: "16px",
            color: "#fde68a",
            fontStyle: "bold",
          })
          .setOrigin(0, 0)
      : this.add
          .text(cx - 200, cy + 56, "（スキル無し）", {
            fontSize: "13px",
            color: "#9ca3af",
          })
          .setOrigin(0, 0);

    const skillDesc = hero.skill
      ? this.add
          .text(cx - 200, cy + 80, hero.skill.description, {
            fontSize: "12px",
            color: "#cbd5e1",
            wordWrap: { width: 400 },
          })
          .setOrigin(0, 0)
      : null;

    // ── ゲージ表示
    const gaugeBgX = cx - 200;
    const gaugeY = cy + 116;
    const gaugeW = 240;
    const gaugeH = 8;
    const panelGaugeBg = this.add
      .rectangle(gaugeBgX, gaugeY, gaugeW, gaugeH, 0x1f2937, 1)
      .setOrigin(0, 0.5);
    const fillW = gaugeW * (hero.skillGauge / GAUGE_MAX);
    const panelGaugeFill = this.add
      .rectangle(gaugeBgX, gaugeY, fillW, gaugeH, 0xfacc15)
      .setOrigin(0, 0.5);
    const gaugeLabel = this.add
      .text(gaugeBgX + gaugeW + 8, gaugeY, `${Math.floor(hero.skillGauge)}/${GAUGE_MAX}`, {
        fontSize: "11px",
        color: "#bae6fd",
      })
      .setOrigin(0, 0.5);

    // ── スキル発動ボタン
    const ready = canActivate(hero.skillGauge) && hero.skill !== null;
    const activateBtnBg = this.add.rectangle(
      cx + 105,
      cy + 56,
      120,
      36,
      ready ? 0xfacc15 : 0x374151,
      0.95,
    );
    activateBtnBg.setStrokeStyle(2, ready ? 0xfde047 : 0x6b7280);
    if (ready) activateBtnBg.setInteractive({ useHandCursor: true });
    const activateBtnText = this.add
      .text(cx + 105, cy + 56, ready ? "▶ 発動" : "ゲージ不足", {
        fontSize: "14px",
        color: ready ? "#1f2937" : "#9ca3af",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    if (ready) {
      activateBtnBg.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (pointer.rightButtonDown()) return;
        this.activateSkillFromPanel(hero);
      });
    }

    // ── 閉じるボタン
    const closeBtn = this.add
      .text(cx, cy + 150, "[ 閉じる ]", {
        fontSize: "14px",
        color: "#93c5fd",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    closeBtn.on("pointerdown", () => this.closeStatusPanel());
    overlay.on("pointerdown", () => this.closeStatusPanel());

    const items: Phaser.GameObjects.GameObject[] = [
      overlay,
      panel,
      title,
      portrait,
      stats,
      skillTitle,
      skillName,
      panelGaugeBg,
      panelGaugeFill,
      gaugeLabel,
      activateBtnBg,
      activateBtnText,
      closeBtn,
    ];
    if (skillDesc) items.splice(7, 0, skillDesc);
    this.statusPanel = this.add.container(0, 0, items);
    this.statusPanel.setDepth(100);

    for (const r of hero.rangeRects) r.setAlpha(0.35);
    this.playSpeed = 0.1;
    this.refreshSpeedButton();
  }

  /** SPEC-005 §5.5: パネル経由でスキル発動 → パネル閉じてカットイン */
  private activateSkillFromPanel(hero: PlacedHero): void {
    this.closeStatusPanel();
    this.tryActivateSkill(hero);
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
    if (this.placement) return; // SPEC-005 §5.6: 配置中は 0.1× 固定なのでトグル無効
    this.playSpeedToggle = this.playSpeedToggle === 1.0 ? 2.0 : 1.0;
    this.playSpeed = this.playSpeedToggle;
    this.refreshSpeedButton();
  }

  /**
   * SPEC-005 §5.6: 配置フェーズに入ったら 0.1× に減速、抜けたらユーザー設定速度
   * （playSpeedToggle）に戻す。ステータスパネル表示中は触らない（パネル側が
   * すでに 0.1× にしている）。
   */
  private setPlacementSpeed(active: boolean): void {
    if (this.statusPanel) return;
    this.playSpeed = active ? 0.1 : this.playSpeedToggle;
    this.refreshSpeedButton();
  }

  private refreshSpeedButton(): void {
    this.speedButtonText.setText(`${this.playSpeed.toFixed(1)}×`);
  }

  // ========== ループ ==========

  update(time: number, delta: number): void {
    if (this.gameOver) return;
    const dt = (delta / 1000) * this.playSpeed;
    this.elapsed += dt;

    this.tickCe(dt);
    this.tickWave();
    this.tickEnemies(dt);
    this.tickHeroAttacks();
    this.tickBullets(dt);
    this.tickSkills(dt);
    this.tickPlacementUI(time);
    this.refreshHud();
    this.checkEndCondition();
  }

  /**
   * SPEC-005 §5.6: 配置中の向き矢印 UI のパルスを担当する。
   * playSpeed=0.1× でもアニメは止まらないよう、Phaser の渡してくる real time
   * （ms）を使う。
   */
  private tickPlacementUI(realTimeMs: number): void {
    if (this.placement?.kind !== "orienting") return;
    const t = realTimeMs / 1000;
    const pulse = 0.7 + 0.3 * Math.abs(Math.sin(t * 5));
    for (const dir of DIRECTIONS) {
      const arrow = this.placement.directionArrows.get(dir);
      if (!arrow) continue;
      arrow.setAlpha(dir === this.placement.direction ? pulse : 0.55);
    }
  }

  private tickSkills(dt: number): void {
    for (const hero of this.placedHeroes) {
      // ゲージ蓄積
      hero.skillGauge = tickGauge(hero.skillGauge, dt);

      // ゲージ UI 位置同期
      hero.gaugeBg.x = hero.sprite.x;
      hero.gaugeBg.y = hero.sprite.y - 32;
      hero.gaugeFill.x = hero.sprite.x - 20;
      hero.gaugeFill.y = hero.sprite.y - 32;
      hero.gaugeFill.displayWidth = 40 * (hero.skillGauge / GAUGE_MAX);

      // 満タンリング
      const ready = canActivate(hero.skillGauge);
      if (ready && !hero.readyRing) {
        hero.readyRing = this.add
          .circle(hero.sprite.x, hero.sprite.y, TILE_SIZE * 0.45, 0xfde047, 0)
          .setStrokeStyle(2, 0xfde047, 0.9)
          .setDepth(22);
      } else if (!ready && hero.readyRing) {
        hero.readyRing.destroy();
        hero.readyRing = null;
      }
      if (hero.readyRing) {
        hero.readyRing.x = hero.sprite.x;
        hero.readyRing.y = hero.sprite.y;
        hero.readyRing.setStrokeStyle(2, 0xfde047, 0.6 + 0.4 * Math.abs(Math.sin(this.elapsed * 4)));
      }

      // 効果オーラ位置同期
      if (hero.aura) {
        hero.aura.x = hero.sprite.x;
        hero.aura.y = hero.sprite.y;
      }

      // 効果期限切れ処理
      if (hero.activeEffect && !isEffectActive(hero.activeEffect, this.elapsed)) {
        // singleStrike は startEffect 直後から isEffectActive=false なので、この分岐は
        // 持続効果と singleStrike 後始末の両方で機能する
        this.endSkillEffect(hero);
      }
    }
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
      phyDefMul: 1,
      intDefMul: 1,
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
    if (enemy.goalReached) return; // 二重カウント防止
    enemy.goalReached = true;
    this.escapedTotal += 1;
    this.baseHp = Math.max(0, this.baseHp - 1);
  }

  private tickHeroAttacks(): void {
    for (const hero of this.placedHeroes) {
      const baseInterval = 1 / Math.max(0.1, hero.def.agi / 100);
      const interval =
        baseInterval * intervalScale(hero.activeEffect, this.elapsed);
      if (this.elapsed - hero.lastAttackAt < interval) continue;
      const target = this.findTargetByRouteProgress(hero);
      if (!target) continue;
      hero.lastAttackAt = this.elapsed;
      this.fireBullet(hero, target);
      hero.skillGauge = gainOnAttack(hero.skillGauge);
    }
  }

  /**
   * SPEC-005 §5.2: path 職業は自身のタイルも攻撃範囲に含める。
   */
  private effectiveAttackTiles(hero: PlacedHero): TilePos[] {
    const tiles = applyPatternToTile(
      hero.tile,
      rotatePattern(hero.def.attackPattern, hero.direction),
    );
    if (isPathClass(hero.def.class)) {
      // 自タイルが既にパターンに含まれていない場合のみ追加
      if (!tiles.some((t) => tileEquals(t, hero.tile))) {
        tiles.push({ col: hero.tile.col, row: hero.tile.row });
      }
    }
    return tiles;
  }

  /**
   * SPEC-003 §5.7: 攻撃範囲タイルに重なる敵から
   *   1. ルート進行度が最大
   *   2. ゴールまでの距離が最小
   *   3. 配列順
   * の順で 1 体選ぶ。
   */
  private findTargetByRouteProgress(hero: PlacedHero): ActiveEnemy | null {
    const tiles = this.effectiveAttackTiles(hero);
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

  private fireBullet(
    hero: PlacedHero,
    target: ActiveEnemy,
    overrideDamageRate?: number,
  ): void {
    const damageRate =
      overrideDamageRate ??
      effectiveDamageRate(hero.activeEffect, this.elapsed);
    const damage = calculateDamage({
      attackType: hero.def.attackType,
      heroPhy: hero.def.phy,
      heroInt: hero.def.int,
      enemyPhyDef: target.def.phyDef * target.phyDefMul,
      enemyIntDef: target.def.intDef * target.intDefMul,
      damageRate,
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

    // SPEC-005 §5.5: 道職業（前衛系）が攻撃したときに swipe SE。
    // 連発を避けるため volume はやや控えめ。
    if (isPathClass(hero.def.class)) {
      this.playUiSe(SE_KEYS.attackSwipe(), 0.35);
    }
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
    // SPEC-005 §5.1 のバグ修正: 旧実装は `goalReached` を持つ enemies を即時 filter で
    // 取り除いてから数えていたため、ゴール到達の累計を取り損ねていた。永続カウンタの
    // `escapedTotal` を使うことでブロックして全敵を撃破した時もクリア判定が出る。
    if (
      this.spawnedTotal >= this.totalToDefeat &&
      this.defeatedTotal + this.escapedTotal >= this.totalToDefeat
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
