import { ENEMIES, TWIN_ENRAGE, resistOf, type EnemyDef } from "../data/balance/enemies";
import { ROLES, heroVisual, maxLevel, roleStats, type RoleId } from "../data/balance/heroes";
import type { LevelDef } from "./level";
import {
  BASE_CRIT_MUL,
  COMBUST_MUL,
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
  | { type: "leak"; enemyId: number; damage: number; blocked: boolean }
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
  | { type: "won" }
  | { type: "lost" };

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
}

interface SpawnEntry {
  t: number;
  enemy: string;
  path: number;
  hpMul: number;
  accel: number;
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
  readonly stats: RunStats = { kills: 0, leaks: 0, gumEarned: 0, wavesReached: 0, wavesCleared: 0, cannonDamage: 0 };
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
    return this.statsFor(hero.role, level);
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
    return {
      damage: base.damage * (1 + b.dmg),
      interval: base.interval / Math.max(0.2, 1 + b.speed),
      range: base.range + b.range,
    };
  }

  /** 採掘ヒーローの通行料（1 体あたり） */
  tollFor(hero: HeroState): number {
    const miner = ROLES[hero.role].miner;
    return miner ? miner.tollPerLevel * hero.level + this.mods.minerTollAdd : 0;
  }

  /** 採掘ヒーローの Wave クリア配当 */
  payoutFor(hero: HeroState): number {
    const miner = ROLES[hero.role].miner;
    return miner ? Math.round(miner.payoutPerLevel * hero.level * (1 + this.mods.minerPayoutPct)) : 0;
  }

  /** 炎ヒーローが 1 回の命中で積む炎上（毎秒ダメージ） */
  burnPerHit(hero: HeroState): number {
    const flame = ROLES[hero.role].flame;
    if (!flame) return 0;
    const lvMul = ROLES[hero.role].perLevel.damageMul ** (hero.level - 1);
    return flame.burnPerHit * lvMul * (1 + this.mods.fireBurnPct) * (1 + this.mods.fireDamagePct);
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
    const width = CANNON.width + this.mods.cannonWidthAdd;
    const damage = CANNON.damage * (1 + this.mods.cannonDamagePct);
    let hits = 0;
    for (const e of [...this.enemies]) {
      if (e.hp <= 0) continue;
      const t = (e.x - o.x) * ux + (e.y - o.y) * uy;
      if (t < 0 || t > CANNON.length) continue;
      const d = Math.abs((e.x - o.x) * uy - (e.y - o.y) * ux);
      if (d > width) continue;
      hits++;
      if (this.mods.cannonBurn > 0) this.applyBurn(e, CANNON.burnDps, CANNON.burnDuration, 0, Infinity);
      this.dealDamage(e, damage, 0, false);
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
      const e = this.spawnEnemy(ENEMIES[s.enemy], s.path, 0, s.hpMul);
      e.status.accel = s.accel;
    }
  }

  private spawnEnemy(def: EnemyDef, pathIndex: number, dist: number, hpMul: number): EnemyState {
    const hp = def.hp * hpMul;
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
    };
    this.placeOnPath(enemy);
    this.enemies.push(enemy);
    this.emit({ type: "spawn", enemyId: enemy.id });
    return enemy;
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
      this.emit({ type: "leak", enemyId: e.id, damage: 0, blocked: true });
      return;
    }
    if (e.def.boss && this.mods.lastStand > 0 && !this.lastStandUsed && this.hp - e.def.leak <= 0) {
      this.lastStandUsed = true;
      this.hp = 1;
      this.emit({ type: "leak", enemyId: e.id, damage: 0, blocked: true });
      this.emit({ type: "lastStand" });
      return;
    }
    this.hp -= e.def.leak;
    this.emit({ type: "leak", enemyId: e.id, damage: e.def.leak, blocked: false });
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
      h.cooldown = stats.interval;
      h.facing = target.x < h.x ? -1 : 1;
      if (h.role === "lightning") this.lightning(h, target, stats.damage);
      else if (h.role === "fire") this.flame(h, target, stats.damage);
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
    if (this.mods.extraShotChance > 0 && this.rng.chance(this.mods.extraShotChance)) {
      const second = this.selectTarget(h, stats.range, [target]);
      if (second) this.fire(h, second, stats.damage);
    }
  }

  /** SPEC-110: 雷。初撃から近くの敵へ連鎖し、感電を積む。閾値で放電（スタン） */
  private lightning(h: HeroState, first: EnemyState, damage: number): void {
    const c = ROLES.lightning.chain!;
    const jumps = c.jumps + this.mods.lightningChains;
    const hit: EnemyState[] = [];
    let cur: EnemyState | undefined = first;
    const points: Point[] = [{ x: h.x, y: h.y }];
    for (let k = 0; cur && k <= jumps; k++) {
      hit.push(cur);
      points.push({ x: cur.x, y: cur.y });
      const dmg = damage * (1 - c.falloff) ** k;
      this.dealDamage(cur, dmg, h.id, false);
      const s = cur.status;
      s.shock += c.shockPerHit + this.mods.lightningShock;
      if (s.shock >= c.shockThreshold && cur.hp > 0) {
        s.shock = 0;
        this.applyStun(cur, c.stun + this.mods.dischargeStunAdd);
        this.emit({ type: "discharge", enemyId: cur.id, x: cur.x, y: cur.y });
        if (this.mods.arcFlash > 0) this.dealDamage(cur, dmg * 3, h.id, false);
      }
      const from: EnemyState = cur;
      cur = this.enemies
        .filter((e) => e.hp > 0 && !hit.includes(e) && Math.hypot(e.x - from.x, e.y - from.y) <= c.jumpRange)
        .sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y) || a.id - b.id)[0];
    }
    this.emit({ type: "chain", heroId: h.id, points });
  }

  /** SPEC-111: 結界。範囲内の全員にダメージと鈍足。敵がいなければ撃たない */
  private pulse(h: HeroState, stats: { damage: number; range: number }): boolean {
    const inRange = this.enemies.filter((e) => e.hp > 0 && Math.hypot(e.x - h.x, e.y - h.y) <= stats.range);
    if (inRange.length === 0) return false;
    const p = ROLES.pulse.pulse!;
    for (const e of inRange) {
      this.applySlow(e, p.slow + this.mods.pulseSlowAdd, p.slowDuration + this.mods.pulseSlowDurAdd);
      if (this.mods.pulseZhuge > 0) this.applyVuln(e, ZHUGE_VULN, ZHUGE_VULN_DURATION);
      if (this.mods.pulseStunChance > 0 && this.rng.chance(this.mods.pulseStunChance)) this.applyStun(e, PULSE_STUN);
      this.dealDamage(e, stats.damage, h.id, false);
    }
    this.emit({ type: "pulse", heroId: h.id, x: h.x, y: h.y, r: stats.range });
    return true;
  }

  /** SPEC-112: 炎。標的とその周りに小ダメージと炎上を積む */
  private flame(h: HeroState, target: EnemyState, damage: number): void {
    const f = ROLES.fire.flame!;
    const burn = this.burnPerHit(h);
    const duration = f.burnDuration + this.mods.fireBurnDurAdd;
    const cap = burn * f.burnCapHits;
    const victims = this.enemies.filter((e) => e.hp > 0 && Math.hypot(e.x - target.x, e.y - target.y) <= f.splash);
    for (const e of victims) {
      this.applyBurn(e, burn, duration, h.id, cap);
      this.dealDamage(e, damage, h.id, false, true);
    }
    this.emit({ type: "flame", heroId: h.id, tx: target.x, ty: target.y });
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
      (e) => e.hp > 0 && !exclude.includes(e) && Math.hypot(e.x - h.x, e.y - h.y) <= range,
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
      if (this.mods.poisonChance > 0 && target.hp > 0 && this.rng.chance(this.mods.poisonChance)) this.applyPoison(target, p.heroId);
      this.dealDamage(target, p.damage, p.heroId, p.crit);
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
  private dealDamage(e: EnemyState, amount: number, heroId: number, crit: boolean, silent = false): void {
    if (e.hp <= 0 || amount <= 0) return;
    const total = amount * (1 + e.status.vuln);
    const dealt = Math.min(total, e.hp);
    e.hp -= total;
    if (heroId === 0) this.stats.cannonDamage += dealt;
    else {
      const hero = this.findHero(heroId);
      if (hero) hero.totalDamage += dealt;
    }
    if (!silent) this.emit({ type: "hit", enemyId: e.id, damage: dealt, x: e.x, y: e.y, crit });
    if (e.hp <= 0) this.onKill(e);
  }

  private onKill(e: EnemyState): void {
    this.stats.kills += 1;
    this.emit({ type: "kill", enemyId: e.id, x: e.x, y: e.y, boss: !!e.def.boss });
    const drop: DropState = {
      id: this.nextId++,
      x: e.x,
      y: e.y,
      value: e.def.reward + this.mods.dropValueFlat,
      ttl: DROP_LIFETIME + this.mods.dropLifetimeAdd,
    };
    this.drops.push(drop);
    this.emit({ type: "drop", dropId: drop.id });
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
