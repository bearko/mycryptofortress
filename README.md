# MyCryptoFortress

マイクリプトヒーローズのアセットを活用したブラウザ向け 2D タワーディフェンスゲーム。

> **v2 へ作り直し中（2026-09〜）**: v1（Unity `MCHTowerDefence` 移植・Arknights 型の編成 TD）を廃棄し、
> [Outhold](https://store.steampowered.com/app/3767740/Outhold/) のゲームシステムをベースにした **タワーディフェンス × インクリメンタル** として再設計しています。
> - Outhold 解析: [docs/research/OUTHOLD_ANALYSIS.md](docs/research/OUTHOLD_ANALYSIS.md)
> - v2 設計（親仕様）: [docs/specs/SPEC-100-v2-game-design.md](docs/specs/SPEC-100-v2-game-design.md)
> - ロードマップ: [docs/ROADMAP.md](docs/ROADMAP.md)

## 技術スタック

- 言語: TypeScript
- ゲームエンジン: [Phaser 3](https://phaser.io/)
- ビルド/開発: [Vite](https://vitejs.dev/)
- アセット: [bearko/mycryptoheroes](https://github.com/bearko/mycryptoheroes) の画像・音声を、使用分だけ `web/public/assets/mch/` に同梱

## ローカル起動

```bash
cd web
npm install
npm run dev
```

ブラウザで `http://localhost:5173` を開く（スマホ縦画面が主対象。PC ではブラウザの端末エミュレーションで確認すると実機に近い）。

## テスト・チェック

```bash
cd web
npm run typecheck      # 型チェック
npm test               # ユニットテスト（Vitest）
npm run assets:check   # 同梱アセットとマニフェストの整合
```

CI（`.github/workflows/ci.yml`）で上記とビルドを実行する。

## MCH アセットの追加

1. `web/assets.manifest.json` にエントリ（`key` / `type` / `path`）を追加する。`path` は mycryptoheroes リポジトリ内の相対パス。
2. `npm run assets:sync`（隣に mycryptoheroes をクローンしている場合。場所は `MCH_REPO_DIR` で指定可）または `npm run assets:sync:remote`（GitHub から取得）を実行する。
3. `web/public/assets/mch/` に増えたファイルをコミットする。

利用不可（`restricted_removed_records`）の素材を登録すると同期がエラーになる。詳細は [SPEC-101](docs/specs/SPEC-101-phase0-foundation.md)。

## ビルド

```bash
cd web
npm run build
```

## Vercel へのデプロイ

リポジトリルートに [vercel.json](vercel.json) を置き、`web/` 配下を Vite でビルドして `web/dist/` を公開する設定にしている。
Vercel プロジェクトのダッシュボード側では **Root Directory はデフォルト（リポジトリルート）のまま** にする（`vercel.json` で吸収済み）。
独自ドメインや環境変数の設定はダッシュボードから行う。

## 開発の進め方

このリポジトリは [bearko/aidev_template](https://github.com/bearko/aidev_template) の **仕様駆動開発** フローに従う。
変更を行う前に [AGENTS.md](AGENTS.md) と [docs/specs/SPEC-INDEX.md](docs/specs/SPEC-INDEX.md) を読むこと。

| 領域 | パス |
|------|------|
| エージェント向け入口 | [AGENTS.md](AGENTS.md) |
| プロジェクト憲章 | [docs/charters/PROJECT_CHARTER.md](docs/charters/PROJECT_CHARTER.md) |
| 開発憲章 | [docs/charters/DEVELOPMENT_CHARTER.md](docs/charters/DEVELOPMENT_CHARTER.md) |
| 仕様一覧 | [docs/specs/SPEC-INDEX.md](docs/specs/SPEC-INDEX.md) |
| ロードマップ（v2） | [docs/ROADMAP.md](docs/ROADMAP.md) |
| Git ワークフロー | [docs/process/GIT_WORKFLOW.md](docs/process/GIT_WORKFLOW.md) |

## クレジット (Credits)

### MCH アセット

ヒーロー / 幻獣（クリプタイド）/ エネミー画像、アイコン、背景、BGM・SE は [bearko/mycryptoheroes](https://github.com/bearko/mycryptoheroes) 収録の My Crypto Heroes アセットを使用しています。利用条件は同リポジトリの README / LICENSE と MCH 公式ガイドラインに従います。

### オリジナルキャラクター

- クリスくん / マインちゃん: ドット絵：こじもこ
- マイクリくん: 原画：こはるさん／ドット絵：こじもこさん
