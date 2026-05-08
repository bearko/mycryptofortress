// screens.jsx — World / Stage / Party Formation screens (mobile + desktop)

const { useState: sUseState } = React;

const WORLDS = [
  { id: "w1", name: "戦国時代",  en: "SENGOKU JIDAI",  era: "1467-1615",
    sub: "戦国の世、群雄割拠。", stages: 12, cleared: 7, unlocked: true },
  { id: "w2", name: "三国志",    en: "SAN GUO ZHI",    era: "184-280",
    sub: "三分天下、英傑のきざし。", stages: 10, cleared: 0, unlocked: false },
  { id: "w3", name: "西洋騎士",  en: "WESTERN CHIVALRY", era: "1095-1492",
    sub: "鋼と信仰、十字の道。", stages: 10, cleared: 0, unlocked: false },
];

const STAGES = [
  { id: "s1", n: "01", name: "桶狭間 序",   diff: "EASY", cleared: true,  stars: 3, ene: 8, hp: 3, ce: 10 },
  { id: "s2", n: "02", name: "今川の前哨",   diff: "EASY", cleared: true,  stars: 3, ene: 12, hp: 3, ce: 10 },
  { id: "s3", n: "03", name: "高地の砦",     diff: "NORMAL", cleared: true, stars: 2, ene: 14, hp: 3, ce: 8 },
  { id: "s4", n: "04", name: "桶狭間",       diff: "NORMAL", cleared: false, stars: 0, ene: 18, hp: 3, ce: 8 },
  { id: "s5", n: "05", name: "毒沼の街道",   diff: "HARD", cleared: false, stars: 0, ene: 20, hp: 2, ce: 7, locked: false },
  { id: "s6", n: "06", name: "?????",        diff: "HARD", cleared: false, stars: 0, ene: 0, hp: 0, ce: 0, locked: true },
];

const ROSTER = [
  { id: "h1", name: "前田慶次",   cls: "vanguard",   r: "U", cost: 11, lv: 32 },
  { id: "h2", name: "武田信玄",   cls: "defender",   r: "U", cost: 16, lv: 28 },
  { id: "h3", name: "島津義弘",   cls: "sniper",     r: "U", cost: 13, lv: 25 },
  { id: "h4", name: "明智光秀",   cls: "specialist", r: "C", cost: 12, lv: 18 },
  { id: "h5", name: "森蘭丸",     cls: "pioneer",    r: "C", cost: 8,  lv: 14 },
  { id: "h6", name: "毛利元就",   cls: "caster",     r: "U", cost: 14, lv: 22 },
  { id: "h7", name: "竹中半兵衛", cls: "medic",      r: "C", cost: 10, lv: 16 },
  { id: "h8", name: "黒田官兵衛", cls: "supporter",  r: "U", cost: 12, lv: 20 },
  { id: "h9", name: "上杉謙信",   cls: "vanguard",   r: "U", cost: 13, lv: 30 },
  { id: "h10", name: "雑賀孫一",  cls: "sniper",     r: "C", cost: 9,  lv: 12 },
  { id: "h11", name: "服部半蔵",  cls: "specialist", r: "C", cost: 10, lv: 11 },
  { id: "h12", name: "今川義元",  cls: "caster",     r: "C", cost: 11, lv: 13 },
  { id: "h13", name: "井伊直虎",  cls: "supporter",  r: "C", cost: 9,  lv: 10 },
  { id: "h14", name: "北条早雲",  cls: "defender",   r: "C", cost: 12, lv: 9 },
  { id: "h15", name: "吉田兼好",  cls: "medic",      r: "C", cost: 8,  lv: 8 },
  { id: "h16", name: "津田宗及",  cls: "pioneer",    r: "C", cost: 7,  lv: 7 },
  { id: "h17", name: "斎藤道三",  cls: "vanguard",   r: "C", cost: 10, lv: 6 },
  { id: "h18", name: "細川藤孝",  cls: "supporter",  r: "C", cost: 8,  lv: 5 },
];

// ─── World Select ──────────────────────────────────────
function WorldSelect({ theme, w, mobile }) {
  const t = theme;
  return (
    <div style={{
      width: w, background: t.bg.base, border: `1px solid ${t.line.base}`,
      color: t.ink.primary, fontFamily: TYPE.jp,
      borderRadius: 4, overflow: "hidden",
    }}>
      <ScreenHeader theme={theme} mono="WORLD SELECT" jp="ワールド選択" mobile={mobile}/>
      <div style={{ padding: mobile ? 12 : 24,
        display: "flex", flexDirection: "column", gap: mobile ? 12 : 16 }}>
        {WORLDS.map((wo, i) => <WorldCard key={wo.id} world={wo} theme={theme} mobile={mobile}/>)}
      </div>
    </div>
  );
}
function WorldCard({ world, theme, mobile }) {
  const t = theme;
  const locked = !world.unlocked;
  const [h, setH] = sUseState(false);
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        position: "relative",
        height: mobile ? 110 : 140,
        background: t.bg.surface,
        border: `1px solid ${h && !locked ? t.line.strong : t.line.base}`,
        borderRadius: 4, overflow: "hidden",
        cursor: locked ? "not-allowed" : "pointer",
        opacity: locked ? .55 : 1, transition: SHAPE.motion.base,
      }}>
      {/* placeholder banner */}
      <div style={{
        position: "absolute", inset: 0,
        background: `linear-gradient(120deg, ${t.bg.raised} 0%, ${t.bg.surface} 60%, ${t.bg.inset} 100%)`,
      }}/>
      <div style={{
        position: "absolute", top: 0, right: 0, bottom: 0, width: "45%",
        background: `linear-gradient(90deg, transparent, ${t.accent.primary}10)`,
        borderLeft: `1px solid ${t.line.weak}`,
        display: "grid", placeItems: "center",
        fontFamily: TYPE.mono, fontSize: 10, color: t.ink.muted,
        letterSpacing: ".15em",
      }}>[Banner Image]</div>
      {/* left content */}
      <div style={{
        position: "relative", padding: mobile ? "12px 14px" : "18px 22px",
        height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontFamily: TYPE.display, fontSize: 10, letterSpacing: ".22em",
            color: t.accent.primary }}>{world.en}</div>
          <div style={{ fontFamily: TYPE.jp, fontSize: mobile ? 22 : 28, fontWeight: 700,
            marginTop: 2, color: t.ink.primary }}>{world.name}</div>
          <div style={{ fontFamily: TYPE.display, fontSize: 10, color: t.ink.tertiary,
            letterSpacing: ".15em", marginTop: 2 }}>{world.era}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ fontSize: 12, color: t.ink.secondary }}>{world.sub}</div>
          {!locked ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                fontFamily: TYPE.display, fontSize: 11, color: t.ink.secondary,
                fontVariantNumeric: "tabular-nums",
              }}>
                <span style={{ color: t.accent.primary }}>{world.cleared}</span>
                <span style={{ color: t.ink.muted }}> / {world.stages}</span>
              </div>
              <IconChevronRight size={20} style={{ color: t.ink.secondary }}/>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: t.ink.muted }}>
              <IconLock size={14}/> <span style={{ fontSize: 11 }}>未開放</span>
            </div>
          )}
        </div>
      </div>
      {/* progress bar bottom */}
      {!locked && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: t.bg.inset,
        }}>
          <div style={{ height: "100%", width: `${world.cleared / world.stages * 100}%`,
            background: t.accent.primary, boxShadow: `0 0 8px ${t.accent.primary}` }}/>
        </div>
      )}
    </div>
  );
}

// ─── Stage Select ──────────────────────────────────────
function StageSelect({ theme, w, mobile }) {
  const t = theme;
  return (
    <div style={{ width: w, background: t.bg.base, border: `1px solid ${t.line.base}`,
      color: t.ink.primary, fontFamily: TYPE.jp,
      borderRadius: 4, overflow: "hidden" }}>
      <ScreenHeader theme={theme} mono="STAGE SELECT" jp="戦国時代  /  ステージ"
        meta="3 / 12 CLEARED" mobile={mobile}/>
      <div style={{
        padding: mobile ? 12 : 24,
        display: "grid",
        gridTemplateColumns: mobile ? "1fr" : "repeat(2, 1fr)",
        gap: mobile ? 10 : 14,
      }}>
        {STAGES.map(s => <StageCard key={s.id} stage={s} theme={theme} mobile={mobile}/>)}
      </div>
    </div>
  );
}
function StageCard({ stage, theme, mobile }) {
  const t = theme;
  const locked = stage.locked;
  const diffColor = {
    EASY: t.accent.success, NORMAL: t.accent.primary, HARD: t.accent.warn, NIGHTMARE: t.accent.danger,
  }[stage.diff];
  return (
    <div style={{
      position: "relative", padding: mobile ? "12px 14px" : "14px 16px",
      background: t.bg.surface,
      border: `1px solid ${stage.cleared ? `${t.accent.success}55` : t.line.base}`,
      borderRadius: 4, cursor: locked ? "not-allowed" : "pointer",
      opacity: locked ? .5 : 1,
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      {/* TOP ROW */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
          <div style={{
            fontFamily: TYPE.display, fontSize: 22, fontWeight: 700,
            color: stage.cleared ? t.accent.success : t.ink.secondary,
            fontVariantNumeric: "tabular-nums", letterSpacing: ".05em",
          }}>{stage.n}</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: TYPE.jp, fontSize: 15, fontWeight: 700,
              color: locked ? t.ink.muted : t.ink.primary }}>
              {stage.name}
            </div>
            <Tag color={diffColor} theme={theme} mono>{stage.diff}</Tag>
          </div>
        </div>
        {stage.cleared ? (
          <div style={{ display: "flex", gap: 4 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                width: 10, height: 10, transform: "rotate(45deg)",
                background: i < stage.stars ? t.accent.warn : t.bg.inset,
                border: `1px solid ${i < stage.stars ? t.accent.warn : t.line.base}`,
              }}/>
            ))}
          </div>
        ) : locked ? (
          <IconLock size={16} style={{ color: t.ink.muted }}/>
        ) : (
          <Tag color={t.accent.primary} theme={theme} mono>NEW</Tag>
        )}
      </div>
      {/* META */}
      {!locked && (
        <div style={{ display: "flex", gap: 14, fontSize: 11, fontFamily: TYPE.display,
          color: t.ink.tertiary, letterSpacing: ".12em" }}>
          <span><span style={{ color: t.ink.muted }}>ENE</span> <span style={{ color: t.ink.secondary,
            fontVariantNumeric: "tabular-nums" }}>{stage.ene}</span></span>
          <span><span style={{ color: t.ink.muted }}>HP</span> <span style={{ color: t.accent.danger,
            fontVariantNumeric: "tabular-nums" }}>{stage.hp}</span></span>
          <span><span style={{ color: t.ink.muted }}>CE-INIT</span> <span style={{ color: t.accent.warn,
            fontVariantNumeric: "tabular-nums" }}>{stage.ce}</span></span>
        </div>
      )}
      {stage.cleared && (
        <div style={{
          position: "absolute", top: 8, right: 8, color: t.accent.success,
        }}><IconCheck size={14}/></div>
      )}
    </div>
  );
}

// ─── Party Formation ───────────────────────────────────
function PartyFormation({ theme, w, mobile }) {
  const t = theme;
  const [slots, setSlots] = sUseState([
    ROSTER[0], ROSTER[1], ROSTER[4], ROSTER[5], ROSTER[6],
    null, null, null, null, null,
  ]);
  const [focused, setFocused] = sUseState(0); // hero index in roster
  const [filterCls, setFilterCls] = sUseState(null);
  const filteredRoster = filterCls ? ROSTER.filter(h => h.cls === filterCls) : ROSTER;
  const hero = filteredRoster[focused] || ROSTER[0];

  return (
    <div style={{ width: w, background: t.bg.base, border: `1px solid ${t.line.base}`,
      color: t.ink.primary, fontFamily: TYPE.jp,
      borderRadius: 4, overflow: "hidden" }}>
      <ScreenHeader theme={theme} mono="PARTY FORMATION" jp="編成"
        meta="5 / 10 ASSIGNED" mobile={mobile} />
      <div style={{
        display: "grid",
        gridTemplateColumns: mobile ? "1fr" : "1fr 280px",
        gap: 14, padding: mobile ? 12 : 18,
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* SLOTS */}
          <div>
            <SectionLabel theme={theme} mono="SQUAD SLOTS" sub="編成スロット 10"/>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8,
              padding: 10, background: t.bg.surface, border: `1px solid ${t.line.base}`,
              borderRadius: 4,
            }}>
              {slots.map((s, i) => (
                <Slot key={i} hero={s} idx={i} theme={theme}
                  state={s ? "filled" : "empty"}
                  onClick={() => {
                    if (s) {
                      const ns = [...slots]; ns[i] = null; setSlots(ns);
                    }
                  }}/>
              ))}
            </div>
          </div>
          {/* CLASS FILTER */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <ClassFilterChip cls={null} theme={theme} active={!filterCls} onClick={() => setFilterCls(null)}/>
            {CLASS_ORDER.map(cl => (
              <ClassFilterChip key={cl} cls={cl} theme={theme}
                active={filterCls === cl} onClick={() => setFilterCls(filterCls === cl ? null : cl)}/>
            ))}
          </div>
          {/* ROSTER */}
          <div>
            <SectionLabel theme={theme} mono="ROSTER" sub={`保有 ${ROSTER.length}`}/>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8,
            }}>
              {filteredRoster.map((h, i) => (
                <HeroCard key={h.id} hero={h} theme={theme}
                  state={
                    slots.some(s => s && s.id === h.id) ? "placed" :
                    (filteredRoster[focused] && filteredRoster[focused].id === h.id ? "focused" : "idle")
                  }
                  onClick={() => {
                    setFocused(i);
                    // 2-tap add: if already focused, add
                    if (filteredRoster[focused] && filteredRoster[focused].id === h.id
                        && !slots.some(s => s && s.id === h.id)) {
                      const ix = slots.findIndex(s => s == null);
                      if (ix >= 0) { const ns = [...slots]; ns[ix] = h; setSlots(ns); }
                    }
                  }}
                  w="100%" h={mobile ? 96 : 112}/>
              ))}
            </div>
          </div>
        </div>
        {/* DETAIL PANEL */}
        <DetailPanel hero={hero} theme={theme}/>
      </div>
    </div>
  );
}
function ClassFilterChip({ cls, theme, active, onClick }) {
  const t = theme;
  if (!cls) {
    return (
      <button onClick={onClick} style={{
        appearance: "none", padding: "4px 10px", border: `1px solid ${active ? t.accent.primary : t.line.base}`,
        background: active ? `${t.accent.primary}1A` : "transparent",
        color: active ? t.accent.primary : t.ink.secondary,
        fontFamily: TYPE.display, fontSize: 10, letterSpacing: ".15em", cursor: "pointer",
        borderRadius: 2,
      }}>ALL</button>
    );
  }
  const c = CLASS_COLORS[cls];
  return (
    <button onClick={onClick} style={{
      appearance: "none", padding: "4px 8px",
      border: `1px solid ${active ? c.hex : t.line.base}`,
      background: active ? `${c.hex}1A` : "transparent",
      color: active ? c.hex : t.ink.secondary,
      fontFamily: TYPE.jp, fontSize: 11, fontWeight: 600,
      cursor: "pointer", borderRadius: 2,
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      {React.createElement(CLASS_ICON[cls], { size: 12, stroke: 1.8 })}
      {c.name}
    </button>
  );
}
function DetailPanel({ hero, theme }) {
  const t = theme; const c = CLASS_COLORS[hero.cls];
  return (
    <div style={{ background: t.bg.surface, border: `1px solid ${t.line.base}`,
      borderRadius: 4, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      {/* preview */}
      <div style={{
        height: 180, background: `linear-gradient(180deg, ${c.hex}1F, ${t.bg.inset})`,
        border: `1px solid ${c.hex}55`, display: "grid", placeItems: "center",
        position: "relative",
      }}>
        <div style={{ color: c.hex, opacity: .35 }}>
          {React.createElement(CLASS_ICON[hero.cls], { size: 80, stroke: 1.4 })}
        </div>
        <div style={{ position: "absolute", left: 8, top: 8 }}>
          <RarityChip r={hero.r} size={18}/>
        </div>
        <div style={{
          position: "absolute", bottom: 8, left: 8, fontFamily: TYPE.mono,
          fontSize: 9, color: t.ink.muted, letterSpacing: ".15em",
        }}>[Sprite Preview]</div>
      </div>
      {/* name */}
      <div>
        <div style={{ fontFamily: TYPE.display, fontSize: 10, color: c.hex,
          letterSpacing: ".22em" }}>{c.en}  ·  LV {hero.lv}</div>
        <div style={{ fontFamily: TYPE.jp, fontSize: 22, fontWeight: 700, marginTop: 2 }}>{hero.name}</div>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <Tag color={c.hex} theme={theme} mono>{c.name}</Tag>
          <Tag color={hero.cls === "caster" || hero.cls === "specialist" ? ATTR.INT.hex : ATTR.PHY.hex}
            theme={theme} mono>{hero.cls === "caster" || hero.cls === "specialist" ? "INT" : "PHY"}</Tag>
          <Tag theme={theme} mono>CE {hero.cost}</Tag>
        </div>
      </div>
      {/* stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
        {[
          ["HP", 1240], ["ATK", 384], ["DEF", 142], ["RES", 22],
          ["RANGE", "5x3"], ["ATKSPD", "0.92s"],
        ].map(([k, v]) => (
          <div key={k} style={{ borderBottom: `1px solid ${t.line.weak}`, paddingBottom: 4,
            display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontFamily: TYPE.display, fontSize: 10, color: t.ink.tertiary,
              letterSpacing: ".15em" }}>{k}</span>
            <span style={{ fontFamily: TYPE.display, fontSize: 12, color: t.ink.primary,
              fontVariantNumeric: "tabular-nums" }}>{v}</span>
          </div>
        ))}
      </div>
      {/* skill */}
      <div style={{ background: t.bg.inset, border: `1px solid ${t.line.weak}`, padding: 10, borderRadius: 2 }}>
        <div style={{ fontFamily: TYPE.display, fontSize: 9, color: t.accent.primary,
          letterSpacing: ".22em" }}>SKILL</div>
        <div style={{ fontFamily: TYPE.jp, fontSize: 13, fontWeight: 700, marginTop: 2 }}>傾奇者の槍</div>
        <div style={{ fontSize: 11, color: t.ink.secondary, marginTop: 4, lineHeight: 1.55 }}>
          範囲内の敵 1 体に <b style={{ color: t.ink.primary }}>×2.4 ダメージ</b>。
          スキルゲージ最大時、自動 / タップで発動。
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <Btn kind="primary" theme={theme}>編成に追加</Btn>
        <Btn kind="secondary" theme={theme}>強化</Btn>
      </div>
    </div>
  );
}

// ─── helpers ────────────────────────────────────────────
function ScreenHeader({ theme, mono, jp, meta, mobile }) {
  const t = theme;
  return (
    <div style={{
      padding: mobile ? "12px 14px" : "16px 24px",
      borderBottom: `1px solid ${t.line.base}`,
      background: t.bg.surface,
      display: "flex", justifyContent: "space-between", alignItems: "center",
    }}>
      <div>
        <div style={{ fontFamily: TYPE.display, fontSize: 10, letterSpacing: ".24em",
          color: t.accent.primary }}>{mono}</div>
        <div style={{ fontFamily: TYPE.jp, fontSize: mobile ? 18 : 22, fontWeight: 700,
          color: t.ink.primary, marginTop: 2 }}>{jp}</div>
      </div>
      {meta && <div style={{ fontFamily: TYPE.display, fontSize: 10, color: t.ink.tertiary,
        letterSpacing: ".18em" }}>{meta}</div>}
    </div>
  );
}
function SectionLabel({ theme, mono, sub }) {
  const t = theme;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline",
      marginBottom: 8 }}>
      <div style={{ fontFamily: TYPE.display, fontSize: 10, letterSpacing: ".22em",
        color: t.accent.primary, textTransform: "uppercase" }}>{mono}</div>
      {sub && <div style={{ fontFamily: TYPE.jp, fontSize: 11, color: t.ink.tertiary }}>{sub}</div>}
    </div>
  );
}

Object.assign(window, { WorldSelect, StageSelect, PartyFormation, ROSTER, STAGES, WORLDS });
