/**
 * SPEC-100 §9: 決定的シミュレーション用のシード付き乱数（mulberry32）。
 * 同じシードからは常に同じ系列を返す。状態は 32bit 整数 1 つで保存・復元できる。
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** [0, 1) の一様乱数 */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min, max] の整数（両端含む） */
  int(min: number, max: number): number {
    if (max < min) throw new RangeError(`int(${min}, ${max})`);
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** 確率 p で true */
  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError("pick from empty array");
    return items[this.int(0, items.length - 1)];
  }

  getState(): number {
    return this.state;
  }

  setState(state: number): void {
    this.state = state >>> 0;
  }
}
