# SPEC-120: bearko.games 共通基盤のトロフィー

| 項目 | 値 |
|------|-----|
| ID | SPEC-120 |
| 状態 | Accepted |
| 作成日 | 2026-10-16 |
| 最終更新 | 2026-10-16 |
| 親仕様 | [bearko/mycryptoportfolio の SPEC-001](https://github.com/bearko/mycryptoportfolio/blob/claude/game-portfolio-page-4afqbc/docs/specs/SPEC-001-bearko-games-platform.md)（bearko.games 共通基盤。9 章トロフィー） |
| 実装 | `web/src/meta/trophies.ts`（レベル → トロフィー ID）、`web/src/view/platform.ts`（SDK への窓口）、`RunScene` の結果表示、`web/src/main.ts`、`web/index.html` |

## 1. 背景

bearko.games 配下の全タイトルで、共通 Google ログイン・タイトル横断のトロフィー・総合スコア・RTA を始める（作者の決定 2026-10-15）。共通基盤の段階 2（トロフィー）が公開済みなので、本作も参加する。

## 2. 仕様

### 2.1 送るトロフィー

`RunScene` で結果をセーブに反映した直後（`applyRunResult` の後）に、**勝ったときだけ** 送る。

| クリアしたレベル | 送るトロフィー | 名前 |
|---|---|---|
| L1（アンティキティラ・ノード） | `fortress.level01` | 天地開闢の守護 |
| L5 | `fortress.level05` | 過五関斬六将 |
| L9（最後のレベル。L8 クリアで解放されるので、全レベルクリアと同じ） | `fortress.clear` | 毘沙門天の化身 |

- 2 回目以降のクリアでも送るが、共通基盤で 1 つにまとまる（通知も最初の 1 回だけ）
- 通知（「トロフィー獲得」、未ログインなら「未登録のトロフィー n 個 — ログインして登録」）は共通基盤の SDK が画面下に出す

### 2.2 読み込みとレイヤ

- `web/index.html` で SDK（`https://bearko.games/sdk/v1.js`）を `defer` で読み込み、`main.ts` より先に並べる
- レベル → トロフィー ID の対応は `meta/trophies.ts`（純関数。Phaser・window に依存しない）
- SDK を呼ぶのは `view/platform.ts`。**SDK が読めない・通信に失敗しても何もしない**（`console.warn` だけ）。セーブ（localStorage）には触らない

## 3. 受け入れ基準

- [ ] L1 をクリアすると「天地開闢の守護」の通知が出る
- [ ] L9 をクリアすると「毘沙門天の化身」の通知が出る
- [ ] 未ログインで獲得したトロフィーが `https://bearko.games/me/` に「未登録」として出て、ログインすると登録される
- [ ] SDK が読めない状態でも、レベルの開始・結果表示・セーブまで通しで遊べる

## 4. テスト

- `web/src/meta/trophies.spec.ts`：対応表（勝ったときだけ・実在するレベル・最後のレベルが全クリア）
- `web/src/view/platform.spec.ts`：SDK がない・失敗・例外のときにゲームを止めない
