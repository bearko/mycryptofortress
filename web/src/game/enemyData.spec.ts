import { describe, it, expect } from "vitest";
import { ENEMIES, findEnemy } from "./enemyData";

describe("ENEMIES (SPEC-013 / SPEC-019)", () => {
  it("10 種類の敵が登録されている (基本 4 + 拡張 6)", () => {
    expect(ENEMIES.length).toBe(10);
    const ids = ENEMIES.map((e) => e.id).sort((a, b) => a - b);
    expect(ids).toEqual([101, 104, 105, 121, 122, 131, 132, 141, 151, 161]);
  });

  it("拡張エネミーは多様な役割をカバー", () => {
    const rusher = findEnemy(141)!;
    const tank = findEnemy(151)!;
    expect(rusher.speed).toBeGreaterThan(1.3); // 高速ラッシャー
    expect(tank.phyDef).toBeGreaterThan(30); // 高耐久タンク
    expect(tank.speed).toBeLessThan(0.7);
  });

  it("findEnemy で id 検索ができる", () => {
    expect(findEnemy(101)?.name).toBe("クリーパー ショート");
    expect(findEnemy(104)?.name).toBe("クリーパー ヴェンティ");
    expect(findEnemy(121)?.attackType).toBe("INT");
    expect(findEnemy(131)?.attackType).toBe("INT");
    expect(findEnemy(999)).toBeUndefined();
  });

  it("各敵が必須フィールドを持つ", () => {
    for (const e of ENEMIES) {
      expect(e.id).toBeTypeOf("number");
      expect(e.name.length).toBeGreaterThan(0);
      expect(e.hp).toBeGreaterThan(0);
      expect(e.speed).toBeGreaterThan(0);
      expect(e.attackInterval).toBeGreaterThan(0);
    }
  });

  it("クリーパー ヴェンティは大型 (HP/PHY 高、移動遅い)", () => {
    const big = findEnemy(104)!;
    const small = findEnemy(101)!;
    expect(big.hp).toBeGreaterThan(small.hp);
    expect(big.phy).toBeGreaterThan(small.phy);
    expect(big.speed).toBeLessThan(small.speed);
  });

  it("ハートブリードは脆い (HP 低、INT 高、速い)", () => {
    const fast = findEnemy(121)!;
    const standard = findEnemy(101)!;
    expect(fast.hp).toBeLessThan(standard.hp);
    expect(fast.int).toBeGreaterThan(standard.int);
    expect(fast.speed).toBeGreaterThan(standard.speed);
    expect(fast.attackType).toBe("INT");
  });
});
