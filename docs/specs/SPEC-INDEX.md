# SPEC インデックス

| ID | 状態 | 題名 | 最終更新 |
|----|------|------|----------|
| [SPEC-001](./SPEC-001-mvp-stage1.md) | Deprecated（→ SPEC-100） | Stage1-1 相当 MVP（ブラウザ TD ループ） | 2026-05-07 |
| [SPEC-002](./SPEC-002-battle-screen-polish.md) | Deprecated（→ SPEC-100） | バトル画面ブラッシュアップ（タイル攻撃範囲・向き選択・描画調整・残 Unity 要素） | 2026-05-07 |
| [SPEC-003](./SPEC-003-battle-systems.md) | Deprecated（→ SPEC-100） | バトル戦域システム（職業・多経路マップ・配置ルール・ブロック・ターゲティング） | 2026-05-07 |
| [SPEC-004](./SPEC-004-skills.md) | Deprecated（→ SPEC-100） | スキルシステム（ゲージ・タップ発動・カットイン・SE・職業別エフェクト） | 2026-05-07 |
| [SPEC-100](./SPEC-100-v2-game-design.md) | Draft | v2 ゲームデザイン（Outhold 型 TD × インクリメンタル / MCH アセット）v0.2 | 2026-09-26 |
| [SPEC-101](./SPEC-101-phase0-foundation.md) | Accepted | Phase 0: v1 撤去と v2 基盤（アセット同期・縦画面・入力・セーブ・CI） | 2026-09-26 |
| [SPEC-102](./SPEC-102-sim-core.md) | Accepted | シミュレーションコア（決定的 RunSim・ターゲット優先度・イベント） | 2026-09-26 |
| [SPEC-103](./SPEC-103-level-format.md) | Accepted | レベル定義フォーマットとバリデータ | 2026-09-26 |
| [SPEC-104](./SPEC-104-cryptid-archer-gum.md) | Accepted | 幻獣・弓ヒーロー・エネミー・GUM（Lv1 の中身） | 2026-09-26 |
| [SPEC-105](./SPEC-105-run-ui.md) | Accepted | ラン UI（スマホ縦画面） | 2026-09-26 |

## v1 → v2 の切り替え

- SPEC-001〜004 は v1（Arknights 型 Stage1-1 MVP）の仕様。v2 への作り直し決定により Deprecated（replaced_by: SPEC-100）。
- v2 の仕様は **SPEC-100 番台**で採番する。フェーズと採番予定は [ROADMAP](../ROADMAP.md) を参照。

## 番号付けルール

- 3 桁ゼロ埋め（`SPEC-001`, `SPEC-002`, ...）。
- 状態は `Draft` / `Review` / `Accepted` / `Deprecated` のいずれか。
- Deprecated にする場合は `replaced_by`（任意）を本文に書く。
