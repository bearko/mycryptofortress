// OGP サムネイルとアイコンを書き出す: node design/thumbnail/make-thumbnails.mjs
// Playwright（グローバル）と、web/public/assets/mch に同期済みの MCH アセットが必要。
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(here, "../../web/public");

const browser = await chromium.launch();
const page = await browser.newPage();

await page.setViewportSize({ width: 1200, height: 630 });
await page.goto("file://" + path.join(here, "og.html"));
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(pub, "og-image.jpg"), type: "jpeg", quality: 90 });

await page.goto("file://" + path.join(here, "icon.html"));
for (const [name, size] of [["icon-512.png", 512], ["icon-192.png", 192], ["apple-touch-icon.png", 180], ["favicon-32.png", 32]]) {
  await page.setViewportSize({ width: 512, height: 512 });
  const buf = await page.screenshot({ clip: { x: 0, y: 0, width: 512, height: 512 } });
  // 縮小はブラウザで行う（ピクセルアートのにじみを抑えるため 512 から一段で）
  const small = await browser.newPage();
  await small.setViewportSize({ width: size, height: size });
  await small.setContent(`<body style="margin:0"><img src="data:image/png;base64,${buf.toString("base64")}" style="width:${size}px;height:${size}px;display:block"></body>`);
  await small.screenshot({ path: path.join(pub, name), clip: { x: 0, y: 0, width: size, height: size } });
  await small.close();
}
await browser.close();
console.log("wrote og-image.jpg and icons to", pub);
