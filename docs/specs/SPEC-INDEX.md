# SPEC インデックス

| ID | 状態 | 題名 | 最終更新 |
|----|------|------|----------|
| [SPEC-001](./SPEC-001-mvp-stage1.md) | Deprecated（→ SPEC-100） | Stage1-1 相当 MVP（ブラウザ TD ループ） | 2026-05-07 |
| [SPEC-002](./SPEC-002-battle-screen-polish.md) | Deprecated（→ SPEC-100） | バトル画面ブラッシュアップ（タイル攻撃範囲・向き選択・描画調整・残 Unity 要素） | 2026-05-07 |
| [SPEC-003](./SPEC-003-battle-systems.md) | Deprecated（→ SPEC-100） | バトル戦域システム（職業・多経路マップ・配置ルール・ブロック・ターゲティング） | 2026-05-07 |
| [SPEC-004](./SPEC-004-skills.md) | Deprecated（→ SPEC-100） | スキルシステム（ゲージ・タップ発動・カットイン・SE・職業別エフェクト） | 2026-05-07 |
| [SPEC-100](./SPEC-100-v2-game-design.md) | Draft | v2 ゲームデザイン（Outhold 型 TD × インクリメンタル / MCH アセット）v0.4 | 2026-09-26 |
| [SPEC-101](./SPEC-101-phase0-foundation.md) | Accepted | Phase 0: v1 撤去と v2 基盤（アセット同期・縦画面・入力・セーブ・CI） | 2026-09-26 |
| [SPEC-102](./SPEC-102-sim-core.md) | Accepted | シミュレーションコア（決定的 RunSim・ターゲット優先度・イベント） | 2026-09-26 |
| [SPEC-103](./SPEC-103-level-format.md) | Accepted | レベル定義フォーマットとバリデータ | 2026-09-26 |
| [SPEC-104](./SPEC-104-cryptid-archer-gum.md) | Accepted | 幻獣（初期 HP 3）・弓ヒーロー・エネミー・GUM・Lv1〜6 の中身 | 2026-09-26 |
| [SPEC-105](./SPEC-105-run-ui.md) | Accepted | ラン UI（スマホ縦画面） | 2026-09-26 |
| [SPEC-106](./SPEC-106-results-and-tokens.md) | Accepted | リザルトとトークン（CE）・レベル進行・セーブ v2 | 2026-09-26 |
| [SPEC-107](./SPEC-107-skill-tree.md) | Accepted | スキルツリー（86 ノード・MCH スキル名・CE / エンブレム・ツリー版の自動返金） | 2026-09-26 |
| [SPEC-108](./SPEC-108-refund-and-modifiers.md) | Accepted | 無料返金とツリー効果のラン適用 | 2026-09-26 |
| [SPEC-108a](./SPEC-108a-navi-npc.md) | Accepted | ナビ / NPC 会話基盤 | 2026-09-26 |
| [SPEC-109](./SPEC-109-status-effects.md) | Accepted | 状態異常フレームワーク（炎上・毒・鈍足・感電/放電・スタン・脆弱・加速・耐性） | 2026-09-26 |
| [SPEC-110](./SPEC-110-lightning.md) | Accepted | 雷ヒーロー（フランクリン → テスラ）: 連鎖・放電 | 2026-09-26 |
| [SPEC-111](./SPEC-111-pulse.md) | Accepted | 結界ヒーロー（安倍晴明 → 諸葛亮）: 鈍足・脆弱・充電・ダメージリンク | 2026-09-26 |
| [SPEC-112](./SPEC-112-fire.md) | Accepted | 炎ヒーロー（猿飛佐助 → 皇帝ネロ）: 炎上・誘爆・伏爆の罠 | 2026-09-26 |
| [SPEC-113](./SPEC-113-miner-economy.md) | Accepted | 採掘ヒーロー（サトシ・ナカモト）と経済: 通行料・配当・ロックマス・Wave 繰り上げ | 2026-09-26 |
| [SPEC-114](./SPEC-114-cryptid-cannon.md) | Accepted | 幻獣砲 | 2026-09-26 |
| [SPEC-115](./SPEC-115-magic-stones.md) | Accepted | 魔石（MCH の 4 属性）と属性マス: ロールごとの挙動変化 | 2026-09-26 |
| [SPEC-116 / 116a](./SPEC-116-milestones-and-emblems.md) | Accepted | マイルストーン・ビルドセット / エンブレム（トークンの多層化）・セーブ v5 | 2026-09-26 |
| [SPEC-117](./SPEC-117-gimmick-enemies.md) | Accepted | ギミック敵（隠密・回復）・ギミックボス（召喚・分裂・多節）と Lv7〜9 | 2026-09-26 |
| [SPEC-118](./SPEC-118-armor-insulation.md) | Accepted | 装甲・絶縁と雷の調整（弓の装甲貫通、雷一辺倒を防ぐギミック） | 2026-09-26 |

## v1 → v2 の切り替え

- SPEC-001〜004 は v1（Arknights 型 Stage1-1 MVP）の仕様。v2 への作り直し決定により Deprecated（replaced_by: SPEC-100）。
- v2 の仕様は **SPEC-100 番台**で採番する。フェーズと採番予定は [ROADMAP](../ROADMAP.md) を参照。

## 番号付けルール

- 3 桁ゼロ埋め（`SPEC-001`, `SPEC-002`, ...）。
- 状態は `Draft` / `Review` / `Accepted` / `Deprecated` のいずれか。
- Deprecated にする場合は `replaced_by`（任意）を本文に書く。
