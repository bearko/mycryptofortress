import type { RoleId } from "../data/balance/heroes";
import { RunSim } from "./run";
import type { LevelDef } from "./level";

export interface BotOptions {
  /** ヒーローを置くスロットの優先順（省略時は定義順） */
  slotOrder?: number[];
  /** GUM を回収するか */
  collect?: boolean;
  /** ヒーローを置く / 強化するか（false なら何もしない） */
  act?: boolean;
  /** 置くヒーローの上限 */
  maxHeroes?: number;
  role?: RoleId;
  /** 判断間隔（秒） */
  thinkEvery?: number;
}

/**
 * SPEC-102 §3: 自動検証用の簡易ボット。
 * 「空きスロットに配置 → 置き切ったら最も低レベルのヒーローを強化 → GUM は即回収」を繰り返す。
 */
export function runBot(level: LevelDef, seed: number, opts: BotOptions = {}): RunSim {
  const sim = new RunSim(level, seed);
  const role = opts.role ?? "archer";
  const order = opts.slotOrder ?? level.slots.map((_, i) => i);
  const maxHeroes = opts.maxHeroes ?? order.length;
  const thinkTicks = Math.max(1, Math.round((opts.thinkEvery ?? 0.5) * 30));
  const act = opts.act ?? true;
  const collect = opts.collect ?? true;

  const guard = 60 * 60 * 30; // 最大 60 分
  while (!sim.isOver && sim.tick < guard) {
    if (sim.tick % thinkTicks === 0) {
      if (collect) for (const d of [...sim.drops]) sim.collectDropsAt(d.x, d.y, 0.01);
      if (act) {
        let acted = true;
        while (acted) {
          acted = false;
          const free = order.find((i) => !sim.heroAt(i));
          if (free !== undefined && sim.heroes.length < maxHeroes) {
            acted = sim.placeHero(free, role) !== null;
          } else {
            const target = [...sim.heroes]
              .filter((h) => sim.levelUpCost(h) !== null)
              .sort((a, b) => a.level - b.level || a.id - b.id)[0];
            if (target) acted = sim.levelUp(target.id);
          }
        }
      }
    }
    sim.step();
  }
  return sim;
}
