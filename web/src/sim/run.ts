import { ENEMIES, type EnemyDef } from "../data/balance/enemies";
import { ROLES, maxLevel, roleStats, type RoleId } from "../data/balance/heroes";
import type { LevelDef } from "./level";
import { PathGeom } from "./path";
import { Rng } from "./rng";

/** SPEC-102 §2.1: 固定タイムステップ（秒） */
export const TICK = 1 / 30;
/** SPEC-104 §5: GUM ドロップの寿命（秒）と既定の回収半径（マス） */
export const DROP_LIFETIME = 10;
export const COLLECT_RADIUS = 0.7;
/** 敵の見た目の重なりを避ける、経路法線方向のオフセット幅（マス） */
const LANE_JITTER = 0.18;

export const TARGET_MODES = ["first", "strong", "weak", "close", "boss"] as const;
export type TargetMode = (typeof TARGET_MODES)[number];

export type RunStatus = "prep" | "running" | "won" | "lost";

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
  /** 飛翔中の弾の予定ダメージ（撃ちすぎ防止） */
  pending: number;
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
}

export interface DropState {
  id: number;
  x: number;
  y: number;
  value: number;
  ttl: number;
}

export type SimEvent =
  | { type: "waveStart"; wave: number; boss: boolean }
  | { type: "waveClear"; wave: number; reward: number }
  | { type: "spawn"; enemyId: number }
  | { type: "attack"; heroId: number; targetId: number; tx: number; ty: number }
  | { type: "hit"; enemyId: number; damage: number; x: number; y: number }
  | { type: "kill"; enemyId: number; x: number; y: number; boss: boolean }
  | { type: "leak"; enemyId: number; damage: number }
  | { type: "drop"; dropId: number }
  | { type: "collect"; dropId: number; value: number; x: number; y: number }
  | { type: "dropExpire"; dropId: number }
  | { type: "heroPlaced"; heroId: number }
  | { type: "heroLevelUp"; heroId: number; level: number }
  | { type: "won" }
  | { type: "lost" };

export interface RunStats {
  kills: number;
  leaks: number;
  gumEarned: number;
  /** 到達した Wave 数（開始した Wave の数） */
  wavesReached: number;
}

interface SpawnEntry {
  t: number;
  enemy: string;
  path: number;
}

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
  readonly stats: RunStats = { kills: 0, leaks: 0, gumEarned: 0, wavesReached: 0 };
  readonly paths: PathGeom[];

  private readonly rng: Rng;
  private spawnQueue: SpawnEntry[] = [];
  private waveTime = 0;
  private nextId = 1;
  private events: SimEvent[] = [];

  constructor(
    readonly level: LevelDef,
    seed: number,
  ) {
    this.rng = new Rng(seed);
    this.gum = level.startGum;
    this.hp = this.maxHp = level.cryptidHp;
    this.nextWaveIn = level.prepSeconds;
    this.paths = level.paths.map((p) => new PathGeom(p.id, p.points));
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

  // ─── コマンド ───────────────────────────────────────────

  heroAt(slotIndex: number): HeroState | undefined {
    return this.heroes.find((h) => h.slotIndex === slotIndex);
  }

  canPlace(slotIndex: number, role: RoleId): boolean {
    return (
      !this.isOver &&
      slotIndex >= 0 &&
      slotIndex < this.level.slots.length &&
      !this.heroAt(slotIndex) &&
      this.gum >= ROLES[role].placeCost
    );
  }

  placeHero(slotIndex: number, role: RoleId): HeroState | null {
    if (!this.canPlace(slotIndex, role)) return null;
    const slot = this.level.slots[slotIndex];
    this.gum -= ROLES[role].placeCost;
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
      facing: 1,
    };
    this.heroes.push(hero);
    this.emit({ type: "heroPlaced", heroId: hero.id });
    return hero;
  }

  /** 次レベルへの費用。最大レベルなら null */
  levelUpCost(hero: HeroState): number | null {
    const role = ROLES[hero.role];
    return hero.level >= maxLevel(role) ? null : role.levelUpCosts[hero.level - 1];
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

  heroStats(hero: HeroState, level = hero.level): { damage: number; interval: number; range: number } {
    return roleStats(ROLES[hero.role], level);
  }

  /** 開始前、または Wave 間の休憩中なら次の Wave を即開始できる */
  canStartNextWave(): boolean {
    return !this.isOver && this.nextWaveIn !== null;
  }

  startNextWave(): boolean {
    if (!this.canStartNextWave()) return false;
    this.beginWave(this.waveIndex + 1);
    return true;
  }

  /** (x, y) から半径 r 以内の GUM を回収し、回収額を返す */
  collectDropsAt(x: number, y: number, r = COLLECT_RADIUS): number {
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

  drainEvents(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  // ─── 進行 ───────────────────────────────────────────────

  step(): void {
    if (this.isOver) return;
    this.tick += 1;

    if (this.nextWaveIn !== null) {
      this.nextWaveIn -= TICK;
      if (this.nextWaveIn <= 1e-9) this.beginWave(this.waveIndex + 1);
    }
    this.spawnDue();
    this.moveEnemies();
    if (this.isOver) return;
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

  private beginWave(index: number): void {
    const wave = this.level.waves[index];
    this.waveIndex = index;
    this.nextWaveIn = null;
    this.status = "running";
    this.waveTime = 0;
    this.stats.wavesReached = index + 1;
    const queue: SpawnEntry[] = [];
    for (const g of wave.groups) {
      const path = this.level.paths.findIndex((p) => p.id === g.path);
      for (let i = 0; i < g.count; i++) queue.push({ t: g.delay + i * g.interval, enemy: g.enemy, path });
    }
    // 同時刻は定義順を保つ（安定ソート）
    this.spawnQueue = queue.sort((a, b) => a.t - b.t);
    this.emit({ type: "waveStart", wave: index, boss: wave.groups.some((g) => ENEMIES[g.enemy].boss) });
  }

  private spawnDue(): void {
    if (this.waveIndex < 0 || this.spawnQueue.length === 0) return;
    this.waveTime += TICK;
    const hpMul = this.level.waves[this.waveIndex].hpMul;
    while (this.spawnQueue.length > 0 && this.spawnQueue[0].t <= this.waveTime + 1e-9) {
      const s = this.spawnQueue.shift()!;
      const def = ENEMIES[s.enemy];
      const hp = def.hp * hpMul;
      const enemy: EnemyState = {
        id: this.nextId++,
        def,
        pathIndex: s.path,
        dist: 0,
        offset: (this.rng.next() * 2 - 1) * LANE_JITTER,
        x: 0,
        y: 0,
        dirX: 0,
        hp,
        maxHp: hp,
        pending: 0,
      };
      this.placeOnPath(enemy);
      this.enemies.push(enemy);
      this.emit({ type: "spawn", enemyId: enemy.id });
    }
  }

  private placeOnPath(e: EnemyState): void {
    const { pos, dir } = this.paths[e.pathIndex].sample(e.dist);
    e.x = pos.x - dir.y * e.offset;
    e.y = pos.y + dir.x * e.offset;
    e.dirX = dir.x;
  }

  private moveEnemies(): void {
    const survivors: EnemyState[] = [];
    for (const e of this.enemies) {
      e.dist += e.def.speed * TICK;
      if (e.dist >= this.paths[e.pathIndex].length) {
        this.hp -= e.def.leak;
        this.stats.leaks += 1;
        this.emit({ type: "leak", enemyId: e.id, damage: e.def.leak });
        continue;
      }
      this.placeOnPath(e);
      survivors.push(e);
    }
    this.enemies = survivors;
    if (this.hp <= 0) {
      this.hp = 0;
      this.status = "lost";
      this.emit({ type: "lost" });
    }
  }

  private updateHeroes(): void {
    for (const h of this.heroes) {
      h.cooldown = Math.max(0, h.cooldown - TICK);
      if (h.cooldown > 0) continue;
      const stats = this.heroStats(h);
      const target = this.selectTarget(h, stats.range);
      if (!target) continue;
      target.pending += stats.damage;
      h.cooldown = stats.interval;
      h.facing = target.x < h.x ? -1 : 1;
      this.projectiles.push({
        id: this.nextId++,
        heroId: h.id,
        targetId: target.id,
        x: h.x,
        y: h.y,
        tx: target.x,
        ty: target.y,
        damage: stats.damage,
        speed: ROLES[h.role].projectileSpeed,
      });
      this.emit({ type: "attack", heroId: h.id, targetId: target.id, tx: target.x, ty: target.y });
    }
  }

  /** SPEC-102 §2.4: 射程内から優先度に従って標的を選ぶ（撃ちすぎ防止つき） */
  selectTarget(h: HeroState, range: number): EnemyState | null {
    const inRange = this.enemies.filter((e) => e.hp > 0 && Math.hypot(e.x - h.x, e.y - h.y) <= range);
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
      if (target) this.damage(target, p.damage, p.heroId);
    }
    this.projectiles = alive;
  }

  private damage(e: EnemyState, amount: number, heroId: number): void {
    e.pending = Math.max(0, e.pending - amount);
    const dealt = Math.min(amount, e.hp);
    e.hp -= amount;
    const hero = this.findHero(heroId);
    if (hero) hero.totalDamage += dealt;
    this.emit({ type: "hit", enemyId: e.id, damage: dealt, x: e.x, y: e.y });
    if (e.hp <= 0) {
      this.stats.kills += 1;
      this.emit({ type: "kill", enemyId: e.id, x: e.x, y: e.y, boss: !!e.def.boss });
      const drop: DropState = { id: this.nextId++, x: e.x, y: e.y, value: e.def.reward, ttl: DROP_LIFETIME };
      this.drops.push(drop);
      this.emit({ type: "drop", dropId: drop.id });
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
    const wave = this.level.waves[this.waveIndex];
    this.gum += wave.reward;
    this.emit({ type: "waveClear", wave: this.waveIndex, reward: wave.reward });
    if (this.waveIndex >= this.level.waves.length - 1) {
      this.status = "won";
      this.emit({ type: "won" });
    } else {
      this.nextWaveIn = this.level.intermissionSeconds;
    }
  }

  private findHero(id: number): HeroState | undefined {
    return this.heroes.find((h) => h.id === id);
  }

  private emit(e: SimEvent): void {
    this.events.push(e);
  }
}
