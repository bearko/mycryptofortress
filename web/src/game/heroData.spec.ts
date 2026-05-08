import { describe, it, expect } from "vitest";
import { HEROES, findHero } from "./heroData";

describe("HEROES (SPEC-015)", () => {
  it("Common 8 体 + Uncommon 10 体 = 18 体", () => {
    expect(HEROES.length).toBe(18);
    const commons = HEROES.filter((h) => h.rarity === "common");
    const uncommons = HEROES.filter((h) => h.rarity === "uncommon");
    expect(commons.length).toBe(8);
    expect(uncommons.length).toBe(10);
  });

  it("findHero で id 検索ができる", () => {
    expect(findHero(1001)?.name).toBe("コナン・ドイル");
    expect(findHero(2002)?.name).toBe("スパルタクス");
    expect(findHero(9999)).toBeUndefined();
  });

  it("各ヒーローが必須フィールドを持つ", () => {
    for (const h of HEROES) {
      expect(h.id).toBeTypeOf("number");
      expect(h.name.length).toBeGreaterThan(0);
      expect(h.rarity).toMatch(/^(common|uncommon)$/);
      expect(h.cost).toBeGreaterThan(0);
      expect(h.hp).toBeGreaterThan(0);
      expect(h.attackPattern.length).toBeGreaterThan(0);
    }
  });

  it("Uncommon は 8 職業をカバー", () => {
    const uncommonClasses = new Set(
      HEROES.filter((h) => h.rarity === "uncommon").map((h) => h.class),
    );
    // Uncommon でも全 8 職業を網羅していることが望ましい
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

  it("ID の重複なし", () => {
    const ids = HEROES.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
