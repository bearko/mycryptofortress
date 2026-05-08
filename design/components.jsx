// components.jsx — 基本コンポーネント (chips/buttons/cards/slots/HUD parts)

const { useState, useEffect, useRef, useMemo } = React;

// ─── ClassChip ─────────────────────────────────────────
function ClassChip({ id, size = 32, ring = false, dim = false }) {
  const c = CLASS_COLORS[id]; const Glyph = CLASS_ICON[id];
  return (
    <div style={{
      width: size, height: size, borderRadius: 4, display: "grid", placeItems: "center",
      background: dim ? "rgba(255,255,255,.04)" : `${c.hex}1F`,
      color: dim ? "#5A6478" : c.hex,
      border: `1px solid ${dim ? "#2D3441" : c.hex + "55"}`,
      boxShadow: ring ? `0 0 0 1px ${c.hex}, 0 0 12px -2px ${c.hex}` : "none",
      transition: "all 200ms",
    }}>
      <Glyph size={Math.round(size * 0.62)} stroke={1.6}/>
    </div>
  );
}

// ─── RarityChip ────────────────────────────────────────
function RarityChip({ r, size = 18 }) {
  const c = RARITY[r];
  return (
    <div style={{
      width: size, height: size, borderRadius: 2, display: "grid", placeItems: "center",
      background: c.hex, color: "#0A0C10",
      fontFamily: TYPE.display, fontWeight: 800, fontSize: size * 0.55,
      letterSpacing: ".02em",
    }}>{c.label}</div>
  );
}

// ─── Btn ───────────────────────────────────────────────
function Btn({ kind = "primary", children, icon: I, sm, disabled, theme, style, ...rest }) {
  const t = theme;
  const map = {
    primary: {
      bg: t.accent.primary, fg: t.ink.inverse, border: t.accent.primary,
      hbg: t.accent.primaryDk,
    },
    secondary: {
      bg: "transparent", fg: t.ink.primary, border: t.line.strong, hbg: t.bg.raised,
    },
    ghost: {
      bg: "transparent", fg: t.ink.secondary, border: "transparent", hbg: t.bg.raised,
    },
    destructive: {
      bg: "transparent", fg: t.accent.danger, border: t.accent.danger + "88", hbg: t.accent.danger + "1A",
    },
  };
  const v = map[kind];
  const [h, setH] = useState(false);
  return (
    <button
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      disabled={disabled}
      style={{
        appearance: "none", cursor: disabled ? "not-allowed" : "pointer",
        background: disabled ? t.bg.raised : (h ? v.hbg : v.bg),
        color: disabled ? t.ink.muted : v.fg,
        border: `1px solid ${disabled ? t.line.base : v.border}`,
        padding: sm ? "6px 10px" : "10px 16px",
        fontFamily: TYPE.jp, fontWeight: 600, fontSize: sm ? 12 : 13,
        letterSpacing: ".04em",
        borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 8,
        transition: SHAPE.motion.fast, ...style,
      }} {...rest}>
      {I && <I size={sm ? 14 : 16}/>}
      {children}
    </button>
  );
}

// ─── Bar (HP / CE / Skill ゲージ) ──────────────────────
function Bar({ value, max = 100, color, label, theme, height = 10, glow, segs }) {
  const t = theme; const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: t.ink.tertiary,
          fontFamily: TYPE.display, letterSpacing: ".15em", textTransform: "uppercase" }}>
          <span>{label}</span>
          <span style={{ color: t.ink.secondary, fontVariantNumeric: "tabular-nums" }}>
            {value}<span style={{ color: t.ink.muted }}> / {max}</span>
          </span>
        </div>
      )}
      <div style={{
        height, background: t.bg.inset, border: `1px solid ${t.line.weak}`, borderRadius: 2,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0, width: `${pct * 100}%`,
          background: color, transition: "width 320ms",
          boxShadow: glow ? `0 0 12px -2px ${color}, 0 0 4px ${color} inset` : "none",
        }}/>
        {segs && Array.from({ length: segs - 1 }).map((_, i) => (
          <div key={i} style={{
            position: "absolute", top: 0, bottom: 0, left: `${((i+1)/segs)*100}%`, width: 1,
            background: t.bg.inset,
          }}/>
        ))}
      </div>
    </div>
  );
}

// ─── KPI (HUD 数値 + ラベル) ───────────────────────────
function KPI({ label, value, unit, icon: I, color, theme, size = "md" }) {
  const t = theme;
  const big = size === "lg";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {I && <I size={big ? 22 : 16} style={{ color: color || t.ink.secondary }}/>}
      <div style={{ display: "flex", flexDirection: "column", gap: 1, lineHeight: 1 }}>
        <div style={{ fontSize: 9, color: t.ink.tertiary,
          fontFamily: TYPE.display, letterSpacing: ".18em", textTransform: "uppercase" }}>{label}</div>
        <div style={{ fontFamily: TYPE.display, fontWeight: 700,
          fontSize: big ? 26 : 18, color: color || t.ink.primary,
          fontVariantNumeric: "tabular-nums", letterSpacing: ".02em" }}>
          {value}{unit && <span style={{ fontSize: big ? 14 : 11, color: t.ink.tertiary, marginLeft: 3 }}>{unit}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Tag (PHY/INT/状態系) ──────────────────────────────
function Tag({ children, color, theme, mono }) {
  const t = theme;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 6px", borderRadius: 2,
      background: color ? color + "22" : t.bg.raised,
      color: color || t.ink.secondary,
      border: `1px solid ${color ? color + "55" : t.line.base}`,
      fontFamily: mono ? TYPE.display : TYPE.jp,
      fontSize: 10, fontWeight: 700, letterSpacing: ".1em",
      textTransform: "uppercase",
    }}>{children}</span>
  );
}

// ─── HeroCard (パーティ編成・パレット用) ───────────────
function HeroCard({ hero, theme, state = "idle", onClick, w = 88, h = 112 }) {
  // state: idle / selected / placed / focused / disabled
  const t = theme;
  const c = CLASS_COLORS[hero.cls];
  const sel = state === "selected" || state === "focused";
  const placed = state === "placed";
  const disabled = state === "disabled";
  const [h0, setH0] = useState(false);
  return (
    <div onClick={!disabled ? onClick : undefined}
      onMouseEnter={() => setH0(true)} onMouseLeave={() => setH0(false)}
      style={{
        width: w, height: h, position: "relative", cursor: disabled ? "not-allowed" : "pointer",
        background: t.bg.raised,
        border: `1px solid ${sel ? c.hex : t.line.base}`,
        borderRadius: 4,
        boxShadow: sel ? `0 0 0 1px ${c.hex}, 0 0 16px -2px ${c.hex}88` :
                   (h0 && !disabled ? `0 0 0 1px ${t.line.bright}` : "none"),
        opacity: disabled ? 0.4 : (placed ? 0.5 : 1),
        transition: SHAPE.motion.base, overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}>
      {/* sprite slot */}
      <div style={{
        flex: 1, background:
          `linear-gradient(180deg, ${c.hex}14, transparent 60%), ${t.bg.inset}`,
        display: "grid", placeItems: "center", position: "relative",
        borderBottom: `1px solid ${t.line.weak}`,
      }}>
        <div style={{
          fontFamily: TYPE.mono, fontSize: 9, color: t.ink.muted, letterSpacing: ".1em",
        }}>[Sprite 64]</div>
        {/* corner rarity */}
        <div style={{ position: "absolute", top: 4, left: 4 }}>
          <RarityChip r={hero.r} size={14}/>
        </div>
        {/* corner class */}
        <div style={{ position: "absolute", top: 4, right: 4, color: c.hex }}>
          {React.createElement(CLASS_ICON[hero.cls], { size: 14, stroke: 1.8 })}
        </div>
        {placed && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center",
            background: "rgba(0,0,0,.55)" }}>
            <IconCheck size={24} style={{ color: t.accent.success }}/>
          </div>
        )}
      </div>
      {/* footer */}
      <div style={{ padding: "4px 6px", display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ fontFamily: TYPE.jp, fontSize: 11, fontWeight: 600, color: t.ink.primary,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{hero.name}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: TYPE.display, fontSize: 9, color: c.hex, letterSpacing: ".15em" }}>
            {c.en}
          </span>
          <span style={{ fontFamily: TYPE.display, fontSize: 10, color: t.ink.secondary,
            fontVariantNumeric: "tabular-nums" }}>{hero.cost}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Slot (編成枠) ─────────────────────────────────────
function Slot({ hero, theme, state = "empty", onClick, idx }) {
  // empty / filled / focused
  const t = theme;
  const c = hero ? CLASS_COLORS[hero.cls] : null;
  const focused = state === "focused";
  if (!hero) {
    return (
      <div onClick={onClick} style={{
        width: 76, height: 96, borderRadius: 4,
        background: t.bg.inset,
        border: `1px dashed ${focused ? t.accent.primary : t.line.base}`,
        display: "grid", placeItems: "center",
        cursor: "pointer", transition: SHAPE.motion.fast,
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 2,
            border: `1px solid ${t.line.base}`,
            display: "grid", placeItems: "center", color: t.ink.muted,
            fontFamily: TYPE.display, fontSize: 14, fontWeight: 700,
          }}>+</div>
          <div style={{ fontFamily: TYPE.display, fontSize: 9, color: t.ink.tertiary,
            letterSpacing: ".18em" }}>{String(idx+1).padStart(2,"0")}</div>
        </div>
      </div>
    );
  }
  return (
    <div onClick={onClick} style={{
      width: 76, height: 96, borderRadius: 4,
      background: t.bg.raised,
      border: `1px solid ${focused ? c.hex : t.line.base}`,
      boxShadow: focused ? `0 0 0 1px ${c.hex}, 0 0 12px -2px ${c.hex}88` : "none",
      cursor: "pointer", overflow: "hidden", display: "flex", flexDirection: "column",
      transition: SHAPE.motion.base,
    }}>
      <div style={{ flex: 1, background: `linear-gradient(180deg, ${c.hex}1a, ${t.bg.inset})`,
        display: "grid", placeItems: "center", color: c.hex }}>
        {React.createElement(CLASS_ICON[hero.cls], { size: 22, stroke: 1.6 })}
      </div>
      <div style={{ padding: "3px 5px", borderTop: `1px solid ${t.line.weak}` }}>
        <div style={{ fontFamily: TYPE.jp, fontSize: 10, fontWeight: 600, color: t.ink.primary,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{hero.name}</div>
        <div style={{ fontFamily: TYPE.display, fontSize: 9, color: c.hex, letterSpacing: ".1em" }}>
          {String(idx+1).padStart(2,"0")} · {hero.cost}
        </div>
      </div>
    </div>
  );
}

// ─── Panel (見出し付きの汎用パネル) ────────────────────
function Panel({ title, sub, theme, children, style, accent }) {
  const t = theme;
  return (
    <div style={{
      background: t.bg.surface, border: `1px solid ${t.line.base}`, borderRadius: 4,
      ...style,
    }}>
      {(title || sub) && (
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${t.line.weak}`,
          display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            {title && <div style={{
              fontFamily: TYPE.display, fontSize: 11, fontWeight: 700, letterSpacing: ".22em",
              color: accent || t.accent.primary, textTransform: "uppercase",
            }}>{title}</div>}
            {sub && <div style={{ fontFamily: TYPE.jp, fontSize: 12, color: t.ink.secondary, marginTop: 2 }}>
              {sub}</div>}
          </div>
        </div>
      )}
      <div style={{ padding: 14 }}>{children}</div>
    </div>
  );
}

// ─── Swatch ────────────────────────────────────────────
function Swatch({ hex, label, sub, theme, w = 120 }) {
  const t = theme;
  return (
    <div style={{ width: w, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ height: 56, background: hex, borderRadius: 3,
        border: `1px solid ${t.line.weak}` }}/>
      <div>
        <div style={{ fontFamily: TYPE.jp, fontSize: 11, fontWeight: 600, color: t.ink.primary }}>{label}</div>
        <div style={{ fontFamily: TYPE.display, fontSize: 10, color: t.ink.tertiary,
          letterSpacing: ".06em", textTransform: "uppercase" }}>{hex}</div>
        {sub && <div style={{ fontFamily: TYPE.jp, fontSize: 10, color: t.ink.muted, marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

Object.assign(window, {
  ClassChip, RarityChip, Btn, Bar, KPI, Tag, HeroCard, Slot, Panel, Swatch,
});
