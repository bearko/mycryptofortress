import { ENEMIES } from "../data/balance/enemies";
import { ROLES } from "../data/balance/heroes";
import type { LevelDef, WaveDef } from "./level";
import { BLAST_PCT, HASTE_CAP, HEAVY_SHOT_DAMAGE, HEAVY_SHOT_INTERVAL, emptyModifiers, type RunModifiers } from "./modifiers";
import { CANNON, EARLY_CALL_ACCEL, RunSim, type SimEvent } from "./run";

const ALL_ROLES: Partial<RunModifiers> = { unlockLightning: 1, unlockPulse: 1, unlockFire: 1, unlockMiner: 1 };
const mods = (patch: Partial<RunModifiers> = {}): RunModifiers => ({ ...emptyModifiers(), ...patch });

/** 横一直線の経路（長さ 20）・スロットは経路の上 */
function line(waves: WaveDef[], overrides: Partial<LevelDef> = {}): LevelDef {
  return {
    id: "T",
    name: "test",
    background: "bg.node.1037",
    cols: 20,
    rows: 5,
    cryptid: { col: 19, row: 2 },
    startGum: 10_000,
    cryptidHp: 50,
    prepSeconds: 1,
    intermissionSeconds: 1,
    reward: { perWave: 1, clear: 1, firstClear: 1 },
    paths: [{ id: "a", points: [[-1, 2], [19, 2]] }],
    slots: [{ col: 5, row: 1 }, { col: 7, row: 1 }, { col: 9, row: 1 }, { col: 11, row: 3, kind: "locked", cost: 80 }],
    waves,
    ...overrides,
  };
}
/** 幻獣砲の射程に収まる短い盤面 */
const short = (waves: WaveDef[], o: Partial<LevelDef> = {}): LevelDef =>
  line(waves, { cols: 10, cryptid: { col: 9, row: 2 }, paths: [{ id: "a", points: [[-1, 2], [9, 2]] }], slots: [{ col: 5, row: 1 }], ...o });
const wave = (enemy: string, count: number, interval = 0.6, hpMul = 1): WaveDef => ({
  reward: 5,
  hpMul,
  groups: [{ enemy, count, interval, path: "a", delay: 0 }],
});

function run(sim: RunSim, seconds: number, until?: (e: SimEvent) => boolean): SimEvent[] {
  const out: SimEvent[] = [];
  const end = sim.time + seconds;
  while (!sim.isOver && sim.time < end) {
    sim.step();
    const evs = sim.drainEvents();
    out.push(...evs);
    if (until && evs.some(until)) break;
  }
  return out;
}

describe("ロールの解放 (SPEC-110〜113)", () => {
  it("弓以外はツリーで解放するまで配置できない", () => {
    const locked = new RunSim(line([wave("byte_s", 1)]), 1);
    expect(locked.unlockedRoles()).toEqual(["archer"]);
    expect(locked.placeHero(0, "lightning")).toBeNull();
    const open = new RunSim(line([wave("byte_s", 1)]), 1, mods(ALL_ROLES));
    expect(open.unlockedRoles().sort()).toEqual(["archer", "fire", "lightning", "miner", "pulse"]);
    expect(open.placeHero(0, "lightning")).not.toBeNull();
  });

  it("交代ノードでヒーローの見た目が変わる", () => {
    const sim = new RunSim(line([wave("byte_s", 1)]), 1, mods({ ...ALL_ROLES, lightningTesla: 1, archerHeavy: 1 }));
    expect(sim.heroVisual("lightning").heroName).toBe("ニコラ・テスラ");
    expect(sim.heroVisual("archer").heroName).toBe("ウィリアム・テル");
    expect(sim.heroVisual("pulse").heroName).toBe(ROLES.pulse.heroName);
  });
});

describe("雷 (SPEC-110)", () => {
  it("連鎖して複数の敵に当たり、感電が閾値で放電（スタン）する", () => {
    const sim = new RunSim(line([wave("byte_t", 4, 0.3, 20)]), 1, mods(ALL_ROLES));
    for (const slot of [0, 1, 2]) sim.placeHero(slot, "lightning");
    sim.startNextWave();
    const evs = run(sim, 20, (e) => e.type === "discharge");
    const chain = evs.find((e) => e.type === "chain");
    expect(chain && chain.type === "chain" && chain.points.length).toBeGreaterThanOrEqual(3); // ヒーロー + 2 体以上
    expect(evs.some((e) => e.type === "discharge")).toBe(true);
    expect(sim.enemies.some((e) => e.status.stunTime > 0)).toBe(true);
  });

  it("連鎖数の補正で跳ぶ回数が増える", () => {
    const sim = new RunSim(line([wave("byte_t", 6, 0.2, 20)]), 1, mods({ ...ALL_ROLES, lightningChains: 2 }));
    sim.placeHero(0, "lightning");
    sim.startNextWave();
    const evs = run(sim, 10);
    const most = Math.max(...evs.filter((e) => e.type === "chain").map((e) => (e.type === "chain" ? e.points.length : 0)));
    expect(most).toBeGreaterThanOrEqual(1 + 1 + ROLES.lightning.chain!.jumps + 2);
  });
});

describe("結界 (SPEC-111)", () => {
  it("範囲内の全員を鈍足にし、敵がいなければ撃たない", () => {
    const sim = new RunSim(line([wave("byte_t", 3, 0.3, 20)]), 1, mods(ALL_ROLES));
    sim.placeHero(0, "pulse");
    const idle = run(sim, 0.5);
    expect(idle.some((e) => e.type === "pulse")).toBe(false);
    sim.startNextWave();
    run(sim, 20, (e) => e.type === "pulse");
    const slowed = sim.enemies.filter((e) => e.status.slow > 0);
    expect(slowed.length).toBeGreaterThanOrEqual(1);
    expect(slowed[0].status.slow).toBeCloseTo(ROLES.pulse.pulse!.slow);
  });

  it("鈍足で移動が遅くなる", () => {
    const base = new RunSim(line([wave("byte_s", 1, 1, 50)]), 1, mods(ALL_ROLES));
    const slowed = new RunSim(line([wave("byte_s", 1, 1, 50)]), 1, mods(ALL_ROLES));
    slowed.placeHero(1, "pulse");
    base.startNextWave();
    slowed.startNextWave();
    run(base, 12);
    run(slowed, 12);
    expect(slowed.enemies[0].dist).toBeLessThan(base.enemies[0].dist);
  });

  it("ボスは状態異常に耐性がある（鈍足が半分）", () => {
    const sim = new RunSim(line([wave("boss_nobunaga", 1)]), 1, mods(ALL_ROLES));
    sim.placeHero(0, "pulse");
    sim.startNextWave();
    run(sim, 20, (e) => e.type === "pulse");
    expect(sim.enemies[0].status.slow).toBeCloseTo(ROLES.pulse.pulse!.slow * 0.5);
  });

  it("諸葛亮に交代すると脆弱（被ダメージ増加）を与える", () => {
    const sim = new RunSim(line([wave("byte_t", 1, 1, 50)]), 1, mods({ ...ALL_ROLES, pulseZhuge: 1 }));
    sim.placeHero(0, "pulse");
    sim.startNextWave();
    run(sim, 20, (e) => e.type === "pulse");
    expect(sim.enemies[0].status.vuln).toBeGreaterThan(0);
  });
});

describe("炎 (SPEC-112)", () => {
  it("炎上を積み重ね、上限で止まり、継続ダメージを与える", () => {
    const sim = new RunSim(line([wave("byte_t", 1, 1, 100)]), 1, mods(ALL_ROLES));
    const h = sim.placeHero(0, "fire")!;
    sim.startNextWave();
    run(sim, 20, (e) => e.type === "flame");
    const e = sim.enemies[0];
    const one = sim.burnPerHit(h);
    expect(e.status.burnDps).toBeCloseTo(one);
    run(sim, 3);
    expect(e.status.burnDps).toBeGreaterThan(one);
    expect(e.status.burnDps).toBeLessThanOrEqual(one * ROLES.fire.flame!.burnCapHits + 1e-9);
    expect(e.hp).toBeLessThan(e.maxHp);
  });

  it("弓の会心で炎上中の敵が誘爆する（タイガーシュート）", () => {
    const sim = new RunSim(line([wave("byte_t", 1, 1, 200)]), 1, mods({ ...ALL_ROLES, critCombust: 1, critChance: 1 }));
    sim.placeHero(0, "fire");
    sim.placeHero(1, "archer");
    sim.startNextWave();
    const evs = run(sim, 25, (e) => e.type === "combust");
    expect(evs.some((e) => e.type === "combust")).toBe(true);
  });
});

describe("採掘 (SPEC-113)", () => {
  it("範囲を通る敵 1 体ごとに 1 回だけ通行料、Wave クリアで配当", () => {
    const sim = new RunSim(line([wave("byte_s", 3)]), 1, mods(ALL_ROLES));
    const m = sim.placeHero(0, "miner")!;
    sim.placeHero(2, "archer");
    sim.placeHero(1, "archer");
    const gum0 = sim.gum;
    sim.startNextWave();
    const evs = run(sim, 60, (e) => e.type === "won");
    const tolls = evs.filter((e) => e.type === "toll");
    expect(tolls.length).toBeLessThanOrEqual(3);
    expect(tolls.length).toBeGreaterThanOrEqual(1);
    expect(evs.some((e) => e.type === "payout" && e.value === sim.payoutFor(m))).toBe(true);
    expect(m.totalGum).toBe(tolls.length * sim.tollFor(m) + sim.payoutFor(m));
    expect(sim.gum).toBeGreaterThan(gum0);
  });
});

describe("ロックマス (SPEC-113)", () => {
  it("開放するまで置けず、開放費用はツリーで下がる", () => {
    const sim = new RunSim(line([wave("byte_s", 1)]), 1, mods({ lockedSlotCostPct: 0.25 }));
    expect(sim.isSlotOpen(3)).toBe(false);
    expect(sim.placeHero(3, "archer")).toBeNull();
    expect(sim.slotOpenCost(3)).toBe(60);
    const g = sim.gum;
    expect(sim.openSlot(3)).toBe(true);
    expect(sim.gum).toBe(g - 60);
    expect(sim.slotOpenCost(3)).toBeNull();
    expect(sim.placeHero(3, "archer")).not.toBeNull();
  });
});

describe("Wave の繰り上げ (SPEC-113)", () => {
  it("解放前は呼べない。出現が終わって敵が残っていればボーナス付きで呼べ、呼んだ Wave は加速する", () => {
    const waves = [wave("byte_s", 3, 0.3, 50), wave("byte_s", 2, 0.3, 50)];
    const locked = new RunSim(line(waves), 1);
    locked.startNextWave();
    run(locked, 2);
    expect(locked.earlyCallBonus()).toBeNull();

    const sim = new RunSim(line(waves), 1, mods({ unlockSkip: 1 }));
    sim.startNextWave();
    expect(sim.earlyCallBonus()).toBeNull(); // まだ出現中
    run(sim, 2);
    const bonus = sim.earlyCallBonus();
    expect(bonus).toBe(3 * 2);
    const g = sim.gum;
    expect(sim.callEarly()).toBe(true);
    expect(sim.waveIndex).toBe(1);
    expect(sim.stats.wavesCleared).toBe(1);
    expect(sim.gum).toBe(g + bonus! + 5);
    run(sim, 1);
    const called = sim.enemies.filter((e) => e.status.accel > 0);
    expect(called.length).toBeGreaterThan(0);
    expect(called[0].status.accel).toBeCloseTo(EARLY_CALL_ACCEL);
    expect(sim.earlyCallBonus()).toBeNull(); // 最終 Wave は呼べない
  });
});

describe("幻獣砲 (SPEC-114)", () => {
  it("解放前は撃てない。GUM を消費し、光線上の敵を貫通してダメージ、クールダウンあり", () => {
    const locked = new RunSim(short([wave("byte_t", 3, 0.2, 50)]), 1);
    expect(locked.fireCannon(0, 2.5)).toBe(false);

    const sim = new RunSim(short([wave("byte_t", 3, 0.2, 50)]), 1, mods({ unlockCannon: 1 }));
    sim.startNextWave();
    run(sim, 2);
    const g = sim.gum;
    const hp = sim.enemies.map((e) => e.hp);
    expect(sim.fireCannon(0, 2.5)).toBe(true);
    const evs = sim.drainEvents();
    const shot = evs.find((e) => e.type === "cannon");
    expect(shot && shot.type === "cannon" && shot.hits).toBe(3);
    expect(sim.gum).toBe(g - CANNON.cost);
    sim.enemies.forEach((e, i) => expect(e.hp).toBeCloseTo(hp[i] - CANNON.damage));
    expect(sim.fireCannon(0, 2.5)).toBe(false); // クールダウン中
    expect(sim.stats.cannonDamage).toBeCloseTo(CANNON.damage * 3);
  });

  it("消費 GUM が足りなければ撃てない", () => {
    const sim = new RunSim(short([wave("byte_s", 1)], { startGum: 2 }), 1, mods({ unlockCannon: 1 }));
    expect(sim.fireCannon(0, 2.5)).toBe(false);
  });
});

describe("特殊な敵 (SPEC-109 / Phase 3)", () => {
  it("分裂する敵は倒すと子を出す", () => {
    const sim = new RunSim(short([wave("love_t", 1)]), 1, mods({ unlockCannon: 1 }));
    sim.startNextWave();
    run(sim, 1);
    const parent = sim.enemies[0];
    parent.hp = 1;
    sim.fireCannon(parent.x, parent.y);
    const kids = sim.enemies.filter((e) => e.def.id === ENEMIES.love_t.split!.enemy);
    expect(kids).toHaveLength(2);
  });

  it("双子の片方が倒れると、もう片方が加速する", () => {
    const twins: WaveDef = {
      reward: 0,
      hpMul: 1,
      groups: [
        { enemy: "boss_grimm", count: 1, interval: 1, path: "a", delay: 0 },
        { enemy: "boss_wright", count: 1, interval: 1, path: "a", delay: 0.5 },
      ],
    };
    const sim = new RunSim(short([twins]), 1, mods({ unlockCannon: 1 }));
    sim.startNextWave();
    run(sim, 1);
    const [a, b] = sim.enemies;
    a.hp = 1;
    sim.fireCannon(a.x, a.y);
    expect(b.status.accel).toBeGreaterThan(0.5);
  });

  it("5 種類の状態異常を同時に与えられる（炎上・毒・鈍足・感電・脆弱）", () => {
    const sim = new RunSim(
      // 4 人の射程が重なるよう密集させる
      line([wave("bagle_t", 1, 1, 400)], {
        slots: [{ col: 5, row: 1 }, { col: 6, row: 1 }, { col: 5, row: 3 }, { col: 6, row: 3, kind: "locked", cost: 80 }],
      }),
      3,
      mods({ ...ALL_ROLES, pulseZhuge: 1, poisonChance: 1 }),
    );
    sim.placeHero(0, "fire");
    sim.placeHero(1, "pulse");
    sim.placeHero(2, "lightning");
    sim.openSlot(3);
    sim.placeHero(3, "archer");
    sim.startNextWave();
    let best = 0;
    for (let i = 0; i < 30 * 40 && !sim.isOver; i++) {
      sim.step();
      for (const e of sim.enemies) best = Math.max(best, RunSim.statusCount(e));
      if (best >= 5) break;
    }
    expect(best).toBe(5);
  });
});

describe("Outhold 由来のシナジー", () => {
  it("一撃特化（崩城の一撃）: 弓の攻撃力 ×5・攻撃間隔 ×3", () => {
    const base = new RunSim(line([wave("byte_s", 1)]), 1).statsFor("archer", 1);
    const heavy = new RunSim(line([wave("byte_s", 1)]), 1, mods({ heavyShot: 1 })).statsFor("archer", 1);
    expect(heavy.damage).toBeCloseTo(base.damage * HEAVY_SHOT_DAMAGE);
    expect(heavy.interval).toBeCloseTo(base.interval * HEAVY_SHOT_INTERVAL);
  });

  it("充電（電気伝導）: 結界の範囲内のヒーローだけ攻撃間隔が短くなる", () => {
    const sim = new RunSim(line([wave("byte_s", 1)]), 1, mods({ ...ALL_ROLES, pulseHaste: 0.3 }));
    const far = sim.placeHero(0, "archer")!; // (5,1)
    sim.placeHero(1, "pulse"); // (7,1): 距離 2 > 結界の範囲 1.7
    expect(sim.hasteFor(far)).toBe(0);
    const sim2 = new RunSim(
      line([wave("byte_s", 1)], { slots: [{ col: 5, row: 1 }, { col: 6, row: 1 }] }),
      1,
      mods({ ...ALL_ROLES, pulseHaste: 0.9 }),
    );
    const a = sim2.placeHero(0, "archer")!;
    const p = sim2.placeHero(1, "pulse")!;
    expect(sim2.hasteFor(a)).toBe(HASTE_CAP);
    expect(sim2.hasteFor(p)).toBe(0);
  });

  it("ダメージリンク（連環の計）: 鈍足中の敵への命中が他の鈍足中の敵にも伝わる", () => {
    const sim = new RunSim(short([wave("byte_t", 3, 0.2, 50)]), 1, mods({ unlockCannon: 1, slowLink: 0.5 }));
    sim.startNextWave();
    run(sim, 2);
    const [a, b, c] = sim.enemies;
    for (const e of [a, b]) {
      e.status.slow = 0.3;
      e.status.slowTime = 5;
    }
    const hb = b.hp;
    const hc = c.hp;
    // ヒーローの直接の命中として与える
    const archer = sim.placeHero(0, "archer")!;
    (sim as unknown as { dealDamage: (e: unknown, n: number, h: number, c: boolean) => void }).dealDamage(a, 10, archer.id, false);
    expect(b.hp).toBeCloseTo(hb - 5);
    expect(c.hp).toBe(hc); // 鈍足していない敵には伝わらない
  });

  it("撃破時の爆発（伏爆の罠）: 周りの敵に最大 HP の一定割合", () => {
    const sim = new RunSim(short([wave("byte_t", 3, 0.2, 50)]), 1, mods({ unlockCannon: 1, deathBlastChance: 1 }));
    sim.startNextWave();
    run(sim, 1.5);
    const [a, b] = sim.enemies;
    const hb = b.hp;
    a.hp = 1;
    sim.fireCannon(a.x, a.y);
    const evs = sim.drainEvents();
    expect(evs.some((e) => e.type === "blast")).toBe(true);
    expect(b.hp).toBeLessThanOrEqual(hb - CANNON.damage - a.maxHp * BLAST_PCT + 1e-6);
    expect(sim.stats.blastDamage).toBeGreaterThan(0);
  });

  it("背水（不屈のガンマン）と無血開城: 失った HP で攻撃力、到達で GUM", () => {
    const sim = new RunSim(short([wave("byte_s", 2, 0.3)], { cryptidHp: 3 }), 1, mods({ lostHpDamagePct: 0.2, gumOnLeak: 5 }));
    expect(sim.lostHpBonus).toBe(0);
    sim.startNextWave();
    const g = sim.gum;
    const evs = run(sim, 30, (e) => e.type === "leak");
    const leak = evs.find((e) => e.type === "leak");
    expect(leak && leak.type === "leak" && leak.gum).toBe(5);
    expect(sim.gum).toBe(g + 5);
    expect(sim.lostHpBonus).toBeCloseTo(0.2);
  });
});
