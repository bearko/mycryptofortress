# SPEC-125: bearko.games の総合ランキングへの導線

| 項目 | 値 |
|------|-----|
| ID | SPEC-125 |
| 状態 | Accepted |
| 作成日 | 2026-10-17 |
| 最終更新 | 2026-10-17 |
| 実装 | `web/src/view/platform.ts`（`openPlatformRanking`）・`web/src/view/scenes/HomeScene.ts`（`buildHeader`） |

## 1. 背景

共通基盤（bearko.games）の総合スコア（SPEC-121・122）と RTA（SPEC-123）に参加しているが、ゲームの中から共通基盤のランキングへ行く道がない。ゲーム内にランキングはないので、共通基盤のランキングへの入口を置く（作者の決定 2026-10-17、bearko/MyCryptoPortfolio#29）。

## 2. 仕様

| 項目 | 内容 |
|---|---|
| 場所 | ホームのヘッダー、ロゴの下に小さな文字「bearko.games の総合ランキング ↗」（金色・18px） |
| 行き先 | `https://bearko.games/score/?game=fortress`（共通基盤のタイトル別ランキング。総合のタブにも切り替えられる） |
| 開き方 | **新しいタブ**（`window.open(url, "_blank", "noopener")`）。再読み込みすると RTA の計測が消えるため（SPEC-123）。タップは `bindPress` の `onTap`（指を離したとき。ブラウザがポップアップとして止めない） |

- meta・sim・data は Phaser を読まない決まりのまま（触るのは view だけ）
- 依存は増えない

## 3. 受け入れ基準

- [ ] ホームのロゴの下に「bearko.games の総合ランキング ↗」が出て、RTA のボタン・SLOT の表示と重ならない
- [ ] タップすると、新しいタブで bearko.games の Fortress のランキングが開く
- [ ] RTA の計測中も出る（押しても計測は続く）

## 4. テスト

- `npm test`：`openPlatformRanking` が新しいタブで行き先を開くこと（`window.open` の引数）
- ブラウザ：ホームの見た目（390×844）
