// icons.jsx — 8職業 + 状態系 SVG アイコン
// すべて currentColor 駆動・stroke ベース・線幅 1.5

const Icon = ({ size = 24, stroke = 1.5, children, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={stroke}
    strokeLinecap="square" strokeLinejoin="miter" shapeRendering="geometricPrecision"
    {...rest}>{children}</svg>
);

// ─── 8 職業 ────────────────────────────────────────────────
// 重装 Defender — タワーシールド
const IconDefender = (p) => (
  <Icon {...p}>
    <path d="M12 2.5 4 5v6.5c0 4.5 3.4 8.4 8 9.5 4.6-1.1 8-5 8-9.5V5L12 2.5Z"/>
    <path d="M12 7v9.5"/><path d="M8 11h8"/>
  </Icon>
);
// 前衛 Vanguard — クロスソード
const IconVanguard = (p) => (
  <Icon {...p}>
    <path d="m4 4 9 9"/><path d="m20 4-9 9"/>
    <path d="m4 20 5-5"/><path d="m20 20-5-5"/>
    <path d="M9 13h6v6H9z" transform="rotate(45 12 16)"/>
  </Icon>
);
// 先鋒 Pioneer — 旗 / コスト回復
const IconPioneer = (p) => (
  <Icon {...p}>
    <path d="M5 3v18"/><path d="M5 4h12l-3 4 3 4H5"/>
    <path d="M9 8h4"/>
  </Icon>
);
// 特殊 Specialist — ダイヤ + 短刀
const IconSpecialist = (p) => (
  <Icon {...p}>
    <path d="m12 3 7 9-7 9-7-9 7-9Z"/>
    <path d="M12 8v8"/><path d="M9 12h6"/>
  </Icon>
);
// 狙撃 Sniper — 照準
const IconSniper = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="7"/>
    <path d="M12 2v4"/><path d="M12 18v4"/>
    <path d="M2 12h4"/><path d="M18 12h4"/>
    <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
  </Icon>
);
// 術師 Caster — 三角オーブ
const IconCaster = (p) => (
  <Icon {...p}>
    <path d="m12 3 9 16H3l9-16Z"/>
    <circle cx="12" cy="14" r="2.4"/>
    <path d="M12 8v3.6"/>
  </Icon>
);
// 医療 Medic — 十字 + 血玉
const IconMedic = (p) => (
  <Icon {...p}>
    <path d="M4 8h6V4h4v4h6v4h-6v8h-4v-8H4z"/>
  </Icon>
);
// 補助 Supporter — 二重円・補助波
const IconSupporter = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 4v3"/><path d="M12 17v3"/>
    <path d="M4 12h3"/><path d="M17 12h3"/>
    <path d="m6.5 6.5 2 2"/><path d="m15.5 15.5 2 2"/>
    <path d="m17.5 6.5-2 2"/><path d="m8.5 15.5-2 2"/>
  </Icon>
);

const CLASS_ICON = {
  defender: IconDefender, vanguard: IconVanguard, pioneer: IconPioneer,
  specialist: IconSpecialist, sniper: IconSniper, caster: IconCaster,
  medic: IconMedic, supporter: IconSupporter,
};

// ─── 状態系 ────────────────────────────────────────────────
const IconCheck = (p) => (
  <Icon {...p} stroke={2}><path d="m5 12 5 5L20 7"/></Icon>
);
const IconBlocked = (p) => ( // 配置不可
  <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="m6 18 12-12"/></Icon>
);
const IconPoison = (p) => ( // 毒沼
  <Icon {...p}>
    <path d="M12 3c-2 4-5 5-5 9a5 5 0 0 0 10 0c0-4-3-5-5-9Z"/>
    <path d="M9 14a3 3 0 0 0 3 3"/>
  </Icon>
);
const IconWall = (p) => (
  <Icon {...p}>
    <path d="M3 6h18M3 12h18M3 18h18"/>
    <path d="M9 6v6M15 12v6M6 18v-6M18 6v6"/>
  </Icon>
);
const IconPath = (p) => (
  <Icon {...p}><path d="M4 4h16v6H4zM4 14h16v6H4z"/></Icon>
);
const IconObstacle = (p) => (
  <Icon {...p}><path d="m12 3 9 9-9 9-9-9 9-9Z"/><path d="M12 8v5"/><circle cx="12" cy="16" r="0.7" fill="currentColor"/></Icon>
);
const IconBolt = (p) => (
  <Icon {...p}><path d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z"/></Icon>
);
const IconHeart = (p) => (
  <Icon {...p}><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.7A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z"/></Icon>
);
const IconClock = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>
);
const IconGoal = (p) => (
  <Icon {...p}><path d="M5 21V4"/><path d="M5 4h12l-2 4 2 4H5"/></Icon>
);
const IconSpawn = (p) => (
  <Icon {...p}><path d="M3 12h12"/><path d="m11 8 4 4-4 4"/><path d="M19 4v16"/></Icon>
);
const IconFastForward = (p) => (
  <Icon {...p}><path d="M3 5v14l9-7-9-7Z"/><path d="M13 5v14l9-7-9-7Z"/></Icon>
);
const IconPause = (p) => (
  <Icon {...p}><path d="M7 5v14M17 5v14"/></Icon>
);
const IconChevronRight = (p) => (
  <Icon {...p}><path d="m9 5 7 7-7 7"/></Icon>
);
const IconLock = (p) => (
  <Icon {...p}><path d="M6 11h12v9H6z"/><path d="M9 11V8a3 3 0 0 1 6 0v3"/></Icon>
);

Object.assign(window, {
  Icon, CLASS_ICON,
  IconDefender, IconVanguard, IconPioneer, IconSpecialist,
  IconSniper, IconCaster, IconMedic, IconSupporter,
  IconCheck, IconBlocked, IconPoison, IconWall, IconPath, IconObstacle,
  IconBolt, IconHeart, IconClock, IconGoal, IconSpawn, IconFastForward,
  IconPause, IconChevronRight, IconLock,
});
