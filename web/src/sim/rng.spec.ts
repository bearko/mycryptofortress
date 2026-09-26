import { Rng } from "./rng";

describe("Rng (SPEC-100 §9 決定性)", () => {
  it("同じシードなら同じ系列", () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 100 }, () => a.next());
    const seqB = Array.from({ length: 100 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("異なるシードなら異なる系列", () => {
    expect(new Rng(1).next()).not.toEqual(new Rng(2).next());
  });

  it("next は [0,1)、int は両端を含む範囲", () => {
    const r = new Rng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      const n = r.int(1, 3);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(3);
      seen.add(n);
    }
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it("状態の保存・復元で続きが再現できる", () => {
    const r = new Rng(99);
    r.next();
    const state = r.getState();
    const expected = [r.next(), r.next()];
    const restored = new Rng(0);
    restored.setState(state);
    expect([restored.next(), restored.next()]).toEqual(expected);
  });

  it("不正な引数はエラー", () => {
    const r = new Rng(1);
    expect(() => r.int(3, 1)).toThrow(RangeError);
    expect(() => r.pick([])).toThrow(RangeError);
  });
});
