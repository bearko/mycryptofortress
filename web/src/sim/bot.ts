import type { RoleId } from "../data/balance/heroes";
import type { RunModifiers } from "./modifiers";
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
  /** すべて同じロールで置く（指定時は rolePlan より優先） */
  role?: RoleId;
  /** n 人目に置くロール。未解放・範囲外は弓で代用（省略時は DEFAULT_ROLE_PLAN） */
  rolePlan?: RoleId[];
  /** 通常マスを置き切ったらロックマスを開放するか（既定 true） */
  openLocked?: boolean;
  /** 幻獣砲を撃つか（既定 true。GUM に余裕があるときだけ先頭の敵へ） */
  cannon?: boolean;
  /** 判断間隔（秒） */
  thinkEvery?: number;
  /** スキルツリーの補正 */
  mods?: RunModifiers;
}

/** 解放済みなら混成で置く標準の順番（弓 2 → 結界 → 雷 → 炎 → 採掘 → 以降は弓と雷） */
export const DEFAULT_ROLE_PLAN: RoleId[] = ["archer", "archer", "pulse", "lightning", "fire", "miner", "archer", "lightning", "archer", "fire"];

/** 幻獣砲を撃つのは、この GUM を残せるときだけ */
const CANNON_RESERVE = 60;

/**
 * SPEC-102 §3: 自動検証用の簡易ボット。
 * 「空きスロットに配置 → 置き切ったら最も低レベルのヒーローを強化 → GUM は即回収」を繰り返す。
 */
export function runBot(level: LevelDef, seed: number, opts: BotOptions = {}): RunSim {
  const sim = new RunSim(level, seed, opts.mods);
  const plan = opts.rolePlan ?? DEFAULT_ROLE_PLAN;
  const roleFor = (n: number): RoleId => {
    const r = opts.role ?? plan[n] ?? "archer";
    return sim.isRoleUnlocked(r) ? r : "archer";
  };
  const openLocked = opts.openLocked ?? true;
  const cannon = opts.cannon ?? true;
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
          const free = order.find((i) => !sim.heroAt(i) && sim.isSlotOpen(i));
          const locked = order.find((i) => !sim.isSlotOpen(i));
          if (free !== undefined && sim.heroes.length < maxHeroes) {
            acted = sim.placeHero(free, roleFor(sim.heroes.length)) !== null;
          } else if (openLocked && locked !== undefined && sim.heroes.length < maxHeroes) {
            const cost = sim.slotOpenCost(locked)!;
            if (sim.gum >= cost + sim.placeCost(roleFor(sim.heroes.length))) acted = sim.openSlot(locked);
            else acted = levelUpLowest(sim, cost);
          } else {
            const target = [...sim.heroes]
              .filter((h) => sim.levelUpCost(h) !== null)
              .sort((a, b) => a.level - b.level || a.id - b.id)[0];
            if (target) acted = sim.levelUp(target.id);
          }
        }
        if (cannon && sim.canFireCannon() && sim.gum >= CANNON_RESERVE + sim.cannonCost) {
          const c = sim.cryptidPos;
          const lead = [...sim.enemies].sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
          if (lead) sim.fireCannon(lead.x, lead.y);
        }
      }
    }
    sim.step();
  }
  return sim;
}

/** ロックマス開放の資金 reserve を残せる範囲で、最も低レベルのヒーローを強化する */
function levelUpLowest(sim: RunSim, reserve: number): boolean {
  const target = [...sim.heroes]
    .filter((h) => {
      const c = sim.levelUpCost(h);
      return c !== null && sim.gum - c >= reserve;
    })
    .sort((a, b) => a.level - b.level || a.id - b.id)[0];
  return target ? sim.levelUp(target.id) : false;
}
