import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ASSETS, assetUrl, getAsset, preloadAssets } from "./assets";
import { CRYPTIDS } from "./cryptids";

const WEB_DIR = fileURLToPath(new URL("../..", import.meta.url));

describe("アセットマニフェスト (SPEC-101 §5.2)", () => {
  it("キーとパスが一意", () => {
    expect(new Set(ASSETS.map((a) => a.key)).size).toBe(ASSETS.length);
    expect(new Set(ASSETS.map((a) => a.path)).size).toBe(ASSETS.length);
  });

  it("全エントリが public/assets/mch に同梱されている", () => {
    for (const a of ASSETS) {
      expect(existsSync(path.join(WEB_DIR, "public/assets/mch", a.path)), a.path).toBe(true);
    }
  });

  it("幻獣の画像・背景キーがマニフェストに存在し、背景は遅延読み込み", () => {
    for (const c of CRYPTIDS) {
      expect(getAsset(c.imageKey).type).toBe("image");
      expect(getAsset(c.backgroundKey).preload).toBe(false);
    }
  });

  it("URL はパスをエンコードする", () => {
    expect(assetUrl({ key: "x", type: "image", path: "Image/Backgrounds/1023 (1).png" })).toBe(
      "assets/mch/Image/Backgrounds/1023%20(1).png",
    );
  });

  it("未登録キーは例外", () => {
    expect(() => getAsset("nope")).toThrow();
  });

  it("preload 対象の合計サイズは 5MB 以下（SPEC-101 §6）", () => {
    const total = preloadAssets().reduce((sum, a) => sum + readFileSync(path.join(WEB_DIR, "public/assets/mch", a.path)).length, 0);
    expect(total).toBeLessThanOrEqual(5 * 1024 * 1024);
  });
});

describe("レイヤ分離 (SPEC-101 §5.1)", () => {
  const listTs = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? listTs(path.join(dir, e.name)) : e.name.endsWith(".ts") ? [path.join(dir, e.name)] : [],
    );

  it.each(["sim", "meta", "data"])("src/%s は phaser / view を import しない", (layer) => {
    for (const file of listTs(path.join(WEB_DIR, "src", layer))) {
      const src = readFileSync(file, "utf8");
      expect(src, file).not.toMatch(/from\s+["']phaser["']/);
      expect(src, file).not.toMatch(/from\s+["'][./]*view\//);
    }
  });
});
