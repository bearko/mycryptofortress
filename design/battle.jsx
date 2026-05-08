// battle.jsx — Battle HUD ワイヤーフレーム (mobile portrait + desktop landscape)
// 10×8 タイル, 64px 想定。可読性 = 床/壁/障害/毒/通行不可 の差を強くつける。

const { useState: bUseState, useMemo: bUseMemo } = React;

// マップ定義 — 0:wall / 1:path / 2:obstacle / 3:poison / 4:path_blocked / 5:goal / 6:spawn
// 10 cols × 8 rows
const MAP = [
  [0,0,6,1,1,1,1,1,1,0],
  [0,0,0,0,0,0,0,0,1,0],
  [0,2,2,0,1,1,1,0,1,0],
  [0,0,0,0,1,3,1,0,1,0],
  [0,1,1,1,1,3,1,0,1,0],
  [0,1,0,0,0,0,0,0,1,0],
  [0,1,1,1,1,1,1,1,1,0],
  [0,0,0,0,0,0,0,0,5,0],
];

// ヒーローパレット (出撃可能)
const PALETTE = [
  { id: "h1", name: "前田慶次",   cls: "vanguard",   r: "U", cost: 11, sp: 32 },
  { id: "h2", name: "武田信玄",   cls: "defender",   r: "U", cost: 16, sp: 14 },
  { id: "h3", name: "島津義弘",   cls: "sniper",     r: "U", cost: 13, sp: 60 },
  { id: "h4", name: "明智光秀",   cls: "specialist", r: "C", cost: 12, sp: 8  },
  { id: "h5", name: "森蘭丸",     cls: "pioneer",    r: "C", cost: 8,  sp: 100, ready: true },
  { id: "h6", name: "毛利元就",   cls: "caster",     r: "U", cost: 14, sp: 45 },
  { id: "h7", name: "竹中半兵衛", cls: "medic",      r: "C", cost: 10, sp: 22 },
  { id: "h8", name: "黒田官兵衛", cls: "supporter",  r: "U", cost: 12, sp: 70 },
];

// ─── タイル描画 ─────────────────────────────────────────
function Tile({ kind, theme, active, range, onClick, size = 56, placed }) {
  const t = theme;
  const KIND = {
    wall: {
      bg: t.bg.base, line: t.line.weak,
      // 斜線パターン (壁: 通行不可+建造不可)
      pattern: `repeating-linear-gradient(45deg, ${t.line.weak} 0 1px, transparent 1px 7px)`,
    },
    path: {
      bg: t.bg.surface, line: t.line.base,
      pattern: null,
    },
    path_blocked: {
      bg: t.bg.surface, line: t.line.base,
      pattern: `repeating-linear-gradient(135deg, ${t.accent.danger}33 0 1px, transparent 1px 6px)`,
    },
    obstacle: {
      bg: "#0F0F12", line: t.line.strong, pattern: null,
    },
    poison: {
      bg: "#16231C", line: "#2D5237",
      pattern: `radial-gradient(circle at 30% 30%, ${t.accent.success}33, transparent 60%), radial-gradient(circle at 70% 70%, ${t.accent.success}22, transparent 50%)`,
    },
    spawn: { bg: t.bg.surface, line: t.accent.danger, pattern: null },
    goal:  { bg: t.bg.surface, line: t.accent.warn,   pattern: null },
  };
  const k = KIND[kind] || KIND.path;
  const isWall = kind === "wall" || kind === "obstacle";
  return (
    <div onClick={!isWall ? onClick : undefined} style={{
      width: size, height: size, position: "relative", boxSizing: "border-box",
      background: k.bg,
      border: `1px solid ${active ? t.accent.primary : k.line}`,
      cursor: isWall ? "default" : "pointer",
      outline: range ? `2px solid ${t.accent.primary}66` : "none",
      outlineOffset: -2,
      transition: SHAPE.motion.fast,
    }}>
      {k.pattern && <div style={{ position: "absolute", inset: 0, background: k.pattern, pointerEvents: "none" }}/>}
      {kind === "obstacle" && (
        <div style={{ position: "absolute", inset: 6, border: `1px solid ${t.line.bright}`, borderRadius: 1,
          background: "#1A1A20", display: "grid", placeItems: "center", color: t.ink.muted }}>
          <div style={{
            width: 10, height: 10, background: t.line.bright,
            transform: "rotate(45deg)",
          }}/>
        </div>
      )}
      {kind === "spawn" && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: t.accent.danger }}>
          <IconSpawn size={18}/>
        </div>
      )}
      {kind === "goal" && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: t.accent.warn }}>
          <IconGoal size={18}/>
        </div>
      )}
      {kind === "poison" && (
        <div style={{ position: "absolute", bottom: 2, right: 2, color: t.accent.success, opacity: .8 }}>
          <IconPoison size={10}/>
        </div>
      )}
      {placed && (
        <PlacedHero hero={placed.hero} dir={placed.dir} theme={theme} />
      )}
    </div>
  );
}

// 配置済ヒーロー
function PlacedHero({ hero, dir, theme }) {
  const c = CLASS_COLORS[hero.cls];
  const t = theme;
  return (
    <div style={{
      position: "absolute", inset: 3, borderRadius: 2,
      background: `linear-gradient(180deg, ${c.hex}33, ${c.hex}10)`,
      border: `1px solid ${c.hex}`,
      display: "grid", placeItems: "center", color: c.hex,
      boxShadow: `0 0 12px -3px ${c.hex}`,
    }}>
      {React.createElement(CLASS_ICON[hero.cls], { size: 20, stroke: 1.8 })}
      {/* HP gauge */}
      <div style={{ position: "absolute", left: 3, right: 3, bottom: 2, height: 2,
        background: t.bg.inset }}>
        <div style={{ width: "78%", height: "100%", background: t.accent.success }}/>
      </div>
      {/* facing arrow */}
      {dir && <FacingArrow dir={dir} color={c.hex}/>}
    </div>
  );
}
function FacingArrow({ dir, color }) {
  const r = { up: 0, right: 90, down: 180, left: 270 }[dir] ?? 0;
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" style={{
      position: "absolute", top: 1, right: 1, transform: `rotate(${r}deg)`, color }}>
      <path d="M5 1l3 4H6v3H4V5H2z" fill={color}/>
    </svg>
  );
}

// ─── 攻撃範囲算出 (簡易: 職業ごと固定パターン) ─────────
function rangeFor(cls, x, y) {
  const cells = [];
  const add = (dx,dy,r=2) => {
    for (let i=-r;i<=r;i++) for (let j=-r;j<=r;j++) cells.push([x+i+dx, y+j+dy]);
  };
  switch (cls) {
    case "sniper":     for (let i=-3;i<=3;i++) for (let j=-2;j<=2;j++) cells.push([x+i,y+j]); break;
    case "caster":     for (let i=-2;i<=2;i++) for (let j=-2;j<=2;j++) cells.push([x+i,y+j]); break;
    case "defender":   for (let i=-1;i<=1;i++) for (let j=-1;j<=1;j++) cells.push([x+i,y+j]); break;
    case "vanguard":   for (let i=-1;i<=1;i++) for (let j=-1;j<=1;j++) cells.push([x+i,y+j]); break;
    case "pioneer":    for (let i=-1;i<=1;i++) for (let j=-1;j<=1;j++) cells.push([x+i,y+j]); break;
    case "specialist": for (let i=-2;i<=2;i++) for (let j=-1;j<=1;j++) cells.push([x+i,y+j]); break;
    case "medic":      for (let i=-2;i<=2;i++) for (let j=-2;j<=2;j++) cells.push([x+i,y+j]); break;
    case "supporter":  for (let i=-2;i<=2;i++) for (let j=-2;j<=2;j++) cells.push([x+i,y+j]); break;
  }
  return cells;
}

// ─── HeroToken (パレット下部の出撃可能枠) ────────────────
function HeroToken({ hero, theme, selected, onClick, sm }) {
  const t = theme; const c = CLASS_COLORS[hero.cls];
  const ready = hero.sp >= 100;
  const sz = sm ? 56 : 68;
  return (
    <div onClick={onClick} style={{
      width: sz, position: "relative", cursor: "pointer",
      transition: SHAPE.motion.fast,
      transform: selected ? "translateY(-4px)" : "none",
    }}>
      <div style={{
        width: sz, height: sz, borderRadius: 4,
        background: `linear-gradient(180deg, ${c.hex}26, ${c.hex}08)`,
        border: `1px solid ${selected ? c.hex : t.line.base}`,
        boxShadow: selected ? `0 0 0 1px ${c.hex}, 0 0 16px -2px ${c.hex}` :
                   ready ? `0 0 0 1px ${t.accent.primary}88, 0 0 14px -3px ${t.accent.primary}` : "none",
        display: "grid", placeItems: "center", color: c.hex,
        position: "relative", overflow: "hidden",
      }}>
        {React.createElement(CLASS_ICON[hero.cls], { size: sm ? 22 : 26, stroke: 1.7 })}
        {/* CE cost in corner */}
        <div style={{ position: "absolute", top: 2, left: 2,
          fontFamily: TYPE.display, fontWeight: 700, fontSize: 10,
          color: t.ink.primary, background: t.bg.inset, padding: "1px 4px",
          borderRadius: 2, letterSpacing: ".05em",
        }}>{hero.cost}</div>
        {/* rarity bar */}
        <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 3,
          background: RARITY[hero.r].hex }}/>
      </div>
      {/* skill ready ring */}
      {ready && (
        <div style={{
          position: "absolute", inset: -2, borderRadius: 6,
          border: `1px solid ${t.accent.primary}`,
          animation: "pulseReady 1.4s ease-in-out infinite",
          pointerEvents: "none",
        }}/>
      )}
      {/* SP gauge */}
      <div style={{ marginTop: 4, height: 3, background: t.bg.inset, borderRadius: 1, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${hero.sp}%`,
          background: ready ? t.accent.primary : t.ink.secondary,
          boxShadow: ready ? `0 0 6px ${t.accent.primary}` : "none",
        }}/>
      </div>
      <div style={{ marginTop: 3, textAlign: "center", fontFamily: TYPE.jp,
        fontSize: 10, color: t.ink.secondary, fontWeight: 500,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {hero.name}
      </div>
    </div>
  );
}

// ─── 方向選択リング (タイル選択時) ─────────────────────
function DirectionRing({ x, y, theme, cls, tileSize, onPick, onCancel }) {
  const c = CLASS_COLORS[cls]; const t = theme;
  const cx = x * tileSize + tileSize / 2;
  const cy = y * tileSize + tileSize / 2;
  const arrow = (dir, dx, dy, rot) => (
    <div onClick={(e) => { e.stopPropagation(); onPick(dir); }}
      style={{
        position: "absolute", left: cx + dx - 18, top: cy + dy - 18,
        width: 36, height: 36, borderRadius: 4,
        background: t.bg.overlay, border: `1px solid ${c.hex}`,
        color: c.hex, display: "grid", placeItems: "center",
        boxShadow: `0 0 16px -2px ${c.hex}`,
        transform: `rotate(${rot}deg)`, cursor: "pointer",
      }}>
      <svg width="18" height="18" viewBox="0 0 18 18">
        <path d="M9 2l5 7h-3v7H7v-7H4z" fill={c.hex}/>
      </svg>
    </div>
  );
  return (
    <div onClick={onCancel} style={{
      position: "absolute", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 10,
    }}>
      <div style={{
        position: "absolute", left: cx - tileSize/2, top: cy - tileSize/2,
        width: tileSize, height: tileSize,
        border: `1.5px solid ${c.hex}`, boxShadow: `0 0 24px -2px ${c.hex}`,
      }}/>
      {arrow("up", 0, -tileSize, 0)}
      {arrow("right", tileSize, 0, 90)}
      {arrow("down", 0, tileSize, 180)}
      {arrow("left", -tileSize, 0, 270)}
      <div style={{
        position: "absolute", left: cx - 60, top: cy + tileSize + 8, width: 120,
        textAlign: "center", fontFamily: TYPE.jp, fontSize: 11, color: t.ink.secondary,
      }}>向きを選択</div>
    </div>
  );
}

// ─── BattleHUD (デスクトップ横) ─────────────────────────
function BattleHUDDesktop({ theme, cutin, fireCutin, w = 980 }) {
  const t = theme;
  const tile = 56;
  const cols = 10, rows = 8;
  const fieldW = cols * tile, fieldH = rows * tile;
  const [sel, setSel] = bUseState(null); // hero index
  const [placing, setPlacing] = bUseState(null); // {x,y}
  const [placed, setPlaced] = bUseState({
    "5,4": { hero: PALETTE[1], dir: "right" },
    "4,4": { hero: PALETTE[0], dir: "right" },
    "8,3": { hero: PALETTE[2], dir: "left" },
  });
  const range = bUseMemo(() => {
    if (placing && sel != null) {
      const r = rangeFor(PALETTE[sel].cls, placing.x, placing.y);
      return new Set(r.map(([x,y]) => `${x},${y}`));
    }
    return new Set();
  }, [placing, sel]);

  return (
    <div style={{
      width: w, background: t.bg.base, border: `1px solid ${t.line.base}`,
      borderRadius: 4, position: "relative", overflow: "hidden",
      fontFamily: TYPE.jp, color: t.ink.primary,
    }}>
      {/* TOP HUD */}
      <div style={{
        display: "grid", gridTemplateColumns: "auto auto 1fr auto auto",
        alignItems: "center", gap: 24, padding: "12px 18px",
        borderBottom: `1px solid ${t.line.base}`, background: t.bg.surface,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontFamily: TYPE.display, fontSize: 10, color: t.ink.tertiary,
            letterSpacing: ".22em", textTransform: "uppercase" }}>WORLD-01 / STAGE-04</div>
          <div style={{ width: 1, height: 14, background: t.line.base }}/>
          <div style={{ fontFamily: TYPE.jp, fontSize: 13, fontWeight: 600 }}>桶狭間</div>
        </div>
        {/* HP */}
        <div style={{ minWidth: 220 }}>
          <Bar label="BASE HP" value={3} max={3} color={t.accent.danger} theme={theme} segs={3} height={12} glow/>
        </div>
        {/* center spacer + wave */}
        <div style={{ display: "flex", justifyContent: "center", gap: 18 }}>
          <KPI label="WAVE" value="2 / 5" theme={theme}/>
          <KPI label="ENEMY" value="14" theme={theme} icon={IconChevronRight}/>
        </div>
        <KPI label="CE" value={32} theme={theme} icon={IconBolt} color={t.accent.warn} size="lg"/>
        <KPI label="TIME" value="01:24" theme={theme} icon={IconClock}/>
        {/* speed */}
        <div style={{ display: "flex", gap: 6 }}>
          <Btn kind="secondary" theme={theme} sm icon={IconPause}>PAUSE</Btn>
          <Btn kind="primary" theme={theme} sm icon={IconFastForward}>×2</Btn>
        </div>
      </div>

      {/* FIELD + RIGHT PANEL */}
      <div style={{ display: "grid", gridTemplateColumns: `${fieldW}px 1fr`, gap: 14, padding: 14 }}>
        <div style={{
          width: fieldW, height: fieldH, position: "relative",
          border: `1px solid ${t.line.strong}`,
          background: t.bg.inset,
          boxShadow: `inset 0 0 0 1px ${t.line.weak}`,
        }}>
          {/* tile grid */}
          <div style={{
            position: "absolute", inset: 0,
            display: "grid", gridTemplateColumns: `repeat(${cols}, ${tile}px)`,
            gridTemplateRows: `repeat(${rows}, ${tile}px)`,
          }}>
            {MAP.flatMap((row, y) => row.map((v, x) => {
              const kind = ["wall","path","obstacle","poison","path_blocked","goal","spawn"][v] || "path";
              const key = `${x},${y}`;
              const active = placing && placing.x===x && placing.y===y;
              const inRange = range.has(key);
              return (
                <Tile key={key} kind={kind} theme={theme} active={active} range={inRange} size={tile}
                  placed={placed[key]}
                  onClick={() => {
                    if (sel == null) return;
                    if (kind === "path" || kind === "path_blocked" || kind === "poison") {
                      setPlacing({ x, y });
                    }
                  }}
                />
              );
            }))}
          </div>
          {/* path indicator (route arrows) */}
          <RouteArrows tile={tile} theme={theme}/>
          {/* direction picker overlay */}
          {placing && sel != null && (
            <DirectionRing x={placing.x} y={placing.y} theme={theme} cls={PALETTE[sel].cls}
              tileSize={tile}
              onPick={(d) => {
                setPlaced({ ...placed, [`${placing.x},${placing.y}`]: { hero: PALETTE[sel], dir: d } });
                setPlacing(null); setSel(null);
              }}
              onCancel={() => setPlacing(null)}
            />
          )}
          {/* coordinate ruler */}
          <Ruler cols={cols} rows={rows} tile={tile} theme={theme}/>
        </div>

        {/* Right info panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Panel title="TARGET" theme={theme} style={{ minHeight: 200 }}>
            {sel != null ? (
              <SelectedHeroInfo hero={PALETTE[sel]} theme={theme}/>
            ) : (
              <div style={{ color: t.ink.tertiary, fontSize: 12 }}>下のパレットから出撃ヒーローを選択</div>
            )}
          </Panel>
          <Panel title="LEGEND" theme={theme}>
            <Legend theme={theme}/>
          </Panel>
          <Btn kind="primary" theme={theme} icon={IconBolt} onClick={fireCutin}
            style={{ justifyContent: "center" }}>
            スキルカットイン プレビュー
          </Btn>
        </div>
      </div>

      {/* BOTTOM HERO PALETTE */}
      <div style={{
        borderTop: `1px solid ${t.line.base}`, background: t.bg.surface,
        padding: "12px 18px", display: "flex", gap: 12, alignItems: "flex-start",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingRight: 14,
          borderRight: `1px solid ${t.line.weak}` }}>
          <div style={{ fontFamily: TYPE.display, fontSize: 9, color: t.ink.tertiary, letterSpacing: ".22em" }}>SQUAD</div>
          <div style={{ fontFamily: TYPE.display, fontSize: 22, fontWeight: 700, color: t.ink.primary,
            fontVariantNumeric: "tabular-nums" }}>3<span style={{ color: t.ink.muted, fontSize: 14 }}> / 8</span></div>
        </div>
        <div style={{ display: "flex", gap: 10, flex: 1, overflowX: "auto" }}>
          {PALETTE.map((h, i) => (
            <HeroToken key={h.id} hero={h} theme={theme}
              selected={sel === i}
              onClick={() => setSel(sel === i ? null : i)}/>
          ))}
        </div>
      </div>

      {/* CUTIN OVERLAY */}
      {cutin && <CutinOverlay theme={theme} hero={cutin}/>}
    </div>
  );
}

// ─── BattleHUD (モバイル縦) ─────────────────────────────
function BattleHUDMobile({ theme, cutin, fireCutin, w = 390 }) {
  const t = theme;
  const tile = Math.floor((w - 24) / 10); // 10cols 範囲内に収まる
  const cols = 10, rows = 8;
  const fieldW = cols * tile, fieldH = rows * tile;
  const [sel, setSel] = bUseState(null);
  const [placing, setPlacing] = bUseState(null);
  const [placed, setPlaced] = bUseState({
    "5,4": { hero: PALETTE[1], dir: "right" },
    "4,4": { hero: PALETTE[0], dir: "right" },
  });
  const range = bUseMemo(() => {
    if (placing && sel != null) {
      const r = rangeFor(PALETTE[sel].cls, placing.x, placing.y);
      return new Set(r.map(([x,y]) => `${x},${y}`));
    }
    return new Set();
  }, [placing, sel]);

  return (
    <div style={{
      width: w, background: t.bg.base, border: `1px solid ${t.line.base}`,
      borderRadius: 4, position: "relative", overflow: "hidden",
      fontFamily: TYPE.jp, color: t.ink.primary,
    }}>
      {/* TOP HUD */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center",
        padding: "8px 12px", borderBottom: `1px solid ${t.line.base}`, background: t.bg.surface,
        gap: 8,
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontFamily: TYPE.display, fontSize: 9, color: t.ink.tertiary,
            letterSpacing: ".22em" }}>W-01 / S-04 桶狭間</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <KPI label="HP" value="3/3" theme={theme} icon={IconHeart} color={t.accent.danger}/>
            <KPI label="CE" value={32} theme={theme} icon={IconBolt} color={t.accent.warn}/>
            <KPI label="TIME" value="01:24" theme={theme}/>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <Btn kind="secondary" theme={theme} sm icon={IconPause}/>
          <Btn kind="primary" theme={theme} sm icon={IconFastForward}>×2</Btn>
        </div>
      </div>
      {/* FIELD */}
      <div style={{ padding: 12, display: "flex", justifyContent: "center" }}>
        <div style={{
          width: fieldW, height: fieldH, position: "relative",
          border: `1px solid ${t.line.strong}`, background: t.bg.inset,
        }}>
          <div style={{
            position: "absolute", inset: 0,
            display: "grid", gridTemplateColumns: `repeat(${cols}, ${tile}px)`,
            gridTemplateRows: `repeat(${rows}, ${tile}px)`,
          }}>
            {MAP.flatMap((row, y) => row.map((v, x) => {
              const kind = ["wall","path","obstacle","poison","path_blocked","goal","spawn"][v] || "path";
              const key = `${x},${y}`;
              const inRange = range.has(key);
              return (
                <Tile key={key} kind={kind} theme={theme} range={inRange} size={tile}
                  placed={placed[key]}
                  onClick={() => {
                    if (sel == null) return;
                    if (["path","path_blocked","poison"].includes(kind)) setPlacing({ x, y });
                  }}/>
              );
            }))}
          </div>
          <RouteArrows tile={tile} theme={theme}/>
          {placing && sel != null && (
            <DirectionRing x={placing.x} y={placing.y} theme={theme} cls={PALETTE[sel].cls}
              tileSize={tile}
              onPick={(d) => {
                setPlaced({ ...placed, [`${placing.x},${placing.y}`]: { hero: PALETTE[sel], dir: d }});
                setPlacing(null); setSel(null);
              }} onCancel={() => setPlacing(null)}/>
          )}
        </div>
      </div>
      {/* PALETTE */}
      <div style={{
        borderTop: `1px solid ${t.line.base}`, background: t.bg.surface,
        padding: "10px 12px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline",
          marginBottom: 6 }}>
          <div style={{ fontFamily: TYPE.display, fontSize: 9, color: t.ink.tertiary,
            letterSpacing: ".22em" }}>SQUAD 2 / 8</div>
          <div onClick={fireCutin} style={{ fontFamily: TYPE.display, fontSize: 9,
            color: t.accent.primary, letterSpacing: ".15em", cursor: "pointer" }}>SKILL DEMO ▸</div>
        </div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {PALETTE.map((h, i) => (
            <HeroToken key={h.id} hero={h} theme={theme} sm
              selected={sel === i}
              onClick={() => setSel(sel === i ? null : i)}/>
          ))}
        </div>
      </div>
      {cutin && <CutinOverlay theme={theme} hero={cutin}/>}
    </div>
  );
}

// ─── Route arrows (経路の流れを示す矢印) ───────────────
function RouteArrows({ tile, theme }) {
  // ハードコードされた経路ヒント (MAP を見ながら主要分岐)
  const arrows = [
    [3, 0, "right"], [7, 0, "down"], [8, 4, "down"], [4, 4, "right"], [1, 6, "right"], [7, 6, "right"], [8, 7, "right"],
  ];
  const t = theme;
  return (
    <>
      {arrows.map(([x,y,dir], i) => {
        const r = { up: -90, right: 0, down: 90, left: 180 }[dir];
        return (
          <svg key={i} width={14} height={14} viewBox="0 0 14 14"
            style={{ position: "absolute", left: x*tile + tile/2 - 7, top: y*tile + tile/2 - 7,
              transform: `rotate(${r}deg)`, color: t.accent.primary, opacity: .55,
              pointerEvents: "none" }}>
            <path d="M2 7h7M7 4l4 3-4 3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="square"/>
          </svg>
        );
      })}
    </>
  );
}

// ─── Ruler (タイル座標) ───────────────────────────────
function Ruler({ cols, rows, tile, theme }) {
  const t = theme;
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, top: -14, height: 12,
        display: "grid", gridTemplateColumns: `repeat(${cols}, ${tile}px)` }}>
        {Array.from({ length: cols }).map((_,i) => (
          <div key={i} style={{ fontFamily: TYPE.display, fontSize: 8, color: t.ink.muted,
            textAlign: "center", letterSpacing: ".05em" }}>{String(i).padStart(2,"0")}</div>
        ))}
      </div>
    </>
  );
}

// ─── Selected hero detail (right panel) ────────────────
function SelectedHeroInfo({ hero, theme }) {
  const c = CLASS_COLORS[hero.cls]; const t = theme;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 4, background: `${c.hex}1F`,
          border: `1px solid ${c.hex}`, display: "grid", placeItems: "center", color: c.hex,
        }}>{React.createElement(CLASS_ICON[hero.cls], { size: 30, stroke: 1.7 })}</div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <RarityChip r={hero.r} size={14}/>
            <span style={{ fontFamily: TYPE.jp, fontSize: 14, fontWeight: 700 }}>{hero.name}</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <Tag color={c.hex} theme={theme} mono>{c.en}</Tag>
            <Tag color={hero.cls === "caster" || hero.cls === "specialist" ? ATTR.INT.hex : ATTR.PHY.hex}
              theme={theme} mono>
              {hero.cls === "caster" || hero.cls === "specialist" ? "INT" : "PHY"}
            </Tag>
          </div>
        </div>
      </div>
      <Bar label="SKILL" value={hero.sp} max={100} color={t.accent.primary} theme={theme}
        glow={hero.sp >= 100}/>
      <div style={{ fontSize: 11, color: t.ink.secondary, lineHeight: 1.5 }}>
        範囲内の敵 1 体に <b style={{ color: t.ink.primary }}>damage×2.4</b>。
        スキル満タンで自動 / タップ発動。
      </div>
    </div>
  );
}

// ─── Legend ────────────────────────────────────────────
function Legend({ theme }) {
  const t = theme;
  const items = [
    { ic: <div style={{ width: 14, height: 14, background: t.bg.surface, border: `1px solid ${t.line.base}` }}/>, l: "床" },
    { ic: <div style={{ width: 14, height: 14, background: t.bg.base,
      backgroundImage: `repeating-linear-gradient(45deg, ${t.line.weak} 0 1px, transparent 1px 4px)` }}/>, l: "壁" },
    { ic: <div style={{ width: 14, height: 14, background: "#0F0F12",
      border: `1px solid ${t.line.strong}`, display:"grid", placeItems:"center" }}>
        <div style={{ width: 4, height: 4, background: t.line.bright, transform:"rotate(45deg)"}}/></div>, l: "障害物" },
    { ic: <div style={{ width: 14, height: 14, background: "#16231C", border: `1px solid #2D5237` }}/>, l: "毒沼" },
    { ic: <div style={{ width: 14, height: 14, background: t.bg.surface,
      backgroundImage: `repeating-linear-gradient(135deg, ${t.accent.danger}33 0 1px, transparent 1px 3px)` }}/>, l: "通行不可" },
    { ic: <IconSpawn size={14} style={{ color: t.accent.danger }}/>, l: "敵スポーン" },
    { ic: <IconGoal size={14} style={{ color: t.accent.warn }}/>, l: "GOAL (BASE)" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 11,
          color: t.ink.secondary, fontFamily: TYPE.jp }}>{it.ic}{it.l}</div>
      ))}
    </div>
  );
}

// ─── Cut-in (中庸: 半画面・キャラ顔+スキル名・効果線) ──
function CutinOverlay({ theme, hero }) {
  const t = theme; const c = CLASS_COLORS[hero.cls];
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 50, pointerEvents: "none",
      animation: "cutinFade 1500ms ease-out forwards",
    }}>
      {/* upper sweep */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "50%",
        background: `linear-gradient(135deg, ${t.bg.base}f0 0%, ${t.bg.base}80 70%, transparent 100%)`,
        clipPath: "polygon(0 0, 100% 0, 100% 80%, 0 100%)",
        animation: "cutinUpper 700ms cubic-bezier(.2,.8,.2,1) forwards",
      }}/>
      {/* lower sweep */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "50%",
        background: `linear-gradient(315deg, ${t.bg.base}f0 0%, ${t.bg.base}80 70%, transparent 100%)`,
        clipPath: "polygon(0 20%, 100% 0, 100% 100%, 0 100%)",
        animation: "cutinLower 700ms cubic-bezier(.2,.8,.2,1) forwards",
      }}/>
      {/* speedlines */}
      <div style={{ position: "absolute", inset: 0, mixBlendMode: "screen", opacity: .6,
        background: `repeating-linear-gradient(105deg, ${c.hex}55 0 1px, transparent 1px 22px)`,
        animation: "cutinLines 700ms linear forwards",
      }}/>
      {/* portrait + name */}
      <div style={{
        position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)",
        display: "flex", alignItems: "center", gap: 18,
        animation: "cutinPop 560ms cubic-bezier(.16,.7,.2,1.05) 100ms both",
      }}>
        <div style={{
          width: 140, height: 140, background: `linear-gradient(180deg, ${c.hex}33, ${t.bg.inset})`,
          border: `2px solid ${c.hex}`, boxShadow: `0 0 40px -4px ${c.hex}`,
          display: "grid", placeItems: "center", color: c.hex,
        }}>
          {React.createElement(CLASS_ICON[hero.cls], { size: 80, stroke: 1.5 })}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, color: t.ink.primary }}>
          <div style={{ fontFamily: TYPE.display, fontSize: 11, color: c.hex, letterSpacing: ".3em" }}>
            SKILL ACTIVATE
          </div>
          <div style={{ fontFamily: TYPE.jp, fontSize: 28, fontWeight: 700,
            textShadow: `0 0 20px ${c.hex}88` }}>{hero.name}</div>
          <div style={{ fontFamily: TYPE.jp, fontSize: 18, color: c.hex, fontWeight: 600,
            letterSpacing: ".05em" }}>『{hero.skill || "傾奇者の槍"}』</div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  BattleHUDDesktop, BattleHUDMobile, CutinOverlay, PALETTE, MAP,
});
