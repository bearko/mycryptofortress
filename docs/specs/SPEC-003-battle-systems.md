# SPEC-003: バトル戦域システム（職業・多経路マップ・配置ルール・ブロック・ターゲティング）

| 項目 | 値 |
|------|-----|
| ID | SPEC-003 |
| 状態 | Draft |
| 作成日 | 2026-05-07 |
| 最終更新 | 2026-05-07 |
| 作者 | bearko + AI エージェント |
| 関連 | [SPEC-002](./SPEC-002-battle-screen-polish.md) を一部上書き（§5.1 タイル, §5.2 配置フロー）|

## 1. 概要

Arknights 風の **職業 (Class)** をヒーローに導入し、職業に応じて配置可能なタイル（道 / 壁）が変わる戦略性をバトルに加える。マップは多経路化し、敵が出現するルートだけアニメーションで一瞬可視化する。原作 Unity 版にあった **ブロック**（路上の前衛が敵を停止させる）と、Arknights 流の **ルート進行優先ターゲティング**（射程内の敵で最もゴールに近い 1 体を攻撃）も実装する。

スキル発動・カットイン・回復 / バフは別 SPEC（SPEC-004 予定）で扱う。

## 2. 背景と動機

- SPEC-002 までで「単一直線ルート + 円形 → タイルパターン攻撃」が動くが、ヒーローが全員同じ「path 以外なら置ける」ルールで戦略性が薄い。
- Arknights / 原作 Unity いずれもヒーロー（Operator）に **職業** を持たせ、職業ごとに「壁置き / 道置き」「ブロック数」「ターゲット規則」を変えることで初手の選択肢が広がる。
- 多経路マップは「どのルートに敵が来るか」をプレイヤーが読む要素を生み、配置の意思決定を増やす。
- ブロックは Unity 版（`Hero.OnCollisionStay2D`）のコア機能で、これがないと前衛が「前に立つ」意味が無い。

## 3. 目標と非目標

### 目標

- ヒーローを 8 職業に分類: 重装 (Defender) / 補助 (Supporter) / 狙撃 (Sniper) / 前衛 (Guard) / 術師 (Caster) / 医療 (Medic) / 先鋒 (Vanguard) / 特殊 (Specialist)
- Common レアリティのヒーロー 8 体を `mycryptoheroes` のデータから取り込み、各職業に割り当てる。
- マップに「path（敵が通る）」「wall（壁・ブロック）」「obstacle（配置不可）」の 3 種タイル + 複数 Route。
- 配置可能タイルは職業で変わる:
  - 重装 / 前衛 / 先鋒 / 特殊: path 上のみ
  - 狙撃 / 術師 / 医療 / 補助: wall 上のみ
- 敵が出現する直前に、その敵が通る Route の経路をアニメで一瞬光らせる（常時表示はしない）。
- ブロック: 路上のヒーローが `blockMax` までの敵を停止させる。停止中の敵はターン進行しない。
- ターゲティング: 攻撃範囲タイル内の敵から「ルート進行度が一番進んでいる敵」を 1 体選んで撃つ。同点ならゴールに近い順に決める。

### 非目標

- スキルゲージ・スキル発動・カットイン・回復 / バフ系（SPEC-004 で扱う）。
- 敵の遠距離攻撃 / 状態異常 / 多種類化（別 SPEC）。
- ステージセレクト UI / 複数ステージのデータ構造（別 SPEC）。
- セーブデータ / BGM 切替。
- ダメージ式の見直し（SPEC-001 仕様を継続使用）。
- Common 以外のレアリティの取り込み（Common のみで動く形にする）。

## 4. スコープ

### 含む

- 型: `HeroClass`, `MapTileType`, `MapDef`, `RouteDef` を `web/src/game/types.ts` に追加。
- 新規モジュール: `web/src/game/map.ts`（Stage1-1 v2 の MapDef、職業 ↔ タイル対応、ルート展開ヘルパ）。
- ヒーローデータ更新: `web/src/game/heroData.ts` を `mycryptoheroes/Data/Heroes/heroes.json` の Common 8 体（ID 1001-1010）に置き換え、`class` と `blockMax` を付与。
- StageScene 改修: 多経路 / 職業ベース配置 / ブロック / ルート進行ターゲティング / 経路アニメ。
- ユニットテスト: `map.spec.ts` で「職業 → タイル種別」の許可マトリクス、`progress.spec.ts` でルート進行度算定、既存 `pattern.spec.ts` / `damage.spec.ts` / `stage.spec.ts` は緑のまま維持。
- 既存 `stage.ts` は `Stage1-1 v2` の MapDef を export する形にリファクタ。SPEC-002 で書いた `STAGE1_ROUTE` / `buildTileMap` などの古い API は内部互換のために残すか、削除する場合は本 SPEC で明示する。

### 含まない

- 上記すべての非目標。
- 多ステージのプレイ可能化（後続 SPEC でステージセレクト UI と一緒に）。

## 5. 契約と挙動

### 5.1 職業 (`HeroClass`)

```ts
export type HeroClass =
  | "defender"   // 重装：HP 高、ブロック 3、近接、path 配置
  | "guard"      // 前衛：PHY 高、ブロック 2、近接、path 配置
  | "vanguard"   // 先鋒：AGI 高、ブロック 1、近接、path 配置
  | "specialist" // 特殊：AGI 高、ブロック 1、特殊挙動、path 配置
  | "sniper"     // 狙撃：PHY 高、遠距離、wall 配置、ブロック 0
  | "caster"     // 術師：INT 高、遠距離、wall 配置、ブロック 0
  | "medic"      // 医療：INT 高、回復、wall 配置、ブロック 0
  | "supporter"; // 補助：HP/INT 高、バフ、wall 配置、ブロック 0
```

職業 → 配置タイル種別 / `blockMax` の対応表:

| Class | tile | blockMax |
|-------|------|----------|
| defender | path | 3 |
| guard | path | 2 |
| vanguard | path | 1 |
| specialist | path | 1 |
| sniper | wall | 0 |
| caster | wall | 0 |
| medic | wall | 0 |
| supporter | wall | 0 |

### 5.2 Common ヒーロー 8 体の割り当て

`mycryptoheroes/Data/Heroes/heroes.json` の `rarity.name === "Common"` から ID 1001-1010 のうち 8 体を採用。Passive スキル名 / 内容を踏まえて職業を割り当てる:

| ID | 名前 | HP | PHY | INT | AGI | スキル要約 | 職業 |
|----|------|-----|-----|-----|-----|------------|------|
| 1001 | コナン・ドイル | 192 | 25 | 69 | 138 | 先頭味方の INT バフ | supporter |
| 1002 | 甲斐姫 | 162 | 79 | 45 | 118 | バフ + ダメージ | vanguard |
| 1003 | 張遼 | 222 | 67 | 62 | 93 | 最後尾敵にダメージ（ねらい撃ち） | sniper |
| 1004 | シートン | 345 | 66 | 69 | 46 | 高 PHY 敵にダメージ | caster |
| 1006 | ピタゴラス | 216 | 84 | 84 | 56 | 味方バフ複数 | guard |
| 1007 | 大長今 | 261 | 40 | 115 | 54 | 最低 HP の味方を回復 | medic |
| 1008 | ジョン・L・サリバン | 264 | 85 | 35 | 88 | 自身バフ（チャージ） | defender |
| 1009 | ヘルクレスオオカブト | 267 | 72 | 71 | 64 | INT デバフ複数 | specialist |

8 体で 8 職業すべてが揃う。1005 / 1010 は今回不採用（バランス調整余地として SPEC-004 以降で追加する余地あり）。

### 5.3 マップ (`MapDef`, `RouteDef`)

```ts
export type MapTileType = "path" | "wall" | "obstacle";

export interface RouteDef {
  id: string;          // "A", "B" など
  points: TilePos[];   // ウェイポイント。最後の点がゴール
}

export interface MapDef {
  id: string;
  cols: number;
  rows: number;
  tiles: MapTileType[][];    // [row][col]
  routes: RouteDef[];
}
```

#### Stage1-1 v2 レイアウト

12 列 × 8 行の長方形。**2 つの並行ルート（上 / 下）**。中段（行 2, 5）に壁帯、行 3, 4 は obstacle（中央障害）。

```
       0 1 2 3 4 5 6 7 8 9 10 11
row 0: . . . . . . . . . .  .  .   obstacle
row 1: P P P P P P P P P P  P  P   route A (start (0,1) → goal (11,1))
row 2: . W W W W W W W W W  W  .   wall（端 2 マスは obstacle）
row 3: . . . . . . . . . .  .  .   obstacle
row 4: . . . . . . . . . .  .  .   obstacle
row 5: . W W W W W W W W W  W  .   wall
row 6: P P P P P P P P P P  P  P   route B (start (0,6) → goal (11,6))
row 7: . . . . . . . . . .  .  .   obstacle
```

#### Wave

`STAGE1_WAVE` は 6 体スポーン:

| 出現秒 | 敵 ID | ルート |
|-------|-------|--------|
| 1.0 | 101 | A |
| 2.0 | 101 | B |
| 4.0 | 101 | A |
| 6.0 | 101 | B |
| 8.0 | 101 | A |
| 10.0 | 101 | B |

クリア条件: 6 体全滅。失敗条件: ベース HP 0。

### 5.4 配置ルール

ヒーローを選択したとき、`canvas` 上の **配置可能タイル** をハイライトする:

- 職業が path 系（defender/guard/vanguard/specialist）のとき: tile が `path` のマスのみ。
- 職業が wall 系（sniper/caster/medic/supporter）のとき: tile が `wall` のマスのみ。
- 既にヒーローがいるマスは不可。

タイル種別が一致しないマスをクリックしたら配置キャンセルではなく、`statusText` で理由を表示してから選択を維持する。

### 5.5 経路アニメーション

- 各 Route について「初出現」したフレームで、その Route の `points` を結ぶ折線を 0.6 秒で描き、0.6 秒キープ、0.6 秒でフェードアウトする（合計 1.8 秒）。
- ルート色は固定で、Route 間は色を変える（A: 黄系 / B: シアン系）。
- 初出現後は再表示しない。プレイヤーが見逃しても基本ループは進む。

### 5.6 ブロック

- 各 `PlacedHero` に `blockNum` を持たせる（初期 0）。
- 敵が「ヒーローと同じタイル」に乗った瞬間に判定:
  - hero の class が path 系（blockMax > 0）かつ `blockNum < blockMax` かつ enemy が未ブロック: enemy の `blockedBy = hero` を立て、`hero.blockNum += 1`。
  - 上記以外: 敵は通過する（移動継続）。
- `enemy.blockedBy` がある間、敵は移動しない（Unity 準拠）。
- 敵が死亡した時、`blockedBy` を解放（hero.blockNum--）。
- ヒーローが売却されたとき、ブロック中の敵すべてを解放（敵は次フレームから再移動）。

MVP 範囲では「敵がヒーローを攻撃する」挙動はないため、ブロック = 完全停止のみ。

### 5.7 ターゲティング

- `tickHeroAttacks` で各ヒーロー: 攻撃間隔が来たら、`applyPatternToTile(heroTile, rotated)` の絶対タイル集合に重なる敵から **ルート進行度が最大** の 1 体を選び発射。
- ルート進行度 = `enemy.nextIndex - 1 + (現在位置と直前の点の距離) / (直前と次の点の距離)`。
- 同点（同じセグメント上）の場合はゴールまでの距離が小さい方を優先。
- それでも同点なら配列順（決定的）。
- ブロック中の敵も射撃対象になる（前衛が殴り、後ろから狙撃が削るイメージ）。

### 5.8 既存仕様との関係

- SPEC-002 §5.1（タイル種別が `path` / `placeable` の 2 種）→ SPEC-003 では `path` / `wall` / `obstacle` の 3 種に置換。
- SPEC-002 §5.2（配置フロー）の 2 段階確定（タイル → 向き）は維持。配置可能タイル判定だけ職業ベースに変更。
- SPEC-001 のダメージ式 / SPEC-002 の攻撃パターン / 売却 / ステータスパネル / 速度トグル: すべて維持。

## 6. 非機能要件

- 性能: 12×8 = 96 タイル、ヒーロー最大 8 体、敵 6 体まで。60fps を維持。
- アクセシビリティ: 既存 SPEC と同様に MVP では未対応。

## 7. マージ前確認事項（HITL）

- [x] **ゲーム数値の調整あり**: ヒーロー 8 体のステータス・職業割り当てが新規追加。`mycryptoheroes` の Common ヒーロー max-level stats を採用。各職業の `blockMax` は Arknights 慣習を参考にした暫定値（重装 3 / 前衛 2 / 先鋒・特殊 1 / 後衛 0）。
- [x] **アセット権利**: ヒーロー画像は `mycryptoheroes` の raw URL から読み込み。8 体すべて Common かつ `restricted_removed_records` に含まれない通常素材。

## 8. 受け入れ基準

- [ ] Common 8 体（1001-1010 から 8 つ）がパレットに並び、職業バッジ（テキストでよい）が表示される。
- [ ] ヒーローを選択すると、配置可能タイル（path 系 or wall 系）のみが緑系でハイライトされ、不可タイルでクリックしてもステータスメッセージで理由が出る。
- [ ] Stage1-1 v2 で 2 経路 + 中央障害が描画される。常時はルート線を出さず、敵出現時にだけ点線アニメで光る。
- [ ] 重装 / 前衛 / 先鋒 / 特殊を path 上に置くと、敵が同じタイルで停止する（最大 `blockMax` 体まで）。`blockMax` を超えた敵は通過する。
- [ ] 敵 / ヒーローが消えるとブロックが正しく解放される。
- [ ] 攻撃対象は射程内の敵のうち、ルート進行度が最も進んだ敵 1 体になる。
- [ ] `npm run typecheck` / `npm test` / `npm run build` が緑。
- [ ] `map.spec.ts` で職業 ↔ タイルの判定行列を網羅。`progress.spec.ts` でルート進行度の算定を検証。

## 9. テストと証跡

- 自動: 上記 §8 のテストで職業 / 進行度ロジックを単位テスト。既存 26 件もすべて緑のまま維持。
- 手動: 配置 → 敵出現アニメ → ブロック → 撃破 → クリア / 失敗 まで 1 周プレイし、PR 本文にスクリーンショット 1〜2 枚。

## 10. 改訂履歴

| 日付 | 版 | 変更内容 |
|------|-----|----------|
| 2026-05-07 | 0.1 | 初版草案 |
