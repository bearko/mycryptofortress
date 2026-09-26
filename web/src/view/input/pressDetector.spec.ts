import { PressDetector } from "./pressDetector";

const cfg = { longPressMs: 450, moveTolerance: 24 };

describe("PressDetector (SPEC-101 §5.4)", () => {
  it("短く押して離すと tap", () => {
    const d = new PressDetector(cfg);
    d.down(100, 100, 0);
    expect(d.tick(200)).toBeNull();
    expect(d.up(105, 102, 200)).toBe("tap");
  });

  it("長押しで longpress が 1 回だけ発火し、その後の up は tap にならない", () => {
    const d = new PressDetector(cfg);
    d.down(100, 100, 0);
    expect(d.tick(449)).toBeNull();
    expect(d.tick(450)).toBe("longpress");
    expect(d.tick(600)).toBeNull();
    expect(d.up(100, 100, 700)).toBeNull();
  });

  it("許容量を超えて動かすとキャンセル（tap / longpress なし）", () => {
    const d = new PressDetector(cfg);
    d.down(100, 100, 0);
    d.move(130, 100);
    expect(d.isPressing).toBe(false);
    expect(d.tick(500)).toBeNull();
    expect(d.up(130, 100, 520)).toBeNull();
  });

  it("許容量以内の指のブレは tap のまま", () => {
    const d = new PressDetector(cfg);
    d.down(100, 100, 0);
    d.move(115, 110);
    expect(d.up(116, 112, 100)).toBe("tap");
  });

  it("離す瞬間に大きく動いていたら tap にしない", () => {
    const d = new PressDetector(cfg);
    d.down(0, 0, 0);
    expect(d.up(100, 0, 50)).toBeNull();
  });

  it("down していない up は無視、再利用できる", () => {
    const d = new PressDetector(cfg);
    expect(d.up(0, 0, 0)).toBeNull();
    d.down(0, 0, 1000);
    expect(d.up(0, 0, 1100)).toBe("tap");
  });
});
