# Handoff: MyCryptoFortress · Visual Refresh (v1)

ブラウザ向け 2D タワーディフェンス『MyCryptoFortress』(Phaser 3 + TypeScript + Vite) のビジュアル刷新仕様。Claude Code でそのままコードベースに落とし込むためのハンドオフパッケージ。

---

## About the Design Files

このフォルダの HTML / JSX ファイルは **デザイン参考用の高忠実度プロトタイプ** であって、そのまま Phaser 3 アプリに貼り付けるためのものではありません。
タスクは **既存の Phaser 3 + TypeScript + Vite コードベース上で、これらの HTML デザインを再現すること** です。色・タイポ・サイズ・モーションは仕様の通りに、Phaser のレンダラ (`Phaser.GameObjects.Rectangle`, `Container`, `BitmapText` 等) と既存のシーン構造に合わせて実装してください。SVG アイコンは Canvas 上に貼る場合 `loader.image` で読み込むか、Container + Graphics で再描画するかは既存パターンに合わせて選択してください。

## Fidelity

**High-fidelity (hifi)**。色・タイポ・スペーシング・モーション値はすべて確定済みで、`design_tokens.txt` の HEX 値・px 値・easing をそのまま使えるレベルまで落とし込まれています。低彩度の世界観 + 8 職業フル彩度のサブカラーという構造は厳守してください。

---

## Themes — A / B 切替

仕様書は 2 テーマを内包し、すべての画面が両方で破綻しないように設計されています。

| ID         | 名称           | アクセント | 用途 |
|------------|----------------|-----------|------|
| `onyx`     | STEEL ONYX     | `#38BDF8` (sky) | デフォルト。アークナイツ寄り、無機質・タクティカル |
| `sengoku`  | STEEL SENGOKU  | `#DC2626` (朱赤) + `#D4A24C` (金) | 戦国ワールドのみ採用するなら。背景に微かな赤温が乗る |

実装は theme オブジェクト 1 つ持って色テーブルを切り替えるだけで両対応できる設計です。

---

## Screens / Views

仕様書に含まれる主要画面 4 種。すべて **モバイル縦 (390×844)** と **デスクトップ横 (1280×800)** の両レイアウトを定義しています。

### 1. WorldSelectScene (ワールド選択)
- **Purpose**: 「戦国時代」「三国志」「西洋騎士」などのワールドカードを縦積みで一覧。タップで Stage Select へ。
- **Layout**:
  - Mobile: 単一カラム、card 高さ 110px、padding 12, gap 12。
  - Desktop: 単一カラム (max-width 760px 程度)、card 高さ 140px、padding 24, gap 16。
- **WorldCard**:
  - bg: `bg.surface` (#14181F) + 右半分に `linear-gradient(90deg, transparent, accent.primary 10%)` のオーバーレイ
  - 左: 英字タグ (Orbitron 10px / `accent.primary` / letter-spacing .22em)、ワールド名 (Zen Kaku 22px〜28px / 700)、年代 (Orbitron 10px / `ink.tertiary`)
  - 右: バナー画像枠 (現状は `[Banner Image]` プレースホルダ。後でアセット差し替え)
  - 下端 2px 進捗バー (`accent.primary` + glow)
  - ロック中: `IconLock` + 「未開放」表示、opacity .55、cursor not-allowed
- **States**: idle / hover (border `line.strong` に変化) / locked

### 2. StageSelectScene (ステージ選択)
- **Purpose**: ワールド配下のステージ一覧。クリア済は緑チェック + 星 (3段階)。
- **Layout**:
  - Mobile: 1 列 grid, gap 10, padding 12
  - Desktop: 2 列 grid, gap 14, padding 24
- **StageCard**:
  - bg: `bg.surface`、border はクリア済なら `accent.success + 55` (rgba)、それ以外 `line.base`
  - 上段: ステージ番号 (Orbitron 22px / 700 / クリア済は `accent.success`)、ステージ名 (Zen Kaku 15px / 700)、難易度タグ
  - 右上: 星 3 つ (10×10, 45° rotate, 達成数だけ `accent.warn` 塗り) または NEW タグ または ロック
  - 下段メタ: ENE / HP / CE-INIT (Orbitron 11px, 等幅数値)
- **難易度色**: EASY=success, NORMAL=primary, HARD=warn, NIGHTMARE=danger

### 3. PartyFormationScene (編成)
- **Purpose**: 編成スロット 5×2 + 保有ヒーロー一覧 6×3 + 詳細パネル。
- **Layout**:
  - Desktop: `grid-template-columns: 1fr 280px` (左メイン + 右詳細)
  - Mobile: 単一カラム、詳細パネルは下に積む
- **左カラム**:
  - **SQUAD SLOTS**: `bg.surface` パネル内、5 列 grid。各 Slot は 76×96。
    - 空: dashed border, +ボタン + idx (01〜10)
    - filled: 職業色グラデ + 職業アイコン + 名前 + idx · cost
    - focused: 職業色 border + glow
  - **CLASS FILTER**: ALL + 8 職業のチップ (active で職業色枠 + 1A 塗り)
  - **ROSTER**: 6 列 grid。HeroCard (88×112) を並べる。
- **HeroCard 状態**: idle / focused (職業色 border + glow) / placed (opacity .5 + チェックマーク overlay) / disabled (opacity .4)
- **2-tap add 操作**: 1 回目で focus、focused のまま 2 回目タップで slot に追加。
- **右 DetailPanel**: 大きめプレビュー枠 (180px height) + 名前 + Tag (職業/PHY|INT/CE) + ステータス 6 項目 (HP/ATK/DEF/RES/RANGE/ATKSPD) + スキル説明ブロック + ボタン 2 つ。

### 4. StageScene (バトル HUD) — **最重要**
- **Purpose**: 10×8 タイル戦場 + 上部 KPI + 下部ヒーローパレット。Phaser のメインシーン。
- **Layout (Desktop)**:
  - 上部 HUD バー: WORLD/STAGE → BASE HP バー → WAVE/ENEMY → CE → TIME → PAUSE/×2 ボタン
  - メイン: `grid-template-columns: ${cols * 56}px 1fr` で左にフィールド、右に TARGET / LEGEND / カットイン Btn パネル
  - 下部: SQUAD カウンタ + ヒーローパレット (横スクロール可)
- **Layout (Mobile)**:
  - 上部 HUD は HP/CE/TIME を横一列 KPI + 倍速ボタン
  - フィールドは `(width - 24) / 10` で 1 タイルを算出 (≈36.6px)
  - パレットは下部、横スクロール
- **タイル種別 (色だけでなくパターンで判別可能に)**:
  | kind | fill | line | パターン |
  |------|------|------|---------|
  | path | `#1A2230` | `#2A3344` | なし (均質サーフェス) |
  | wall | `#0E1118` | `#1F2530` | `repeating-linear-gradient(45deg, line.weak 0 1px, transparent 1px 7px)` |
  | obstacle | `#181818` | `#2A2A2A` | 中央に inset box + 4×4 ダイヤ |
  | poison | `#16231C` | `#2D5237` | `radial-gradient` 2 重 + 緑被ノイズ + 角に IconPoison |
  | path_blocked | `#241A1F` | `#3A2A35` | `repeating-linear-gradient(135deg, danger 33 0 1px, transparent 1px 6px)` |
  | spawn | path と同じ + accent.danger 枠 + IconSpawn |
  | goal  | path と同じ + accent.warn 枠 + IconGoal |
- **配置フロー**:
  1. パレットでヒーロータップ → そのトークンを `translateY(-4px)` + 職業色 glow で選択状態
  2. 配置可能タイルをタップ → そのタイル border が `accent.primary` に + **DirectionRing** が出現
  3. DirectionRing: 暗幕 0.55 + 4 方向の 36px 矢印トークン (職業色枠 + glow) + 「向きを選択」ラベル
  4. 矢印タップで向き確定 → ヒーロー設置、暗幕外タップで取消
- **攻撃範囲表示**: 配置候補タイル群を `outline: 2px solid accent.primary 66; outline-offset: -2;` で囲む。**塗りはかぶせない**（床/壁のパターンが見えなくなるため）。
- **配置済ヒーロー (Tile 内)**: 内側 inset 3px、職業色グラデ (33→10) + 1px 職業色枠 + glow + 中央に職業アイコン (20px / stroke 1.8) + 下端 2px の HP バー + 右上に 10×10 の向き三角。
- **HeroToken (パレット)**:
  - 56〜68px square。職業色グラデ + 職業色枠 (selected で太く + glow)
  - 左上に CE コスト (Orbitron 700, 10px, `bg.inset` ピル)
  - 右端 3px の `rarity.{C|U}` バー
  - 下に 3px の SP ゲージ (満タンで `accent.primary` + glow + リングパルス)
  - 名前 (Zen Kaku 10px / 500, ellipsis)

---

## Interactions & Behavior

| Interaction | Spec |
|-------------|------|
| Hover (全インタラクティブ要素) | 120ms cubic-bezier(.2,0,.2,1)。border → `line.strong`、または `boxShadow` 付与 |
| ヒーロー選択 | 200ms。`translateY(-4px)` + 職業色 glow + 職業色 border |
| HP/SP バー伸縮 | 320ms |
| スキル満タンリング | `pulseReady` 1.4s ease-in-out infinite (opacity .4↔1, scale 1↔1.06) |
| カットイン全体 | 1.5s 総尺 (`cutinFade`) |
| カットイン上スイープ | 700ms cubic-bezier(.2,.8,.2,1) — `translateY(-100%) → 0 → -100%` |
| カットイン下スイープ | 700ms — 同形・逆方向 |
| カットインスピードライン | 700ms linear、`mix-blend-mode: screen`、105° |
| カットインポートレート | 560ms cubic-bezier(.16,.7,.2,1.05)、scale .85 → 1.04 → 1 + delay 100ms |
| Goal 到達警告 | flash 0.8s × 2、画面四隅に 12px の `accent.warn` フレーム + 「DANGER」テロップ (Orbitron 800) |

タッチ/マウス両対応。Mobile では DirectionRing の矢印 36px は最低タップターゲット 44px に拡大することを推奨 (実装時に密度調整可)。

---

## State Management

`StageScene` で必要な状態:
```ts
selectedHeroIdx: number | null;            // パレットで選択中のヒーロー index
placing: { x: number; y: number } | null;  // 配置候補タイル (DirectionRing 表示中)
placed: Map<string, { hero, dir: 'up'|'right'|'down'|'left' }>; // key = "x,y"
range: Set<string>;                        // 配置候補時の攻撃範囲タイル群
ce: number;                                // 時間で増加、配置で消費
baseHP: number;                            // 敵 Goal 到達で減少
elapsed: number;                           // 経過秒
speed: 1 | 2;
paused: boolean;
heroes: HeroState[];                       // 各ヒーローの hp / sp / cooldown
enemies: EnemyState[];                     // 経路上の位置・hp
cutinHero: Hero | null;                    // カットイン表示中のヒーロー (1.5s で null)
```

`PartyFormationScene`:
```ts
slots: (Hero | null)[10];
focused: number;          // roster index
filterCls: ClassId | null;
```

---

## Design Tokens

完全な HEX/font/モーション値は **`design_tokens.txt`** を参照。要約:

### Background / Surface (Onyx)
```
bg.base    = #0A0C10  // Phaser canvas back
bg.surface = #14181F  // カード/HUDパネル
bg.raised  = #1B202A  // ヒーロー枠/スロット
bg.overlay = #232A36  // モーダル/カットイン
bg.inset   = #080A0E  // 凹み (ゲージトラック)
```

### Accent
```
accent.primary  = #38BDF8  // 主アクセント・選択中・スキル満タン
accent.warn     = #F59E0B  // CE / 警告
accent.danger   = #EF4444  // HP / 死亡
accent.success  = #22C55E  // クリア / 回復
```

### 8 Class Colors (フル彩度)
```
defender   = #4A8FE8  重装    DEFENDER
vanguard   = #E84A5F  前衛    VANGUARD
pioneer    = #F59E0B  先鋒    PIONEER
specialist = #C448E8  特殊    SPECIALIST
sniper     = #84CC16  狙撃    SNIPER
caster     = #06B6D4  術師    CASTER
medic      = #10B981  医療    MEDIC
supporter  = #EC4899  補助    SUPPORTER
```

### Rarity / Attr
```
rarity.C = #FCD34D  (Common, 黄)
rarity.U = #60A5FA  (Uncommon, 水)
attr.PHY = #F87171
attr.INT = #A78BFA
```

### Tile fill / line — 上記 Layout 表を参照

### Typography
```
font.jpHead  = 'Zen Kaku Gothic New', 'Noto Sans JP', system-ui, sans-serif
font.jpBody  = 'Noto Sans JP', system-ui, sans-serif
font.display = 'Orbitron', 'Audiowide', ui-monospace, monospace
font.mono    = 'JetBrains Mono', 'Major Mono Display', ui-monospace, monospace
```

Scale (px / line-height / weight):
```
h1      32 / 1.25 / 700   シーンタイトル
h2      24 / 1.30 / 700   セクション見出し
h3      18 / 1.35 / 600   カードタイトル / ヒーロー名
body    14 / 1.55 / 400   本文
small   12 / 1.45 / 500   メタ情報
caption 11 / 1.40 / 500
badge   10 / 1.0  / 700   英字 ALL-CAPS, letter-spacing .15em
hud     20 / 1.0  / 600   HUD 数値 (Orbitron)
hudL    28 / 1.0  / 700   HUD 大数値 (Orbitron)
```

### Motion
```
motion.fast  = 120ms cubic-bezier(.2,0,.2,1)
motion.base  = 200ms cubic-bezier(.2,0,.2,1)
motion.slow  = 320ms cubic-bezier(.2,0,.2,1)
motion.cutin = 560ms cubic-bezier(.16,.7,.2,1.05)
```

### Shape
```
radius: 2 / 4 / 6 / 10 / 999 (pill)
border: 1px hairline 統一
shadow.card   = 0 1px 0 rgba(255,255,255,.04) inset, 0 8px 24px rgba(0,0,0,.45)
shadow.glow(c)= 0 0 0 1px c, 0 0 16px -2px c
```

---

## Assets

- **キャラクタースプライト**: 既存の MCH 公式 64×64 ピクセルアートを保持 (NEAREST フィルタ運用)。仕様書中の枠は `[Sprite]` プレースホルダになっています。
- **アイコン (8 職業 + 状態系)**: `icons.jsx` に SVG コンポーネントとして実装済み (currentColor 駆動 / stroke 1.5 / 24×24 viewBox)。Phaser に持ち込む場合は:
  - **Option A**: 各 SVG を `.svg` ファイルに切り出して `loader.svg` で `Phaser.Texture` 化
  - **Option B**: Container + `Phaser.GameObjects.Graphics` で同じパスを再描画 (色変更が楽)
- **バナー画像 (World Card)**: 後追いで用意。プレースホルダで進めて OK。

---

## Files (このフォルダ内)

| Path | 内容 |
|------|------|
| `MyCryptoFortress Visual Refresh.html` | エントリ HTML。Google Fonts + Babel で .jsx を読み込む |
| `app.jsx` | 仕様書全体のレイアウト。Cover + 10 Section |
| `tokens.jsx` | テーマトークン (`THEME_ONYX` / `THEME_SENGOKU`) + CLASS_COLORS / RARITY / ATTR / TILE / TYPE / SHAPE |
| `icons.jsx` | 8 職業 + 14 状態系 SVG コンポーネント |
| `components.jsx` | Btn / Bar / KPI / Tag / Slot / HeroCard / RarityChip / ClassChip / Panel / Swatch |
| `battle.jsx` | BattleHUDDesktop / BattleHUDMobile / Tile / DirectionRing / HeroToken / CutinOverlay / RouteArrows / Legend |
| `screens.jsx` | WorldSelect / StageSelect / PartyFormation / DetailPanel |
| `tweaks-panel.jsx` | A/B テーマ切替パネル (実装時は不要、参考のみ) |
| `design_tokens.txt` | コピペ用の `0xRRGGBB` 形式トークン一覧 (Onyx) |

---

## 実装の順番（提案）

1. `tokens.ts` を作成し `design_tokens.txt` の値を `Theme` interface に流し込む。`THEMES.onyx` をデフォルト export。
2. アイコン (`icons/*.svg` あるいは Graphics 関数群) を整備。
3. 共通 UI ヘルパ: `Bar`, `KPI`, `HeroToken` を Phaser Container として実装。
4. **StageScene** から着手（最重要、可読性 = 床/壁の差を最優先で実装）。タイル描画 → 配置フロー → 攻撃範囲 → DirectionRing。
5. PartyFormationScene → WorldSelectScene → StageSelectScene。
6. カットイン演出は最後に上載せ (シーン上に浮かせる Container 1 つで完結)。

---

## 制約 (再確認)

- ピクセルアートのキャラクタースプライトは保持 (NEAREST)。UI のハイレゾと共存。
- 日本語は横書き・ベースライン揃え。縦書き禁止。
- マップタイル 64px 基準は変更しない (仕様書のフィールドは表示用に 56px 等に圧縮しているだけ)。
- `setFillStyle(0xRRGGBB)` で直接指定するため HEX 値で運用。
- 「黒/濃紺基調 + 少数アクセント」を維持。8 職業色は **トークン/タグ/配置オーラ等に限定** し、画面全体に乗せない。
