import { getAsset } from "./assets";
import { ENEMIES } from "./balance/enemies";
import { ROLE_IDS, ROLES } from "./balance/heroes";
import { emptyModifiers } from "../sim/modifiers";

describe("敵・ヒーローのデータ (SPEC-104 / Phase 3)", () => {
  it("敵の画像がマニフェストにあり、分裂先が存在して循環しない", () => {
    for (const e of Object.values(ENEMIES)) {
      expect(getAsset(e.imageKey).type, e.id).toBe("image");
      const seen = new Set<string>([e.id]);
      let cur = e.split?.enemy;
      while (cur) {
        expect(ENEMIES[cur], `${e.id} → ${cur}`).toBeDefined();
        expect(seen.has(cur), `${e.id} split cycle`).toBe(false);
        seen.add(cur);
        cur = ENEMIES[cur].split?.enemy;
      }
    }
  });

  it("双子グループは 2 体以上のボスで構成される", () => {
    const groups = new Map<string, number>();
    for (const e of Object.values(ENEMIES)) {
      if (!e.twinGroup) continue;
      expect(e.boss, e.id).toBe(true);
      groups.set(e.twinGroup, (groups.get(e.twinGroup) ?? 0) + 1);
    }
    for (const [g, n] of groups) expect(n, g).toBeGreaterThanOrEqual(2);
  });

  it("5 ロールの画像（交代先を含む）がマニフェストにあり、交代フラグは補正値のキー", () => {
    const keys = Object.keys(emptyModifiers());
    expect(ROLE_IDS).toHaveLength(5);
    for (const id of ROLE_IDS) {
      const r = ROLES[id];
      expect(getAsset(r.imageKey).type).toBe("image");
      if (r.unlock) expect(keys).toContain(r.unlock);
      for (const v of r.variants) {
        expect(getAsset(v.imageKey).type).toBe("image");
        expect(keys).toContain(v.flag);
      }
    }
  });
});
