# SPEC-128: 全体チャットの置き場所（共通基盤 SPEC-004）

| 項目 | 値 |
|------|-----|
| ID | SPEC-128 |
| 状態 | Accepted |
| 作成日 | 2026-10-17 |
| 最終更新 | 2026-10-17 |
| 実装 | `web/src/view/platform.ts`（`setChatVisible`）・`web/src/view/scenes/*Scene.ts`（各 `create()`） |

## 1. 背景

bearko.games の全体チャット（共通基盤 SPEC-004。SDK 1.6.0 の `BearkoGames.chat`）は、`init()` を呼ぶだけで
右下に 💬 として出る。窓そのものは SDK が描く（Phaser のキャンバスの上に DOM で重なる）。
このゲームで決めるのは **どの場面で隠すか** だけ。作者の依頼（2026-10-17）「全タイトルに全体チャット」、
共通基盤 SPEC-004 6 章の表：Fortress は「ホームで出す。戦闘中は隠す。右下」。

## 2. 仕様

- 位置は右下（SDK の既定。ホームの「音の設定」の下、何とも重ならない。390px で確認）
- 出す：Title・Home・LevelSelect・Tree の `create()` で `setChatVisible(true)`
- 隠す：Run（戦闘）の `create()` で `setChatVisible(false)`。開いていた窓も SDK が閉じる
- `setChatVisible` は SDK がない・古い（`chat` が無い）・失敗したときに何もしない（SPEC-120 の作法）。
  SDK はゲーム本体のあとに読まれることがある（SPEC-121）ので、いまの値を覚えておき、`init` が済んだときにそろえる

## 3. 非ゴール

- 窓の見た目・発言の決まり（200 文字・連投・締め出し）は共通基盤 SPEC-004
- 戦闘中に読む手段は作らない（タワーディフェンスの最中は見ない）

## 4. テスト

- `npm test`（`platform.spec.ts`）：SDK がない・古いときに例外を出さない。出す・隠すを SDK に渡し、後から読めたときにいまの値をそろえる
- `npm run typecheck` / `npm run build` / `npm run assets:check`
