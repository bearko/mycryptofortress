import type { LevelDef, WaveDef } from "./level";
import { INTEREST_CAP, emptyModifiers, type RunModifiers } from "./modifiers";
import { RunSim, type SimEvent } from "./run";

/** SPEC-119: Outhold 由来の強化（印・自動マーク・弱点を突く・多重会心・報復の炎・利息）と累計記録 */

const mods = (patch: Partial<RunModifiers> = {}): RunModifiers => ({ ...emptyModifiers(), ...patch });

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
    slots: [{ col: 4, row: 1 }, { col: 6, row: 1 }],
    waves,
    ...o,
  };
}
const wave = (enemy: string, count = 1, hpMul = 1, interval = 0.5): WaveDef => ({
  reward: 0,
  hpMul,
  groups: [{ enemy, count, interval, path: "a", delay: 0 }],
});
function run(sim: RunSim, seconds: number): SimEvent[] {
  const out: SimEvent[] = [];
  const end = sim.time + seconds;
  while (!sim.isOver && sim.time < end) {
    sim.step();
    out.push(...sim.drainEvents());
  }
  return out;
}
const hits = (evs: SimEvent[]) => evs.flatMap((e) => (e.type === "hit" ? [e.damage] : []));

describe("印・自動マーク・弱点を突く・多重会心 (SPEC-119)", () => {
  it("矢が当たった敵に印がつき、次の命中から被ダメージが増える", () => {
    const plain = new RunSim(line([wave("byte_s", 1, 100)]), 1, mods());
    plain.placeHero(0, "archer");
    const base = hits(run(plain, 12)).slice(0, 2);
    expect(base[1]).toBeCloseTo(base[0]);

    const sim = new RunSim(line([wave("byte_s", 1, 100)]), 1, mods({ markPct: 0.5 }));
    sim.placeHero(0, "archer");
    const d = hits(run(sim, 12)).slice(0, 2);
    expect(d[0]).toBeCloseTo(base[0]);
    expect(d[1]).toBeCloseTo(base[0] * 1.5);
  });

  it("自動マークはボスとトール級（到達 2 以上）にだけ最初から印をつける", () => {
    const sim = new RunSim(line([{ reward: 0, hpMul: 1, groups: [{ enemy: "byte_s", count: 1, interval: 1, path: "a", delay: 0 }, { enemy: "byte_g", count: 1, interval: 1, path: "a", delay: 0 }] }]), 1, mods({ markPct: 0.1, autoMark: 1 }));
    run(sim, 1.5);
    const small = sim.enemies.find((e) => e.def.id === "byte_s")!;
    const big = sim.enemies.find((e) => e.def.id === "byte_g")!;
    expect(small.status.markTime).toBe(0);
    expect(big.status.markTime).toBe(Infinity);
  });

  it("弱点を突く: 状態異常の種類数だけ被ダメージが増える", () => {
    const measure = (weaknessPct: number) => {
      const sim = new RunSim(line([wave("byte_s", 1, 100)]), 1, mods({ weaknessPct }));
      sim.placeHero(0, "archer");
      run(sim, 1.2);
      const e = sim.enemies[0];
      // 鈍足（効果 0）と炎上（毎秒 0）の 2 種類をかけておく
      e.status.slowTime = 99;
      e.status.burnTime = 99;
      return hits(run(sim, 10))[0];
    };
    expect(measure(0.25)).toBeCloseTo(measure(0) * 1.5);
  });

  it("多重会心: 会心がもう一度会心になると倍率が 2 回かかる", () => {
    const measure = (multiCritChance: number) => {
      const sim = new RunSim(line([wave("byte_s", 1, 100)]), 1, mods({ critChance: 1, multiCritChance }));
      sim.placeHero(0, "archer");
      return hits(run(sim, 12))[0];
    };
    expect(measure(1)).toBeCloseTo(measure(0) * 2);
  });
});

describe("報復の炎・利息 (SPEC-119)", () => {
  it("到達されると幻獣の周りの敵が最大 HP に比例したダメージを受ける", () => {
    const sim = new RunSim(line([wave("byte_s", 3, 5, 0.3)]), 1, mods({ vengeancePct: 0.3 }));
    const evs = run(sim, 30);
    expect(evs.some((e) => e.type === "vengeance")).toBe(true);
    // 3 体とも到達したが、後ろの 2 体は炎で削られていた
    expect(sim.stats.leaks).toBe(3);
    expect(sim.stats.blastDamage).toBeGreaterThan(0);
    expect(sim.stats.damageTaken).toBe(3);
  });

  it("Wave クリアで所持 GUM の利息が入り、上限で止まる", () => {
    const small = new RunSim(line([wave("byte_s")], { startGum: 1000 }), 1, mods({ interestPct: 0.03 }));
    const e1 = run(small, 30).find((e) => e.type === "interest");
    expect(e1).toMatchObject({ value: 30 });
    const rich = new RunSim(line([wave("byte_s")]), 1, mods({ interestPct: 0.03 }));
    const e2 = run(rich, 30).find((e) => e.type === "interest");
    expect(e2).toMatchObject({ value: INTEREST_CAP });
  });
});

describe("累計記録に使うランの記録 (SPEC-119)", () => {
  it("分裂ボス・多節ボスは 1 体として数える", () => {
    for (const boss of ["boss_yoshka", "boss_pooly"]) {
      const sim = new RunSim(line([wave(boss, 1, 0.0005)]), 1, mods({ damagePct: 50 }));
      sim.placeHero(0, "archer");
      sim.placeHero(1, "archer");
      run(sim, 40);
      expect(sim.stats.bossKills, boss).toBe(1);
    }
  });
});
