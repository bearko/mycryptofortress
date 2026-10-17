import { describe, expect, it } from "vitest";
import { VOLUME_STEP, snapVolume, stepVolume, volumeLabel } from "./volume";

describe("SPEC-127 音量の 20 段階", () => {
  it("5% 刻みに丸め、0..1 に収める", () => {
    expect(VOLUME_STEP).toBe(0.05);
    expect(snapVolume(0.6)).toBe(0.6);
    expect(snapVolume(0.8)).toBe(0.8);
    expect(snapVolume(0.37)).toBe(0.35);
    expect(snapVolume(0.62)).toBe(0.6);
    expect(snapVolume(0.999)).toBe(1);
    expect(snapVolume(0.024)).toBe(0);
    expect(snapVolume(-1)).toBe(0);
    expect(snapVolume(3)).toBe(1);
    expect(snapVolume(NaN)).toBe(0);
  });

  it("1 段ずつ上げ下げし、端で止まる", () => {
    expect(stepVolume(0.6, 1)).toBe(0.65);
    expect(stepVolume(0.6, -1)).toBe(0.55);
    expect(stepVolume(0.37, 1)).toBe(0.4);
    expect(stepVolume(1, 1)).toBe(1);
    expect(stepVolume(0, -1)).toBe(0);
    expect(stepVolume(0.05, -1)).toBe(0);
    let v = 0;
    for (let i = 0; i < 20; i++) v = stepVolume(v, 1);
    expect(v).toBe(1); // OFF から 20 回で 100%
  });

  it("表示：0 は OFF、既定の 0.6 / 0.8 は 60% / 80%", () => {
    expect(volumeLabel(0)).toBe("OFF");
    expect(volumeLabel(0.02)).toBe("OFF");
    expect(volumeLabel(0.6)).toBe("60%");
    expect(volumeLabel(0.8)).toBe("80%");
    expect(volumeLabel(0.65)).toBe("65%");
    expect(volumeLabel(1)).toBe("100%");
  });
});
