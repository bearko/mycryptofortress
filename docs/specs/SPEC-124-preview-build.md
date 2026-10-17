# SPEC-124: Cloudflare のプレビュービルド（本番以外のブランチ）を通す

| 項目 | 値 |
|------|-----|
| ID | SPEC-124 |
| 状態 | Accepted |
| 作成日 | 2026-10-17 |
| 最終更新 | 2026-10-17 |
| 実装 | ルートの `wrangler.jsonc` |

## 1. 背景

プルリクエストのたびに走る Cloudflare の Workers Builds（`Workers Builds: mycryptofortress`）が、本番（`main`）では成功するのに、本番以外のブランチでは毎回失敗していた（#45 から #49 まで）。#48 で `web/wrangler.jsonc` に空の `previews` を足したが直らなかった。

## 2. 原因

- 本番以外のブランチは `npx wrangler preview` でビルドされる（Worker Previews）。設定ファイルは **リポジトリの直下** で探される
- 本作は設定（`web/wrangler.jsonc`）もゲーム（Vite）も `web/` の下にあり、直下には設定がなかった。ローカルで直下から `wrangler preview` を流すと「Worker の名前がない」で止まる
- 直下に `assets.directory: "./web/dist"` の設定を置くだけでは、まだ失敗した（プレビューのコマンドの時点で `web/dist` ができていない）。設定にビルドのコマンド（Wrangler の custom build）を足すと成功した（#50）
- 同じ作りの Workshop（Vite・`dist`）は設定が直下にあるので、プレビューも成功していた

## 3. 仕様

リポジトリの直下に `wrangler.jsonc` を置く。

| 項目 | 値 |
|---|---|
| `name` | `mycryptofortress`（`web/wrangler.jsonc` と同じ Worker） |
| `assets.directory` | `./web/dist` |
| `build.command` | `cd web && npm ci && npm run build`（Wrangler が公開の前に流す） |
| `previews` | 空（プレビューには本番の変数・シークレットをつながない） |

- 本番の公開（`main`）はいままでどおり。`web/wrangler.jsonc` は消さない（本番のビルドの設定がどちらを使っているかを、ダッシュボードを見ずに変えないため）
- プレビューの URL は `https://<ブランチ名>-mycryptofortress.bearko-miyamoto.workers.dev`。Cloudflare がプルリクエストにコメントで出す

## 4. 受け入れ基準

- [x] プルリクエストの `Workers Builds: mycryptofortress` が成功し、詳細の URL が `…/previews/<ブランチ名>/builds/…` になる（#50 の 435b03c で確認）
- [ ] `main` にマージしたあとの本番のビルドが成功する
