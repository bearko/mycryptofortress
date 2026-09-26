import { STONE_NUM } from "../data/balance/stones";
import type { LevelDef, WaveDef } from "./level";
import { emptyModifiers, type RunModifiers } from "./modifiers";
import { CANNON, RunSim, type SimEvent } from "./run";

const ALL: Partial<RunModifiers> = {
  unlockLightning: 1,
  unlockPulse: 1,
  unlockFire: 1,
  unlockMiner: 1,
  unlockCannon: 1,
  stoneIfrit: 1,
  stoneLeviathan: 1,
  stoneTiamat: 1,
  stoneGaruda: 1,
};
const mods = (patch: Partial<RunModifiers> = {}): RunModifiers => ({ ...emptyModifiers(), ...ALL, ...patch });

function line(waves: WaveDef[], o: Partial<LevelDef> = {}): LevelDef {
  return {
    id: "T",
    name: "test",
    background: "bg.node.1037",
    cols: 10,
    rows: 5,
    cryptid: { col: 9, row: 2 },
    startGum: 10_000,
    cryptidHp: 50,
    prepSeconds: 1,
    intermissionSeconds: 1,
    reward: { perWave: 1, clear: 1, firstClear: 1 },
    paths: [{ id: "a", points: [[-1, 2], [9, 2]] }],
    slots: [{ col: 3, row: 1 }, { col: 5, row: 1 }, { col: 7, row: 3, element: "tiamat" }],
    waves,
    ...o,
  };
}
const wave = (enemy: string, count = 1, hpMul = 1, interval = 0.5): WaveDef => ({
  reward: 0,
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

describe("魔石 (SPEC-115)", () => {
  it("解放した魔石だけ装着でき、付け替えると前の持ち主から外れる", () => {
    const locked = new RunSim(line([wave("byte_s")]), 1, { ...emptyModifiers() });
    const a0 = locked.placeHero(0, "archer")!;
    expect(locked.equipStone("ifrit", a0.id)).toBe(false);

    const sim = new RunSim(line([wave("byte_s")]), 1, mods());
    const a = sim.placeHero(0, "archer")!;
    const b = sim.placeHero(1, "archer")!;
    expect(sim.equipStone("ifrit", a.id)).toBe(true);
    expect(sim.heroElement(a)).toBe("ifrit");
    expect(sim.equipStone("ifrit", b.id)).toBe(true);
    expect(sim.heroElement(a)).toBeNull();
    expect(sim.heroElement(b)).toBe("ifrit");
    // 別の魔石を付けると前の魔石は外れる
    expect(sim.equipStone("garuda", b.id)).toBe(true);
    expect(sim.stoneHolderOf("ifrit")).toBeNull();
    // 幻獣砲にも付けられる
    expect(sim.equipStone("leviathan", "cannon")).toBe(true);
    expect(sim.cannonStone).toBe("leviathan");
  });

  it("属性マスのヒーローは魔石なしで属性を得て、魔石は付けられない", () => {
    const sim = new RunSim(line([wave("byte_s")]), 1, mods());
    const m = sim.placeHero(2, "miner")!;
    expect(sim.heroElement(m)).toBe("tiamat");
    expect(sim.equipStone("ifrit", m.id)).toBe(false);
    // ティアマト（地脈）: 通行料 2 倍
    const plain = new RunSim(line([wave("byte_s")]), 1, mods()).placeHero(0, "miner")!;
    expect(sim.tollFor(m)).toBe(sim.tollFor(plain) * STONE_NUM.tiamatMinerMul);
  });

  it("弓 × イフリート: 火矢が周りを巻き込み炎上させる / × ガルーダ: 毎回 2 体に撃つ", () => {
    const sim = new RunSim(line([wave("byte_t", 4, 20, 0.2)]), 1, mods());
    const a = sim.placeHero(1, "archer")!;
    sim.equipStone("ifrit", a.id);
    sim.startNextWave();
    run(sim, 6);
    expect(sim.enemies.filter((e) => e.status.burnTime > 0).length).toBeGreaterThanOrEqual(2);

    const g = new RunSim(line([wave("byte_t", 4, 20, 0.2)]), 1, mods());
    const b = g.placeHero(1, "archer")!;
    g.equipStone("garuda", b.id);
    g.startNextWave();
    run(g, 6);
    expect(g.enemies.filter((e) => e.hp < e.maxHp).length).toBeGreaterThanOrEqual(2);
  });

  it("雷 × リヴァイアサン: 放電で押し戻す / × ティアマト: 連鎖した敵すべてに毒", () => {
    const sim = new RunSim(line([wave("byte_t", 3, 50, 0.3)]), 1, mods({ lightningShock: 5 }));
    sim.equipStone("leviathan", sim.placeHero(0, "lightning")!.id);
    sim.startNextWave();
    const evs = run(sim, 5);
    expect(evs.some((e) => e.type === "knockback")).toBe(true);

    const t = new RunSim(line([wave("byte_t", 3, 50, 0.3)]), 1, mods());
    t.equipStone("tiamat", t.placeHero(0, "lightning")!.id);
    t.startNextWave();
    run(t, 5, (e) => e.type === "chain" && e.points.length >= 3);
    expect(t.enemies.filter((e) => e.status.poisonTime > 0).length).toBeGreaterThanOrEqual(2);
  });

  it("結界 × ガルーダ: 波動の間隔 0.6 倍 / × ティアマト: 毒の結界", () => {
    const sim = new RunSim(line([wave("byte_t", 3, 50, 0.3)]), 1, mods());
    const p = sim.placeHero(1, "pulse")!;
    const base = sim.heroStats(p).interval;
    sim.equipStone("garuda", p.id);
    expect(sim.heroStats(p).interval).toBeCloseTo(base * STONE_NUM.garudaPulseInterval);
    sim.equipStone("tiamat", p.id);
    sim.startNextWave();
    run(sim, 10, (e) => e.type === "pulse");
    expect(sim.enemies.some((e) => e.status.poisonTime > 0)).toBe(true);
  });

  it("炎 × ガルーダ: 十字火球が射程外の直線上の敵にも当たる / × リヴァイアサン: 冷炎で鈍足", () => {
    const sim = new RunSim(line([wave("byte_t", 6, 50, 0.4)]), 1, mods());
    const f = sim.placeHero(1, "fire")!; // (5,1): 経路 row 2 は縦方向に 1 マス
    sim.equipStone("garuda", f.id);
    sim.startNextWave();
    const evs = run(sim, 12, (e) => e.type === "cross");
    expect(evs.some((e) => e.type === "cross")).toBe(true);

    const c = new RunSim(line([wave("byte_t", 2, 50, 0.4)]), 1, mods());
    c.equipStone("leviathan", c.placeHero(1, "fire")!.id);
    c.startNextWave();
    run(c, 12, (e) => e.type === "flame");
    expect(c.enemies.some((e) => e.status.slowTime > 0)).toBe(true);
  });

  it("採掘 × リヴァイアサン（渦潮）/ × イフリート（焼き討ち）: 通行料を払った敵に効果", () => {
    const sim = new RunSim(line([wave("byte_s", 2, 30)]), 1, mods());
    const vortex = sim.placeHero(0, "miner")!;
    sim.equipStone("leviathan", vortex.id);
    const burner = sim.placeHero(1, "miner")!;
    sim.equipStone("ifrit", burner.id);
    sim.startNextWave();
    run(sim, 10, (e) => e.type === "toll" && e.heroId === vortex.id);
    expect(sim.enemies.some((e) => e.status.slowTime > 0)).toBe(true);
    run(sim, 10, (e) => e.type === "toll" && e.heroId === burner.id);
    expect(sim.enemies.some((e) => e.status.burnTime > 0)).toBe(true);
  });

  it("幻獣砲 × ガルーダで光線が太くなり、× リヴァイアサンで鈍足", () => {
    const sim = new RunSim(line([wave("byte_t", 1, 50)]), 1, mods());
    sim.equipStone("leviathan", "cannon");
    sim.startNextWave();
    run(sim, 2);
    const e = sim.enemies[0];
    expect(sim.fireCannon(e.x, e.y)).toBe(true);
    expect(e.status.slowTime).toBeGreaterThan(0);
    expect(e.hp).toBeCloseTo(e.maxHp - CANNON.damage);
  });
});

describe("ギミック敵 (SPEC-117)", () => {
  it("隠密: ヒーローから離れていると狙われず、近づくかガルーダの射程で見える", () => {
    const sim = new RunSim(line([wave("chameleon_s", 1, 50)]), 1, mods());
    const a = sim.placeHero(1, "archer")!; // (5.5, 1.5)
    sim.startNextWave();
    run(sim, 2.5); // x ≈ 1.5: 射程 2.6 の外周だが隠れている
    const e = sim.enemies[0];
    expect(e.revealed).toBe(false);
    expect(sim.selectTarget(a, 99)).toBeNull();
    sim.equipStone("garuda", a.id);
    sim.step();
    const r = sim.heroStats(a).range;
    if (Math.hypot(e.x - a.x, e.y - a.y) <= r) expect(e.revealed).toBe(true);
    run(sim, 3);
    expect(sim.enemies[0]?.revealed ?? true).toBe(true);
  });

  it("回復: 周りの傷ついた敵を回復する", () => {
    const w: WaveDef = { reward: 0, hpMul: 10, groups: [{ enemy: "byte_t", count: 1, interval: 1, path: "a", delay: 0 }, { enemy: "heartbleed_s", count: 1, interval: 1, path: "a", delay: 0.3 }] };
    const sim = new RunSim(line([w]), 1, mods());
    sim.startNextWave();
    run(sim, 1);
    const hurt = sim.enemies.find((e) => e.def.id === "byte_t")!;
    hurt.hp = hurt.maxHp * 0.5;
    const evs = run(sim, 3, (e) => e.type === "enemyHeal");
    expect(evs.some((e) => e.type === "enemyHeal")).toBe(true);
    expect(hurt.hp).toBeGreaterThan(hurt.maxHp * 0.5);
  });

  it("召喚ボス: 一定間隔で手下を呼ぶ", () => {
    const sim = new RunSim(line([wave("boss_genghis", 1)]), 1, mods());
    sim.startNextWave();
    const evs = run(sim, 6, (e) => e.type === "summon");
    expect(evs.some((e) => e.type === "summon")).toBe(true);
    expect(sim.enemies.filter((e) => e.def.id === "rabbit_t")).toHaveLength(2);
  });

  it("分裂ボス: HP が半分を切ると 2 体に分かれ、小さく・報酬が減る", () => {
    const sim = new RunSim(line([wave("boss_yoshka", 1, 0.01)]), 1, mods());
    sim.startNextWave();
    run(sim, 1);
    const boss = sim.enemies[0];
    const hp = boss.maxHp;
    sim.fireCannon(boss.x, boss.y); // 42 * 0.01 = 42 HP → 36
    boss.hp = hp * 0.55;
    run(sim, 0.3);
    sim.drainEvents();
    // 5 ダメージ程度の砲撃で 50% を切らせる
    while (sim.enemies.length === 1 && !sim.isOver) {
      sim.step();
      sim.fireCannon(boss.x, boss.y);
    }
    const kids = sim.enemies.filter((e) => e.def.id === "boss_yoshka");
    expect(kids).toHaveLength(2);
    expect(kids[0].gen).toBe(1);
    expect(kids[0].scale).toBeLessThan(boss.scale);
    expect(kids[0].rewardMul).toBe(0.5);
  });

  it("多節ボス: 節は後ろに連なって出て、どこを殴っても共有 HP が減り、全員同時に倒れる", () => {
    const sim = new RunSim(line([wave("boss_pooly", 1, 0.01)]), 1, mods());
    sim.startNextWave();
    run(sim, 10);
    const members = sim.enemies;
    expect(members.length).toBe(6);
    const pool = members[0].pool!;
    expect(members.every((m) => m.pool === pool)).toBe(true);
    const before = pool.hp;
    const tail = members[members.length - 1];
    sim.fireCannon(tail.x, tail.y);
    expect(pool.hp).toBeLessThan(before);
    expect(members.every((m) => m.hp === pool.hp)).toBe(true);
    pool.hp = 1;
    for (const m of members) m.hp = 1;
    run(sim, 0.5);
    expect(sim.fireCannon(tail.x, tail.y)).toBe(true);
    sim.step();
    expect(sim.enemies).toHaveLength(0);
  });
});

describe("自動回収 (SPEC-116)", () => {
  it("マイルストーンの自動回収があるとドロップが少し後に自動で集まる", () => {
    const sim = new RunSim(line([wave("byte_s", 2, 1, 3)]), 1, mods({ autoCollect: 1 }));
    sim.startNextWave();
    run(sim, 1);
    const e = sim.enemies[0];
    e.hp = 1;
    sim.fireCannon(e.x, e.y);
    expect(sim.drops).toHaveLength(1);
    const gum = sim.gum;
    run(sim, 1);
    expect(sim.drops).toHaveLength(0);
    expect(sim.gum).toBeGreaterThan(gum);
  });
});
