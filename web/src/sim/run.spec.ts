import { ENEMIES } from "../data/balance/enemies";
import { ROLES } from "../data/balance/heroes";
import { getLevel } from "../data/levels";
import type { LevelDef } from "./level";
import { runBot } from "./bot";
import { emptyModifiers, type RunModifiers } from "./modifiers";
import { DROP_LIFETIME, RunSim, TICK, type SimEvent } from "./run";

const L1 = getLevel("L1");

/** 1 経路・1 スロットの検証用ミニレベル */
function miniLevel(overrides: Partial<LevelDef> = {}): LevelDef {
  return {
    id: "T",
    name: "test",
    background: "bg.node.1037",
    cols: 5,
    rows: 5,
    cryptid: { col: 4, row: 2 },
    startGum: 1000,
    cryptidHp: 5,
    prepSeconds: 1,
    intermissionSeconds: 1,
    reward: { perWave: 1, clear: 5, firstClear: 5 },
    paths: [{ id: "a", points: [[-1, 2], [4, 2]] }],
    slots: [{ col: 2, row: 1 }, { col: 2, row: 3 }],
    waves: [{ reward: 7, hpMul: 1, groups: [{ enemy: "byte_s", count: 3, interval: 0.5, path: "a", delay: 0 }] }],
    ...overrides,
  };
}

function snapshot(sim: RunSim) {
  return JSON.stringify({
    t: sim.tick,
    s: sim.status,
    g: sim.gum,
    hp: sim.hp,
    w: sim.waveIndex,
    e: sim.enemies.map((e) => [e.id, e.x, e.y, e.hp]),
    h: sim.heroes.map((h) => [h.id, h.level, h.totalDamage]),
    p: sim.projectiles.map((p) => [p.id, p.x, p.y]),
    d: sim.drops.map((d) => [d.id, d.ttl]),
  });
}

describe("RunSim: 決定性 (SPEC-102 §2.1)", () => {
  it("同じシード・同じコマンド列なら全 tick で状態が一致する", () => {
    const run = () => {
      const sim = new RunSim(L1, 123);
      const snaps: string[] = [];
      for (let i = 0; i < 30 * 90; i++) {
        if (i === 10) sim.placeHero(0, "archer");
        if (i === 20) sim.placeHero(1, "archer");
        if (i % 45 === 0) for (const d of [...sim.drops]) sim.collectDropsAt(d.x, d.y);
        if (i === 900) sim.levelUp(sim.heroes[0].id);
        sim.step();
        if (i % 30 === 0) snaps.push(snapshot(sim));
      }
      return snaps;
    };
    expect(run()).toEqual(run());
  });

  it("シードが違えば敵の横ずれが変わる", () => {
    const a = new RunSim(L1, 1);
    const b = new RunSim(L1, 2);
    a.startNextWave();
    b.startNextWave();
    a.step();
    b.step();
    expect(a.enemies[0].offset).not.toEqual(b.enemies[0].offset);
  });
});

describe("RunSim: 序盤の難度 (SPEC-104 §6)", () => {
  it.each([1, 2, 3, 4, 5])("初期状態では 2 体目のヒーローを置けないまま Wave 2 で陥落する（シード %i）", (seed) => {
    // Wave 1 の GUM を全部回収しても 2 体目（50 GUM）に届かない
    const w1 = L1.waves[0];
    const wave1Gum = w1.groups.reduce((s, g) => s + g.count * ENEMIES[g.enemy].reward, 0) + w1.reward;
    expect(L1.startGum - ROLES.archer.placeCost + wave1Gum).toBeLessThan(ROLES.archer.placeCost);
    const sim = runBot(L1, seed);
    expect(sim.status).toBe("lost");
    expect(sim.stats.wavesReached).toBe(2);
  });

  it.each([1, 2, 3])("黄金の工房 Lv1（開始 GUM +20）なら Wave 2 前に 2 体目を置け、Wave 2 を越える（シード %i）", (seed) => {
    const sim = runBot(L1, seed, { mods: { ...emptyModifiers(), startGumAdd: 20 } });
    expect(sim.stats.wavesCleared).toBeGreaterThanOrEqual(2);
  });

  it("Lv2 / Lv3 は強化なしでは突破できない（スキルツリー前提）", () => {
    for (const id of ["L2", "L3"]) expect(runBot(getLevel(id), 1).status).toBe("lost");
  });

  it("何もしないと陥落する", () => {
    expect(runBot(L1, 1, { act: false }).status).toBe("lost");
  });

  it("GUM を回収しないと陥落する", () => {
    expect(runBot(L1, 1, { collect: false }).status).toBe("lost");
  });
});

describe("RunSim: Wave 進行", () => {
  it("準備時間の後に自動で開始、startNextWave で即開始", () => {
    const sim = new RunSim(miniLevel(), 1);
    expect(sim.status).toBe("prep");
    expect(sim.canStartNextWave()).toBe(true);
    sim.advance(1);
    expect(sim.status).toBe("running");
    expect(sim.waveIndex).toBe(0);

    const sim2 = new RunSim(miniLevel(), 1);
    expect(sim2.startNextWave()).toBe(true);
    expect(sim2.waveIndex).toBe(0);
    expect(sim2.canStartNextWave()).toBe(false);
  });

  it("全滅で Wave 報酬、最終 Wave クリアで won", () => {
    const sim = new RunSim(miniLevel(), 1);
    sim.placeHero(0, "archer");
    sim.placeHero(1, "archer");
    const gumBefore = sim.gum;
    const events: SimEvent[] = [];
    while (!sim.isOver && sim.time < 60) {
      sim.step();
      events.push(...sim.drainEvents());
    }
    expect(sim.status).toBe("won");
    expect(events.find((e) => e.type === "waveClear")).toMatchObject({ reward: 7 });
    expect(sim.gum).toBe(gumBefore + 7);
    expect(events.at(-1)).toEqual({ type: "won" });
  });

  it("到達でHPが減り、0 で lost", () => {
    const sim = new RunSim(miniLevel({ cryptidHp: 2 }), 1);
    const events: SimEvent[] = [];
    while (!sim.isOver && sim.time < 60) {
      sim.step();
      events.push(...sim.drainEvents());
    }
    expect(sim.status).toBe("lost");
    expect(sim.hp).toBe(0);
    expect(events.filter((e) => e.type === "leak")).toHaveLength(2);
  });
});

describe("RunSim: ヒーロー", () => {
  it("配置・強化で GUM を消費し、空きスロット・所持 GUM・最大レベルを守る", () => {
    const role = ROLES.archer;
    const sim = new RunSim(miniLevel({ startGum: role.placeCost + 10 }), 1);
    const h = sim.placeHero(0, "archer")!;
    expect(h.level).toBe(1);
    expect(sim.gum).toBe(10);
    expect(sim.placeHero(0, "archer")).toBeNull(); // 使用中のスロット
    expect(sim.placeHero(1, "archer")).toBeNull(); // GUM 不足
    expect(sim.levelUp(h.id)).toBe(false); // GUM 不足
    expect(sim.gum).toBe(10);
  });

  it("GUM 不足では配置できない", () => {
    const sim = new RunSim(miniLevel({ startGum: 49 }), 1);
    expect(sim.placeHero(0, "archer")).toBeNull();
    expect(sim.gum).toBe(49);
  });

  it("最大レベルまで強化でき、それ以上は不可", () => {
    const sim = new RunSim(miniLevel({ startGum: 10_000 }), 1);
    const h = sim.placeHero(0, "archer")!;
    let n = 0;
    while (sim.levelUp(h.id)) n++;
    expect(n).toBe(ROLES.archer.levelUpCosts.length);
    expect(sim.levelUpCost(h)).toBeNull();
    const spent = ROLES.archer.placeCost + ROLES.archer.levelUpCosts.reduce((a, b) => a + b, 0);
    expect(sim.gum).toBe(10_000 - spent);
    expect(sim.heroStats(h).damage).toBeGreaterThan(ROLES.archer.base.damage);
  });
});

describe("RunSim: ターゲット優先度 (SPEC-102 §2.4)", () => {
  function setup() {
    const sim = new RunSim(miniLevel(), 1);
    const h = sim.placeHero(0, "archer")!;
    sim.startNextWave();
    sim.advance(1.2); // 3 体出現
    const [front, mid, back] = [...sim.enemies].sort((a, b) => b.dist - a.dist);
    return { sim, h, front, mid, back };
  }

  it("first は幻獣に最も近い敵", () => {
    const { sim, h, front } = setup();
    expect(sim.selectTarget(h, 99)?.id).toBe(front.id);
  });

  it("strong / weak は HP で選ぶ", () => {
    const { sim, h, mid, back } = setup();
    mid.hp = 100;
    back.hp = 1;
    sim.setTargetMode(h.id, "strong");
    expect(sim.selectTarget(h, 99)?.id).toBe(mid.id);
    sim.setTargetMode(h.id, "weak");
    expect(sim.selectTarget(h, 99)?.id).toBe(back.id);
  });

  it("close はヒーローに最も近い敵", () => {
    const { sim, h } = setup();
    sim.setTargetMode(h.id, "close");
    const expected = [...sim.enemies].sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
    expect(sim.selectTarget(h, 99)?.id).toBe(expected.id);
  });

  it("boss はボスを優先", () => {
    const { sim, h, back } = setup();
    back.def = { ...back.def, boss: true };
    sim.setTargetMode(h.id, "boss");
    expect(sim.selectTarget(h, 99)?.id).toBe(back.id);
  });

  it("撃ちすぎ防止: 予定ダメージで倒せる敵は、他に候補があれば狙わない", () => {
    const { sim, h, front, mid } = setup();
    front.pending = front.hp;
    expect(sim.selectTarget(h, 99)?.id).toBe(mid.id);
    for (const e of sim.enemies) e.pending = e.hp;
    expect(sim.selectTarget(h, 99)?.id).toBe(front.id);
  });

  it("射程外は狙わない", () => {
    const { sim, h } = setup();
    expect(sim.selectTarget(h, 0.01)).toBeNull();
  });
});

describe("RunSim: GUM ドロップ (SPEC-104 §5)", () => {
  function killOne() {
    // 2 Wave 目を遅らせて、1 Wave 目クリア後もランが続くようにする
    const base = miniLevel();
    const later = { ...base.waves[0], groups: [{ ...base.waves[0].groups[0], delay: 60 }] };
    const sim = new RunSim({ ...base, waves: [base.waves[0], later] }, 1);
    sim.placeHero(0, "archer");
    sim.placeHero(1, "archer");
    sim.startNextWave();
    while (sim.drops.length === 0 && sim.time < 30) sim.step();
    return sim;
  }

  it("撃破でドロップし、半径内を回収すると GUM が増える", () => {
    const sim = killOne();
    const d = sim.drops[0];
    const before = sim.gum;
    expect(sim.collectDropsAt(d.x + 5, d.y)).toBe(0);
    expect(sim.collectDropsAt(d.x + 0.5, d.y)).toBe(d.value);
    expect(sim.gum).toBe(before + d.value);
    expect(sim.stats.gumEarned).toBe(d.value);
  });

  it("寿命で消滅する", () => {
    const sim = killOne();
    const id = sim.drops[0].id;
    for (let t = 0; t < DROP_LIFETIME / TICK + 2; t++) sim.step();
    expect(sim.drops.find((d) => d.id === id)).toBeUndefined();
  });
});

describe("RunSim: ツリー補正 (SPEC-108)", () => {
  const mods = (patch: Partial<RunModifiers>): RunModifiers => ({ ...emptyModifiers(), ...patch });
  const runUntil = (sim: RunSim, pred: (e: SimEvent) => boolean, seconds = 60): SimEvent[] => {
    const out: SimEvent[] = [];
    while (!sim.isOver && sim.time < seconds) {
      sim.step();
      const evs = sim.drainEvents();
      out.push(...evs);
      if (evs.some(pred)) break;
    }
    return out;
  };

  it("開始 GUM・最大 HP・配置 / 強化コスト", () => {
    const sim = new RunSim(miniLevel({ startGum: 100 }), 1, mods({ startGumAdd: 20, maxHpAdd: 3, placeCostFlat: 10, levelCostPct: 0.5 }));
    expect(sim.gum).toBe(120);
    expect(sim.maxHp).toBe(8);
    expect(sim.placeCost("archer")).toBe(ROLES.archer.placeCost - 10);
    const h = sim.placeHero(0, "archer")!;
    expect(sim.levelUpCost(h)).toBe(Math.round(ROLES.archer.levelUpCosts[0] * 0.5));
  });

  it("攻撃力・攻撃速度・射程の補正が性能に反映される", () => {
    const base = new RunSim(miniLevel(), 1);
    const up = new RunSim(miniLevel(), 1, mods({ damagePct: 0.5, attackSpeedPct: 1, rangeAdd: 1 }));
    const hb = base.placeHero(0, "archer")!;
    const hu = up.placeHero(0, "archer")!;
    expect(up.heroStats(hu).damage).toBeCloseTo(base.heroStats(hb).damage * 1.5);
    expect(up.heroStats(hu).interval).toBeCloseTo(base.heroStats(hb).interval / 2);
    expect(up.heroStats(hu).range).toBeCloseTo(base.heroStats(hb).range + 1);
  });

  it("会心率 100% なら全弾が会心（×2 + 会心ダメージ補正）", () => {
    const sim = new RunSim(miniLevel(), 1, mods({ critChance: 1, critMulAdd: 0.5 }));
    const h = sim.placeHero(0, "archer")!;
    sim.startNextWave();
    const hit = runUntil(sim, (e) => e.type === "hit").find((e) => e.type === "hit");
    expect(hit).toMatchObject({ crit: true });
    expect(h.totalDamage).toBeGreaterThan(0);
    expect(sim.heroStats(h).damage * 2.5).toBeGreaterThanOrEqual(h.totalDamage - 1e-9);
  });

  it("一斉射撃は複数の敵に同時に撃つ", () => {
    const sim = new RunSim(miniLevel(), 1, mods({ volley: 1 }));
    sim.placeHero(0, "archer");
    sim.startNextWave();
    sim.advance(1.2);
    sim.drainEvents();
    // 次の攻撃で 2 本以上の弾が同時に出る
    let maxProjectiles = 0;
    for (let i = 0; i < 60; i++) {
      sim.step();
      maxProjectiles = Math.max(maxProjectiles, new Set(sim.projectiles.map((p) => p.targetId)).size);
    }
    expect(maxProjectiles).toBeGreaterThanOrEqual(2);
  });

  it("撃破 GUM・Wave 報酬・消滅時間・回収半径の補正", () => {
    const sim = new RunSim(miniLevel(), 1, mods({ dropValueFlat: 3, waveRewardPct: 1, dropLifetimeAdd: 5, collectRadiusAdd: 0.3 }));
    sim.placeHero(0, "archer");
    sim.placeHero(1, "archer");
    sim.startNextWave();
    const evs = runUntil(sim, (e) => e.type === "won");
    const drop = sim.drops[0];
    expect(drop.value).toBe(6); // byte_s 3 GUM + 3
    expect(evs.find((e) => e.type === "waveClear")).toMatchObject({ reward: 14 });
    expect(sim.collectRadius).toBeCloseTo(1.0);
    expect(drop.ttl).toBeGreaterThan(DROP_LIFETIME);
  });

  it("到達無効化 100% ならボス以外の到達でHPが減らない", () => {
    const sim = new RunSim(miniLevel(), 1, mods({ leakIgnoreChance: 1 }));
    sim.startNextWave();
    const evs = runUntil(sim, (e) => e.type === "won", 60);
    expect(sim.status).toBe("won");
    expect(sim.hp).toBe(sim.maxHp);
    expect(evs.filter((e) => e.type === "leak").every((e) => e.type === "leak" && e.blocked)).toBe(true);
  });

  it("聖女の祈り: ボスの到達を 1 度だけ HP 1 で耐える", () => {
    const boss = { reward: 0, hpMul: 1, groups: [{ enemy: "boss_nobunaga", count: 2, interval: 3, path: "a", delay: 0 }] };
    const lv = miniLevel({ cryptidHp: 50, waves: [boss] });
    const sim = new RunSim(lv, 1, mods({ lastStand: 1 }));
    sim.startNextWave();
    const evs = runUntil(sim, (e) => e.type === "lost", 120);
    expect(evs.some((e) => e.type === "lastStand")).toBe(true);
    expect(sim.status).toBe("lost"); // 2 体目は耐えられない
  });

  it("Wave クリア回復と自然回復は最大 HP を超えない", () => {
    const sim = new RunSim(miniLevel({ cryptidHp: 10 }), 1, mods({ healPerWave: 3, regenPerSec: 0.5 }));
    sim.hp = 4;
    sim.startNextWave();
    sim.advance(3);
    expect(sim.hp).toBeGreaterThan(4);
    sim.advance(60);
    expect(sim.hp).toBeLessThanOrEqual(sim.maxHp);
  });
});

describe("RunSim: 跳躍する敵（クリーパー）", () => {
  it("一定間隔で跳び、同じ時間で通常の敵より先へ進む", () => {
    const lv = miniLevel({
      cols: 20,
      cryptid: { col: 19, row: 2 },
      paths: [{ id: "a", points: [[-1, 2], [19, 2]] }],
      slots: [],
      waves: [{ reward: 0, hpMul: 1, groups: [{ enemy: "creeper_s", count: 1, interval: 1, path: "a", delay: 0 }, { enemy: "byte_s", count: 1, interval: 1, path: "a", delay: 0 }] }],
    });
    const sim = new RunSim(lv, 1);
    sim.startNextWave();
    const evs: SimEvent[] = [];
    for (let i = 0; i < 30 * 9; i++) {
      sim.step();
      evs.push(...sim.drainEvents());
    }
    const [creeper, byte] = sim.enemies;
    expect(evs.filter((e) => e.type === "leap").length).toBeGreaterThanOrEqual(2);
    expect(creeper.dist).toBeGreaterThan(byte.dist);
  });
});
