import type { PathDef } from "./level";

export interface Vec {
  x: number;
  y: number;
}

/** SPEC-102 §2.2: マス中心を結ぶ折れ線。距離 d の位置と進行方向を返す。 */
export class PathGeom {
  readonly points: Vec[];
  readonly cumulative: number[];
  readonly length: number;

  constructor(readonly id: string, def: PathDef["points"]) {
    this.points = def.map(([c, r]) => ({ x: c + 0.5, y: r + 0.5 }));
    this.cumulative = [0];
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1];
      const b = this.points[i];
      this.cumulative.push(this.cumulative[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
    }
    this.length = this.cumulative[this.cumulative.length - 1];
  }

  /** 距離 d（0..length にクランプ）の位置と単位方向ベクトル */
  sample(d: number): { pos: Vec; dir: Vec } {
    const dist = Math.min(Math.max(d, 0), this.length);
    let i = 1;
    while (i < this.points.length - 1 && this.cumulative[i] < dist) i++;
    const a = this.points[i - 1];
    const b = this.points[i];
    const segLen = this.cumulative[i] - this.cumulative[i - 1];
    const t = segLen > 0 ? (dist - this.cumulative[i - 1]) / segLen : 0;
    const dir = segLen > 0 ? { x: (b.x - a.x) / segLen, y: (b.y - a.y) / segLen } : { x: 0, y: 1 };
    return { pos: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, dir };
  }
}
