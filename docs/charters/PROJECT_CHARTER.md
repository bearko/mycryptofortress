# プロジェクト憲章（MyCryptoFortress）

## 1. 目的（Why）

- **ミッション**: マイクリプトヒーローズの世界観とアセットを活用し、ブラウザだけで遊べる軽量 2D タワーディフェンスを成立させる。2021 年に Unity で着手した `MCHTowerDefence` を、配布・改修しやすい Web スタックに作り直す。
- **成功の定義**:
  - PC ブラウザで Stage1-1 相当のステージが最初から最後まで遊べる（プレイ→クリア／敗北）。
  - MCH ヒーロー画像と SE が動く形で読み込まれ、ヒーロー設置→自動攻撃→敵撃破のループが体感できる。
  - aidev_template の仕様駆動フローに沿って、SPEC・PR・テスト証跡が残っている。

## 2. スコープ

### 含む（In scope）

- ブラウザ向け 2D タワーディフェンスのゲームループ（タイル配置・Wave・自動攻撃・HP/CE 管理・勝敗判定）。
- MCH ヒーロー / エネミーのデータ（[bearko/mycryptoheroes](https://github.com/bearko/mycryptoheroes)）の読み込み。
- 単一ステージ（Stage1-1 相当）の実装と、後段ステージへの拡張余地を残した設計。

### 含まない（Out of scope）

- 多人数対戦・サーバーサイド・ブロックチェーン連携（NFT 所持判定など）。
- スマホ専用 UI / ネイティブアプリ化。
- ヒーローの育成・成長・編成保存（将来 SPEC で扱う可能性あり）。
- 完全な原作再現（Unity 版にあった CE 演出・カットイン等は段階的に対応）。
- コラボ等の権利上利用できないキャラクター（mycryptoheroes 側で除外済み）。

## 3. ステークホルダー

| 役割 | 責任 |
|------|------|
| プロダクトオーナー | bearko（仕様判断・受け入れ承認） |
| 開発 | bearko + AI エージェント（実装・テスト証跡） |

## 4. 制約と前提

- **権利**: MCH 公式の最新ガイドラインを尊重する。`mycryptoheroes` の `restricted_removed_records` で除外されている素材は使わない。
- **配布形態**: 当面は静的サイト（GitHub Pages / Vercel など）にデプロイ可能な形で維持する。
- **依存**: ランタイムは TypeScript / Phaser 3。サーバーサイドコンポーネントは持たない。

## 5. 用語と優先順位

- **憲章と仕様の関係**: 本憲章と [DEVELOPMENT_CHARTER.md](./DEVELOPMENT_CHARTER.md) はプロジェクト全体の枠。各機能の詳細は [SPEC-INDEX.md](../specs/SPEC-INDEX.md) の SPEC が優先するが、憲章と矛盾する SPEC は無効とみなす。
- **由来資料**: Unity プロジェクト `C:\Users\beark\UnityProject\MCHTowerDefence` の `Assets/Scripts/5_Stage/*.cs` を一次資料として参照する。完全再現ではなく、ブラウザに合わせて再設計する。

## 6. 改定

- 改定提案は Pull Request で行う。
- 改定履歴: 2026-05-07 初版（v0.1-draft）

---

*バージョン: 0.1-draft | 最終更新: 2026-05-07*
