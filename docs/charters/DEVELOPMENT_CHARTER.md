# 開発憲章（MyCryptoFortress）

## 1. 品質の基準

- **型安全**: TypeScript の `strict` モードを有効にし、`any` の濫用を避ける。
- **再現性**: ビルドはローカル `npm run build` で常に成功する状態を保つ。CI（将来導入時）も同等。
- **小さな PR**: 1 PR で 1 つの意図。レビュアが 30 分以内で読める粒度を目標。
- **テスト証跡**: 自動テストが薄いゲーム特有のロジック（ダメージ計算・Route 追従）はユニットテストを優先的に追加する。手動確認はスクリーンショット / GIF を PR に貼る。

## 2. 安全と権利

- **アセット**: MCH 公式の最新利用ガイドラインに従う。`bearko/mycryptoheroes` の `restricted_removed_records` で除外された素材は本リポジトリでも参照しない。
- **秘密情報**: API キー / トークン / 個人情報はコミットしない。実行に必要な設定は `.env.local`（gitignore 済み）または `web/public/assets/` の静的データのみで完結させる。
- **破壊的操作**: `git push --force` を保護ブランチに対して行わない、`rm -rf` は AI エージェントの自律範囲外。

## 3. コラボレーション

- **由来 Unity プロジェクトとの差分管理**: ダメージ係数・Wave 構成・CE 蓄積速度などの数値は、Unity 版の挙動を初期値とし、ブラウザ向けに調整する場合は SPEC（または PR 本文）に差分理由を記述する。
- **コミット末尾**: AI エージェントによる自動生成コミットは `Co-Authored-By: <model-name>` を含める慣習を推奨。

## 4. ディレクトリ規約

```
mycryptofortress/
  AGENTS.md            # AI エージェント向け入口
  README.md
  docs/                # 仕様駆動の文書群
    charters/
    process/
    specs/
    testing/
  web/                 # 実行可能なゲーム本体
    src/
    public/
    package.json
    vite.config.ts
    tsconfig.json
```

- 文書のみの変更は `docs/...` に閉じ、`web/` を触らない（Git の差分が読みやすくなる）。
- ゲームの実装変更は原則 `web/src/...` に閉じる。

## 5. 改定

改定は PR で行い、改定履歴に日付と要約を残す。

| 日付 | 版 | 変更内容 |
|------|-----|----------|
| 2026-05-07 | 0.1-draft | 初版 |
