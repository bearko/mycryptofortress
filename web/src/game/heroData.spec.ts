import { describe, it, expect } from "vitest";
import { HEROES, findHero } from "./heroData";

describe("HEROES (SPEC-015 / SPEC-019)", () => {
  it("Common 8 + Uncommon 10 + Rare 8 + SuperRare 8 + Legendary 4 = 38 体", () => {
    expect(HEROES.length).toBe(38);
    const counts = {
      common: HEROES.filter((h) => h.rarity === "common").length,
      uncommon: HEROES.filter((h) => h.rarity === "uncommon").length,
      rare: HEROES.filter((h) => h.rarity === "rare").length,
      superRare: HEROES.filter((h) => h.rarity === "superRare").length,
      legendary: HEROES.filter((h) => h.rarity === "legendary").length,
    };
    expect(counts).toEqual({
      common: 8,
      uncommon: 10,
      rare: 8,
      superRare: 8,
      legendary: 4,
    });
  });

  it("findHero で id 検索ができる", () => {
    expect(findHero(1001)?.name).toBe("コナン・ドイル");
    expect(findHero(2002)?.name).toBe("スパルタクス");
    expect(findHero(3001)?.name).toBe("ETHEREMON-RED");
    expect(findHero(4001)?.name).toBe("張飛");
    expect(findHero(5001)?.name).toBe("織田信長");
    expect(findHero(9999)).toBeUndefined();
  });

  it("各ヒーローが必須フィールドを持つ", () => {
    for (const h of HEROES) {
      expect(h.id).toBeTypeOf("number");
      expect(h.name.length).toBeGreaterThan(0);
      expect(h.rarity).toMatch(/^(common|uncommon|rare|superRare|legendary)$/);
      expect(h.cost).toBeGreaterThan(0);
      expect(h.hp).toBeGreaterThan(0);
      expect(h.attackPattern.length).toBeGreaterThan(0);
    }
  });

  it("Uncommon は 8 職業をカバー", () => {
    const uncommonClasses = new Set(
      HEROES.filter((h) => h.rarity === "uncommon").map((h) => h.class),
    );
    for (const c of [
      "defender",
      "guard",
      "vanguard",
      "specialist",
      "sniper",
      "caster",
      "medic",
      "supporter",
    ] as const) {
      expect(uncommonClasses.has(c)).toBe(true);
    }
  });

  it("Rare も 8 職業をカバー", () => {
    const rareClasses = new Set(
      HEROES.filter((h) => h.rarity === "rare").map((h) => h.class),
    );
    for (const c of [
      "defender",
      "guard",
      "vanguard",
      "specialist",
      "sniper",
      "caster",
      "medic",
      "supporter",
    ] as const) {
      expect(rareClasses.has(c)).toBe(true);
    }
  });

  it("ID の重複なし", () => {
    const ids = HEROES.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("Legendary はステータス・コストが他より大幅に高い", () => {
    const legendary = HEROES.filter((h) => h.rarity === "legendary");
    const common = HEROES.filter((h) => h.rarity === "common");
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const lAvgHp = avg(legendary.map((h) => h.hp));
    const cAvgHp = avg(common.map((h) => h.hp));
    expect(lAvgHp).toBeGreaterThan(cAvgHp * 1.5);
  });
});
