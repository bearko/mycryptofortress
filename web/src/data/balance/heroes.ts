/**
 * SPEC-104 §3: ヒーロー（ロール）のバランス値。ロジックはここを参照するだけにする。
 * Phase 1 は弓ロール（ロビンフッド）のみ。
 */
export const ROLE_IDS = ["archer"] as const;
export type RoleId = (typeof ROLE_IDS)[number];

export interface RoleDef {
  id: RoleId;
  /** ロール名（UI 表示） */
  roleName: string;
  /** MCH ヒーロー ID と名前 */
  heroId: number;
  heroName: string;
  imageKey: string;
  placeCost: number;
  /** levelUpCosts[i] = Lv(i+1) → Lv(i+2) の費用。長さ + 1 が最大レベル */
  levelUpCosts: readonly number[];
  base: { damage: number; interval: number; range: number };
  perLevel: { damageMul: number; intervalMul: number; rangeAdd: number };
  projectileSpeed: number;
}

export const ROLES: Record<RoleId, RoleDef> = {
  archer: {
    id: "archer",
    roleName: "弓",
    heroId: 3026,
    heroName: "ロビンフッド",
    imageKey: "hero.3026",
    placeCost: 50,
    levelUpCosts: [45, 75, 120, 190],
    base: { damage: 5, interval: 0.8, range: 2.6 },
    perLevel: { damageMul: 1.45, intervalMul: 0.92, rangeAdd: 0.2 },
    projectileSpeed: 11,
  },
};

export function maxLevel(role: RoleDef): number {
  return role.levelUpCosts.length + 1;
}

/** レベル lv（1 始まり）の性能 */
export function roleStats(role: RoleDef, lv: number): { damage: number; interval: number; range: number } {
  const n = lv - 1;
  return {
    damage: role.base.damage * role.perLevel.damageMul ** n,
    interval: role.base.interval * role.perLevel.intervalMul ** n,
    range: role.base.range + role.perLevel.rangeAdd * n,
  };
}
