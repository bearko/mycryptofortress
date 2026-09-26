# SPEC-103: レベル定義フォーマット

| 項目 | 値 |
|------|-----|
| ID | SPEC-103 |
| 状態 | Accepted |
| 作成日 | 2026-09-26 |
| 最終更新 | 2026-09-26 |
| 親仕様 | [SPEC-100 §6.1 / §6.3](./SPEC-100-v2-game-design.md) |

## 1. 概要

レベル（マップ・経路・ビルドマス・Wave 表）を JSON（`web/src/data/levels/*.json`）で定義し、バリデータ `validateLevel()` で検査する。レベル追加はデータ PR だけで行えるようにする。

## 2. スキーマ

```jsonc
{
  "id": "L1",
  "name": "アンティキティラ・ノード",   // MCH のノード名
  "background": "bg.node.1037",          // マニフェストのキー
  "cols": 9, "rows": 12,                 // 盤面（1 マス = 80 論理 px）
  "cryptid": { "col": 4, "row": 10 },    // 幻獣の位置 = 全経路の終点
  "startGum": 120, "cryptidHp": 20,
  "prepSeconds": 15,                     // 第 1 Wave までの準備時間
  "intermissionSeconds": 6,              // Wave 間の休憩
  "paths": [
    { "id": "west", "points": [[-1, 1], [3, 1], [3, 4], "..."] }   // マス座標の折れ線
  ],
  "slots": [ { "col": 4, "row": 2 } ],   // ビルドマス（kind 省略 = normal）
  "waves": [
    { "reward": 10, "hpMul": 1.0,
      "groups": [ { "enemy": "byte_s", "count": 6, "interval": 1.2, "path": "west", "delay": 0 } ] }
  ]
}
```

- `slots[].kind`: `normal`（既定）。`element`（属性マス）・`locked`（購入マス）は SPEC-113 / 115 で有効化する（Phase 1 では `normal` のみ許可）。
- `groups`: `delay` 秒後から `interval` 秒おきに `count` 体を `path` に出す。
- `hpMul`: その Wave の敵 HP 倍率。

## 3. 検査（`validateLevel`）

| 検査 | 内容 |
|------|------|
| 盤面 | `cols`・`rows` が正、幻獣が盤面内 |
| 経路 | 2 点以上。隣接点は縦 or 横の直線（斜め不可）。点は盤面 + 外周 1 マス以内。**終点 = 幻獣** |
| スロット | 盤面内・重複なし・経路のマス上に置かない・幻獣と重ならない |
| Wave | 1 つ以上。`enemy` が定義済み、`path` が存在、`count ≥ 1`、`interval > 0`、`delay ≥ 0`、`hpMul > 0` |
| 参照 | `background` がマニフェストに存在（data テスト） |

エラーは文字列配列で返す（例: `paths[0]: points[2]→[3] が斜め`）。

## 4. 受け入れ基準

- [x] Lv1 が検査を通る（テスト）
- [x] 斜め経路・終点ずれ・経路上スロット・未知の敵などを検出する（テスト）

## 4a. ロックマス（Phase 3 追加）

- `slots[]` に `kind: "locked"` と `cost`（GUM）を書くと、ラン中に GUM を払って開放するマスになる（[SPEC-113](./SPEC-113-miner-economy.md)）。
- バリデータ: `kind` は `normal` / `locked` のみ、`locked` は `cost > 0` 必須。
- **属性マス**（Phase 4）: `slots[]` に `element`（`ifrit` / `leviathan` / `tiamat` / `garuda`）を書くと、置いたヒーローがその属性を得る（[SPEC-115](./SPEC-115-magic-stones.md)）。未知の属性はエラー。
- `reward.emblems`: 初回クリアでもらえるエンブレム（任意、既定 0）。

## 5. 改訂履歴

| 日付 | 版 | 変更内容 |
|------|-----|----------|
| 2026-09-26 | 1.0 | 初版・実装 |
| 2026-09-26 | 1.1 | ロックマス（`kind: "locked"` / `cost`）を追加 |
| 2026-09-26 | 1.2 | 属性マス（`element`）と `reward.emblems` を追加 |
