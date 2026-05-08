// tokens.jsx — design tokens (colors / type / spacing) + theme A/B

// ─── Theme A: STEEL ONYX (アークナイツ寄り・シアン1色アクセント)
const THEME_ONYX = {
  id: "onyx",
  name: "STEEL ONYX",
  tagline: "黒 / グレー / シアン1色  —  情報優先のミニマル軍事タクティカル",
  bg: {
    base:    "#0A0C10",  // 全体背景 (Phaser canvas back)
    surface: "#14181F",  // カード/HUDパネル
    raised:  "#1B202A",  // ヒーロー枠・スロット
    overlay: "#232A36",  // モーダル/カットイン背景
    inset:   "#080A0E",  // 凹み (ゲージトラック)
  },
  line: {
    weak:   "#222934",
    base:   "#2D3441",
    strong: "#3D4656",
    bright: "#5A6478",
  },
  ink: {
    primary:   "#E5E7EB",
    secondary: "#9CA3AF",
    tertiary:  "#6B7280",
    muted:     "#4B5563",
    inverse:   "#0A0C10",
  },
  accent: {
    primary:   "#38BDF8",  // sky-400 — 主アクセント・選択中・スキル満タン
    primaryDk: "#0EA5E9",
    warn:      "#F59E0B",
    danger:    "#EF4444",
    success:   "#22C55E",
  },
  hudTint: "#38BDF8",
  cutinSweep: "rgba(56,189,248,.85)",
};

// ─── Theme B: STEEL SENGOKU (鋼鉄ミニマル + 朱赤×金 戦国アクセント)
const THEME_SENGOKU = {
  id: "sengoku",
  name: "STEEL SENGOKU",
  tagline: "鋼鉄ミニマル + 朱赤×金  —  戦国の重厚さを少量の差し色で",
  bg: {
    base:    "#0B0908",
    surface: "#15110F",
    raised:  "#1D1815",
    overlay: "#26201C",
    inset:   "#080605",
  },
  line: {
    weak:   "#241D19",
    base:   "#322822",
    strong: "#43352D",
    bright: "#6A5447",
  },
  ink: {
    primary:   "#EDE7DD",
    secondary: "#A89A8A",
    tertiary:  "#766B5E",
    muted:     "#534A40",
    inverse:   "#0B0908",
  },
  accent: {
    primary:   "#DC2626",  // 朱赤
    primaryDk: "#991B1B",
    warn:      "#D4A24C",  // 落ち着いた金
    danger:    "#EF4444",
    success:   "#7DA84A",
  },
  hudTint: "#DC2626",
  cutinSweep: "rgba(220,38,38,.85)",
};

const THEMES = { onyx: THEME_ONYX, sengoku: THEME_SENGOKU };

// ─── 8 職業カラー (フル彩度・暗背景前提) ──────────────────
const CLASS_COLORS = {
  defender:   { hex: "#4A8FE8", name: "重装",   en: "DEFENDER",   role: "Tile占有・敵阻止" },
  vanguard:   { hex: "#E84A5F", name: "前衛",   en: "VANGUARD",   role: "近接・コスト回収" },
  pioneer:    { hex: "#F59E0B", name: "先鋒",   en: "PIONEER",    role: "速攻・初動" },
  specialist: { hex: "#C448E8", name: "特殊",   en: "SPECIALIST", role: "妨害・撹乱" },
  sniper:     { hex: "#84CC16", name: "狙撃",   en: "SNIPER",     role: "遠距離PHY" },
  caster:     { hex: "#06B6D4", name: "術師",   en: "CASTER",     role: "遠距離INT" },
  medic:      { hex: "#10B981", name: "医療",   en: "MEDIC",      role: "回復" },
  supporter:  { hex: "#EC4899", name: "補助",   en: "SUPPORTER",  role: "バフ/デバフ" },
};
const CLASS_ORDER = ["defender","vanguard","pioneer","specialist","sniper","caster","medic","supporter"];

// ─── レアリティ ──────────────────────────────────────────
const RARITY = {
  C: { hex: "#FCD34D", label: "C",  name: "Common"   },
  U: { hex: "#60A5FA", label: "U",  name: "Uncommon" },
};

// ─── 攻撃属性 ──────────────────────────────────────────
const ATTR = {
  PHY: { hex: "#F87171", label: "PHY" },
  INT: { hex: "#A78BFA", label: "INT" },
};

// ─── マップタイル ──────────────────────────────────────
const TILE = {
  path:         { fill: "#1A2230", line: "#2A3344", label: "床 (path)" },
  path_blocked: { fill: "#241A1F", line: "#3A2A35", label: "通行不可 (blocked)" },
  wall:         { fill: "#0E1118", line: "#1F2530", label: "壁 (wall)" },
  obstacle:     { fill: "#181818", line: "#2A2A2A", label: "障害物" },
  poison:       { fill: "#16231C", line: "#2D5237", label: "毒沼" },
};

// ─── タイポ ───────────────────────────────────────────
const TYPE = {
  jp:      "'Zen Kaku Gothic New', 'Noto Sans JP', system-ui, sans-serif",
  jpBody:  "'Noto Sans JP', system-ui, sans-serif",
  display: "'Orbitron', 'Audiowide', ui-monospace, monospace",
  mono:    "'JetBrains Mono', 'Major Mono Display', ui-monospace, monospace",

  scale: {
    h1:      { px: 32, lh: 1.25, w: 700, use: "シーンタイトル（World/Stage 名）" },
    h2:      { px: 24, lh: 1.30, w: 700, use: "セクション見出し" },
    h3:      { px: 18, lh: 1.35, w: 600, use: "カードタイトル / ヒーロー名" },
    body:    { px: 14, lh: 1.55, w: 400, use: "本文 / 説明" },
    small:   { px: 12, lh: 1.45, w: 500, use: "メタ情報 / ステータス" },
    caption: { px: 11, lh: 1.40, w: 500, use: "キャプション" },
    badge:   { px: 10, lh: 1.0,  w: 700, use: "バッジ / タグ (LATIN-only, ALL-CAPS)" },
    hud:     { px: 20, lh: 1.0,  w: 600, use: "HUD 数値 (HP/CE/秒) — display 書体" },
    hudL:    { px: 28, lh: 1.0,  w: 700, use: "HUD 大数値 — display 書体" },
  },
};

// ─── 形/影/間隔 ───────────────────────────────────────
const SHAPE = {
  radius: { xs: 2, sm: 4, md: 6, lg: 10, pill: 999 },
  border: { hairline: 1, base: 1, strong: 2 },
  gap:    { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  shadow: {
    card:   "0 1px 0 rgba(255,255,255,.04) inset, 0 8px 24px rgba(0,0,0,.45)",
    raised: "0 1px 0 rgba(255,255,255,.06) inset, 0 12px 40px rgba(0,0,0,.55)",
    glow:   (c) => `0 0 0 1px ${c}, 0 0 16px -2px ${c}`,
  },
  motion: {
    fast:   "120ms cubic-bezier(.2,0,.2,1)",
    base:   "200ms cubic-bezier(.2,0,.2,1)",
    slow:   "320ms cubic-bezier(.2,0,.2,1)",
    cutin:  "560ms cubic-bezier(.16,.7,.2,1.05)",
  },
};

Object.assign(window, {
  THEMES, THEME_ONYX, THEME_SENGOKU,
  CLASS_COLORS, CLASS_ORDER, RARITY, ATTR, TILE, TYPE, SHAPE,
});
