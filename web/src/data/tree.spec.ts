import { STANDARD_BUY_ORDER } from "../meta/campaign";
import { getAsset } from "./assets";
import { STAT_LABEL, TREE, TREE_BY_ID, nodeCost } from "./tree";

describe("スキルツリーのデータ (SPEC-107)", () => {
  it("ID が一意で、ルートは 1 つ", () => {
    expect(TREE_BY_ID.size).toBe(TREE.length);
    expect(TREE.filter((n) => n.parent === null).map((n) => n.id)).toEqual(["root"]);
  });

  it("親が存在し、すべてのノードがルートから到達できる（循環なし）", () => {
    for (const n of TREE) {
      let cur = n;
      const seen = new Set<string>();
      while (cur.parent) {
        expect(seen.has(cur.id), `循環: ${n.id}`).toBe(false);
        seen.add(cur.id);
        const p = TREE_BY_ID.get(cur.parent);
        expect(p, `${cur.id} の親 ${cur.parent} が無い`).toBeDefined();
        cur = p!;
      }
      expect(cur.id).toBe("root");
    }
  });

  it("コストは正で、レベルとともに単調増加", () => {
    for (const n of TREE) {
      expect(n.maxLevel).toBeGreaterThanOrEqual(1);
      for (let lv = 0; lv < n.maxLevel; lv++) {
        expect(nodeCost(n, lv)).toBeGreaterThan(0);
        if (lv > 0) expect(nodeCost(n, lv)).toBeGreaterThanOrEqual(nodeCost(n, lv - 1));
      }
    }
  });

  it("名前・出典・効果・アイコンがあり、ノード同士が重ならない", () => {
    for (const n of TREE) {
      expect(n.name.length).toBeGreaterThan(0);
      expect(n.source.length).toBeGreaterThan(0);
      expect(n.effects.length).toBeGreaterThan(0);
      for (const e of n.effects) expect(STAT_LABEL[e.stat](e.perLevel).length).toBeGreaterThan(0);
      expect(getAsset(n.icon).type).toBe("image");
    }
    for (const a of TREE)
      for (const b of TREE)
        if (a !== b) expect(Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y), `${a.id}-${b.id}`).toBeGreaterThanOrEqual(0.9);
  });
});

describe("標準購入順 (SPEC-106 §4)", () => {
  it("すべて実在するノードで重複がない", () => {
    const ids = new Set(TREE.map((n) => n.id));
    for (const id of STANDARD_BUY_ORDER) expect(ids.has(id), id).toBe(true);
    expect(new Set(STANDARD_BUY_ORDER).size).toBe(STANDARD_BUY_ORDER.length);
  });
});
