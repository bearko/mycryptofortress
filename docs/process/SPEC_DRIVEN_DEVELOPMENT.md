# 仕様駆動開発（Spec-Driven Development）

このプロジェクトは [aidev_template](https://github.com/bearko/aidev_template) と同じ方針を採用する。

## 1. ライフサイクル

1. **Draft**: 新規 SPEC を [SPEC-000-template.md](../specs/SPEC-000-template.md) から複製して作成。番号は [SPEC-INDEX.md](../specs/SPEC-INDEX.md) で一意化。
2. **Review**: PR でレビューを受ける。実装着手前に受け入れ基準を合意する。
3. **Accepted**: マージ後は Accepted となり、実装 PR から参照される。
4. **Deprecated**: 撤回・置換された SPEC は Deprecated にし、INDEX に履歴を残す。

## 2. SPEC と実装の対応

- 実装 PR は **対応 SPEC ID** を本文に明記する（PR テンプレートのフィールド）。
- 仕様変更が必要になった場合は、実装 PR を一度ドラフトに戻し、SPEC 改訂 PR を先に出す。

## 3. 例外

- 1 ファイルの誤字修正・README の小さな整理など **挙動を変えない変更** は SPEC を必須としない。PR 本文に「該当なし（小規模変更）」と書けばよい。
- ただし新しい挙動を追加するならば、必ず SPEC を起票する。

## 4. 文書の正

- 参照元は **リモートにプッシュされた版** とする。ローカル限定のコミットは根拠にしない。
