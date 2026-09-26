# サムネイル（OGP 画像・アプリアイコン）

| 出力（`web/public/`） | サイズ | 用途 |
|---|---|---|
| `og-image.jpg` | 1200×630 | SNS 共有時のサムネイル（`og:image` / `twitter:image`） |
| `icon-512.png` / `icon-192.png` | 512 / 192 | アプリアイコン |
| `apple-touch-icon.png` | 180 | iOS のホーム画面 |
| `favicon-32.png` | 32 | ブラウザのタブ |

- 原稿は `og.html` / `icon.html`。素材は `web/public/assets/mch/` に同期済みの **MCH アセットのみ**（背景 1037、幻獣オーシャン、5 ロールのヒーロー、エネミー、MCH ロゴ）。
- 書き出し: `node design/thumbnail/make-thumbnails.mjs`（グローバルの Playwright と Chromium を使う）。
- `og:image` の絶対 URL は、Vercel のビルド時に `VERCEL_PROJECT_PRODUCTION_URL` から組み立てる（`web/vite.config.ts`）。
