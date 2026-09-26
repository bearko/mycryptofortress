# SPEC-101: Phase 0 — v1 撤去と v2 基盤

| 項目 | 値 |
|------|-----|
| ID | SPEC-101 |
| 状態 | Accepted |
| 作成日 | 2026-09-26 |
| 最終更新 | 2026-09-26 |
| 作者 | bearko + AI エージェント |
| 親仕様 | [SPEC-100](./SPEC-100-v2-game-design.md) / [ROADMAP Phase 0](../ROADMAP.md) |

## 1. 概要

v1（Arknights 型 TD）のゲームコードと MCH 以外の素材を撤去し、v2 の土台を作る。具体的には、レイヤ分離したディレクトリ構成、MCH アセットのサブセット同期スクリプト、スマホ縦画面基準の画面スケーリングとタップ / 長押し入力、localStorage のセーブ基盤、CI を用意する。ゲームプレイはまだ無く、**タイトル → ホーム（幻獣選択・設定）**が動くところまでを完了とする。

## 2. 背景と動機

- SPEC-100 で v2 への作り直しが決定。v1 コードは型（職業・タイル向き等）が v2 と噛み合わず、流用より撤去の方が安い。
- v1 は実行時に `raw.githubusercontent.com` から画像を読んでいた。オフライン / 回線状況に弱く、使用アセットの把握もできないため、**使うものだけをリポジトリに同梱**する方式に切り替える。

## 3. 目標と非目標

### 目標

- v1 のゲームコード（`web/src/game`・`web/src/scenes`・`web/src/ui`）と Senses Circuit の SE を撤去する。
- `sim/` `meta/` `view/` `data/` のレイヤ構成を作る。
- アセットマニフェスト + 同期スクリプトで、MCH アセットを `web/public/assets/mch/` に同梱する。
- スマホ縦画面（論理解像度 720×1280）で表示が崩れない。PC ではレターボックスで中央表示。
- タップ / 長押しを判定する入力基盤（ロジックは Phaser 非依存でテスト可能）。
- セーブ基盤（3 スロット、スキーマバージョン、マイグレーション、エクスポート / インポート）。
- CI（型チェック / テスト / ビルド / アセット検査）。

### 非目標

- ラン（戦闘）・スキルツリー・トークン（Phase 1〜2）。
- PC 向け左右 UI パネル（Phase 1 以降でラン画面と一緒に設計）。
- NPC 会話システム（SPEC-108a）。タイトルのマインちゃんは立ち絵アニメの表示確認のみ。

## 4. スコープ

### 含む

| # | 内容 |
|---|------|
| 0-1 | v1 撤去: `web/src/game/*`, `web/src/scenes/*`, `web/src/ui/*`, `web/public/assets/se/*`（Senses Circuit）。README の該当クレジットも削除 |
| 0-2 | ディレクトリ構成（§5.1） |
| 0-3 | `web/assets.manifest.json` + `web/scripts/sync-assets.mjs`（§5.2） |
| 0-4 | 画面スケーリング（§5.3）、入力基盤（§5.4）、Boot / Title / Home シーン |
| 0-5 | セーブ基盤（§5.5） |
| 0-6 | GitHub Actions CI（§5.6） |

### 含まない

- `design/`（v1 のビジュアル刷新モック）は参照資料として残す（コードからは参照しない）。
- SPEC-001〜004 のファイルは Deprecated のまま残す。

## 5. 契約と挙動

### 5.1 ディレクトリ構成

```
web/
  assets.manifest.json      使用する MCH アセットの一覧（唯一の登録先）
  scripts/sync-assets.mjs   マニフェスト → public/assets/mch/ へコピー / 検査
  public/assets/mch/        同梱した MCH アセット（mycryptoheroes と同じ相対パス）
  src/
    main.ts                 Phaser 起動
    sim/                    戦闘シミュレーション（Phaser 非依存）: 乱数など
    meta/                   メタ進行（Phaser 非依存）: セーブなど
    data/                   静的データ（アセット、幻獣定義）
    view/                   Phaser 依存: scenes / ui / input / layout
```

- `sim/` と `meta/` は `phaser` を import しない（テストで検査）。

### 5.2 アセットマニフェストと同期

`assets.manifest.json`:

```json
{
  "source": { "repo": "bearko/mycryptoheroes", "ref": "main" },
  "assets": [
    { "key": "cryptid.Ocean", "type": "image", "path": "Image/Cryptids/01_Ocean.png" },
    { "key": "bgm.land", "type": "audio", "path": "Audio/BGM/land.mp3" }
  ]
}
```

- `key`: ゲーム内で使う論理キー（一意）。`type`: `image` | `audio`。`path`: mycryptoheroes リポジトリ内の相対パス。
- ゲームはマニフェストを import し、`assets/mch/<path>` を `key` で読み込む。**マニフェストに無いアセットは読まない**。
- `sync-assets.mjs`:
  - 既定: ローカルの mycryptoheroes クローン（`MCH_REPO_DIR`、未指定時は `../../mycryptoheroes`）からコピー。`--remote` で `raw.githubusercontent.com` から取得。
  - 取得元の `Data/Heroes/metadata.json` / `Data/Extensions/metadata.json` の `restricted_removed_records` に含まれるパスは**エラー**にする。
  - `--check`: コピーせず、全エントリが `public/assets/mch/` に存在すること・キー重複がないこと・`public/assets/mch/` にマニフェスト外のファイルが無いことを検査（CI 用。取得元不要）。
- 同期したファイルはリポジトリにコミットする（Vercel ビルドは取得元に依存しない）。

### 5.3 画面スケーリング

- 論理解像度 **720×1280（9:16）**、`Phaser.Scale.FIT` + `CENTER_BOTH`。
- ページ背景は暗色で、PC の横長画面では左右が余白になる。
- ドット絵（ヒーロー / 幻獣 / 立ち絵）は NEAREST フィルタ、テキストは高解像度（devicePixelRatio 反映）。
- **フォント**: 日本語は**日本語のシステムフォント**を明示したスタックで描く（`view/ui/theme.ts` の `FONT_JA`: Meiryo UI → Meiryo → Yu Gothic UI → Yu Gothic → Hiragino Sans → Hiragino Kaku Gothic ProN → BIZ UDPGothic → Noto Sans JP → Noto Sans CJK JP → Source Han Sans JP → IPA Pゴシック）。Phaser のテキストは DOM 外の canvas に描かれ `lang="ja"` を継承しないため、名前を明示しないと中国語フォント（字形が異なる）にフォールバックする。英数字の見出しは Orbitron を `@fontsource/orbitron` で同梱し、Google Fonts には依存しない。
- `viewport-fit=cover` + `100dvh` + セーフエリア余白。レターボックス部分は、選択中のランド背景を暗くしたページ背景で埋める。

### 5.4 入力基盤

`view/input/pressDetector.ts`（Phaser 非依存の純ロジック）:

| 入力 | 判定 |
|------|------|
| down → up（移動 ≤ 24 論理 px、押下 < 450ms） | `tap` |
| down のまま 450ms 経過（移動 ≤ 24px） | `longpress`（発火は 1 回、その後の up は tap にしない） |
| 移動 > 24px | キャンセル（ドラッグ扱い、tap / longpress なし） |

許容量 24 論理 px はスマホ（1 CSS px ≒ 1.8 論理 px）で指のブレ約 13 CSS px に相当する。Phaser のポインタイベントを流し込むアダプタ（`view/input/press.ts`）で GameObject / シーンに `tap` / `longpress` を付与する。最小タップ領域は 88×88 論理 px（= 端末上でおよそ 44pt 以上）をボタンの既定サイズとする。

### 5.5 セーブ基盤

- 保存先: `localStorage`、キー `mcf.v2.slot.<1|2|3>` と `mcf.v2.activeSlot`。
- スキーマ（v1）:

```ts
interface SaveData {
  schemaVersion: 1;
  createdAt: string;   // ISO
  updatedAt: string;   // ISO
  settings: { bgmVolume: number; seVolume: number };   // 0..1
  profile: { cryptidId: CryptidId };                    // 選択中の幻獣
}
```

- 読み込み: 存在しない → `null`。JSON 破損 / 検証失敗 → `null` を返し、例外を投げない（呼び出し側は新規作成）。旧 `schemaVersion` は `migrations[n]` を順に適用。未来のバージョン → 読み込まない（`null`）。
- エクスポート / インポート: `SaveData` を JSON → Base64（UTF-8 安全）文字列に。インポートは検証 + マイグレーションを通す。
- ストレージは `StorageLike`（`getItem` / `setItem` / `removeItem`）を注入してテスト可能にする。`localStorage` が使えない環境（プライベートモード等）ではメモリストレージにフォールバック。

### 5.6 CI

`.github/workflows/ci.yml`（push / pull_request）: Node 22、`web/` で `npm ci` → `npm run typecheck` → `npm test` → `npm run assets:check` → `npm run build`。

### 5.7 画面

| シーン | 内容 |
|--------|------|
| Boot | マニフェストの全アセットを読み込み、プログレスバー表示 |
| Title | 背景（選択中の幻獣のランドノード背景）、MCH ロゴ、中央に選択中の幻獣（浮遊アニメ + 勢力色オーラ）、マインちゃん（まばたきループ）、「タップしてはじめる」。初回タップで音声アンロック → BGM（land） |
| Home | 幻獣選択（9 体。タップで選択 → セーブ）、メニュー（出撃 / スキルツリー = 「準備中」表示）、設定（BGM / SE の ON/OFF）、セーブスロット表示。長押しで幻獣名のツールチップ |

### 互換性

- v1 のセーブデータは存在しない（v1 は保存機能なし）ため移行不要。

## 6. 非機能要件

- 初回ロード（preload 対象）のアセット合計 5MB 以下（BGM を含む。テストで検査）。ランド背景（各 0.4〜0.8MB）は選択時に遅延読み込みする。
- `Image/Icons/mchc_official.png` は 5.4MB あるため Phase 0 では同梱しない（MCHC トークン実装時に縮小版を検討）。
- スマホ（縦 390×844 相当）で横スクロール・はみ出しなし。

## 7. マージ前確認事項（HITL）

1. **UI 効果音**: MCH にはボタン専用 SE が無いため、暫定でタップ = `Audio/SE/Battle/4_buff.mp3` を割り当てた。実際に聴いて差し替え希望があれば指示がほしい。
2. **アセット同梱方式**: 使用分のみリポジトリにコミットする（BGM 1 曲 ≒ 2MB）。
3. `design/`（v1 のビジュアル刷新モック）を参照資料として残す。

## 8. 受け入れ基準

- [x] `web/src` に v1 のゲームコード・UI が残っていない。Senses Circuit の SE が無い
- [x] `npm run assets:sync` で manifest のアセットが `public/assets/mch/` にコピーされ、制限対象を含めるとエラーになる
- [x] `npm run assets:check` が CI で通る
- [x] 縦 390×844 と横 1440×900 でタイトル / ホームが崩れず表示される（スクリーンショット）
- [x] 幻獣選択・音量設定がリロード後も保持される
- [x] セーブのマイグレーション・破損データ・エクスポート / インポートのユニットテストが通る
- [x] タップ / 長押し判定のユニットテストが通る
- [x] `sim/` `meta/` が Phaser を import していないことをテストで検査

## 9. テストと証跡

- `npm run typecheck` / `npm test` / `npm run assets:check` / `npm run build`
- Playwright（Chromium）で縦・横のスクリーンショットを取得

## 10. 改訂履歴

| 日付 | 版 | 変更内容 |
|------|-----|----------|
| 2026-09-26 | 0.1 | 初版 |
| 2026-09-26 | 1.1 | フォント方針を追記（日本語システムフォントの明示、Orbitron 同梱、Google Fonts 廃止） |
| 2026-09-26 | 1.0 | 実装完了。タップ許容量を 24 論理 px に、背景の遅延読み込み・レターボックス埋め・MCHC アイコン除外を追記 |
