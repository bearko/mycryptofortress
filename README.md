# MyCryptoFortress

マイクリプトヒーローズのアセットを活用したブラウザ向け 2D タワーディフェンスゲーム。
2021 年に Unity で途中まで開発していた `MCHTowerDefence` を、TypeScript + Phaser 3 でブラウザ駆動に作り直すプロジェクト。

## 技術スタック

- 言語: TypeScript
- ゲームエンジン: [Phaser 3](https://phaser.io/)
- ビルド/開発: [Vite](https://vitejs.dev/)
- アセット: [bearko/mycryptoheroes](https://github.com/bearko/mycryptoheroes) のヒーロー/エネミー JSON と画像

## ローカル起動

```bash
cd web
npm install
npm run dev
```

ブラウザで `http://localhost:5173` を開く。

## ビルド

```bash
cd web
npm run build
```

## 開発の進め方

このリポジトリは [bearko/aidev_template](https://github.com/bearko/aidev_template) の **仕様駆動開発** フローに従う。
変更を行う前に [AGENTS.md](AGENTS.md) と [docs/specs/SPEC-INDEX.md](docs/specs/SPEC-INDEX.md) を読むこと。

| 領域 | パス |
|------|------|
| エージェント向け入口 | [AGENTS.md](AGENTS.md) |
| プロジェクト憲章 | [docs/charters/PROJECT_CHARTER.md](docs/charters/PROJECT_CHARTER.md) |
| 開発憲章 | [docs/charters/DEVELOPMENT_CHARTER.md](docs/charters/DEVELOPMENT_CHARTER.md) |
| 仕様一覧 | [docs/specs/SPEC-INDEX.md](docs/specs/SPEC-INDEX.md) |
| Git ワークフロー | [docs/process/GIT_WORKFLOW.md](docs/process/GIT_WORKFLOW.md) |

## 由来となる Unity プロジェクト

`C:\Users\beark\UnityProject\MCHTowerDefence`（ローカル）を参照しつつ、ゲームメカニクスを TypeScript に移植している。
完全な再現ではなく、ブラウザでの操作性と保守性を優先したリ・デザイン版を目指す。
