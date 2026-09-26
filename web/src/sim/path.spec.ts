import { PathGeom } from "./path";

describe("PathGeom", () => {
  const p = new PathGeom("p", [[0, 0], [2, 0], [2, 3]]);

  it("長さはマス中心間の距離の合計", () => {
    expect(p.length).toBeCloseTo(5);
  });

  it("距離 d の位置と進行方向", () => {
    expect(p.sample(0).pos).toEqual({ x: 0.5, y: 0.5 });
    expect(p.sample(1).pos).toEqual({ x: 1.5, y: 0.5 });
    expect(p.sample(1).dir).toEqual({ x: 1, y: 0 });
    expect(p.sample(3).pos).toEqual({ x: 2.5, y: 1.5 });
    expect(p.sample(3).dir).toEqual({ x: 0, y: 1 });
  });

  it("範囲外はクランプ", () => {
    expect(p.sample(-5).pos).toEqual({ x: 0.5, y: 0.5 });
    expect(p.sample(99).pos).toEqual({ x: 2.5, y: 3.5 });
  });
});
