# テスト戦略（v2）

ゲーム特有の挙動（描画・入力）は完全な自動化が難しいため、**ユニットテスト + ブラウザでの確認証跡**の二段構えとする。

## 1. ユニットテスト（Vitest）

`web/src/**/*.spec.ts`。Phaser に依存しないレイヤ（`sim/` `meta/` `data/`、`view/input/pressDetector.ts` のような純ロジック）を中心にカバーする。

| 対象 | 観点 |
|------|------|
| `sim/` | **決定性**（同一シード・同一入力 → 同一結果）、ダメージ式、Wave、状態異常（Phase 1 以降） |
| `meta/` | セーブのマイグレーション・破損データ・エクスポート / インポート、ツリーのコストと返金（Phase 2 以降） |
| `data/` | マニフェストの整合（キー重複・同梱漏れ・preload サイズ上限）、ツリー / レベル JSON の整合 |
| レイヤ | `sim` / `meta` / `data` が `phaser` と `view` を import していないこと |

## 2. ブラウザ確認

- `npm run build && npx vite preview` で起動し、**スマホ縦（390×844, タッチ）**と **PC（1440×900）**の 2 ビューポートで確認する。
- Playwright（Chromium）でスクリーンショットを取り、PR 本文に証跡として残す。
- 確認項目は各 SPEC の受け入れ基準に従う。

## 3. CI

`.github/workflows/ci.yml` で `npm run typecheck` / `npm test` / `npm run assets:check` / `npm run build` を実行する。PR はすべて緑であること。
