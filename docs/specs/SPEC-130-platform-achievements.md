# SPEC-130: bearko.games のアチーブメント（名鑑 100 枚・エクステンション 39 個）

| 項目 | 値 |
|------|-----|
| ID | SPEC-130 |
| 状態 | Accepted |
| 作成日 | 2026-10-18 |
| 最終更新 | 2026-10-18 |
| 親仕様 | bearko/mycryptoportfolio の SPEC-008（アチーブメント名鑑）5.1「ゲーム側で送るもの」・[ACHIEVEMENT_CATALOG](https://github.com/bearko/mycryptoportfolio/blob/claude/achievement-system-overhaul-zzt7gf/docs/ACHIEVEMENT_CATALOG.md) |
| 置き換え | [SPEC-120](./SPEC-120-platform-trophies.md) 2.1（送るトロフィー）を広げる。2.2（読み込みとレイヤ・失敗してもゲームを止めない）はそのまま |
| 実装 | `web/src/meta/trophies.ts`（判定の純関数）、`web/src/view/platform.ts`（順に送る・同じ起動で 1 回）、`web/src/main.ts`（起動時）、`RunScene.showResult`、`TreeScene`（パネルを取った・ビルドを読み込んだあと） |

## 1. 背景

共通基盤は「トロフィー」を「アチーブメント」に改め、ヒーロー名鑑 100 枚（No.001〜100）とエクステンション 39 個に組み直した（作者の決定 2026-10-18）。
本作の分は名鑑 No.056〜066 の 11 枚と、エクステンション 4 個（うち `fortress.visit` は SDK が自動で送る）。
SPEC-120 で送っていたのは `level01`・`level05`・`clear` の 3 つだけなので、残りを送る。

## 2. 送るもの

| 名鑑 | ID | 名前（共通基盤） | 条件 | 判定 |
|---|---|---|---|---|
| 056 | `fortress.level01` | 浪切 | レベル 01 をクリア | セーブ（`meta.levels.L1.cleared`） |
| 057 | `fortress.level03` | 錦城の女主 | レベル 03 をクリア | セーブ（`L3`） |
| 058 | `fortress.heroes5` | ブレーメンの音楽隊 | 5 種類のヒーロー（弓・雷・結界・炎・採掘）をすべて使えるようにする | セーブ（ツリーの効果で全ロールが解放済み。ラン中の `isRoleUnlocked` と同じ判定） |
| 059 | `fortress.boss10` | 虎痴 | ボスを通算 10 体倒す | セーブ（`meta.stats.bossKills ≥ 10`） |
| 060 | `fortress.level05` | 五虎・左将軍 | レベル 05 をクリア | セーブ（`L5`） |
| 061 | `fortress.flawless` | 弁慶の立往生 | ダメージを受けずにレベルをクリア | セーブ（`meta.stats.flawlessClears ≥ 1`） |
| 062 | `fortress.level07` | 東照大権現 | レベル 07 をクリア | セーブ（`L7`） |
| 063 | `fortress.clear` | 毘沙門天の化身 | レベル 09 までクリア | セーブ（`L9`。L8 のクリアで解放されるので全クリアと同じ） |
| 064 | `fortress.boss25` | 過五関斬六将 | ボスを通算 25 体倒す | セーブ（`bossKills ≥ 25`） |
| 065 | `fortress.rta` | 虎威将軍 | RTA「レベル 01〜09」を完走 | その場（`RunScene.showResult` で RTA が完走したとき） |
| 066 | `fortress.l9flawless` | 死せる孔明生ける仲達を走らす | レベル 09 をダメージを受けずにクリア | その場（L9 を勝ち、そのランの `damageTaken === 0`） |
| ext | `fortress.panel` | 樹の種火 | スキルパネルを初めて取る | セーブ（`meta.tree` に 1 以上のパネルがある） |
| ext | `fortress.firstboss` | 砲尾装填式砲 | 初めてボスを倒す | セーブ（`bossKills ≥ 1`） |
| ext | `fortress.kills1000` | 天地開闢の守護 | 敵を通算 1,000 体倒す | セーブ（`meta.stats.kills ≥ 1000`） |

- `fortress.visit`（来訪）は SDK が自動で送るので送らない。`cross.*` も送らない
- **セーブから判定できるもの**は、起動時・ランの結果のあと・スキルツリーでパネルを取った／ビルドを読み込んだあとに、「いま満たしているもの」をまとめて送る。前から遊んでいる人にも付く
- **セーブに残らないもの**（`rta`・`l9flawless`）は、その場で送る
- レベルのクリアは従来どおり結果のあとにその場でも送る（セーブ判定と同じ ID なので、同じ起動では 1 回だけ）
- パネルを返金しても、一度付いたアチーブメントは消えない（共通基盤が持つ）
- RTA 用のセーブで遊んでいる間も、これまでどおり除外しない（SPEC-120 も RTA 中のクリアを送っていた）。RTA 用のセーブは新しいセーブなので、そこで満たした条件は本当に満たしたもの

## 3. 送り方

- `view/platform.ts` の `reportAchievements(ids)` が、**1 つずつ順に**（前の返事を待って）送る。未ログインの最初の書き込みで仮アカウントができるため、同時に送らない
- **同じ起動で同じ ID は 1 回だけ**（成功・失敗にかかわらず）。共通基盤が公開前で知らない ID を 400 ではじいても、何度も送り直さない
- SDK がまだ読めていないときは覚えておき、`init` のあとに送る。SDK が無い・失敗・例外でもゲームは止めない（`console.warn` だけ。SPEC-120 2.2）
- 判定（`meta/trophies.ts`）は純関数。Phaser・window に依存しない。セーブの形は変えない（新しい保存項目は足さない）

## 4. 用語

- ゲームの画面に「トロフィー」という文言は無い（通知は SDK が出す）。コメントと SPEC の新しい記述は「アチーブメント」にそろえる
- ゲーム内でアチーブメントの名前・絵は出していない

## 5. 受け入れ基準

- [ ] L3・L7 をクリアするとアチーブメントの通知が出る（共通基盤の公開後）
- [ ] 前から遊んでいてボスを 10 体以上倒しているセーブで起動すると、`firstboss`・`boss10` が送られる
- [ ] スキルツリーで最初のパネルを取ると `panel` が送られる。4 種のヒーロー解放パネルをすべて取ると `heroes5`
- [ ] L9 をノーダメージでクリアすると `l9flawless`、RTA を完走すると `rta`
- [ ] SDK が無い・失敗するときも、起動・ラン・ツリー・セーブまで通しで遊べる

## 6. テスト

- `web/src/meta/trophies.spec.ts`：セーブからの判定（各しきい値・全ロール解放・パネル）、その場の判定（L9 ノーダメージ・RTA 完走・負けでは送らない）、ID がすべて渡された一覧にあること
- `web/src/view/platform.spec.ts`：順に 1 つずつ送る・同じ起動で 2 回送らない・SDK が後から読めたら送る・失敗や例外でも止めない
- `npm test` / `npm run typecheck` / `npm run build`
