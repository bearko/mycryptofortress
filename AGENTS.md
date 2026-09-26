# AI エージェント向けガイド（mycryptofortress）

このリポジトリは [bearko/aidev_template](https://github.com/bearko/aidev_template) の仕様駆動フローを採用している。実装や変更を行う前に、次の順で読むこと。

## 読む順序

1. [docs/charters/PROJECT_CHARTER.md](docs/charters/PROJECT_CHARTER.md) — このプロジェクトのミッションと非目標
2. [docs/charters/DEVELOPMENT_CHARTER.md](docs/charters/DEVELOPMENT_CHARTER.md) — 品質・安全・コラボレーションの原則
3. [docs/process/SPEC_DRIVEN_DEVELOPMENT.md](docs/process/SPEC_DRIVEN_DEVELOPMENT.md) — 仕様と実装の対応付け
4. [docs/process/AGENT_OPERATING_GUIDE.md](docs/process/AGENT_OPERATING_GUIDE.md) — 自律範囲と HITL
5. [docs/process/HUMAN_IN_THE_LOOP.md](docs/process/HUMAN_IN_THE_LOOP.md) — 人間レビュー時の確認論点
6. [docs/specs/SPEC-INDEX.md](docs/specs/SPEC-INDEX.md) — 有効な SPEC 一覧
7. [docs/process/GIT_WORKFLOW.md](docs/process/GIT_WORKFLOW.md) — ブランチ・コミット・PR

## このプロジェクト固有のルール

- **ゲーム実装は `web/` ディレクトリ配下に置く**（Vite + TypeScript + Phaser 3）。
- **アセット参照**: MCH アセットは `web/assets.manifest.json` に登録し、`npm run assets:sync` で `web/public/assets/mch/` に**使用分だけ**同梱する（実行時に raw.githubusercontent.com を参照しない）。マニフェスト外の読み込み禁止（[SPEC-101](docs/specs/SPEC-101-phase0-foundation.md)）。
- **レイヤ分離**: `web/src/sim`（戦闘）/ `meta`（メタ進行・セーブ）/ `data` は Phaser に依存させない（テストで検査）。描画・入力は `web/src/view`。
- **v2（作り直し中）の一次資料**: [docs/research/OUTHOLD_ANALYSIS.md](docs/research/OUTHOLD_ANALYSIS.md)（Outhold のゲームシステム解析）と [docs/specs/SPEC-100-v2-game-design.md](docs/specs/SPEC-100-v2-game-design.md)（v2 親仕様）。進め方は [docs/ROADMAP.md](docs/ROADMAP.md)。v1 の由来だった Unity `MCHTowerDefence` は参照しない。
- **MCH アセット原則**: 画面に出るキャラクター・アイコン・SE・BGM・背景・スキル名は原則 `mycryptoheroes` の素材を使う。オリジナルキャラクター（マインちゃん / クリスくん / マイクリくん）はナビゲーター / NPC 用。
- **PR は完走させる**: テスト追加・型チェック・ビルド成功まで。論点は PR 本文の「マージ前確認事項（HITL）」に書く。

## 作業時のルール（要約）

- **仕様が単一の真実の源泉**: 曖昧なら SPEC を更新する PR を先に切る。勝手に仕様を広げない。
- **小さな変更単位**: 1 PR で一つの意図に寄せる。
- **証跡**: テスト・手動確認・スクリーンショットは PR 本文に残す。
