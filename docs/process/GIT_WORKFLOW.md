# Git ワークフロー

## ブランチ命名

- `feature/<short-topic>` — 新機能・SPEC 実装
- `fix/<short-topic>` — 不具合修正
- `docs/<short-topic>` — 文書のみ
- `chore/<short-topic>` — ツール設定など、挙動に影響しない変更

## コミットメッセージ

Conventional Commits 互換。例: `feat(stage): add Stage1-1 wave spawning (SPEC-001)`

- `type` 例: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `perf`, `ci`
- `scope` は任意。SPEC ID（例: `spec-001`）やモジュール名でも良い。
- AI エージェントによる自動生成コミットは末尾に `Co-Authored-By:` を含める。

## PR

- 本文に対象 SPEC・受け入れ基準・テスト証跡・HITL 論点を記載（[テンプレート](../../.github/PULL_REQUEST_TEMPLATE.md)）。
- ドラフトで開いて、レビュー可能になったら Ready にする。
- マージ戦略: **Squash merge** を既定とする（履歴を線形に保つ）。

## マージ前

- ローカルで `npm run build` と `npm run typecheck` が通ること。
- 該当する SPEC の受け入れ基準にチェック。
- HITL 論点が該当しないか確認、該当なら本文に理由併記。
