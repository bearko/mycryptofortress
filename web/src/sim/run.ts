import { ARMOR_MIN_PCT, ENEMIES, INSULATED_LIGHTNING, REVEAL_RANGE, TWIN_ENRAGE, resistOf, type EnemyDef } from "../data/balance/enemies";
import { STONES, STONE_IDS, STONE_NUM, STONE_REVEALS, type StoneId } from "../data/balance/stones";
import { ROLES, heroVisual, maxLevel, roleStats, type RoleId } from "../data/balance/heroes";
import type { LevelDef } from "./level";
import {
  BASE_CRIT_MUL,
  BLAST_PCT,
  BLAST_RADIUS,
  COMBUST_MUL,
  HASTE_CAP,
  HEAVY_SHOT_DAMAGE,
  HEAVY_SHOT_INTERVAL,
  LOST_HP_CAP,
  VOLLEY_DAMAGE,
  VOLLEY_TARGETS,
  WEALTH_CAP,
  emptyModifiers,
  type RunModifiers,
} from "./modifiers";
import { PathGeom } from "./path";
import { Rng } from "./rng";

/** SPEC-102 §2.1: 固定タイムステップ（秒） */
export const TICK = 1 / 30;
/** SPEC-104 §5: GUM ドロップの寿命（秒）と既定の回収半径（マス） */
export const DROP_LIFETIME = 10;
export const COLLECT_RADIUS = 0.7;
/** SPEC-116: 自動回収までの秒数 */
export const AUTO_COLLECT_DELAY = 0.5;
/** 敵の見た目の重なりを避ける、経路法線方向のオフセット幅（マス） */
const LANE_JITTER = 0.18;

/** SPEC-109: 毒（最大 HP の割合 / 秒 + 固定値）と持続 */
export const POISON_PCT = 0.01;
export const POISON_FLAT = 1;
export const POISON_DURATION = 4;
/** SPEC-111: 結界のスタン（確率発動）と諸葛亮の脆弱 */
export const PULSE_STUN = 0.5;
export const ZHUGE_VULN = 0.15;
export const ZHUGE_VULN_DURATION = 2;
/** SPEC-113: Wave の繰り上げ呼び出し（残っている敵 1 体ごとのボーナスと、呼んだ Wave の加速） */
export const EARLY_CALL_BONUS = 2;
export const EARLY_CALL_ACCEL = 0.2;
/** SPEC-118: 装甲の貫通（弓の矢と幻獣砲は装甲を半分無視、一撃特化は全部無視） */
export const ARROW_PIERCE = 0.5;
export const CANNON_PIERCE = 0.5;
/** SPEC-114: 幻獣砲 */
export const CANNON = { cooldown: 0.25, cost: 3, damage: 6, width: 0.45, length: 14, burnDps: 2, burnDuration: 2 };

export const TARGET_MODES = ["first", "strong", "weak", "close", "boss"] as const;
export type TargetMode = (typeof TARGET_MODES)[number];

export type RunStatus = "prep" | "running" | "won" | "lost";

/** SPEC-109: 敵にかかっている状態異常 */
export interface StatusState {
  burnDps: number;
  burnTime: number;
  burnSrc: number;
  poisonDps: number;
  poisonTime: number;
  poisonSrc: number;
  slow: number;
  slowTime: number;
  shock: number;
  stunTime: number;
  vuln: number;
  vulnTime: number;
  /** 加速（Wave 繰り上げ・双子の激昂）。永続 */
  accel: number;
}

export interface EnemyState {
  id: number;
  def: EnemyDef;
  pathIndex: number;
  dist: number;
  offset: number;
  x: number;
  y: number;
  /** 進行方向の x 成分（描画の向き用） */
  dirX: number;
  hp: number;
  maxHp: number;
  /** 出現した Wave の HP 倍率（分裂した子に引き継ぐ） */
  hpMul: number;
  /** 飛翔中の弾の予定ダメージ（撃ちすぎ防止） */
  pending: number;
  /** 跳躍: 次の跳躍までの秒数 / 跳躍の残り秒数（跳躍中でなければ 0） */
  leapCooldown: number;
  leapRemaining: number;
  status: StatusState;
  /** 通行料を払った採掘ヒーローの ID */
  tolledBy: number[];
  /** SPEC-117: 隠密の敵がいま見えているか（隠密でない敵は常に true） */
  revealed: boolean;
  /** 分裂ボスの世代（0 = 本体） */
  gen: number;
  /** 表示倍率（分裂で小さくなる） */
  scale: number;
  /** 撃破 GUM の倍率（分裂体は減る） */
  rewardMul: number;
  /** 回復・召喚の残り秒数 */
  timer: number;
  /** 多節ボス: 共有 HP */
  pool?: HpPool;
  /** SPEC-118: 1 発ごとに減らすダメージ（装甲 × √HP 倍率） */
  armor: number;
}

/** SPEC-117: 多節ボスの共有 HP */
export interface HpPool {
  hp: number;
  maxHp: number;
  members: EnemyState[];
}

export interface HeroState {
  id: number;
  slotIndex: number;
  role: RoleId;
  level: number;
  x: number;
  y: number;
  cooldown: number;
  targetMode: TargetMode;
  totalDamage: number;
  /** 採掘ヒーローが稼いだ GUM */
  totalGum: number;
  facing: 1 | -1;
  /** SPEC-115: 装着中の魔石（属性マスの属性は heroElement() で合成する） */
  stone: StoneId | null;
  /** ガルーダ + 炎の十字火球の残り秒数 */
  crossTimer: number;
}

export interface ProjectileState {
  id: number;
  heroId: number;
  targetId: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  damage: number;
  speed: number;
  crit: boolean;
}

export interface DropState {
  id: number;
  x: number;
  y: number;
  value: number;
  ttl: number;
}

export interface Point {
  x: number;
  y: number;
}

export type SimEvent =
  | { type: "waveStart"; wave: number; boss: boolean; early: boolean }
  | { type: "waveClear"; wave: number; reward: number }
  | { type: "spawn"; enemyId: number }
  | { type: "attack"; heroId: number; targetId: number; tx: number; ty: number }
  | { type: "hit"; enemyId: number; damage: number; x: number; y: number; crit: boolean }
  | { type: "kill"; enemyId: number; x: number; y: number; boss: boolean }
  | { type: "leak"; enemyId: number; damage: number; blocked: boolean; gum: number }
  | { type: "blast"; x: number; y: number; r: number }
  | { type: "lastStand" }
  | { type: "leap"; enemyId: number }
  | { type: "gumOnHit"; x: number; y: number }
  | { type: "heal"; amount: number }
  | { type: "drop"; dropId: number }
  | { type: "collect"; dropId: number; value: number; x: number; y: number }
  | { type: "dropExpire"; dropId: number }
  | { type: "heroPlaced"; heroId: number }
  | { type: "heroLevelUp"; heroId: number; level: number }
  | { type: "chain"; heroId: number; points: Point[] }
  | { type: "pulse"; heroId: number; x: number; y: number; r: number }
  | { type: "flame"; heroId: number; tx: number; ty: number }
  | { type: "discharge"; enemyId: number; x: number; y: number }
  | { type: "combust"; enemyId: number; x: number; y: number; damage: number }
  | { type: "toll"; heroId: number; x: number; y: number; value: number }
  | { type: "payout"; heroId: number; value: number }
  | { type: "enrage"; enemyId: number }
  | { type: "slotOpened"; slotIndex: number }
  | { type: "earlyCall"; bonus: number }
  | { type: "cannon"; x0: number; y0: number; x1: number; y1: number; hits: number }
  | { type: "stoneEquipped"; stone: StoneId; target: number | "cannon" | null }
  | { type: "enemyHeal"; enemyId: number; x: number; y: number; r: number }
  | { type: "summon"; enemyId: number; x: number; y: number }
  | { type: "split"; enemyId: number; x: number; y: number }
  | { type: "cross"; heroId: number; x: number; y: number; len: number }
  | { type: "knockback"; enemyId: number }
  | { type: "won" }
  | { type: "lost" };

/** dealDamage の heroId: 撃破時の爆発（0 は幻獣砲、正の数はヒーロー） */
const BLAST_SOURCE = -1;

export interface RunStats {
  kills: number;
  leaks: number;
  gumEarned: number;
  /** 到達した Wave 数（開始した Wave の数） */
  wavesReached: number;
  /** クリアした Wave 数（SPEC-106 の CE 計算に使う） */
  wavesCleared: number;
  /** 幻獣砲のダメージ合計 */
  cannonDamage: number;
  /** 撃破時の爆発（伏爆の罠）のダメージ合計 */
  blastDamage: number;
}

interface SpawnEntry {
  t: number;
  enemy: string;
  path: number;
  hpMul: number;
  accel: number;
  /** 多節ボスの節（共有 HP に加わる） */
  pool?: HpPool;
}

const newStatus = (): StatusState => ({
  burnDps: 0,
  burnTime: 0,
  burnSrc: 0,
  poisonDps: 0,
  poisonTime: 0,
  poisonSrc: 0,
  slow: 0,
  slowTime: 0,
  shock: 0,
  stunTime: 0,
  vuln: 0,
  vulnTime: 0,
  accel: 0,
});

/**
 * SPEC-102: 1 ランの決定的シミュレーション。Phaser に依存しない。
 * 描画側はコマンドを呼び、`step()` を回し、状態と `drainEvents()` を読む。
 */
export class RunSim {
  status: RunStatus = "prep";
  tick = 0;
  gum: number;
  hp: number;
  readonly maxHp: number;
  /** 0 始まり。開始前は -1 */
  waveIndex = -1;
  /** 次 Wave までの秒数。Wave 進行中（出現中 or 敵が残っている）は null */
  nextWaveIn: number | null;
  enemies: EnemyState[] = [];
  heroes: HeroState[] = [];
  projectiles: ProjectileState[] = [];
  drops: DropState[] = [];
  /** 開放済みのロックマス（スロット番号） */
  readonly openedSlots = new Set<number>();
  readonly stats: RunStats = { kills: 0, leaks: 0, gumEarned: 0, wavesReached: 0, wavesCleared: 0, cannonDamage: 0, blastDamage: 0 };
  readonly paths: PathGeom[];
  /** 幻獣の位置（マス座標の中心） */
  readonly cryptidPos: Point;

  private readonly rng: Rng;
  private spawnQueue: SpawnEntry[] = [];
  private waveTime = 0;
  private nextId = 1;
  private events: SimEvent[] = [];
  private lastStandUsed = false;
  private cannonCooldown = 0;
  /** SPEC-115: 魔石の装着先（ヒーロー ID / 幻獣砲）。未装着は入らない */
  private readonly stoneHolder = new Map<StoneId, number | "cannon">();

  constructor(
    readonly level: LevelDef,
    seed: number,
    readonly mods: RunModifiers = emptyModifiers(),
  ) {
    this.rng = new Rng(seed);
    this.gum = level.startGum + mods.startGumAdd;
    this.hp = this.maxHp = level.cryptidHp + mods.maxHpAdd;
    this.nextWaveIn = level.prepSeconds;
    this.paths = level.paths.map((p) => new PathGeom(p.id, p.points));
    this.cryptidPos = { x: level.cryptid.col + 0.5, y: level.cryptid.row + 0.5 };
  }

  get time(): number {
    return this.tick * TICK;
  }

  get wavesTotal(): number {
    return this.level.waves.length;
  }

  get isOver(): boolean {
    return this.status === "won" || this.status === "lost";
  }

  // ─── ヒーロー ───────────────────────────────────────────

  heroAt(slotIndex: number): HeroState | undefined {
    return this.heroes.find((h) => h.slotIndex === slotIndex);
  }

  /** SPEC-110〜113: ツリーで解放済みのロールか（弓は最初から） */
  isRoleUnlocked(role: RoleId): boolean {
    const key = ROLES[role].unlock;
    return !key || this.mods[key] > 0;
  }

  unlockedRoles(): RoleId[] {
    return (Object.keys(ROLES) as RoleId[]).filter((r) => this.isRoleUnlocked(r));
  }

  /** ツリーの交代ノードを反映したヒーローの見た目・名前 */
  heroVisual(role: RoleId): { heroId: number; heroName: string; imageKey: string } {
    return heroVisual(ROLES[role], this.mods);
  }

  /** SPEC-108: ツリー補正込みの配置コスト（ブレイブショットは弓のみ） */
  placeCost(role: RoleId): number {
    const flat = role === "archer" ? this.mods.placeCostFlat : 0;
    return Math.max(10, ROLES[role].placeCost - flat);
  }

  // ─── 魔石（SPEC-115） ───────────────────────────────────

  isStoneUnlocked(id: StoneId): boolean {
    return this.mods[STONES[id].unlock] > 0;
  }

  unlockedStones(): StoneId[] {
    return STONE_IDS.filter((id) => this.isStoneUnlocked(id));
  }

  /** 魔石の装着先（なければ null） */
  stoneHolderOf(id: StoneId): number | "cannon" | null {
    return this.stoneHolder.get(id) ?? null;
  }

  /** 属性マスの属性 */
  slotElement(slotIndex: number): StoneId | null {
    return this.level.slots[slotIndex]?.element ?? null;
  }

  /** ヒーローの属性（属性マスが優先） */
  heroElement(hero: HeroState): StoneId | null {
    return this.slotElement(hero.slotIndex) ?? hero.stone;
  }

  get cannonStone(): StoneId | null {
    for (const [id, t] of this.stoneHolder) if (t === "cannon") return id;
    return null;
  }

  /** 魔石を装着する（別の装着先から付け替え）。属性マスのヒーローには付けられない */
  equipStone(id: StoneId, target: number | "cannon"): boolean {
    if (this.isOver || !this.isStoneUnlocked(id)) return false;
    if (target === "cannon") {
      if (!this.cannonUnlocked) return false;
      const prev = this.cannonStone;
      if (prev) this.stoneHolder.delete(prev);
    } else {
      const hero = this.findHero(target);
      if (!hero || this.slotElement(hero.slotIndex)) return false;
      if (hero.stone) this.stoneHolder.delete(hero.stone);
      hero.stone = id;
    }
    const from = this.stoneHolder.get(id);
    if (typeof from === "number") {
      const h = this.findHero(from);
      if (h) h.stone = null;
    }
    this.stoneHolder.set(id, target);
    this.emit({ type: "stoneEquipped", stone: id, target });
    return true;
  }

  unequipStone(id: StoneId): void {
    const from = this.stoneHolder.get(id);
    if (from === undefined) return;
    if (typeof from === "number") {
      const h = this.findHero(from);
      if (h) h.stone = null;
    }
    this.stoneHolder.delete(id);
    this.emit({ type: "stoneEquipped", stone: id, target: null });
  }

  /** GUM の回収半径（マス） */
  get collectRadius(): number {
    return COLLECT_RADIUS + this.mods.collectRadiusAdd;
  }

  // ─── ロックマス（SPEC-113） ─────────────────────────────

  isSlotOpen(slotIndex: number): boolean {
    const s = this.level.slots[slotIndex];
    return !!s && (s.kind !== "locked" || this.openedSlots.has(slotIndex));
  }

  slotOpenCost(slotIndex: number): number | null {
    const s = this.level.slots[slotIndex];
    if (!s || s.kind !== "locked" || this.openedSlots.has(slotIndex)) return null;
    return Math.max(1, Math.round((s.cost ?? 0) * (1 - this.mods.lockedSlotCostPct)));
  }

  openSlot(slotIndex: number): boolean {
    const cost = this.slotOpenCost(slotIndex);
    if (cost === null || this.isOver || this.gum < cost) return false;
    this.gum -= cost;
    this.openedSlots.add(slotIndex);
    this.emit({ type: "slotOpened", slotIndex });
    return true;
  }

  canPlace(slotIndex: number, role: RoleId): boolean {
    return (
      !this.isOver &&
      this.isRoleUnlocked(role) &&
      slotIndex >= 0 &&
      slotIndex < this.level.slots.length &&
      this.isSlotOpen(slotIndex) &&
      !this.heroAt(slotIndex) &&
      this.gum >= this.placeCost(role)
    );
  }

  placeHero(slotIndex: number, role: RoleId): HeroState | null {
    if (!this.canPlace(slotIndex, role)) return null;
    const slot = this.level.slots[slotIndex];
    this.gum -= this.placeCost(role);
    const hero: HeroState = {
      id: this.nextId++,
      slotIndex,
      role,
      level: 1,
      x: slot.col + 0.5,
      y: slot.row + 0.5,
      cooldown: 0,
      targetMode: "first",
      totalDamage: 0,
      totalGum: 0,
      facing: 1,
      stone: null,
      crossTimer: 0,
    };
    this.heroes.push(hero);
    this.emit({ type: "heroPlaced", heroId: hero.id });
    return hero;
  }

  /** 次レベルへの費用。最大レベルなら null */
  levelUpCost(hero: HeroState): number | null {
    const role = ROLES[hero.role];
    if (hero.level >= maxLevel(role)) return null;
    return Math.max(1, Math.round(role.levelUpCosts[hero.level - 1] * (1 - this.mods.levelCostPct)));
  }

  levelUp(heroId: number): boolean {
    const hero = this.findHero(heroId);
    if (!hero || this.isOver) return false;
    const cost = this.levelUpCost(hero);
    if (cost === null || this.gum < cost) return false;
    this.gum -= cost;
    hero.level += 1;
    this.emit({ type: "heroLevelUp", heroId: hero.id, level: hero.level });
    return true;
  }

  setTargetMode(heroId: number, mode: TargetMode): void {
    const hero = this.findHero(heroId);
    if (hero) hero.targetMode = mode;
  }

  /** ツリー補正込みの性能（ボス補正・会心・所持 GUM 補正は命中時に別途掛かる） */
  heroStats(hero: HeroState, level = hero.level): { damage: number; interval: number; range: number } {
    const st = this.statsFor(hero.role, level);
    const el = this.heroElement(hero);
    const N = STONE_NUM;
    if (el === "garuda") {
      if (hero.role === "archer") st.interval /= 1 + N.garudaArcherSpeed;
      if (hero.role === "pulse") st.interval *= N.garudaPulseInterval;
      if (hero.role === "miner") st.range += N.garudaMinerRange;
    }
    if (el === "tiamat") {
      if (hero.role === "archer") st.damage *= 1 + N.tiamatArcherDmg;
      if (hero.role === "fire") st.damage *= 1 + N.tiamatFireDmg;
    }
    return st;
  }

  /** 配置前のプレビューにも使う: ロールとレベルから性能を出す */
  statsFor(role: RoleId, level = 1): { damage: number; interval: number; range: number } {
    const base = roleStats(ROLES[role], level);
    const m = this.mods;
    const by: Record<RoleId, { dmg: number; speed: number; range: number }> = {
      archer: { dmg: m.damagePct, speed: m.attackSpeedPct, range: m.rangeAdd },
      lightning: { dmg: m.lightningDamagePct, speed: 0, range: 0 },
      pulse: { dmg: m.pulseDamagePct, speed: 0, range: m.pulseRangeAdd },
      fire: { dmg: m.fireDamagePct, speed: 0, range: m.fireRangeAdd },
      miner: { dmg: 0, speed: 0, range: m.minerRangeAdd },
    };
    const b = by[role];
    const heavy = role === "archer" && m.heavyShot > 0;
    return {
      damage: base.damage * (1 + b.dmg) * (heavy ? HEAVY_SHOT_DAMAGE : 1),
      interval: (base.interval / Math.max(0.2, 1 + b.speed)) * (heavy ? HEAVY_SHOT_INTERVAL : 1),
      range: base.range + b.range,
    };
  }

  /** 充電: 結界ヒーローの範囲内にいれば攻撃間隔がこの割合だけ短くなる（0〜HASTE_CAP） */
  hasteFor(hero: HeroState): number {
    if (this.mods.pulseHaste <= 0 || hero.role === "pulse" || hero.role === "miner") return 0;
    const covered = this.heroes.some(
      (p) => p.role === "pulse" && p !== hero && Math.hypot(p.x - hero.x, p.y - hero.y) <= this.heroStats(p).range,
    );
    return covered ? Math.min(HASTE_CAP, this.mods.pulseHaste) : 0;
  }

  /** 背水: 失った幻獣 HP に応じたヒーローの攻撃力補正 */
  get lostHpBonus(): number {
    return Math.min(LOST_HP_CAP, this.mods.lostHpDamagePct * Math.max(0, this.maxHp - this.hp));
  }

  /** 採掘ヒーローの通行料（1 体あたり） */
  tollFor(hero: HeroState): number {
    const miner = ROLES[hero.role].miner;
    if (!miner) return 0;
    const toll = miner.tollPerLevel * hero.level + this.mods.minerTollAdd;
    return this.heroElement(hero) === "tiamat" ? toll * STONE_NUM.tiamatMinerMul : toll;
  }

  /** 採掘ヒーローの Wave クリア配当 */
  payoutFor(hero: HeroState): number {
    const miner = ROLES[hero.role].miner;
    if (!miner) return 0;
    const garuda = this.heroElement(hero) === "garuda" ? STONE_NUM.garudaMinerPayout : 0;
    return Math.round(miner.payoutPerLevel * hero.level * (1 + this.mods.minerPayoutPct + garuda));
  }

  /** 炎ヒーローが 1 回の命中で積む炎上（毎秒ダメージ） */
  burnPerHit(hero: HeroState): number {
    const flame = ROLES[hero.role].flame;
    if (!flame) return 0;
    const lvMul = ROLES[hero.role].perLevel.damageMul ** (hero.level - 1);
    const ifrit = this.heroElement(hero) === "ifrit" ? STONE_NUM.ifritFireBurnMul : 1;
    return flame.burnPerHit * lvMul * (1 + this.mods.fireBurnPct) * (1 + this.mods.fireDamagePct) * ifrit;
  }

  // ─── Wave ───────────────────────────────────────────────

  /** 開始前、または Wave 間の休憩中なら次の Wave を即開始できる */
  canStartNextWave(): boolean {
    return !this.isOver && this.nextWaveIn !== null;
  }

  startNextWave(): boolean {
    if (!this.canStartNextWave()) return false;
    this.beginWave(this.waveIndex + 1, false);
    return true;
  }

  /**
   * SPEC-113: Wave の繰り上げ呼び出し。今の Wave の出現が終わっていて敵が残っている間、
   * 次の Wave を今すぐ呼べる。残っている敵 1 体ごとにボーナス GUM、呼んだ Wave の敵は加速する。
   */
  earlyCallBonus(): number | null {
    if (this.isOver || this.mods.unlockSkip <= 0 || this.nextWaveIn !== null) return null;
    if (this.waveIndex < 0 || this.waveIndex >= this.wavesTotal - 1) return null;
    if (this.spawnQueue.length > 0 || this.enemies.length === 0) return null;
    return Math.round(this.enemies.length * EARLY_CALL_BONUS * (1 + this.mods.skipBonusPct));
  }

  callEarly(): boolean {
    const bonus = this.earlyCallBonus();
    if (bonus === null) return false;
    this.gum += bonus;
    this.stats.gumEarned += bonus;
    this.emit({ type: "earlyCall", bonus });
    this.clearWave();
    this.beginWave(this.waveIndex + 1, true);
    return true;
  }

  // ─── GUM ────────────────────────────────────────────────

  /** (x, y) から半径 r 以内の GUM を回収し、回収額を返す */
  collectDropsAt(x: number, y: number, r = this.collectRadius): number {
    if (this.isOver) return 0;
    let total = 0;
    this.drops = this.drops.filter((d) => {
      if (Math.hypot(d.x - x, d.y - y) > r) return true;
      total += d.value;
      this.emit({ type: "collect", dropId: d.id, value: d.value, x: d.x, y: d.y });
      return false;
    });
    this.gum += total;
    this.stats.gumEarned += total;
    return total;
  }

  // ─── 幻獣砲（SPEC-114） ─────────────────────────────────

  get cannonUnlocked(): boolean {
    return this.mods.unlockCannon > 0;
  }

  get cannonCost(): number {
    return Math.max(1, CANNON.cost - this.mods.cannonCostDown);
  }

  canFireCannon(): boolean {
    return !this.isOver && this.cannonUnlocked && this.cannonCooldown <= 0 && this.gum >= this.cannonCost;
  }

  /** 幻獣から (tx, ty) の方向へ貫通する光線を撃つ */
  fireCannon(tx: number, ty: number): boolean {
    if (!this.canFireCannon()) return false;
    const o = this.cryptidPos;
    const len = Math.hypot(tx - o.x, ty - o.y);
    if (len < 0.01) return false;
    this.gum -= this.cannonCost;
    this.cannonCooldown = CANNON.cooldown;
    const ux = (tx - o.x) / len;
    const uy = (ty - o.y) / len;
    const x1 = o.x + ux * CANNON.length;
    const y1 = o.y + uy * CANNON.length;
    const stone = this.cannonStone;
    const width = (CANNON.width + this.mods.cannonWidthAdd) * (stone === "garuda" ? STONE_NUM.garudaCannonWidth : 1);
    const damage = CANNON.damage * (1 + this.mods.cannonDamagePct);
    let hits = 0;
    for (const e of [...this.enemies]) {
      if (e.hp <= 0) continue;
      const t = (e.x - o.x) * ux + (e.y - o.y) * uy;
      if (t < 0 || t > CANNON.length) continue;
      const d = Math.abs((e.x - o.x) * uy - (e.y - o.y) * ux);
      if (d > width) continue;
      hits++;
      if (this.mods.cannonBurn > 0 || stone === "ifrit") this.applyBurn(e, CANNON.burnDps, CANNON.burnDuration, 0, Infinity);
      if (stone === "leviathan") this.applySlow(e, STONE_NUM.cannonSlow, STONE_NUM.levSlowDuration);
      if (stone === "tiamat") this.applyPoison(e, 0);
      this.strike(e, damage, 0, false, { pierce: CANNON_PIERCE });
    }
    this.emit({ type: "cannon", x0: o.x, y0: o.y, x1, y1, hits });
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    return true;
  }

  drainEvents(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  // ─── 進行 ───────────────────────────────────────────────

  step(): void {
    if (this.isOver) return;
    this.tick += 1;
    this.cannonCooldown = Math.max(0, this.cannonCooldown - TICK);

    if (this.nextWaveIn !== null) {
      this.nextWaveIn -= TICK;
      if (this.nextWaveIn <= 1e-9) this.beginWave(this.waveIndex + 1, false);
    }
    this.spawnDue();
    this.updateStatuses();
    this.moveEnemies();
    if (this.isOver) return;
    this.updateGimmicks();
    this.updateReveal();
    this.updateMiners();
    this.updateHeroes();
    this.updateProjectiles();
    this.updateDrops();
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    this.checkWaveClear();
  }

  /** seconds 秒ぶん step する */
  advance(seconds: number): void {
    const n = Math.round(seconds / TICK);
    for (let i = 0; i < n && !this.isOver; i++) this.step();
  }

  private beginWave(index: number, early: boolean): void {
    const wave = this.level.waves[index];
    this.waveIndex = index;
    this.nextWaveIn = null;
    this.status = "running";
    this.waveTime = 0;
    this.stats.wavesReached = index + 1;
    const accel = early ? EARLY_CALL_ACCEL : 0;
    const queue: SpawnEntry[] = [];
    for (const g of wave.groups) {
      const path = this.level.paths.findIndex((p) => p.id === g.path);
      for (let i = 0; i < g.count; i++) queue.push({ t: g.delay + i * g.interval, enemy: g.enemy, path, hpMul: wave.hpMul, accel });
    }
    // 同時刻は定義順を保つ（安定ソート）
    this.spawnQueue = queue.sort((a, b) => a.t - b.t);
    this.emit({ type: "waveStart", wave: index, boss: wave.groups.some((g) => ENEMIES[g.enemy].boss), early });
  }

  private spawnDue(): void {
    if (this.waveIndex < 0 || this.spawnQueue.length === 0) return;
    this.waveTime += TICK;
    while (this.spawnQueue.length > 0 && this.spawnQueue[0].t <= this.waveTime + 1e-9) {
      const s = this.spawnQueue.shift()!;
      if (s.pool && s.pool.hp <= 0) continue; // 本体ごと倒された節は出さない
      const e = this.spawnEnemy(ENEMIES[s.enemy], s.path, 0, s.hpMul, s.pool);
      e.status.accel = s.accel;
    }
  }

  private spawnEnemy(def: EnemyDef, pathIndex: number, dist: number, hpMul: number, pool?: HpPool): EnemyState {
    const hp = pool ? pool.hp : def.hp * hpMul;
    const enemy: EnemyState = {
      id: this.nextId++,
      def,
      pathIndex,
      dist,
      offset: (this.rng.next() * 2 - 1) * LANE_JITTER,
      x: 0,
      y: 0,
      dirX: 0,
      hp,
      maxHp: hp,
      hpMul,
      pending: 0,
      leapCooldown: def.leap?.interval ?? 0,
      leapRemaining: 0,
      status: newStatus(),
      tolledBy: [],
      revealed: !def.stealth,
      gen: 0,
      scale: def.scale ?? 1,
      rewardMul: 1,
      timer: def.healer?.interval ?? def.summon?.interval ?? 0,
      armor: (def.armor ?? 0) * Math.sqrt(hpMul),
    };
    if (pool) {
      enemy.maxHp = pool.maxHp;
      enemy.pool = pool;
      pool.members.push(enemy);
    }
    this.placeOnPath(enemy);
    this.enemies.push(enemy);
    this.emit({ type: "spawn", enemyId: enemy.id });
    // SPEC-117 多節ボス: 節を後ろに連ねて出す（全員で HP を共有）
    if (def.segments && !pool) {
      const shared: HpPool = { hp, maxHp: hp, members: [enemy] };
      enemy.pool = shared;
      const seg = def.segments;
      for (let k = 1; k <= seg.count; k++) {
        this.spawnQueue.push({ t: this.waveTime + (k * seg.spacing) / def.speed, enemy: seg.enemy, path: pathIndex, hpMul, accel: 0, pool: shared });
      }
      this.spawnQueue.sort((a, b) => a.t - b.t);
    }
    return enemy;
  }

  // ─── ギミック（SPEC-117） ──────────────────────────────

  /** 回復と召喚 */
  private updateGimmicks(): void {
    for (const e of [...this.enemies]) {
      const heal = e.def.healer;
      const summon = e.def.summon;
      if (!heal && !summon) continue;
      if (e.status.stunTime > 0) continue;
      e.timer -= TICK;
      if (e.timer > 0) continue;
      if (heal) {
        e.timer = heal.interval;
        for (const o of this.enemies) {
          if (o === e || o.hp <= 0 || o.pool || o.hp >= o.maxHp || Math.hypot(o.x - e.x, o.y - e.y) > heal.radius) continue;
          o.hp = Math.min(o.maxHp, o.hp + o.maxHp * heal.pct);
        }
        this.emit({ type: "enemyHeal", enemyId: e.id, x: e.x, y: e.y, r: heal.radius });
      }
      if (summon) {
        e.timer = summon.interval;
        for (let i = 0; i < summon.count; i++) {
          this.spawnEnemy(ENEMIES[summon.enemy], e.pathIndex, Math.max(0, e.dist - 0.3 * i), e.hpMul);
        }
        this.emit({ type: "summon", enemyId: e.id, x: e.x, y: e.y });
      }
    }
  }

  /** 隠密: ヒーローの近く、またはガルーダ（風）のヒーローの射程内で見える */
  private updateReveal(): void {
    const seers = this.heroes.map((h) => ({
      h,
      r: Math.max(REVEAL_RANGE, this.heroElement(h) === STONE_REVEALS ? this.heroStats(h).range : 0),
    }));
    for (const e of this.enemies) {
      if (!e.def.stealth) continue;
      e.revealed = seers.some(({ h, r }) => Math.hypot(e.x - h.x, e.y - h.y) <= r);
    }
  }

  private placeOnPath(e: EnemyState): void {
    const { pos, dir } = this.paths[e.pathIndex].sample(e.dist);
    e.x = pos.x - dir.y * e.offset;
    e.y = pos.y + dir.x * e.offset;
    e.dirX = dir.x;
  }

  // ─── 状態異常（SPEC-109） ───────────────────────────────

  private updateStatuses(): void {
    for (const e of this.enemies) {
      const s = e.status;
      if (s.burnTime > 0) {
        s.burnTime -= TICK;
        this.dealDamage(e, s.burnDps * TICK, s.burnSrc, false, true);
        if (s.burnTime <= 0) s.burnDps = 0;
      }
      if (s.poisonTime > 0) {
        s.poisonTime -= TICK;
        this.dealDamage(e, s.poisonDps * TICK, s.poisonSrc, false, true);
        if (s.poisonTime <= 0) s.poisonDps = 0;
      }
      if (s.slowTime > 0 && (s.slowTime -= TICK) <= 0) s.slow = 0;
      if (s.vulnTime > 0 && (s.vulnTime -= TICK) <= 0) s.vuln = 0;
      if (s.stunTime > 0) s.stunTime = Math.max(0, s.stunTime - TICK);
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);
  }

  /** 炎上: 毎秒ダメージを積み（上限あり）、持続を更新する */
  private applyBurn(e: EnemyState, dps: number, duration: number, src: number, cap: number): void {
    const r = 1 - resistOf(e.def);
    e.status.burnDps = Math.min(cap * r, e.status.burnDps + dps * r);
    e.status.burnTime = Math.max(e.status.burnTime, duration);
    e.status.burnSrc = src;
  }

  private applyPoison(e: EnemyState, src: number): void {
    const r = 1 - resistOf(e.def);
    e.status.poisonDps = Math.max(e.status.poisonDps, (e.maxHp * POISON_PCT + POISON_FLAT) * r);
    e.status.poisonTime = POISON_DURATION;
    e.status.poisonSrc = src;
  }

  private applySlow(e: EnemyState, amount: number, duration: number): void {
    const r = 1 - resistOf(e.def);
    e.status.slow = Math.min(0.8, Math.max(e.status.slow, amount * r));
    e.status.slowTime = Math.max(e.status.slowTime, duration);
  }

  private applyStun(e: EnemyState, duration: number): void {
    e.status.stunTime = Math.max(e.status.stunTime, duration * (1 - resistOf(e.def)));
  }

  private applyVuln(e: EnemyState, amount: number, duration: number): void {
    e.status.vuln = Math.max(e.status.vuln, amount);
    e.status.vulnTime = Math.max(e.status.vulnTime, duration);
  }

  /** 状態異常の種類数（実績「Rough Day」相当の確認用） */
  static statusCount(e: EnemyState): number {
    const s = e.status;
    return [s.burnTime > 0, s.poisonTime > 0, s.slowTime > 0, s.shock > 0 || s.stunTime > 0, s.vulnTime > 0].filter(Boolean).length;
  }

  // ─── 移動 ───────────────────────────────────────────────

  private moveEnemies(): void {
    const survivors: EnemyState[] = [];
    for (const e of this.enemies) {
      const s = e.status;
      let speed = s.stunTime > 0 ? 0 : e.def.speed * (1 - s.slow) * (1 + s.accel);
      const leap = e.def.leap;
      if (leap && s.stunTime <= 0) {
        if (e.leapRemaining > 0) {
          e.leapRemaining = Math.max(0, e.leapRemaining - TICK);
          speed += leap.distance / leap.duration;
        } else {
          e.leapCooldown -= TICK;
          if (e.leapCooldown <= 0) {
            e.leapCooldown = leap.interval;
            e.leapRemaining = leap.duration;
            this.emit({ type: "leap", enemyId: e.id });
          }
        }
      }
      e.dist += speed * TICK;
      if (e.dist >= this.paths[e.pathIndex].length) {
        this.onLeak(e);
        continue;
      }
      this.placeOnPath(e);
      survivors.push(e);
    }
    this.enemies = survivors;
    if (this.hp > 0 && this.mods.regenPerSec > 0) this.hp = Math.min(this.maxHp, this.hp + this.mods.regenPerSec * TICK);
    if (this.hp <= 0) {
      this.hp = 0;
      this.status = "lost";
      this.emit({ type: "lost" });
    }
  }

  private onLeak(e: EnemyState): void {
    this.stats.leaks += 1;
    if (!e.def.boss && this.mods.leakIgnoreChance > 0 && this.rng.chance(this.mods.leakIgnoreChance)) {
      this.emit({ type: "leak", enemyId: e.id, damage: 0, blocked: true, gum: 0 });
      return;
    }
    if (e.def.boss && this.mods.lastStand > 0 && !this.lastStandUsed && this.hp - e.def.leak <= 0) {
      this.lastStandUsed = true;
      this.hp = 1;
      this.emit({ type: "leak", enemyId: e.id, damage: 0, blocked: true, gum: 0 });
      this.emit({ type: "lastStand" });
      return;
    }
    this.hp -= e.def.leak;
    const gum = Math.round(e.def.leak * this.mods.gumOnLeak);
    if (gum > 0) {
      this.gum += gum;
      this.stats.gumEarned += gum;
    }
    this.emit({ type: "leak", enemyId: e.id, damage: e.def.leak, blocked: false, gum });
  }

  // ─── ヒーローの行動 ─────────────────────────────────────

  private updateMiners(): void {
    for (const h of this.heroes) {
      if (h.role !== "miner") continue;
      const range = this.heroStats(h).range;
      const toll = this.tollFor(h);
      for (const e of this.enemies) {
        if (e.tolledBy.includes(h.id) || Math.hypot(e.x - h.x, e.y - h.y) > range) continue;
        e.tolledBy.push(h.id);
        const el = this.heroElement(h);
        if (el === "ifrit") this.applyBurn(e, STONE_NUM.ifritMinerBurn * h.level, STONE_NUM.ifritBurnDuration, h.id, STONE_NUM.ifritMinerBurn * h.level * 3);
        if (el === "leviathan") this.applySlow(e, STONE_NUM.levMinerSlow, STONE_NUM.levMinerSlowDuration);
        this.gum += toll;
        this.stats.gumEarned += toll;
        h.totalGum += toll;
        this.emit({ type: "toll", heroId: h.id, x: e.x, y: e.y, value: toll });
      }
    }
  }

  private updateHeroes(): void {
    for (const h of this.heroes) {
      if (h.role === "miner") continue;
      h.cooldown = Math.max(0, h.cooldown - TICK);
      if (h.cooldown > 0) continue;
      const stats = this.heroStats(h);
      if (h.role === "pulse") {
        if (this.pulse(h, stats)) h.cooldown = stats.interval;
        continue;
      }
      const target = this.selectTarget(h, stats.range);
      if (!target) continue;
      h.cooldown = stats.interval * (1 - this.hasteFor(h));
      h.facing = target.x < h.x ? -1 : 1;
      if (h.role === "lightning") this.lightning(h, target, stats.damage);
      else if (h.role === "fire") this.flame(h, target, stats);
      else this.archer(h, target, stats);
      this.emit({ type: "attack", heroId: h.id, targetId: target.id, tx: target.x, ty: target.y });
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);
  }

  private archer(h: HeroState, target: EnemyState, stats: { damage: number; range: number }): void {
    if (this.mods.volley > 0) {
      const targets = [target];
      while (targets.length < VOLLEY_TARGETS) {
        const next = this.selectTarget(h, stats.range, targets);
        if (!next) break;
        targets.push(next);
      }
      for (const t of targets) this.fire(h, t, stats.damage * VOLLEY_DAMAGE);
      return;
    }
    this.fire(h, target, stats.damage);
    // ガルーダ（疾風）: 毎回もう 1 体に撃つ
    if (this.heroElement(h) === "garuda") {
      const second = this.selectTarget(h, stats.range, [target]);
      if (second) this.fire(h, second, stats.damage);
    }
    if (this.mods.extraShotChance > 0 && this.rng.chance(this.mods.extraShotChance)) {
      const second = this.selectTarget(h, stats.range, [target]);
      if (second) this.fire(h, second, stats.damage);
    }
  }

  /** SPEC-110: 雷。初撃から近くの敵へ連鎖し、感電を積む。閾値で放電（スタン） */
  private lightning(h: HeroState, first: EnemyState, damage: number): void {
    const c = ROLES.lightning.chain!;
    const el = this.heroElement(h);
    const garuda = el === "garuda";
    const jumps = c.jumps + this.mods.lightningChains + (garuda ? STONE_NUM.garudaChains : 0);
    const jumpRange = c.jumpRange + (garuda ? STONE_NUM.garudaJumpRange : 0);
    const hit: EnemyState[] = [];
    let cur: EnemyState | undefined = first;
    const points: Point[] = [{ x: h.x, y: h.y }];
    for (let k = 0; cur && k <= jumps; k++) {
      hit.push(cur);
      points.push({ x: cur.x, y: cur.y });
      const dmg = damage * (1 - c.falloff) ** k;
      this.strike(cur, dmg, h.id, false, { lightning: true });
      if (el === "ifrit" && cur.hp > 0) this.applyBurn(cur, dmg * STONE_NUM.ifritBurnPct, STONE_NUM.ifritBurnDuration, h.id, dmg * STONE_NUM.ifritBurnPct * 4);
      if (el === "tiamat" && cur.hp > 0) this.applyPoison(cur, h.id);
      const s = cur.status;
      if (!cur.def.insulated) s.shock += c.shockPerHit + this.mods.lightningShock;
      if (s.shock >= c.shockThreshold && cur.hp > 0) {
        s.shock = 0;
        this.applyStun(cur, c.stun + this.mods.dischargeStunAdd);
        this.emit({ type: "discharge", enemyId: cur.id, x: cur.x, y: cur.y });
        if (this.mods.arcFlash > 0) this.strike(cur, dmg * 3, h.id, false, { lightning: true });
        // リヴァイアサン: 放電で押し戻す（ボスは半分）
        if (el === "leviathan" && cur.hp > 0) {
          cur.dist = Math.max(0, cur.dist - STONE_NUM.levKnockback * (1 - resistOf(cur.def)));
          this.placeOnPath(cur);
          this.applySlow(cur, STONE_NUM.levSlow, STONE_NUM.levSlowDuration);
          this.emit({ type: "knockback", enemyId: cur.id });
        }
      }
      const from: EnemyState = cur;
      cur = this.enemies
        .filter((e) => e.hp > 0 && !hit.includes(e) && Math.hypot(e.x - from.x, e.y - from.y) <= jumpRange)
        .sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y) || a.id - b.id)[0];
    }
    this.emit({ type: "chain", heroId: h.id, points });
  }

  /** SPEC-111: 結界。範囲内の全員にダメージと鈍足。敵がいなければ撃たない */
  private pulse(h: HeroState, stats: { damage: number; range: number }): boolean {
    const inRange = this.enemies.filter((e) => e.hp > 0 && Math.hypot(e.x - h.x, e.y - h.y) <= stats.range);
    if (inRange.length === 0) return false;
    const p = ROLES.pulse.pulse!;
    const el = this.heroElement(h);
    const lev = el === "leviathan";
    const stun = this.mods.pulseStunChance + (lev ? STONE_NUM.levPulseStun : 0);
    for (const e of inRange) {
      this.applySlow(e, p.slow + this.mods.pulseSlowAdd + (lev ? STONE_NUM.levPulseSlow : 0), p.slowDuration + this.mods.pulseSlowDurAdd);
      if (this.mods.pulseZhuge > 0) this.applyVuln(e, ZHUGE_VULN, ZHUGE_VULN_DURATION);
      if (stun > 0 && this.rng.chance(stun)) this.applyStun(e, PULSE_STUN);
      if (el === "ifrit") this.applyBurn(e, stats.damage, STONE_NUM.ifritBurnDuration, h.id, stats.damage * 4);
      if (el === "tiamat") this.applyPoison(e, h.id);
      this.strike(e, stats.damage, h.id, false);
    }
    this.emit({ type: "pulse", heroId: h.id, x: h.x, y: h.y, r: stats.range });
    return true;
  }

  /** SPEC-112: 炎。標的とその周りに小ダメージと炎上を積む */
  private flame(h: HeroState, target: EnemyState, stats: { damage: number; interval: number; range: number }): void {
    const f = ROLES.fire.flame!;
    const el = this.heroElement(h);
    const damage = stats.damage;
    const burn = this.burnPerHit(h);
    const duration = f.burnDuration + this.mods.fireBurnDurAdd;
    const cap = burn * f.burnCapHits * (el === "ifrit" ? STONE_NUM.ifritFireCapMul : 1);
    const victims = this.enemies.filter((e) => e.hp > 0 && Math.hypot(e.x - target.x, e.y - target.y) <= f.splash);
    for (const e of victims) {
      this.applyBurn(e, burn, duration, h.id, cap);
      if (el === "leviathan") this.applySlow(e, STONE_NUM.levFireSlow, STONE_NUM.levSlowDuration);
      this.strike(e, damage, h.id, false, { silent: true });
    }
    this.emit({ type: "flame", heroId: h.id, tx: target.x, ty: target.y });
    // ガルーダ（十字火球）: 1 秒ごとに縦横 4 方向へ貫通する火を放つ
    if (el === "garuda") {
      h.crossTimer -= stats.interval;
      if (h.crossTimer <= 0) {
        h.crossTimer = 1;
        const len = stats.range + STONE_NUM.garudaCrossExtra;
        const w = STONE_NUM.garudaCrossWidth;
        for (const e of [...this.enemies]) {
          if (e.hp <= 0) continue;
          const dx = Math.abs(e.x - h.x);
          const dy = Math.abs(e.y - h.y);
          if ((dy <= w && dx <= len) || (dx <= w && dy <= len)) {
            this.applyBurn(e, burn, duration, h.id, cap);
            this.strike(e, damage * STONE_NUM.garudaCrossDmg, h.id, false);
          }
        }
        this.emit({ type: "cross", heroId: h.id, x: h.x, y: h.y, len });
      }
    }
  }

  /** 弓: 1 本の弾を撃つ。会心・ボス補正・所持 GUM 補正は発射時に確定させ、予定ダメージに積む */
  private fire(h: HeroState, target: EnemyState, baseDamage: number): void {
    const m = this.mods;
    const crit = m.critChance > 0 && this.rng.chance(m.critChance);
    const wealth = Math.min(WEALTH_CAP, m.wealthDamagePct * Math.floor(this.gum / 100));
    const damage =
      baseDamage *
      (crit ? BASE_CRIT_MUL + m.critMulAdd : 1) *
      (target.def.boss ? 1 + m.bossDamagePct : 1) *
      (1 + wealth);
    target.pending += damage;
    this.projectiles.push({
      id: this.nextId++,
      heroId: h.id,
      targetId: target.id,
      x: h.x,
      y: h.y,
      tx: target.x,
      ty: target.y,
      damage,
      speed: ROLES[h.role].projectileSpeed ?? 10,
      crit,
    });
  }

  /** SPEC-102 §2.4: 射程内から優先度に従って標的を選ぶ（撃ちすぎ防止つき） */
  selectTarget(h: HeroState, range: number, exclude: readonly EnemyState[] = []): EnemyState | null {
    const inRange = this.enemies.filter(
      (e) => e.hp > 0 && e.revealed && !exclude.includes(e) && Math.hypot(e.x - h.x, e.y - h.y) <= range,
    );
    if (inRange.length === 0) return null;
    const notDoomed = inRange.filter((e) => e.pending < e.hp);
    const pool = notDoomed.length > 0 ? notDoomed : inRange;
    const remaining = (e: EnemyState) => this.paths[e.pathIndex].length - e.dist;
    const score: Record<TargetMode, (e: EnemyState) => number> = {
      first: remaining,
      strong: (e) => -e.hp,
      weak: (e) => e.hp,
      close: (e) => Math.hypot(e.x - h.x, e.y - h.y),
      boss: (e) => (e.def.boss ? -1e9 : 0) + remaining(e),
    };
    const f = score[h.targetMode];
    let best = pool[0];
    for (const e of pool) {
      const d = f(e) - f(best);
      if (d < -1e-9 || (Math.abs(d) <= 1e-9 && e.id < best.id)) best = e;
    }
    return best;
  }

  private updateProjectiles(): void {
    const alive: ProjectileState[] = [];
    for (const p of this.projectiles) {
      const target = this.enemies.find((e) => e.id === p.targetId && e.hp > 0);
      if (target) {
        p.tx = target.x;
        p.ty = target.y;
      }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const dist = Math.hypot(dx, dy);
      const stepLen = p.speed * TICK;
      if (dist > stepLen) {
        p.x += (dx / dist) * stepLen;
        p.y += (dy / dist) * stepLen;
        alive.push(p);
        continue;
      }
      if (!target) continue;
      target.pending = Math.max(0, target.pending - p.damage);
      if (p.crit && this.mods.critCombust > 0 && target.status.burnTime > 0) {
        const combust = target.status.burnDps * COMBUST_MUL;
        this.emit({ type: "combust", enemyId: target.id, x: target.x, y: target.y, damage: combust });
        this.dealDamage(target, combust, p.heroId, false);
      }
      const shooter = this.findHero(p.heroId);
      const el = shooter ? this.heroElement(shooter) : null;
      if (target.hp > 0 && (el === "tiamat" || (this.mods.poisonChance > 0 && this.rng.chance(this.mods.poisonChance)))) this.applyPoison(target, p.heroId);
      if (el === "leviathan" && target.hp > 0) this.applySlow(target, STONE_NUM.levSlow, STONE_NUM.levSlowDuration);
      if (el === "ifrit") {
        // 火矢: 周りに小爆発し、当たった敵をまとめて炎上させる
        const burn = p.damage * STONE_NUM.ifritBurnPct;
        for (const o of [...this.enemies]) {
          if (o.hp <= 0 || Math.hypot(o.x - target.x, o.y - target.y) > STONE_NUM.ifritSplash) continue;
          this.applyBurn(o, burn, STONE_NUM.ifritBurnDuration, p.heroId, burn * 4);
          if (o !== target) this.strike(o, p.damage * STONE_NUM.ifritSplashPct, p.heroId, false, { pierce: ARROW_PIERCE, silent: true });
        }
      }
      this.strike(target, p.damage, p.heroId, p.crit, { pierce: this.mods.heavyShot > 0 ? 1 : ARROW_PIERCE });
      if (this.mods.gumOnHitChance > 0 && this.rng.chance(this.mods.gumOnHitChance)) {
        this.gum += 1;
        this.stats.gumEarned += 1;
        this.emit({ type: "gumOnHit", x: target.x, y: target.y });
      }
    }
    this.projectiles = alive;
  }

  /**
   * すべてのダメージの入口。脆弱で増やし、撃破処理（ドロップ・分裂・双子）まで行う。
   * heroId 0 は幻獣砲。silent は継続ダメージ（hit イベントを出さない）。
   */
  /**
   * SPEC-118: 1 発の攻撃。絶縁（雷を弱める）と装甲（1 発ごとに固定値を減らす）を掛けてから dealDamage へ。
   * pierce = 装甲を無視する割合。継続ダメージ・爆発・誘爆は dealDamage を直接呼ぶ（装甲に関係しない）。
   */
  private strike(e: EnemyState, amount: number, heroId: number, crit: boolean, o: { pierce?: number; lightning?: boolean; silent?: boolean } = {}): void {
    if (e.hp <= 0 || amount <= 0) return;
    let dmg = amount;
    if (o.lightning && e.def.insulated) dmg *= INSULATED_LIGHTNING;
    const armor = e.armor * (1 - (o.pierce ?? 0));
    if (armor > 0) dmg = Math.max(dmg * ARMOR_MIN_PCT, dmg - armor);
    this.dealDamage(e, dmg, heroId, crit, o.silent ?? false);
  }

  private dealDamage(e: EnemyState, amount: number, heroId: number, crit: boolean, silent = false, linked = false): void {
    if (e.hp <= 0 || amount <= 0) return;
    const hero = heroId > 0;
    const total = amount * (1 + e.status.vuln) * (hero ? 1 + this.lostHpBonus : 1);
    const dealt = Math.min(total, e.hp);
    if (e.pool) {
      // 多節ボス: 共有 HP を減らし、全節に反映
      e.pool.hp -= total;
      for (const m of e.pool.members) m.hp = e.pool.hp;
    } else {
      e.hp -= total;
    }
    if (heroId === 0) this.stats.cannonDamage += dealt;
    else if (heroId === BLAST_SOURCE) this.stats.blastDamage += dealt;
    else {
      const h = this.findHero(heroId);
      if (h) h.totalDamage += dealt;
    }
    if (!silent) this.emit({ type: "hit", enemyId: e.id, damage: dealt, x: e.x, y: e.y, crit });
    // ダメージリンク: 鈍足中の敵への直接の命中を、他の鈍足中の敵にも分ける
    if (hero && !silent && !linked && this.mods.slowLink > 0 && e.status.slowTime > 0) {
      const share = amount * this.mods.slowLink;
      for (const o of this.enemies) {
        if (o !== e && o.hp > 0 && o.status.slowTime > 0) this.dealDamage(o, share, heroId, false, true, true);
      }
    }
    if (e.hp <= 0) {
      if (e.pool) {
        const members = e.pool.members;
        e.pool.members = [];
        for (const m of members) this.onKill(m);
      } else {
        this.onKill(e);
      }
      return;
    }
    // 分裂ボス: HP が半分を切ったら 2 体に分かれる
    const sb = e.def.splitBoss;
    if (sb && e.gen < sb.generations && e.hp <= e.maxHp * 0.5) this.splitEnemy(e, sb.childHpPct);
  }

  private splitEnemy(e: EnemyState, childHpPct: number): void {
    const hp = e.hp * childHpPct;
    e.hp = 0; // 撃破扱いにせず取り除く（ドロップ・撃破数なし）
    this.emit({ type: "split", enemyId: e.id, x: e.x, y: e.y });
    for (let i = 0; i < 2; i++) {
      const c = this.spawnEnemy(e.def, e.pathIndex, Math.max(0, e.dist - 0.35 * i), e.hpMul);
      c.hp = c.maxHp = hp;
      c.gen = e.gen + 1;
      c.scale = e.scale * 0.8;
      c.rewardMul = e.rewardMul * 0.5;
      c.status.accel = e.status.accel;
    }
  }

  private onKill(e: EnemyState): void {
    this.stats.kills += 1;
    this.emit({ type: "kill", enemyId: e.id, x: e.x, y: e.y, boss: !!e.def.boss });
    if (e.def.reward > 0) {
      const drop: DropState = {
        id: this.nextId++,
        x: e.x,
        y: e.y,
        value: Math.max(1, Math.round(e.def.reward * e.rewardMul)) + this.mods.dropValueFlat,
        ttl: DROP_LIFETIME + this.mods.dropLifetimeAdd,
      };
      this.drops.push(drop);
      this.emit({ type: "drop", dropId: drop.id });
    }
    // 伏爆の罠: 確率で爆発して周りの敵を巻き込む
    if (this.mods.deathBlastChance > 0 && this.rng.chance(this.mods.deathBlastChance)) {
      this.emit({ type: "blast", x: e.x, y: e.y, r: BLAST_RADIUS });
      const damage = e.maxHp * BLAST_PCT;
      for (const o of [...this.enemies]) {
        if (o !== e && o.hp > 0 && Math.hypot(o.x - e.x, o.y - e.y) <= BLAST_RADIUS) this.dealDamage(o, damage, BLAST_SOURCE, false);
      }
    }
    // 分裂
    if (e.def.split) {
      const child = ENEMIES[e.def.split.enemy];
      for (let i = 0; i < e.def.split.count; i++) {
        const c = this.spawnEnemy(child, e.pathIndex, Math.max(0, e.dist - 0.25 * i), e.hpMul);
        c.status.accel = e.status.accel;
      }
    }
    // 双子の激昂
    if (e.def.twinGroup) {
      for (const o of this.enemies) {
        if (o !== e && o.hp > 0 && o.def.twinGroup === e.def.twinGroup) {
          o.status.accel = Math.max(o.status.accel, TWIN_ENRAGE);
          this.emit({ type: "enrage", enemyId: o.id });
        }
      }
    }
  }

  private updateDrops(): void {
    // SPEC-116: 自動回収（落ちてから少し見せてから集める）
    if (this.mods.autoCollect > 0) {
      const life = DROP_LIFETIME + this.mods.dropLifetimeAdd;
      for (const d of this.drops.filter((x) => life - x.ttl >= AUTO_COLLECT_DELAY)) this.collectDropsAt(d.x, d.y, 0.001);
    }
    this.drops = this.drops.filter((d) => {
      d.ttl -= TICK;
      if (d.ttl > 0) return true;
      this.emit({ type: "dropExpire", dropId: d.id });
      return false;
    });
  }

  private checkWaveClear(): void {
    if (this.waveIndex < 0 || this.nextWaveIn !== null) return;
    if (this.spawnQueue.length > 0 || this.enemies.length > 0) return;
    this.clearWave();
    if (this.waveIndex >= this.level.waves.length - 1) {
      this.status = "won";
      this.emit({ type: "won" });
    } else {
      this.nextWaveIn = this.level.intermissionSeconds;
    }
  }

  /** Wave クリアの報酬（Wave 報酬・採掘の配当・回復） */
  private clearWave(): void {
    const wave = this.level.waves[this.waveIndex];
    const reward = Math.round(wave.reward * (1 + this.mods.waveRewardPct));
    this.gum += reward;
    this.stats.wavesCleared += 1;
    this.emit({ type: "waveClear", wave: this.waveIndex, reward });
    for (const h of this.heroes) {
      const payout = this.payoutFor(h);
      if (payout <= 0) continue;
      this.gum += payout;
      this.stats.gumEarned += payout;
      h.totalGum += payout;
      this.emit({ type: "payout", heroId: h.id, value: payout });
    }
    if (this.mods.healPerWave > 0 && this.hp < this.maxHp) {
      const amount = Math.min(this.maxHp - this.hp, this.mods.healPerWave);
      this.hp += amount;
      this.emit({ type: "heal", amount });
    }
  }

  private findHero(id: number): HeroState | undefined {
    return this.heroes.find((h) => h.id === id);
  }

  private emit(e: SimEvent): void {
    this.events.push(e);
  }
}
