# SPEC-129: bearko.games 共通のアイコンへの入口（共通基盤 SPEC-005）

| 項目 | 値 |
|------|-----|
| ID | SPEC-129 |
| 状態 | Accepted |
| 作成日 | 2026-10-17 |
| 最終更新 | 2026-10-17 |
| 実装 | `web/src/view/platform.ts`（`canPickAvatar` / `openAvatarPicker`）・`web/src/view/scenes/HomeScene.ts`（`buildHeader`） |

## 1. 背景

bearko.games のプレイヤーアイコン（チャットに出る絵）は全タイトルで共通になった（共通基盤 SPEC-005 5.3）。
作者の依頼：ポータルでも各タイトルのマイページでも変えられるようにし、ほかのゲームにも効くことを伝える。
選ぶ窓そのものは SDK 1.7.0 が持つ（`BearkoGames.openAvatarPicker()`。窓の中に「bearko.games 全体のアイコンが変わります」と出る）。

## 2. 仕様

- ホームの見出しの「bearko.games の総合ランキング ↗」の下に、文字のリンク「アイコンを変える（bearko.games 共通）」を置く。押すと SDK の窓
- SDK が無い・古い（`openAvatarPicker` が無い）ときは出さない。例外も出さない（SPEC-120 の作法）
- 絵の一覧・保存は SDK と共通基盤が持つ。このゲームは何も持たない

## 3. テスト

- `npm test`（`platform.spec.ts`）：SDK がない・古いときは出さず例外も出さない。あれば窓を開く
- `npm run typecheck` / `npm run build`
