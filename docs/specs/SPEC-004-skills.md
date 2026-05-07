# SPEC-004: スキルシステム（ゲージ・タップ発動・カットイン・SE・職業別エフェクト）

| 項目 | 値 |
|------|-----|
| ID | SPEC-004 |
| 状態 | Draft |
| 作成日 | 2026-05-07 |
| 最終更新 | 2026-05-07 |
| 作者 | bearko + AI エージェント |
| 関連 | [SPEC-003](./SPEC-003-battle-systems.md)（職業システムを土台として使う） |

## 1. 概要

ヒーローに **アクティブスキル** を導入する。スキルゲージは時間経過と通常攻撃の両方で蓄積し、満タン時にヒーローを左クリック（または将来的に自動発動）で **強力な一発** が発動する。発動時はカットイン演出と SE が再生される。

スコープは **Common ヒーロー 8 体** のみ。スキル名は MCH 公式 DB（`mycryptoheroes/Data/Heroes/heroes.json` の `passive.name`）を流用し、効果内容は Arknights のオペレーター・スキルを参考に職業別に割り当てる。

## 2. 背景と動機

- SPEC-003 まででバトルの基盤（職業 / マップ / ブロック / ターゲティング）が揃ったが、戦闘中の「決め手」が無く、配置後はオート射撃を眺めるだけの体験になっている。
- 原作 Unity 版の `Hero.ActivateSkill()` も「DamageRate 倍化 / HeroSpeed 半減」のような単純なバフを採用しており、本 SPEC でこのコンセプトを正式実装する。
- カットインと SE があると、プレイヤーが「いま自分の操作で世界が変わった」という体感を得やすい。

## 3. 目標と非目標

### 目標

- 各 Common ヒーローに 1 種のアクティブスキルを定義する。
- スキルゲージ（0〜100）を実装し、時間経過と攻撃の両方で蓄積。
- ゲージ満タン時にヒーローをクリックすると即時発動。発動するとゲージは 0 にリセット。
- 効果は 4 種類: `damageMultiplier`（自身の damageRate 倍化）/ `agiBuff`（自身の AGI 倍化）/ `enemyDefDebuff`（範囲内敵の防御 % ダウン）/ `singleStrike`（1 発だけ高倍率の攻撃を即座に撃つ）。
- カットイン: ヒーロー画像 + スキル名 + 職業色のフラッシュを 1.0 秒間表示。
- SE: スキル種別ごとに `mycryptoheroes/Data/SoundEffects/battle_sound_effects.json` の 5 種から選んで再生。
- 状態管理 API はテスト可能な純粋関数として `skill.ts` に切り出す。

### 非目標

- 自動発動モード（手動クリックのみで起動）。
- スキル発動時のターゲット手動選択（自動的に「ターゲティングルール」を流用）。
- スキル LV / 強化 / 装備（Extension）。
- 持続時間中の重ね掛けや上書き挙動の精緻化（同じ種別の効果が掛かっていたら上書き）。
- ヒーロー被ダメージ前提の効果（例: 大長今の HP 回復は、敵の攻撃が無い MVP では空打ち。代替の見た目演出だけ走らせる）。
- Common 以外のレアリティ。

## 4. スコープ

### 含む

- 型: `SkillCategory`, `SkillEffectType`, `SkillDef`, `ActiveSkillState` を `web/src/game/types.ts` または専用モジュールに追加。
- 新規モジュール `web/src/game/skill.ts` にスキル定義（8 体ぶん）と純粋関数（`tickGauge`, `applyEffectStart`, `applyEffectTick`, `applyEffectEnd`）。
- `BootScene` で SE 5 種を読み込む（読み込み失敗時はサイレント、ゲームは継続）。
- `StageScene` 改修:
  - 各 `PlacedHero` に `skillGauge` / `activeEffectUntil` を持たせる。
  - 攻撃成功時にゲージ +X、毎フレーム +Y。満タンで頭上に金色リング表示。
  - 配置済みヒーロークリック時、ゲージが満タンなら **発動**（既存のステータスパネル表示は満タンでない時のみ）。
  - カットイン演出（ポートレート + 名前 + フラッシュ）を 1.0 秒。
  - SE 再生。
  - 発動効果の適用 / 持続中の挙動 / 終了処理。
- ユニットテスト `skill.spec.ts`: `tickGauge`、効果適用 / 期限切れ、Damage 倍率の合成。

### 含まない

- 上記の非目標すべて。
- スキル発動中のヒーロースプライト変更や 2 段アニメ。

## 5. 契約と挙動

### 5.1 スキル定義 (`SkillDef`)

```ts
type SkillCategory =
  | "single_damage"
  | "area_damage"
  | "heal_resurrection"
  | "buff"
  | "debuff_status_effect";

type SkillEffectType =
  | "damageMultiplier"   // 自身の damageRate ×倍率, durationSec 持続
  | "agiBuff"            // 自身の AGI ×倍率, durationSec 持続
  | "enemyDefDebuff"     // 範囲内敵の phyDef / intDef ×倍率, durationSec 持続
  | "singleStrike";      // 即発: 一番進行度の高い敵に 1 回 damageRate=value の攻撃

interface SkillDef {
  /** ヒーロー ID（heroData の id と一致） */
  heroId: number;
  /** スキル名（MCH DB の passive.name.ja を流用） */
  name: string;
  /** 説明（Arknights を参考にした 1 行） */
  description: string;
  /** SE 分類 */
  seCategory: SkillCategory;
  /** 効果タイプ */
  effectType: SkillEffectType;
  /** 効果の倍率（0.5 / 1.5 / 2.0 など） */
  value: number;
  /** 持続秒。`singleStrike` の場合は無視（即発） */
  durationSec: number;
  /** 必要ゲージ（常に 100、将来用に拡張可能） */
  cost: number;
}
```

### 5.2 ヒーロー別スキル割り当て

| ID | 名前 | 職業 | スキル名 (MCH 準拠) | 効果タイプ | 値 / 持続 | SE 分類 |
|----|------|------|---------------------|-----------|----------|---------|
| 1001 | コナン・ドイル | supporter | シャーロック・ホームズ | damageMultiplier | 1.5× / 8 秒 | buff |
| 1002 | 甲斐姫 | vanguard | 浪切 | agiBuff | 1.5× / 6 秒 | buff |
| 1003 | 張遼 | sniper | 遼来遼来 | singleStrike | damageRate 3.0× | single_damage |
| 1004 | シートン | caster | 狼王ロボ | damageMultiplier | 1.7× / 6 秒 | area_damage |
| 1006 | ピタゴラス | guard | テトラクテュス | damageMultiplier | 2.0× / 5 秒 | buff |
| 1007 | 大長今 | medic | 李氏朝鮮、宮廷医女 | damageMultiplier | 1.4× / 10 秒（敵 HP 回復演出を兼ねる） | heal_resurrection |
| 1008 | ジョン・L・サリバン | defender | ボストン・ストロング・ボーイ | damageMultiplier | 1.8× / 8 秒 | buff |
| 1009 | ヘルクレスオオカブト | specialist | ローリングドライバー | enemyDefDebuff | 0.5×（防御半減）/ 6 秒 | debuff_status_effect |

> **大長今の MVP 仕様**: 敵の攻撃が無いため HP 回復に意味がない。代替として味方ヒーローの damageRate を上げる効果を割り当てつつ、SE と演出は heal カテゴリにする。SPEC-005 以降で敵攻撃が入った時に純粋な heal に置換する。

### 5.3 ゲージ蓄積

- 初期値: 0
- 上限: 100（コスト 100 = 1 発分）
- レート: 時間経過 `+5/秒` + 攻撃発射時 `+8/発`（合算）
- 上限に達するとゲージは満タンで停止（オーバーフロー無し）
- スキル発動でゲージは 0 にリセット

### 5.4 発動操作

- 配置済みヒーローを **左クリック**:
  - `skillGauge >= cost` なら **発動**: `applyEffectStart` を呼び、ゲージ 0 に。
  - そうでなければ既存挙動（ステータスパネルを開く）。
- 発動中はヒーロー周囲に色付きオーラ（職業色）を表示。

### 5.5 効果実装

- `damageMultiplier`: 該当ヒーローの実効 damageRate を `1.0 → value` に変える。期限が切れたら戻す。
- `agiBuff`: 該当ヒーローの実効 AGI を `agi → agi * value` に変える。実装上は攻撃間隔を `interval / value` に短縮。期限が切れたら戻す。
- `enemyDefDebuff`: 該当ヒーローの攻撃範囲内に「現在いる」敵全員の phyDef / intDef を即座に `× value` に。期限切れで元に戻す（その間に出現した新規敵には付与しない）。
- `singleStrike`: 効果開始時、ターゲティングルールで決まる 1 体に対して即時 1 発 (`damageRate = value`) を撃つ。持続時間 = 0。

### 5.6 カットイン演出

- ヒーロー発動時、画面中央に半透明オーバーレイ（160 px 高）をスライドイン。
- 中身: ヒーロー名（小） / スキル名（大） / 職業色フラッシュ。
- 表示時間: 1.0 秒（in 0.2s + hold 0.6s + out 0.2s）。
- カットイン中もゲームは進行（速度低下しない）。
- カットインは同時 1 個のみ。次の発動が直後に来た場合は前のカットインを即座に閉じて新しいものに差し替える。

### 5.7 SE

- `BootScene` で 5 つの SE を `mycryptoheroes/Audio/SE/Battle/*.mp3` から読み込む。
- 失敗時はミュート扱いで継続（コンソール警告のみ）。
- 発動時に `seCategory` に対応する SE を 1 回再生。

### 5.8 既存仕様との関係

- ヒーロークリック時の挙動は SPEC-002 §5.6（ステータスパネル）を SPEC-004 で上書き: ゲージ満タンならスキル発動、そうでなければパネル。
- ターゲティング（SPEC-003 §5.7）はそのまま使う。
- ブロック / 配置 / 売却 / 速度トグル / 経路アニメは変更なし。

## 6. 非機能要件

- 性能: スキル発動時の追加描画はカットイン 1 枚 + フラッシュのみ。フレーム維持。
- アクセシビリティ: 既存 SPEC と同じく MVP では未対応。

## 7. マージ前確認事項（HITL）

- [x] **ゲーム数値の調整あり**: スキル倍率と持続時間が新規追加。Arknights を参考にしたバランス値だが、Common 8 体での実プレイ調整は別 SPEC。
- [x] **アセット権利**: SE は `mycryptoheroes/Audio/SE/Battle/*.mp3` を raw URL 経由で読み込み、`battle_sound_effects.json` に列挙された通常素材のみ使用。

## 8. 受け入れ基準

- [ ] Common 8 体それぞれが固有のスキル名（MCH DB 準拠）を持つ。
- [ ] スキルゲージがヒーロー頭上に表示され、時間と攻撃でジワジワ伸びる。
- [ ] 満タン時にヒーローを左クリックすると発動し、ゲージが 0 に戻る。
- [ ] 発動時にカットインが約 1 秒表示される。
- [ ] 発動時に `seCategory` 対応の SE が再生される（読み込み失敗時はミュートで継続）。
- [ ] `damageMultiplier` 発動中は弾の与ダメージが `value` 倍になる。
- [ ] `agiBuff` 発動中は攻撃間隔が `1/value` 倍に短縮される。
- [ ] `enemyDefDebuff` 発動時、範囲内の敵の防御値が一時的に `value` 倍になる。
- [ ] `singleStrike` 発動時、ターゲティングルールで選ばれた 1 体に即時 1 発撃つ。
- [ ] `npm run typecheck` / `npm test` / `npm run build` が緑。
- [ ] `skill.spec.ts` でゲージ蓄積、効果開始 / 終了、duration 計算を網羅。

## 9. テストと証跡

- 自動: `skill.spec.ts` で `tickGauge` / `applyEffectStart` / 期限判定 / SkillDef テーブルの整合（8 体ぶん）。
- 手動: 配置 → 攻撃を見守る → ゲージ満タン → クリック発動 → カットインと SE 確認、を 1 周。スクリーンショットを PR 本文に貼る。

## 10. 改訂履歴

| 日付 | 版 | 変更内容 |
|------|-----|----------|
| 2026-05-07 | 0.1 | 初版草案 |
