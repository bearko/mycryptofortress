import Phaser from "phaser";
import { HEROES, findHero } from "../game/heroData";
import { findEnemy } from "../game/enemyData";
import {
  STAGE1_MAP,
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
import {
  ALL_WORLDS,
  DEFAULT_STAGE_ID,
  findStage,
  type StageDef,
} from "../game/stages";
import { getPartyHeroIds, markStageCleared } from "../game/progress";
import type {
  EnemyDef,
  HeroClass,
  HeroDef,
  MapDef,
  MapTileType,
  RouteDef,
  SpawnPattern,
  TilePos,
} from "../game/types";
import { calculateDamage, calculateHeal } from "../game/damage";
import { POISON_DAMAGE_PER_SEC, TILE_INFO } from "../game/tileInfo";
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
import { onResize } from "./layout";
import {
  CLASS_COLORS,
  TILE_COLORS,
  hex2css,
  setTheme,
  textStyle,
  theme,
} from "../ui/tokens";
import { makeClassIcon } from "../ui/icons";
import { Bar, Btn, KPI } from "../ui/components";

// SPEC-024 / SPEC-026: KPI 値 (20px) と Bar (6px) が縦衝突しないよう HUD_HEIGHT
// を 144 → 156 に拡張。bar / palette / status text もこれに合わせて下げる。
const HUD_HEIGHT = 156;
/** SPEC-006 §5.5: Arknights 風サイドパネル領域。ステージ右に常駐。 */
const PANEL_SLOT_WIDTH = 280;

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
  A: theme.accent.warn,
  B: theme.accent.primary,
};

/**
 * SPEC-010 §5.2 / SPEC-018: タイル種別ごとの描画色は ui/tokens.ts に集約。
 * 旧トーンの茶系 path / 紫系 poison から、design hand-off の Tactical 配色に切替。
 */
const TILE_VISUAL: Record<MapTileType, { fill: number; stroke: number }> = {
  path: { fill: TILE_COLORS.path.fill, stroke: TILE_COLORS.path.line },
  wall: { fill: TILE_COLORS.wall.fill, stroke: TILE_COLORS.wall.line },
  obstacle: {
    fill: TILE_COLORS.obstacle.fill,
    stroke: TILE_COLORS.obstacle.line,
  },
  poison: { fill: TILE_COLORS.poison.fill, stroke: TILE_COLORS.poison.line },
  path_blocked: {
    fill: TILE_COLORS.path_blocked.fill,
    stroke: TILE_COLORS.path_blocked.line,
  },
};

/**
 * SPEC-004 §5.6 / SPEC-018: 職業ごとのカットイン / オーラ色は ui/tokens の
 * CLASS_COLORS から派生。デザインの 8 色相と統一される。
 */
const CLASS_AURA_COLOR: Record<HeroClass, number> = {
  defender: CLASS_COLORS.defender.hex,
  guard: CLASS_COLORS.guard.hex,
  vanguard: CLASS_COLORS.vanguard.hex,
  specialist: CLASS_COLORS.specialist.hex,
  sniper: CLASS_COLORS.sniper.hex,
  caster: CLASS_COLORS.caster.hex,
  medic: CLASS_COLORS.medic.hex,
  supporter: CLASS_COLORS.supporter.hex,
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
  /** SPEC-008 §5.1: 現在 HP / 最大 HP（敵の攻撃で減る） */
  currentHp: number;
  maxHp: number;
  /** HP バー（currentHp < maxHp で表示） */
  hpBar: Phaser.GameObjects.Rectangle;
  hpBarBg: Phaser.GameObjects.Rectangle;
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
  /** SPEC-008 §5.2: 直近の攻撃時刻（攻撃間隔判定用） */
  lastAttackAt: number;
}

interface ActiveBullet {
  sprite: Phaser.GameObjects.Arc;
  target: ActiveEnemy;
  damage: number;
  speed: number;
  done: boolean;
}

/** SPEC-008 §5.3: 敵 → ヒーローの弾。Unity 版 EnemyBullet.cs の port。 */
interface EnemyBullet {
  sprite: Phaser.GameObjects.Arc;
  target: PlacedHero;
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
  /** SPEC-006 §5.6: カーソル直下のタイルに重ねるスナップ表示 */
  snapRect: Phaser.GameObjects.Rectangle;
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
  /** SPEC-011: 現在実行中のステージ（init で設定） */
  private currentStage: StageDef | null = null;
  private currentStageId = DEFAULT_STAGE_ID;
  /** SPEC-015: パレットに表示するヒーロー（progress.ts のパーティ） */
  private partyHeroes: HeroDef[] = [];
  /** プレイ領域（タイル群）の幅。サイドパネルは含まない */
  private stageWidth = 0;
  private stageHeight = 0;
  /** Canvas 全体の幅（stageWidth + PANEL_SLOT_WIDTH） */
  private canvasWidth = 0;
  /** サイドパネルスロットの左端 x */
  private panelSlotX = 0;

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
  /** SPEC-008 §5.3: 敵から発射された弾（heroes 狙い） */
  private enemyBullets: EnemyBullet[] = [];

  /** 既に経路アニメを再生済みの routeId の集合 */
  private routesAnimated = new Set<string>();

  private playSpeed = 1.0;
  private playSpeedToggle: 1.0 | 2.0 = 1.0;
  /** SPEC-007 §5.1: ユーザーによる明示的な一時停止 */
  private paused = false;

  /**
   * SPEC-025: マップ / 配置ヒーロー / 敵 / 弾など world 系オブジェクトを
   * 集約する Container。orientation に合わせて position と scale を変える
   * ことで、縦画面でもタイル座標 (TILE_SIZE=64) のまま画面幅にフィットさせる。
   */
  private worldRoot!: Phaser.GameObjects.Container;

  /** SPEC-020: HUD は KPI/Bar ヘルパで構成。下記は更新参照のために保持 */
  private hpBar!: Bar;
  private hpKPI!: KPI;
  private ceKPI!: KPI;
  private ceBar!: Bar;
  private timeKPI!: KPI;
  private pauseBtn!: Btn;
  private speedBtn!: Btn;
  private statusText!: Phaser.GameObjects.Text;
  private heroPaletteEntries: {
    hero: HeroDef;
    container: Phaser.GameObjects.Container;
    border: Phaser.GameObjects.Rectangle;
    statusLabel: Phaser.GameObjects.Text;
  }[] = [];

  /** パネルスロット内の常駐 placeholder（ヒーロー未選択時に表示） */
  private panelPlaceholder: Phaser.GameObjects.Text | null = null;

  private statusPanel: Phaser.GameObjects.Container | null = null;
  private statusPanelHeroId: number | null = null;

  private endOverlay: Phaser.GameObjects.Container | null = null;
  private gameOver = false;

  /** 表示中のカットイン（同時 1 個だけ） */
  private currentCutIn: Phaser.GameObjects.Container | null = null;

  /** SPEC-010 §5.4: 表示中のタイルヘルプツールチップ（同時 1 個） */
  private currentTileHelp: Phaser.GameObjects.Container | null = null;

  /** SPEC-005 §5.4: 戦闘 BGM の再生インスタンス（停止用に保持） */
  private bgm: Phaser.Sound.BaseSound | null = null;

  constructor() {
    super("StageScene");
  }

  init(data: { stageId?: string }): void {
    if (data?.stageId) this.currentStageId = data.stageId;
  }

  create(): void {
    // SPEC-011: stages.ts から現在ステージを取得。見つからなければデフォルトに fallback
    const stage = findStage(this.currentStageId);
    if (!stage) {
      // eslint-disable-next-line no-console
      console.warn(`[StageScene] stage not found: ${this.currentStageId}, fall back to default`);
      this.currentStageId = DEFAULT_STAGE_ID;
    }
    this.currentStage = findStage(this.currentStageId) ?? null;
    // SPEC-019: 出撃先のワールドに紐づくテーマを適用
    if (this.currentStage) {
      const w = ALL_WORLDS.find((wd) => wd.id === this.currentStage!.worldId);
      if (w?.themeId) setTheme(w.themeId);
    }
    this.map = this.currentStage?.map ?? STAGE1_MAP;
    const wave = this.currentStage?.wave ?? { patterns: [] };

    // SPEC-015: パーティを progress.ts からロード
    this.partyHeroes = getPartyHeroIds()
      .map((id) => findHero(id))
      .filter((h): h is HeroDef => !!h);
    if (this.partyHeroes.length === 0) {
      this.partyHeroes = HEROES.slice(0, 8);
    }

    this.stageWidth = this.map.cols * TILE_SIZE;
    this.stageHeight = this.map.rows * TILE_SIZE;
    this.canvasWidth = this.stageWidth + PANEL_SLOT_WIDTH;
    this.panelSlotX = this.stageWidth;
    void this.canvasWidth;

    this.baseHp = this.currentStage?.baseHp ?? 5;
    this.maxBaseHp = this.baseHp;
    this.ce = this.currentStage?.startingCe ?? 30;
    this.ceProgress = 0;
    this.elapsed = 0;
    this.spawnedTotal = 0;
    this.defeatedTotal = 0;
    this.escapedTotal = 0;
    this.totalToDefeat = wave.patterns.length;
    this.waveQueue = [...wave.patterns];
    this.placement = null;
    this.placedHeroes = [];
    this.enemies = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.routesAnimated = new Set();
    this.playSpeed = 1.0;
    this.playSpeedToggle = 1.0;
    this.paused = false;
    this.statusPanel = null;
    this.statusPanelHeroId = null;
    this.endOverlay = null;
    this.gameOver = false;
    this.currentCutIn = null;
    this.currentTileHelp = null;
    this.heroPaletteEntries = [];
    this.panelPlaceholder = null;

    this.cameras.main.setBackgroundColor(theme.bg.base);
    // SPEC-025: world 系オブジェクトを集約する container を先に作る。
    // worldRoot に reparent された GameObject は worldRoot.scale * worldRoot.x/y
    // のオフセットで描画される。drawTiles 等が `addWorld` ヘルパで自動で
    // ここに登録する。
    this.worldRoot = this.add.container(0, 0);

    this.drawTiles();
    if (this.isPortrait()) {
      this.drawPortraitHud();
    } else {
      this.drawHud();
      this.drawPanelSlot();
    }
    this.bindInput();
    this.refreshSpeedButton();
    this.startBgm();

    // SPEC-025: 縦画面なら worldRoot をマップ領域にスケール + 配置。
    // 横画面なら既存の design 全体をカメラズームでフィット。
    this.applyResponsiveLayout();
    onResize(this, () => this.applyResponsiveLayout());
  }

  /**
   * SPEC-025: 横画面 / 縦画面 で worldRoot と camera を切り替える。
   *
   * 横画面: design 全体 (920×656) をカメラズームでビューポートにフィット。
   *         worldRoot は (0,0) 原点・等倍。
   * 縦画面: カメラはズーム 1。worldRoot を HUD バーの下に配置し、
   *         scale で画面幅にフィット。HUD と palette は drawHud / drawPanelSlot
   *         が portrait モード対応で配置済み。
   */
  private applyResponsiveLayout(): void {
    const vpW = this.scale.width;
    const vpH = this.scale.height;
    if (vpW <= 0 || vpH <= 0) return;
    const isPortrait = vpH > vpW;
    const cam = this.cameras.main;

    if (!isPortrait) {
      const designW = this.canvasWidth || this.stageWidth + PANEL_SLOT_WIDTH;
      const designH = this.stageHeight + HUD_HEIGHT;
      this.worldRoot.setPosition(0, 0);
      this.worldRoot.setScale(1);
      const zoom = Math.min(vpW / designW, vpH / designH);
      cam.setZoom(zoom);
      cam.centerOn(designW / 2, designH / 2);
      return;
    }

    cam.setZoom(1);
    cam.centerOn(vpW / 2, vpH / 2);

    const layout = this.computePortraitLayout();
    this.worldRoot.setPosition(layout.mapX, layout.mapY);
    this.worldRoot.setScale(layout.scale);
  }

  /** 縦画面のレイアウト境界。drawHud / drawPanelSlot がこの値を共有する。 */
  private computePortraitLayout(): {
    hudH: number;
    mapX: number;
    mapY: number;
    mapW: number;
    mapH: number;
    scale: number;
    detailY: number;
    detailH: number;
    paletteY: number;
    paletteH: number;
  } {
    const vpW = this.scale.width;
    const vpH = this.scale.height;
    const hudH = 92;
    const margin = 8;
    const detailH = 36;
    const availW = vpW - margin * 2;
    const scale = availW / this.stageWidth;
    const mapW = this.stageWidth * scale;
    const mapH = this.stageHeight * scale;
    const mapX = (vpW - mapW) / 2;
    const mapY = hudH;
    const detailY = mapY + mapH + 4;
    // SPEC-025: パレットは詳細ストリップ直下に配置し、残り高さを使う
    const paletteY = detailY + detailH + 4;
    const paletteH = Math.max(120, vpH - paletteY - 8);
    return {
      hudH,
      mapX,
      mapY,
      mapW,
      mapH,
      scale,
      detailY,
      detailH,
      paletteY,
      paletteH,
    };
  }

  private isPortrait(): boolean {
    return this.scale.height > this.scale.width;
  }

  /** screen pointer を worldRoot の local 座標 (= タイル空間) に変換 */
  private screenToWorld(p: Phaser.Input.Pointer): { x: number; y: number } {
    return {
      x: (p.worldX - this.worldRoot.x) / this.worldRoot.scaleX,
      y: (p.worldY - this.worldRoot.y) / this.worldRoot.scaleY,
    };
  }

  /** GameObject を worldRoot に reparent するヘルパ */
  private addWorld<T extends Phaser.GameObjects.GameObject>(go: T): T {
    this.worldRoot.add(go);
    return go;
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
        const { fill, stroke } = TILE_VISUAL[kind];
        const rect = this.addWorld(
          this.add.rectangle(cx, cy, TILE_SIZE - 2, TILE_SIZE - 2, fill, 1),
        );
        rect.setStrokeStyle(1, stroke);

        if (kind === "wall") {
          this.addWorld(
            this.add
              .rectangle(cx - 14, cy - 14, 4, 4, theme.ink.tertiary, 0.6)
              .setDepth(2),
          );
          this.addWorld(
            this.add
              .rectangle(cx + 14, cy + 12, 4, 4, theme.ink.tertiary, 0.6)
              .setDepth(2),
          );
        }
        if (kind === "poison") {
          this.addWorld(
            this.add.circle(cx - 12, cy - 10, 4, 0xc084fc, 0.85).setDepth(2),
          );
          this.addWorld(
            this.add.circle(cx + 10, cy + 8, 5, 0xa855f7, 0.85).setDepth(2),
          );
          this.addWorld(
            this.add.circle(cx - 6, cy + 14, 3, 0xd8b4fe, 0.85).setDepth(2),
          );
        }
        if (kind === "path_blocked") {
          const lineColor = 0xfb7185;
          this.addWorld(
            this.add
              .line(cx, cy, -16, -16, 16, 16, lineColor, 0.7)
              .setLineWidth(2)
              .setDepth(2),
          );
          this.addWorld(
            this.add
              .line(cx, cy, -16, 16, 16, -16, lineColor, 0.7)
              .setLineWidth(2)
              .setDepth(2),
          );
        }
      }
    }

    // ルート IN/OUT マーカー
    for (const route of this.map.routes) {
      const start = tileToPixel(route.points[0]);
      const goal = tileToPixel(route.points[route.points.length - 1]);
      const color = ROUTE_COLOR[route.id] ?? 0xffffff;
      this.addWorld(
        this.add
          .text(start.x, start.y - 22, `IN ${route.id}`, {
            fontSize: "14px",
            color: hex2css(theme.accent.success),
            fontStyle: "bold",
          })
          .setOrigin(0.5),
      );
      this.addWorld(
        this.add
          .text(goal.x, goal.y - 22, `OUT ${route.id}`, {
            fontSize: "14px",
            color: hex2css(theme.accent.warn),
            fontStyle: "bold",
          })
          .setOrigin(0.5),
      );
      this.addWorld(
        this.add.circle(start.x, start.y, 5, color, 0.8).setDepth(3),
      );
      this.addWorld(
        this.add.circle(goal.x, goal.y, 5, color, 0.8).setDepth(3),
      );
    }
  }

  private drawHud(): void {
    const hudY = this.stageHeight;

    // 背景（左側のステージ幅分）
    this.add.rectangle(
      this.stageWidth / 2,
      hudY + HUD_HEIGHT / 2,
      this.stageWidth,
      HUD_HEIGHT,
      theme.bg.surface,
      1,
    );
    this.add
      .line(0, 0, 0, hudY, this.stageWidth, hudY, theme.line.base, 1)
      .setOrigin(0, 0);

    // SPEC-020 §HUD: KPI / Bar / Btn ヘルパ構成へ刷新。
    // 上段 (32px): WORLD/STAGE | BASE HP bar | CE KPI+bar | TIME KPI | PAUSE | SPEED

    // 左上: WORLD-XX / STAGE-YY ラベル
    const worldStageLabel = this.currentStage
      ? `${this.currentStage.worldId.toUpperCase()} / STAGE-${this.currentStage.id}`
      : "STAGE";
    this.add
      .text(10, hudY + 6, worldStageLabel, {
        ...textStyle("badge", { colorNum: theme.ink.tertiary }),
      })
      .setOrigin(0, 0);
    if (this.currentStage) {
      this.add
        .text(10, hudY + 18, this.currentStage.name, {
          ...textStyle("small", { colorNum: theme.ink.primary }),
          fontStyle: "bold",
        })
        .setOrigin(0, 0);
    }

    // BASE HP — ラベル + Bar
    const hpX = 170;
    this.hpKPI = new KPI(this, {
      x: hpX,
      y: hudY + 4,
      label: "BASE HP",
      value: `${this.baseHp} / ${this.maxBaseHp}`,
      colorNum: theme.accent.danger,
    });
    this.hpBar = new Bar(this, {
      x: hpX,
      // SPEC-024: KPI 値 (20px) は y=hudY+16〜40 を占めるため bar は y=44 へ
      y: hudY + 44,
      width: 110,
      height: 6,
      value: this.baseHp,
      max: this.maxBaseHp,
      color: theme.accent.danger,
      segments: this.maxBaseHp,
      glow: true,
    });

    // CE — KPI + 1 秒ゲージ
    const ceX = 300;
    this.ceKPI = new KPI(this, {
      x: ceX,
      y: hudY + 4,
      label: "CE",
      value: `${Math.floor(this.ce)}`,
      colorNum: theme.accent.warn,
    });
    this.ceBar = new Bar(this, {
      x: ceX,
      y: hudY + 44,
      width: 90,
      height: 6,
      value: 0,
      max: 1,
      color: theme.accent.primary,
    });

    // TIME — KPI（毎フレーム更新）
    const timeX = 420;
    this.timeKPI = new KPI(this, {
      x: timeX,
      y: hudY + 4,
      label: "TIME",
      value: "00:00",
      colorNum: theme.ink.primary,
    });

    // PAUSE / SPEED ボタン (右端)
    const btnY = hudY + 18;
    this.pauseBtn = new Btn(this, {
      x: this.stageWidth - 124,
      y: btnY,
      width: 64,
      height: 22,
      size: "sm",
      kind: "secondary",
      label: "⏸ PAUSE",
      onClick: () => this.togglePause(),
    });
    this.speedBtn = new Btn(this, {
      x: this.stageWidth - 50,
      y: btnY,
      width: 56,
      height: 22,
      size: "sm",
      kind: "primary",
      label: "1.0×",
      onClick: () => this.togglePlaySpeed(),
    });

    // SPEC-006 §5.3 / SPEC-015: パレットは現在の party から動的に作る。
    // パーティ枠は最大 10 体、stageWidth 640 / 10 = 64px。8 体なら 80px。
    const partyHeroes = this.partyHeroes;
    const slotW = this.stageWidth / Math.max(1, partyHeroes.length);
    // SPEC-020: 上段 KPI ストリップ (44px) を空けて palette を下げる
    // SPEC-024: 上段 KPI ストリップ (label + value 20px + bar 6px = ~58) を空けて palette を下げる
    const palTop = hudY + 58;
    partyHeroes.forEach((hero, i) => {
      const cx = slotW * i + slotW / 2;
      const slotCenterY = palTop + 41; // 高さ ~82
      const border = this.add.rectangle(cx, slotCenterY, slotW - 4, 82, theme.bg.surface, 1);
      border.setStrokeStyle(2, theme.line.weak);
      border.setInteractive({ useHandCursor: true });

      const sprite = this.add
        .sprite(cx, palTop + 28, TEXTURE_KEYS.hero(hero.id))
        .setDisplaySize(56, 56);

      const labelCost = this.add
        .text(cx + 28, palTop + 8, `${hero.cost}`, {
          fontSize: "13px",
          color: hex2css(theme.ink.primary),
          fontStyle: "bold",
          stroke: hex2css(theme.bg.base),
          strokeThickness: 3,
        })
        .setOrigin(1, 0);

      // 職業アイコン（左）+ ラベル（右）の並び
      const classColor = CLASS_COLORS[hero.class].hex;
      const classIcon = makeClassIcon(this, cx - 18, palTop + 60, hero.class, 14, classColor);
      const labelClass = this.add
        .text(cx + 4, palTop + 60, CLASS_LABEL[hero.class], {
          fontSize: "13px",
          color: hex2css(classColor),
          fontStyle: "bold",
        })
        .setOrigin(0, 0.5);
      void classIcon;

      const labelStatus = this.add
        .text(cx, palTop + 75, "", {
          fontSize: "14px",
          color: hex2css(theme.accent.success),
          fontStyle: "bold",
        })
        .setOrigin(0.5);

      const container = this.add.container(0, 0, [
        sprite,
        labelCost,
        labelClass,
        labelStatus,
      ]);

      border.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (pointer.rightButtonDown()) return;
        this.onSelectHero(hero);
      });
      this.heroPaletteEntries.push({
        hero,
        container,
        border,
        statusLabel: labelStatus,
      });
    });

    // 下段ステータステキスト (palette 直下)。SPEC-024: HUD_HEIGHT 156 / palTop 58 / palette 高 82
    this.statusText = this.add.text(
      10,
      hudY + 144,
      "ヒーローアイコンをタップ → タイルへドラッグして配置",
      { fontSize: "13px", color: hex2css(theme.ink.tertiary) },
    );
  }

  /**
   * SPEC-025: 縦画面用 HUD。上段 KPI ストリップ + 下段にフルワイドの
   * パレット + ヒーロー詳細ストリップ。
   */
  private drawPortraitHud(): void {
    const vpW = this.scale.width;
    const vpH = this.scale.height;
    const layout = this.computePortraitLayout();
    const hudH = layout.hudH;

    // ── 上段: HUD バー (背景 + 区切り線)
    this.add.rectangle(vpW / 2, hudH / 2, vpW, hudH, theme.bg.surface, 1);
    this.add
      .line(0, 0, 0, hudH, vpW, hudH, theme.line.base, 1)
      .setOrigin(0, 0);

    // 左上: WORLD / STAGE バッジ
    const worldStageLabel = this.currentStage
      ? `${this.currentStage.worldId.toUpperCase()} / ${this.currentStage.id}`
      : "STAGE";
    this.add
      .text(8, 4, worldStageLabel, {
        ...textStyle("badge", { colorNum: theme.ink.tertiary }),
      })
      .setOrigin(0, 0);
    if (this.currentStage) {
      this.add
        .text(8, 16, this.currentStage.name, {
          ...textStyle("small", { colorNum: theme.ink.primary }),
          fontStyle: "bold",
          wordWrap: { width: 130, useAdvancedWrap: true },
        })
        .setOrigin(0, 0);
    }

    // KPI ストリップ (右側に詰める)
    // 縦画面では幅が狭いため、HP / CE のラベル+値を縦に積み、その横に細い bar を置く
    const stripRight = vpW - 8;
    const stripTop = 4;
    const colGap = 12;
    const colWidth = 70;
    const barW = 56;

    // SPEED / PAUSE ボタン (右下)
    this.speedBtn = new Btn(this, {
      x: stripRight - 30,
      y: hudH - 16,
      width: 56,
      height: 22,
      size: "sm",
      kind: "primary",
      label: "1.0×",
      onClick: () => this.togglePlaySpeed(),
    });
    this.pauseBtn = new Btn(this, {
      x: stripRight - 92,
      y: hudH - 16,
      width: 60,
      height: 22,
      size: "sm",
      kind: "secondary",
      label: "⏸",
      onClick: () => this.togglePause(),
    });

    // TIME (右上)
    const timeX = stripRight - colWidth;
    this.timeKPI = new KPI(this, {
      x: timeX,
      y: stripTop,
      label: "TIME",
      value: "00:00",
      colorNum: theme.ink.primary,
    });

    // CE (TIME の左)
    const ceX = timeX - colWidth - colGap;
    this.ceKPI = new KPI(this, {
      x: ceX,
      y: stripTop,
      label: "CE",
      value: `${Math.floor(this.ce)}`,
      colorNum: theme.accent.warn,
    });
    this.ceBar = new Bar(this, {
      x: ceX,
      y: stripTop + 38,
      width: barW,
      height: 5,
      value: 0,
      max: 1,
      color: theme.accent.primary,
    });

    // BASE HP (CE の左)
    const hpX = ceX - colWidth - colGap;
    this.hpKPI = new KPI(this, {
      x: hpX,
      y: stripTop,
      label: "BASE HP",
      value: `${this.baseHp} / ${this.maxBaseHp}`,
      colorNum: theme.accent.danger,
    });
    this.hpBar = new Bar(this, {
      x: hpX,
      y: stripTop + 38,
      width: barW,
      height: 5,
      value: this.baseHp,
      max: this.maxBaseHp,
      color: theme.accent.danger,
      segments: this.maxBaseHp,
      glow: true,
    });

    // ── 中段: マップ領域 (worldRoot が描画) — 視覚境界線
    this.add
      .rectangle(layout.mapX - 1, layout.mapY - 1, layout.mapW + 2, layout.mapH + 2, 0x000000, 0)
      .setStrokeStyle(1, theme.line.weak)
      .setOrigin(0, 0);

    // ── 詳細メッセージ帯 (マップ直下)
    this.add
      .rectangle(0, layout.detailY, vpW, layout.detailH, theme.bg.surface, 0.95)
      .setOrigin(0, 0)
      .setStrokeStyle(1, theme.line.weak);
    this.statusText = this.add.text(
      8,
      layout.detailY + 8,
      "ヒーローアイコンをタップ → タイルへドラッグして配置",
      {
        fontSize: "12px",
        color: hex2css(theme.ink.secondary),
        wordWrap: { width: vpW - 16, useAdvancedWrap: true },
      },
    );

    // ── 下段: パレット (5 列 × 2 行)
    this.add
      .rectangle(0, layout.paletteY, vpW, layout.paletteH, theme.bg.surface, 1)
      .setOrigin(0, 0);
    this.add
      .line(0, 0, 0, layout.paletteY, vpW, layout.paletteY, theme.line.base, 1)
      .setOrigin(0, 0);

    const partyHeroes = this.partyHeroes;
    const palCols = 5;
    const palRows = Math.ceil(partyHeroes.length / palCols);
    const palMargin = 6;
    const palGap = 4;
    const palSlotW = (vpW - palMargin * 2 - palGap * (palCols - 1)) / palCols;
    const palSlotH = Math.min(80, (layout.paletteH - palGap) / palRows);
    partyHeroes.forEach((hero, i) => {
      const col = i % palCols;
      const row = Math.floor(i / palCols);
      const cx = palMargin + col * (palSlotW + palGap) + palSlotW / 2;
      const cy = layout.paletteY + 4 + row * (palSlotH + palGap) + palSlotH / 2;
      const border = this.add.rectangle(cx, cy, palSlotW - 2, palSlotH - 2, theme.bg.surface, 1);
      border.setStrokeStyle(2, theme.line.weak);
      border.setInteractive({ useHandCursor: true });

      const sprite = this.add
        .sprite(cx, cy - 8, TEXTURE_KEYS.hero(hero.id))
        .setDisplaySize(36, 36);
      const labelCost = this.add
        .text(cx + palSlotW / 2 - 6, cy - palSlotH / 2 + 4, `${hero.cost}`, {
          fontSize: "11px",
          color: hex2css(theme.ink.primary),
          fontStyle: "bold",
          stroke: hex2css(theme.bg.base),
          strokeThickness: 3,
        })
        .setOrigin(1, 0);
      const classColor = CLASS_COLORS[hero.class].hex;
      const classIcon = makeClassIcon(this, cx - 12, cy + palSlotH / 2 - 12, hero.class, 10, classColor);
      const labelClass = this.add
        .text(cx + 2, cy + palSlotH / 2 - 12, CLASS_LABEL[hero.class], {
          fontSize: "11px",
          color: hex2css(classColor),
          fontStyle: "bold",
        })
        .setOrigin(0, 0.5);
      const labelStatus = this.add
        .text(cx, cy + palSlotH / 2 - 4, "", {
          fontSize: "10px",
          color: hex2css(theme.accent.success),
          fontStyle: "bold",
        })
        .setOrigin(0.5, 1);
      void classIcon;

      const container = this.add.container(0, 0, [
        sprite,
        labelCost,
        labelClass,
        labelStatus,
      ]);

      border.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (pointer.rightButtonDown()) return;
        this.onSelectHero(hero);
      });
      this.heroPaletteEntries.push({
        hero,
        container,
        border,
        statusLabel: labelStatus,
      });
    });

    void vpH;
  }

  /** SPEC-006 §5.3: パネルスロット背景（常駐） */
  private drawPanelSlot(): void {
    const slotCx = this.panelSlotX + PANEL_SLOT_WIDTH / 2;
    const slotCy = (this.stageHeight + HUD_HEIGHT) / 2;
    this.add.rectangle(
      slotCx,
      slotCy,
      PANEL_SLOT_WIDTH,
      this.stageHeight + HUD_HEIGHT,
      0x080a0f,
      1,
    );
    // ステージとパネルの境界
    this.add
      .line(0, 0, this.panelSlotX, 0, this.panelSlotX, this.stageHeight + HUD_HEIGHT, theme.line.base, 1)
      .setOrigin(0, 0);

    // 何も無いときの placeholder テキスト
    this.panelPlaceholder = this.add
      .text(slotCx, slotCy - 30, "ヒーロー詳細", {
        fontSize: "16px",
        color: hex2css(theme.line.base),
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.add
      .text(slotCx, slotCy, "ステージ上のヒーローを\nタップすると詳細が出ます", {
        fontSize: "13px",
        color: hex2css(theme.line.base),
        align: "center",
        lineSpacing: 4,
      })
      .setOrigin(0.5);
  }

  private bindInput(): void {
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      // SPEC-025: worldRoot を介してマップ要素を描画しているので、
      // pointer.worldX/Y を worldRoot の local 座標 (タイル空間) に戻す。
      const wp = this.screenToWorld(p);
      if (this.placement?.kind === "selecting") {
        this.placement.ghostSprite.x = wp.x;
        this.placement.ghostSprite.y = wp.y;
        this.repositionPatternRects(
          this.placement.rangeRects,
          this.visualPattern(this.placement.hero),
          { col: 0, row: 0 },
          "right",
          wp.x,
          wp.y,
        );
        const tileUnder = pixelToTile(wp.x, wp.y, this.map.cols, this.map.rows);
        const sr = this.placement.snapRect;
        if (
          !tileUnder ||
          wp.x >= this.stageWidth ||
          wp.y >= this.stageHeight
        ) {
          sr.setVisible(false);
        } else {
          const center = tileToPixel(tileUnder);
          sr.setPosition(center.x, center.y);
          sr.setVisible(true);
          const tt = tileTypeAt(this.map, tileUnder);
          const occupied = this.placedHeroes.some((h) =>
            tileEquals(h.tile, tileUnder),
          );
          const ok =
            tt &&
            canPlaceClassOnTile(this.placement.hero.class, tt) &&
            !occupied;
          sr.setStrokeStyle(
            3,
            ok ? theme.accent.primary : theme.accent.danger,
            0.95,
          );
        }
      } else if (this.placement?.kind === "orienting") {
        const center = tileToPixel(this.placement.tile);
        const dir = directionFromDelta(wp.x - center.x, wp.y - center.y);
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
      const wp = this.screenToWorld(p);
      if (this.statusPanel) {
        // SPEC-007 §5.3: パネル外をタップで閉じる
        // 縦画面では panelSlotX 概念を使わず、status panel の bg 矩形を直接判定
        if (wp.x < this.panelSlotX || this.isPortrait()) {
          // 縦画面ではマップ領域外の場合のみ閉じる
          if (this.isPortrait()) {
            // マップ領域 (worldRoot 内) の外なら閉じる
            if (
              wp.x < 0 ||
              wp.x > this.stageWidth ||
              wp.y < 0 ||
              wp.y > this.stageHeight
            ) {
              this.closeStatusPanel();
            }
          } else {
            this.closeStatusPanel();
          }
        }
        return;
      }
      // マップ範囲外の入力は無視 (UI 領域は scene root の各 UI が個別に処理する)
      if (wp.y < 0 || wp.y >= this.stageHeight) return;
      if (wp.x < 0 || wp.x >= this.stageWidth) return;

      if (p.rightButtonDown()) {
        if (this.placement) {
          this.cancelPlacement();
          return;
        }
        const tile = pixelToTile(wp.x, wp.y, this.map.cols, this.map.rows);
        if (tile) this.tryReleaseHeroAt(tile);
        return;
      }

      if (this.placement?.kind === "selecting") {
        this.tryCommitPlacement(wp.x, wp.y);
        return;
      }
      if (this.placement?.kind === "orienting") {
        this.confirmOrientation();
        return;
      }
      const tile = pixelToTile(wp.x, wp.y, this.map.cols, this.map.rows);
      if (tile) {
        const hero = this.placedHeroes.find((h) => tileEquals(h.tile, tile));
        if (hero) {
          this.playUiSe(SE_KEYS.uiTap());
          this.openStatusPanel(hero);
        } else {
          this.showTileHelp(tile);
        }
      }
    });

    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (this.gameOver || this.statusPanel) return;
      if (this.placement?.kind !== "selecting") return;
      const wp = this.screenToWorld(p);
      if (
        wp.x < 0 ||
        wp.x >= this.stageWidth ||
        wp.y < 0 ||
        wp.y >= this.stageHeight
      )
        return;
      const tile = pixelToTile(wp.x, wp.y, this.map.cols, this.map.rows);
      if (!tile) return;
      this.tryCommitPlacement(wp.x, wp.y);
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
    // SPEC-006 §5.3: 1 体 1 配置 — 既に配置済みなら拒否
    if (this.placedHeroes.some((h) => h.def.id === hero.id)) {
      this.statusText.setText(
        `${hero.name} は既に出撃中です（売却で再選択可能）`,
      );
      return;
    }
    if (this.ce < hero.cost) {
      this.statusText.setText(
        `CE が足りません（必要 ${hero.cost} / 現在 ${Math.floor(this.ce)}）`,
      );
      return;
    }
    this.cancelPlacement();

    const ghost = this.addWorld(
      this.add
        .sprite(-100, -100, TEXTURE_KEYS.hero(hero.id))
        .setDisplaySize(TILE_SIZE, TILE_SIZE)
        .setAlpha(0.6)
        .setDepth(50),
    );

    const highlightRects = this.buildHighlightTilesFor(hero.class);

    // SPEC-006 §5.6: スナップタイル枠（カーソル直下のタイルを示す）
    const snapRect = this.addWorld(
      this.add.rectangle(-100, -100, TILE_SIZE - 4, TILE_SIZE - 4, 0x000000, 0),
    );
    snapRect.setStrokeStyle(3, theme.accent.primary, 0.95);
    snapRect.setDepth(45);
    snapRect.setVisible(false);

    this.placement = {
      kind: "selecting",
      hero,
      ghostSprite: ghost,
      rangeRects: [],
      highlightRects,
      snapRect,
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
        // SPEC-019 §視覚刷新: 配置候補も outline のみ。塗りでパターンを潰さない。
        const rect = this.addWorld(
          this.add.rectangle(cx, cy, TILE_SIZE - 6, TILE_SIZE - 6, 0x000000, 0),
        );
        rect.setStrokeStyle(1.5, theme.accent.success, 0.85);
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
    // SPEC-006 §5.6: スナップタイル枠も役目終了
    this.placement.snapRect.destroy();

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
          color: isActive ? hex2css(theme.accent.primary) : hex2css(theme.ink.tertiary),
          fontStyle: "bold",
          stroke: hex2css(theme.bg.base),
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
      arrow.setColor(isActive ? hex2css(theme.accent.primary) : hex2css(theme.ink.tertiary));
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
    const gaugeBg = this.addWorld(
      this.add
        .rectangle(px.x, gaugeY, gaugeW, gaugeH, theme.bg.surface, 0.9)
        .setDepth(33),
    );
    const gaugeFill = this.addWorld(
      this.add
        .rectangle(px.x - gaugeW / 2, gaugeY, 0, gaugeH, theme.accent.warn)
        .setOrigin(0, 0.5)
        .setDepth(34),
    );

    const hpBarY = px.y - 26;
    const hpBarBg = this.addWorld(
      this.add
        .rectangle(px.x, hpBarY, gaugeW, gaugeH, theme.bg.surface, 0.9)
        .setDepth(33)
        .setVisible(false),
    );
    const hpBar = this.addWorld(
      this.add
        .rectangle(px.x - gaugeW / 2, hpBarY, gaugeW, gaugeH, theme.accent.success)
        .setOrigin(0, 0.5)
        .setDepth(34)
        .setVisible(false),
    );

    this.placedHeroes.push({
      def: hero,
      skill: findSkill(hero.id) ?? null,
      tile,
      direction,
      sprite: ghostSprite,
      rangeRects,
      lastAttackAt: this.elapsed,
      blockNum: 0,
      currentHp: hero.hp,
      maxHp: hero.hp,
      hpBar,
      hpBarBg,
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
    if (this.placement.kind === "selecting") {
      this.placement.snapRect.destroy();
    }
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
      // SPEC-019 §視覚刷新: 攻撃範囲は塗りなしのアウトラインのみ。床/壁の
      // パターンを潰さない。
      const r = this.addWorld(
        this.add.rectangle(0, 0, TILE_SIZE - 4, TILE_SIZE - 4, 0x000000, 0),
      );
      r.setStrokeStyle(2, theme.accent.primary, 0.7);
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
      const isDeployed = this.placedHeroes.some(
        (h) => h.def.id === entry.hero.id,
      );
      const enough = this.ce >= entry.hero.cost;
      const isSelected = entry.hero.id === selectedId;

      // SPEC-006 §5.3: ステータスバッジ
      //   - 出撃中: 既に配置済（1 体 1 配置制限）
      //   - 出撃可能: CE 足りる & 未配置
      //   - CE不足: それ以外
      let label = "";
      let labelColor = hex2css(theme.accent.success);
      let borderColor = theme.line.weak;
      let alpha = 1;
      if (isDeployed) {
        label = "出撃中";
        labelColor = hex2css(theme.accent.danger);
        borderColor = theme.line.bright;
        alpha = 0.4;
      } else if (isSelected) {
        label = "選択中";
        labelColor = hex2css(theme.accent.primary);
        borderColor = theme.accent.primary;
        alpha = 1;
      } else if (enough) {
        label = "出撃可能";
        labelColor = hex2css(theme.accent.success);
        borderColor = theme.accent.success;
        alpha = 1;
      } else {
        label = "CE不足";
        labelColor = hex2css(theme.ink.tertiary);
        borderColor = theme.line.base;
        alpha = 0.55;
      }
      entry.statusLabel.setText(label).setColor(labelColor);
      entry.border.setStrokeStyle(2, borderColor);
      entry.container.setAlpha(alpha);
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
    hero.hpBar.destroy();
    hero.hpBarBg.destroy();
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
    if (skill.effectType !== "singleStrike" && skill.effectType !== "heal") {
      hero.aura?.destroy();
      const aura = this.addWorld(
        this.add.circle(
          hero.sprite.x,
          hero.sprite.y,
          TILE_SIZE * 0.7,
          CLASS_AURA_COLOR[hero.def.class],
          0.18,
        ),
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
      case "heal": {
        // SPEC-009 §5.5: 攻撃範囲内の味方ヒーロー（自分含む）を回復
        const allies = this.findAlliesInPattern(hero);
        for (const ally of allies) {
          const heal = calculateHeal({
            attackType: hero.def.attackType,
            casterPhy: hero.def.phy,
            casterInt: hero.def.int,
            targetPhyDef: ally.def.phyDef,
            targetIntDef: ally.def.intDef,
            healRate: skill.value,
          });
          ally.currentHp = Math.min(ally.maxHp, ally.currentHp + heal);
          // ヒーラー演出: 緑のフラッシュ
          const heart = this.add
            .text(ally.sprite.x, ally.sprite.y - 16, `+${Math.floor(heal)}`, {
              fontSize: "13px",
              color: hex2css(theme.accent.success),
              fontStyle: "bold",
              stroke: hex2css(theme.bg.base),
              strokeThickness: 3,
            })
            .setOrigin(0.5)
            .setDepth(60);
          this.tweens.add({
            targets: heart,
            y: heart.y - 26,
            alpha: 0,
            duration: 900,
            ease: "Cubic.easeOut",
            onComplete: () => heart.destroy(),
          });
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
  /**
   * SPEC-010 §5.4: タイルヘルプツールチップ。
   * ヒーロー無しタイルをタップした時に呼ぶ。
   * 名称 / 説明 / 配置可能職業 を 3 行で表示し、3 秒後フェードアウト。
   * 別タイルがタップされたら即時切替。
   */
  private showTileHelp(tile: TilePos): void {
    const tileType = this.map.tiles[tile.row]?.[tile.col];
    if (!tileType) return;
    const info = TILE_INFO[tileType];
    if (!info) return;

    // 既存の help を破棄
    if (this.currentTileHelp) {
      this.currentTileHelp.destroy(true);
      this.currentTileHelp = null;
    }

    // SPEC-010 fix: ツールチップ幅を 220 → 300 に拡大、CJK 用 advancedWordWrap で
    // どこでも改行できるように。実テキストの行数で動的に高さを伸ばす。
    const helpW = 300;
    const wrapWidth = helpW - 24;
    const accent = parseInt(info.accentColor.slice(1), 16);

    // 先に description テキストを作って実高さを測ってから背景サイズを決める
    const descTextStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: "14px",
      color: hex2css(theme.ink.primary),
      align: "center",
      wordWrap: { width: wrapWidth, useAdvancedWrap: true },
    };
    const descTemp = this.add
      .text(0, 0, info.description, descTextStyle)
      .setOrigin(0.5, 0);
    const descHeight = descTemp.height;

    // 全体のレイアウト: title (16) + descHeight + footer (14) + padding 上下 8
    const helpH = Math.max(76, 16 + descHeight + 14 + 16);

    const px = tileToPixel(tile);
    const placedAbove = px.y > this.stageHeight / 2;
    const helpY = placedAbove
      ? px.y - TILE_SIZE * 0.6 - helpH / 2
      : px.y + TILE_SIZE * 0.6 + helpH / 2;

    // ステージ端で見切れないよう x をクランプ
    const helpX = Math.max(
      helpW / 2 + 6,
      Math.min(this.stageWidth - helpW / 2 - 6, px.x),
    );

    const bg = this.add.rectangle(helpX, helpY, helpW, helpH, theme.bg.base, 0.95);
    bg.setStrokeStyle(2, accent, 0.9);

    const title = this.add
      .text(helpX, helpY - helpH / 2 + 8, `［${info.label}］`, {
        fontSize: "13px",
        color: info.accentColor,
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0);

    descTemp.setPosition(helpX, helpY - helpH / 2 + 26);
    const desc = descTemp;

    const placeableLabel =
      info.placeable.length === 0
        ? "配置不可"
        : "配置可: " +
          info.placeable.map((c) => CLASS_LABEL[c]).join(" / ");
    const placeable = this.add
      .text(helpX, helpY + helpH / 2 - 16, placeableLabel, {
        fontSize: "14px",
        color: hex2css(theme.accent.success),
      })
      .setOrigin(0.5, 0);

    const container = this.addWorld(
      this.add.container(0, 0, [bg, title, desc, placeable]),
    );
    container.setDepth(80);
    container.setAlpha(0);
    this.currentTileHelp = container;

    this.tweens.add({
      targets: container,
      alpha: 1,
      duration: 120,
      onComplete: () => {
        this.tweens.add({
          targets: container,
          alpha: 1,
          duration: 2400,
          onComplete: () => {
            this.tweens.add({
              targets: container,
              alpha: 0,
              duration: 300,
              onComplete: () => {
                if (this.currentTileHelp === container) this.currentTileHelp = null;
                container.destroy(true);
              },
            });
          },
        });
      },
    });
  }

  /**
   * SPEC-020 §カットイン: design ハンドオフのモーション仕様に置換。
   *
   * - 上下スイープ: 700ms cubic-bezier(.2,.8,.2,1) で `translateY(-100%) → 0
   *   → -100%`（下スイープは逆方向）。dark gradient の対角ポリゴン。
   * - speed line: 700ms linear で alpha 0 → 0.6 → 0、職業色の細線が 105°
   *   方向に流れる。
   * - portrait + name: 560ms cubic-bezier(.16,.7,.2,1.05)、scale 0.85 →
   *   1.04 → 1 + 100ms delay。
   * - 全体は 1500ms で fade out。
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
    const classColor = CLASS_AURA_COLOR[hero.def.class];

    // 全体 root container (alpha フェードアウト用)
    const root = this.add.container(0, 0);
    root.setDepth(95);

    // ── 上スイープ: 上半分を覆う dark ポリゴン (cutoff 80% 下端で斜めに切れる)
    // path: (0,0) → (stageW, 0) → (stageW, 0.8 stageH) → (0, stageH)
    const upper = this.add.graphics();
    upper.fillStyle(theme.bg.base, 0.94);
    upper.fillPoints(
      [
        { x: 0, y: 0 },
        { x: stageW, y: 0 },
        { x: stageW, y: stageH * 0.4 },
        { x: 0, y: stageH * 0.5 },
      ],
      true,
    );
    upper.y = -stageH; // off-screen 上から開始
    root.add(upper);

    // ── 下スイープ: 下半分を覆う dark ポリゴン (上端で斜めにえぐれる)
    const lower = this.add.graphics();
    lower.fillStyle(theme.bg.base, 0.94);
    lower.fillPoints(
      [
        { x: 0, y: stageH * 0.5 },
        { x: stageW, y: stageH * 0.4 },
        { x: stageW, y: stageH },
        { x: 0, y: stageH },
      ],
      true,
    );
    lower.y = stageH; // off-screen 下から
    root.add(lower);

    // ── speed line: 105° (rad ≒ 1.832) で職業色のストライプを敷く
    const lines = this.add.graphics();
    lines.lineStyle(1, classColor, 0.55);
    const angleRad = Phaser.Math.DegToRad(105);
    const dx = Math.cos(angleRad);
    const dy = Math.sin(angleRad);
    // 画面対角の長さ + マージン
    const diag = Math.sqrt(stageW * stageW + stageH * stageH) * 1.2;
    // 22px 間隔で平行線を引く
    for (let t = -diag; t <= diag; t += 22) {
      const x1 = cx + t * dy + dx * (-diag / 2);
      const y1 = cy - t * dx + dy * (-diag / 2);
      const x2 = cx + t * dy + dx * (diag / 2);
      const y2 = cy - t * dx + dy * (diag / 2);
      lines.lineBetween(x1, y1, x2, y2);
    }
    lines.setAlpha(0);
    root.add(lines);

    // ── ポートレート + テキスト (中央スタック)
    const heroBlock = this.add.container(cx, cy);

    // ポートレート枠 (140×140)
    const frame = this.add.graphics();
    frame.fillStyle(classColor, 0.18);
    frame.fillRect(-70, -70, 140, 140);
    frame.lineStyle(2, classColor, 1);
    frame.strokeRect(-70, -70, 140, 140);
    heroBlock.add(frame);

    const portrait = this.add
      .sprite(0, 0, TEXTURE_KEYS.hero(hero.def.id))
      .setDisplaySize(120, 120);
    heroBlock.add(portrait);

    // 右側のテキストブロック (heroBlock 内座標)
    const textBlock = this.add.container(110, 0);
    const skillActivate = this.add
      .text(0, -42, "SKILL ACTIVATE", {
        ...textStyle("badge", { colorNum: classColor }),
      })
      .setOrigin(0, 0.5);
    const heroName = this.add
      .text(0, -14, hero.def.name, {
        fontFamily: "'Zen Kaku Gothic New', 'Noto Sans JP', system-ui, sans-serif",
        fontSize: "26px",
        color: hex2css(theme.ink.primary),
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5);
    const skillName = this.add
      .text(0, 22, `『${hero.skill.name}』`, {
        fontFamily: "'Zen Kaku Gothic New', 'Noto Sans JP', system-ui, sans-serif",
        fontSize: "18px",
        color: hex2css(classColor),
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5);
    textBlock.add([skillActivate, heroName, skillName]);
    heroBlock.add(textBlock);

    heroBlock.setScale(0.85);
    heroBlock.setAlpha(0);
    root.add(heroBlock);

    this.currentCutIn = root;

    // ── アニメーション: 上下 sweep
    this.tweens.add({
      targets: upper,
      y: 0,
      duration: 350,
      ease: "Cubic.easeOut",
      hold: 350,
      yoyo: true,
      onYoyo: () => {
        // 折返し時に画面外（上）方向へ
        this.tweens.add({
          targets: upper,
          y: -stageH,
          duration: 350,
          ease: "Cubic.easeIn",
        });
      },
    });
    this.tweens.add({
      targets: lower,
      y: 0,
      duration: 350,
      ease: "Cubic.easeOut",
      hold: 350,
      yoyo: true,
      onYoyo: () => {
        this.tweens.add({
          targets: lower,
          y: stageH,
          duration: 350,
          ease: "Cubic.easeIn",
        });
      },
    });

    // speed line: 0 → 0.6 → 0 over 700ms
    this.tweens.add({
      targets: lines,
      alpha: 0.6,
      duration: 200,
      yoyo: true,
      hold: 300,
    });

    // portrait + text: scale 0.85 → 1.04 → 1, alpha 0 → 1, delay 100ms
    this.tweens.add({
      targets: heroBlock,
      alpha: 1,
      duration: 200,
      delay: 100,
    });
    this.tweens.add({
      targets: heroBlock,
      scale: 1.04,
      duration: 360,
      delay: 100,
      ease: "Cubic.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: heroBlock,
          scale: 1.0,
          duration: 200,
          ease: "Sine.easeOut",
        });
      },
    });

    // 全体 1500ms 後にフェードアウト → destroy
    this.tweens.add({
      targets: root,
      alpha: 0,
      duration: 250,
      delay: 1250,
      onComplete: () => {
        if (this.currentCutIn === root) this.currentCutIn = null;
        root.destroy(true);
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

  /** SPEC-009 §5.5: 攻撃範囲内の味方ヒーロー（自分含む）を返す */
  private findAlliesInPattern(hero: PlacedHero): PlacedHero[] {
    const tiles = this.effectiveAttackTiles(hero);
    const result: PlacedHero[] = [hero];
    for (const ally of this.placedHeroes) {
      if (ally === hero) continue;
      if (tiles.some((t) => tileEquals(t, ally.tile))) {
        result.push(ally);
      }
    }
    return result;
  }

  // ========== ヒーロー詳細パネル ==========

  /**
   * SPEC-006 §5.5 仕様変更:
   * - パネルは画面右側のサイドスロット（PANEL_SLOT_WIDTH 幅）に右からスライドインする
   * - 背景の暗幕は無し。ステージは引き続きそのまま視認できる
   * - パネル表示中は playSpeed = 0.1（完全停止ではない）
   * - portrait を従来 96px → 192px に倍化
   * - スキル発動ボタン押下でパネルを閉じてカットイン → スキル開始
   */
  private openStatusPanel(hero: PlacedHero): void {
    if (this.statusPanel) return;
    this.statusPanelHeroId = hero.def.id;

    // SPEC-006: パネルスロット内の中心。x はパネルスロットの中心、y はキャンバス中央。
    const slotCx = this.panelSlotX + PANEL_SLOT_WIDTH / 2;
    const fullH = this.stageHeight + HUD_HEIGHT;
    const slotCy = fullH / 2;

    // 背景パネル（PANEL_SLOT_WIDTH × fullH を覆う）
    const panel = this.add.rectangle(
      slotCx,
      slotCy,
      PANEL_SLOT_WIDTH,
      fullH,
      theme.bg.surface,
      0.96,
    );
    panel.setStrokeStyle(2, theme.line.weak);

    // タイトル（職業 + 名前）
    const title = this.add
      .text(slotCx, 28, `[${CLASS_LABEL[hero.def.class]}] ${hero.def.name}`, {
        fontSize: "16px",
        color: hex2css(theme.ink.primary),
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: PANEL_SLOT_WIDTH - 24 },
      })
      .setOrigin(0.5, 0);

    // ── ヒーロー portrait（2× = 192×192）
    const portrait = this.add
      .sprite(slotCx, 162, TEXTURE_KEYS.hero(hero.def.id))
      .setDisplaySize(192, 192);

    // ── ステータス
    const interval = (1 / Math.max(0.1, hero.def.agi / 100)).toFixed(2);
    const tilesCount = hero.def.attackPattern.length;
    const statLines = [
      `属性  ${hero.def.attackType}`,
      `HP    ${hero.def.hp}`,
      `PHY   ${hero.def.phy}`,
      `INT   ${hero.def.int}`,
      `AGI   ${hero.def.agi}`,
      `攻撃間隔  ${interval}s`,
      `攻撃範囲  ${tilesCount} マス（${hero.direction} 向き）`,
      `ブロック  ${hero.blockNum} / ${blockMaxFor(hero.def.class)}`,
      `コスト  ${hero.def.cost} CE`,
    ];
    const stats = this.add
      .text(slotCx - 110, 268, statLines.join("\n"), {
        fontSize: "14px",
        color: hex2css(theme.ink.primary),
        lineSpacing: 3,
      })
      .setOrigin(0, 0);

    // ── スキル情報セクション
    const skillTitle = this.add
      .text(slotCx, 388, "[ スキル ]", {
        fontSize: "14px",
        color: hex2css(theme.accent.warn),
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const skillName = hero.skill
      ? this.add
          .text(slotCx, 412, hero.skill.name, {
            fontSize: "16px",
            color: hex2css(theme.ink.primary),
            fontStyle: "bold",
            align: "center",
            wordWrap: { width: PANEL_SLOT_WIDTH - 32 },
          })
          .setOrigin(0.5)
      : this.add
          .text(slotCx, 412, "（スキル無し）", {
            fontSize: "14px",
            color: hex2css(theme.ink.tertiary),
          })
          .setOrigin(0.5);

    const skillDesc = hero.skill
      ? this.add
          .text(slotCx, 442, hero.skill.description, {
            fontSize: "13px",
            color: hex2css(theme.ink.secondary),
            align: "center",
            wordWrap: { width: PANEL_SLOT_WIDTH - 24 },
          })
          .setOrigin(0.5, 0)
      : null;

    // ── ゲージ表示
    const gaugeY = 498;
    const gaugeW = PANEL_SLOT_WIDTH - 60;
    const gaugeH = 10;
    const gaugeBgX = slotCx - gaugeW / 2;
    const panelGaugeBg = this.add
      .rectangle(gaugeBgX, gaugeY, gaugeW, gaugeH, theme.bg.overlay, 1)
      .setOrigin(0, 0.5);
    const fillW = gaugeW * (hero.skillGauge / GAUGE_MAX);
    const panelGaugeFill = this.add
      .rectangle(gaugeBgX, gaugeY, fillW, gaugeH, theme.accent.warn)
      .setOrigin(0, 0.5);
    const gaugeLabel = this.add
      .text(slotCx, gaugeY + 14, `${Math.floor(hero.skillGauge)} / ${GAUGE_MAX}`, {
        fontSize: "13px",
        color: hex2css(theme.accent.primary),
      })
      .setOrigin(0.5);

    // ── スキル発動ボタン（パネル幅いっぱい）
    const ready = canActivate(hero.skillGauge) && hero.skill !== null;
    const btnW = PANEL_SLOT_WIDTH - 48;
    const btnY = 552;
    const activateBtnBg = this.add.rectangle(
      slotCx,
      btnY,
      btnW,
      40,
      ready ? theme.accent.warn : theme.line.base,
      0.95,
    );
    activateBtnBg.setStrokeStyle(2, ready ? theme.accent.primary : theme.line.bright);
    if (ready) activateBtnBg.setInteractive({ useHandCursor: true });
    const activateBtnText = this.add
      .text(slotCx, btnY, ready ? "▶ スキル発動" : "ゲージ不足", {
        fontSize: "15px",
        color: ready ? hex2css(theme.ink.inverse) : hex2css(theme.ink.tertiary),
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    if (ready) {
      activateBtnBg.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (pointer.rightButtonDown()) return;
        this.activateSkillFromPanel(hero);
      });
    }

    // ── 売却ボタン（小さく）
    const sellBtn = this.add
      .text(slotCx - 60, btnY + 38, "[ 売却 ]", {
        fontSize: "13px",
        color: hex2css(theme.accent.danger),
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    sellBtn.on("pointerdown", () => {
      this.closeStatusPanel();
      this.tryReleaseHeroAt(hero.tile);
    });

    // ── 閉じるボタン
    const closeBtn = this.add
      .text(slotCx + 60, btnY + 38, "[ 閉じる ]", {
        fontSize: "13px",
        color: hex2css(theme.accent.primary),
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    closeBtn.on("pointerdown", () => this.closeStatusPanel());

    const items: Phaser.GameObjects.GameObject[] = [
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
      sellBtn,
      closeBtn,
    ];
    if (skillDesc) items.splice(6, 0, skillDesc);
    this.statusPanel = this.add.container(0, 0, items);
    this.statusPanel.setDepth(100);

    // SPEC-006 §5.5: 右からスライドイン
    this.statusPanel.x = PANEL_SLOT_WIDTH;
    this.tweens.add({
      targets: this.statusPanel,
      x: 0,
      duration: 220,
      ease: "Sine.easeOut",
    });

    // パネル placeholder を一時非表示
    this.panelPlaceholder?.setVisible(false);

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
    const panel = this.statusPanel;
    // SPEC-006 §5.5: 右へスライドアウト → 完了で破棄
    this.tweens.add({
      targets: panel,
      x: PANEL_SLOT_WIDTH,
      duration: 200,
      ease: "Sine.easeIn",
      onComplete: () => panel.destroy(true),
    });
    this.statusPanel = null;
    if (this.statusPanelHeroId != null) {
      const hero = this.placedHeroes.find(
        (h) => h.def.id === this.statusPanelHeroId,
      );
      if (hero) for (const r of hero.rangeRects) r.setAlpha(0.18);
    }
    this.statusPanelHeroId = null;
    this.panelPlaceholder?.setVisible(true);
    this.playSpeed = this.placement ? 0.1 : this.playSpeedToggle;
    this.refreshSpeedButton();
  }

  // ========== 再生速度 / 一時停止 ==========

  private togglePlaySpeed(): void {
    if (this.statusPanel) return;
    if (this.placement) return; // SPEC-005 §5.6: 配置中は 0.1× 固定なのでトグル無効
    if (this.paused) return; // 一時停止中は速度切替を受け付けない
    this.playSpeedToggle = this.playSpeedToggle === 1.0 ? 2.0 : 1.0;
    this.playSpeed = this.playSpeedToggle;
    this.refreshSpeedButton();
  }

  /** SPEC-007 §5.1: 一時停止 / 再開トグル */
  private togglePause(): void {
    if (this.gameOver) return;
    this.paused = !this.paused;
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
    this.speedBtn?.setLabel(`${this.playSpeed.toFixed(1)}×`);
    this.pauseBtn?.setLabel(this.paused ? "▶ RESUME" : "⏸ PAUSE");
  }

  // ========== ループ ==========

  update(time: number, delta: number): void {
    if (this.gameOver) return;
    // SPEC-007 §5.1: 一時停止中は時間も処理も止める。配置 UI のパルスだけは
    // 操作感のため real time で動かし続ける。
    if (this.paused) {
      this.tickPlacementUI(time);
      this.refreshHud();
      return;
    }
    const dt = (delta / 1000) * this.playSpeed;
    this.elapsed += dt;

    this.tickCe(dt);
    this.tickWave();
    this.tickEnemies(dt);
    this.tickPoisonDamage(dt);
    this.tickHeroAttacks();
    this.tickEnemyAttacks();
    this.tickBullets(dt);
    this.tickEnemyBullets(dt);
    this.tickSkills(dt);
    this.tickHeroHpUI();
    this.tickPlacementUI(time);
    this.refreshHud();
    this.checkEndCondition();
  }

  /**
   * SPEC-010 §5.3: poison タイル上の敵に毎秒ダメージ。
   * 各敵の現在タイルが `poison` なら `POISON_DAMAGE_PER_SEC * dt` を hp から減らす。
   * dt 単位で適用するため、フレームレートに依存しない。
   */
  private tickPoisonDamage(dt: number): void {
    for (const enemy of this.enemies) {
      if (enemy.goalReached) continue;
      const eTile = pixelToTile(
        enemy.sprite.x,
        enemy.sprite.y,
        this.map.cols,
        this.map.rows,
      );
      if (!eTile) continue;
      const tileType = this.map.tiles[eTile.row]?.[eTile.col];
      if (tileType !== "poison") continue;
      enemy.hp -= POISON_DAMAGE_PER_SEC * dt;
    }
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
        hero.readyRing = this.addWorld(
          this.add
            .circle(hero.sprite.x, hero.sprite.y, TILE_SIZE * 0.45, theme.accent.primary, 0)
            .setStrokeStyle(2, theme.accent.primary, 0.9)
            .setDepth(22),
        );
      } else if (!ready && hero.readyRing) {
        hero.readyRing.destroy();
        hero.readyRing = null;
      }
      if (hero.readyRing) {
        hero.readyRing.x = hero.sprite.x;
        hero.readyRing.y = hero.sprite.y;
        hero.readyRing.setStrokeStyle(2, theme.accent.primary, 0.6 + 0.4 * Math.abs(Math.sin(this.elapsed * 4)));
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
    // SPEC-006 §5.4: 1 秒で 1 CE 蓄積。`ceProgress` が「1秒ゲージ」そのもの。
    if (this.ce >= this.maxCe) {
      this.ceProgress = 1; // 満タン時はゲージも常に満
      return;
    }
    this.ceProgress += dt * 1.0;
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
    const sprite = this.addWorld(
      this.add
        .sprite(start.x, start.y, TEXTURE_KEYS.enemy(def.id))
        .setDisplaySize(TILE_SIZE, TILE_SIZE)
        .setDepth(30),
    );
    const hpBg = this.addWorld(
      this.add
        .rectangle(start.x, start.y - 28, 40, 5, theme.bg.surface, 0.9)
        .setDepth(31),
    );
    const hp = this.addWorld(
      this.add
        .rectangle(start.x - 20, start.y - 28, 40, 5, theme.accent.danger)
        .setOrigin(0, 0.5)
        .setDepth(32),
    );

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
      lastAttackAt: this.elapsed,
    });
    this.spawnedTotal++;
  }

  /** SPEC-003 §5.5: 出現直前にルートを 1.8 秒だけ光らせる。 */
  private playRouteAnimation(route: RouteDef): void {
    const color = ROUTE_COLOR[route.id] ?? 0xffffff;
    const g = this.addWorld(this.add.graphics());
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

    const color = hero.def.attackType === "INT" ? theme.accent.primary : theme.accent.warn;
    const bulletSprite = this.addWorld(
      this.add.circle(hero.sprite.x, hero.sprite.y, 5, color).setDepth(40),
    );
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

  // ========== SPEC-008: 敵 → ヒーロー攻撃 ==========

  /**
   * SPEC-008 §5.2: 敵の攻撃ロジック。
   *
   * Unity 版 `EnemyRange.cs` は collider overlap で hero を見つけて撃つが、
   * 本実装では「敵がブロックされている == ヒーローと同じタイル」のとき、
   * そのブロック元ヒーローを melee 攻撃する。攻撃間隔 1 秒（Unity 版準拠）。
   */
  private tickEnemyAttacks(): void {
    for (const enemy of this.enemies) {
      if (!enemy.blockedBy) continue;
      const target = enemy.blockedBy;
      if (target.currentHp <= 0) continue;
      // SPEC-009 §5.6: 攻撃間隔は EnemyDef から取得
      if (this.elapsed - enemy.lastAttackAt < enemy.def.attackInterval) continue;
      enemy.lastAttackAt = this.elapsed;
      this.fireEnemyBullet(enemy, target);
    }
  }

  private fireEnemyBullet(enemy: ActiveEnemy, target: PlacedHero): void {
    const damage = calculateDamage({
      attackType: enemy.def.attackType,
      heroPhy: enemy.def.phy,
      heroInt: enemy.def.int,
      enemyPhyDef: target.def.phyDef,
      enemyIntDef: target.def.intDef,
    });
    const color = enemy.def.attackType === "INT" ? 0xc084fc : 0xfb7185;
    const bulletSprite = this.addWorld(
      this.add
        .circle(enemy.sprite.x, enemy.sprite.y, 4, color)
        .setStrokeStyle(1, 0xffffff, 0.7)
        .setDepth(40),
    );
    this.enemyBullets.push({
      sprite: bulletSprite,
      target,
      damage,
      speed: 480,
      done: false,
    });
  }

  private tickEnemyBullets(dt: number): void {
    for (const b of this.enemyBullets) {
      if (b.done) continue;
      const target = b.target;
      if (!target.sprite.active || target.currentHp <= 0) {
        b.done = true;
        continue;
      }
      const dx = target.sprite.x - b.sprite.x;
      const dy = target.sprite.y - b.sprite.y;
      const dist = Math.hypot(dx, dy);
      const step = b.speed * dt;
      if (dist <= step) {
        target.currentHp = Math.max(0, target.currentHp - b.damage);
        b.done = true;
        if (target.currentHp <= 0) this.killHero(target);
      } else {
        b.sprite.x += (dx / dist) * step;
        b.sprite.y += (dy / dist) * step;
      }
    }
    this.enemyBullets = this.enemyBullets.filter((b) => {
      if (b.done) {
        b.sprite.destroy();
        return false;
      }
      return true;
    });
  }

  /** 配置済みヒーローの HP バー位置 / 表示制御 */
  private tickHeroHpUI(): void {
    for (const hero of this.placedHeroes) {
      const x = hero.sprite.x;
      const y = hero.sprite.y - 26;
      hero.hpBarBg.setPosition(x, y);
      hero.hpBar.setPosition(x - 20, y);
      const ratio = Math.max(0, hero.currentHp / hero.maxHp);
      hero.hpBar.displayWidth = 40 * ratio;
      const dmgd = hero.currentHp < hero.maxHp;
      hero.hpBar.setVisible(dmgd);
      hero.hpBarBg.setVisible(dmgd);
      // HP 残量で色分け
      hero.hpBar.fillColor = ratio > 0.5 ? theme.accent.success : ratio > 0.25 ? theme.accent.warn : theme.accent.danger;
    }
  }

  /** ヒーロー死亡処理（敵攻撃で HP 0） */
  private killHero(hero: PlacedHero): void {
    // ステータスパネル開いていれば閉じる
    if (this.statusPanel && this.statusPanelHeroId === hero.def.id) {
      this.closeStatusPanel();
    }
    // ブロック中の敵を解放
    for (const e of this.enemies) {
      if (e.blockedBy === hero) e.blockedBy = null;
    }
    // デバフ巻き戻し
    this.revertDebuffs(hero);
    // ゴースト・各種 UI 破棄
    hero.sprite.destroy();
    for (const r of hero.rangeRects) r.destroy();
    hero.gaugeBg.destroy();
    hero.gaugeFill.destroy();
    hero.hpBar.destroy();
    hero.hpBarBg.destroy();
    hero.readyRing?.destroy();
    hero.aura?.destroy();
    const idx = this.placedHeroes.indexOf(hero);
    if (idx !== -1) this.placedHeroes.splice(idx, 1);
    this.statusText.setText(`${hero.def.name} は撤退しました`);
  }

  private refreshHud(): void {
    this.hpKPI.setValue(`${this.baseHp} / ${this.maxBaseHp}`);
    this.hpBar.setValue(this.baseHp, this.maxBaseHp);
    this.ceKPI.setValue(`${Math.floor(this.ce)}`);
    // 1 秒ゲージ: ceProgress (0..1)
    this.ceBar.setValue(Math.min(1, this.ceProgress), 1);
    // 経過秒を mm:ss 形式で
    const total = Math.floor(this.elapsed);
    const mm = Math.floor(total / 60).toString().padStart(2, "0");
    const ss = (total % 60).toString().padStart(2, "0");
    this.timeKPI.setValue(`${mm}:${ss}`);
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

    // SPEC-014: 勝利時のみクリア記録を localStorage に保存
    if (victory) {
      markStageCleared(this.currentStageId);
    }

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
          color: victory ? hex2css(theme.ink.primary) : hex2css(theme.accent.danger),
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
        { fontSize: "16px", color: hex2css(theme.ink.primary) },
      )
      .setOrigin(0.5);
    // SPEC-011 / SPEC-015: もう一度 / 編成変更 / ステージ選択へ の 3 ボタン
    const retryBtn = this.add
      .text(this.stageWidth / 2 - 130, this.stageHeight / 2 + 70, "[ もう一度 ]", {
        fontSize: "14px",
        color: hex2css(theme.accent.primary),
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    retryBtn.on("pointerdown", () =>
      this.scene.restart({ stageId: this.currentStageId }),
    );

    const partyBtn = this.add
      .text(this.stageWidth / 2, this.stageHeight / 2 + 70, "[ 編成を変える ]", {
        fontSize: "14px",
        color: hex2css(theme.accent.success),
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    partyBtn.on("pointerdown", () => {
      this.scene.start("PartyFormationScene", { stageId: this.currentStageId });
    });

    const selectBtn = this.add
      .text(this.stageWidth / 2 + 130, this.stageHeight / 2 + 70, "[ ステージ選択 ]", {
        fontSize: "14px",
        color: hex2css(theme.ink.primary),
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    selectBtn.on("pointerdown", () => {
      const worldId = this.currentStage?.worldId ?? "world-1";
      this.scene.start("StageSelectScene", { worldId });
    });

    this.endOverlay = this.add.container(0, 0, [overlay, title, sub, retryBtn, partyBtn, selectBtn]);
    this.endOverlay.setDepth(100);
  }
}

export const STAGE_DIMENSIONS = {
  width: STAGE1_MAP.cols * TILE_SIZE + PANEL_SLOT_WIDTH,
  height: STAGE1_MAP.rows * TILE_SIZE + HUD_HEIGHT,
};

if (HEROES.length === 0 || !findHero(HEROES[0].id)) {
  // eslint-disable-next-line no-console
  console.warn("HEROES list is empty or inconsistent");
}
