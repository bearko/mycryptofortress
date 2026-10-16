# SPEC-121: bearko.games 共通基盤の総合スコア

| 項目 | 値 |
|------|-----|
| ID | SPEC-121 |
| 状態 | Accepted |
| 作成日 | 2026-10-16 |
| 最終更新 | 2026-10-16 |
| 親仕様 | [bearko/mycryptoportfolio の SPEC-002](https://github.com/bearko/mycryptoportfolio/blob/claude/game-portfolio-page-4afqbc/docs/specs/SPEC-002-total-score.md)（総合スコア。3.3 が本作の計算式） |
| 実装 | `web/src/meta/score.ts`（送る成績）、`web/src/view/platform.ts`（SDK への窓口）、`RunScene` の結果表示、`web/index.html` |

## 1. 背景

bearko.games の総合スコア（各タイトルの自己ベストの合計）に参加する。作者の決定（2026-10-16）で、本作は **残り体力** と **使ったヒーローの少なさ（縛りの度合い）** で測る。

## 2. 仕様

### 2.1 送るとき・送る成績

`RunScene` で結果をセーブに反映した直後（SPEC-120 のトロフィーの直後）に、勝ち・負け・撤退とも 1 回送る。

| 項目 | 中身 |
|---|---|
| `levelId` | `L1`〜`L9` |
| `won` | クリアしたか |
| `hpLeft` / `maxHp` | 終わったときの体力 ／ 最大体力（スキルツリーの加算込み） |
| `heroesUsed` | 置いたヒーローの数（`RunSim.heroes`） |
| `slots` | そのレベルのスロット数 |

点は共通基盤が決める：クリアしたレベル n の節目 P ＝ 500 ＋ (n − 1) × 562.5、成績 ＝ P ×（残り体力の割合 ＋ 空きスロットの割合）÷ 1.2。負けは 0 点。

### 2.2 SDK の読み込み

Vite はビルドで `main.ts` を head に入れるため、body の最後に置いた SDK はゲーム本体より後に読まれていた（SPEC-120 のトロフィーは `init` なしでも送れるので動いていた）。総合スコアは `init` のタイトル名が要るので、**SDK を head に移し**、さらに読み込みが遅れたときは `load` で `init` する。

## 3. 受け入れ基準

- [ ] レベルをクリアすると「タイトルスコア 自己ベスト」の通知が出て、`https://bearko.games/score/` に載る（ログイン時）
- [ ] 同じレベルを少ないヒーロー・体力を減らさずにクリアすると点が上がる
- [ ] SDK が読めない状態でも今までどおり遊べる

## 4. テスト

- `web/src/meta/score.spec.ts`：送る成績の形と範囲
- 型チェック・全テスト・ビルド
