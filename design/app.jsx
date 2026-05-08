// app.jsx — main spec page wrapping all sections

const { useState: aUseState, useEffect: aUseEffect, useMemo: aUseMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "onyx",
  "lang": "ja"
}/*EDITMODE-END*/;

function App() {
  const [tw, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const theme = THEMES[tw.theme] || THEMES.onyx;
  const [cutin, setCutin] = aUseState(null);
  const fireCutin = (hero = PALETTE[0]) => {
    setCutin({ ...hero, skill: "傾奇者の槍" });
    setTimeout(() => setCutin(null), 1500);
  };

  // body bg
  aUseEffect(() => { document.body.style.background = theme.bg.base; }, [theme]);

  return (
    <div style={{
      minHeight: "100vh", background: theme.bg.base, color: theme.ink.primary,
      fontFamily: TYPE.jpBody,
    }}>
      <CoverHero theme={theme}/>
      <Section id="art-direction" theme={theme} num="01" en="ART DIRECTION" jp="アートディレクション">
        <ArtDirectionSection theme={theme}/>
      </Section>
      <Section id="colors" theme={theme} num="02" en="COLOR SYSTEM" jp="カラーシステム">
        <ColorSection theme={theme}/>
      </Section>
      <Section id="type" theme={theme} num="03" en="TYPOGRAPHY" jp="タイポグラフィ">
        <TypeSection theme={theme}/>
      </Section>
      <Section id="icons" theme={theme} num="04" en="ICON VOCABULARY" jp="アイコン語彙">
        <IconSection theme={theme}/>
      </Section>
      <Section id="components" theme={theme} num="05" en="COMPONENTS" jp="コンポーネントキット">
        <ComponentsSection theme={theme}/>
      </Section>
      <Section id="battle" theme={theme} num="06" en="BATTLE HUD" jp="StageScene HUD"
        emphasized note="最重要 — クリックで配置 → 向き選択。攻撃範囲は対象タイルのアウトライン (二重ボーダー)。">
        <BattleSection theme={theme} fireCutin={fireCutin} cutin={cutin}/>
      </Section>
      <Section id="party" theme={theme} num="07" en="PARTY FORMATION" jp="編成画面">
        <PartySection theme={theme}/>
      </Section>
      <Section id="world-stage" theme={theme} num="08" en="WORLD / STAGE SELECT" jp="ワールド / ステージ選択">
        <WorldStageSection theme={theme}/>
      </Section>
      <Section id="cutin" theme={theme} num="09" en="MOTION & EFFECTS" jp="モーション / エフェクト指針">
        <MotionSection theme={theme} fire={fireCutin}/>
      </Section>
      <Section id="appendix" theme={theme} num="10" en="APPENDIX" jp="実装用 HEX / Font 一覧">
        <Appendix theme={theme}/>
      </Section>
      <Footer theme={theme}/>

      {/* Tweaks */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Art Direction" />
        <TweakRadio label="Theme" value={tw.theme}
          options={[
            { value: "onyx",    label: "STEEL ONYX (A)" },
            { value: "sengoku", label: "STEEL SENGOKU (B)" },
          ]}
          onChange={(v) => setTweak("theme", v)} />
        <TweakSection label="Locale" />
        <TweakRadio label="Lang" value={tw.lang}
          options={["ja", "en"]}
          onChange={(v) => setTweak("lang", v)} />
      </TweaksPanel>
    </div>
  );
}

// ─── Cover ─────────────────────────────────────────────
function CoverHero({ theme }) {
  const t = theme;
  return (
    <div style={{
      minHeight: "min(88vh, 800px)", padding: "60px clamp(24px, 6vw, 64px) 80px",
      borderBottom: `1px solid ${t.line.base}`,
      position: "relative", overflow: "hidden",
      background: `radial-gradient(circle at 80% 20%, ${t.accent.primary}10, transparent 50%)`,
    }}>
      {/* grid pattern */}
      <div style={{
        position: "absolute", inset: 0, opacity: .35,
        backgroundImage: `linear-gradient(${t.line.weak} 1px, transparent 1px), linear-gradient(90deg, ${t.line.weak} 1px, transparent 1px)`,
        backgroundSize: "64px 64px", maskImage: "radial-gradient(circle at 70% 30%, black, transparent 70%)",
      }}/>
      <div style={{ position: "relative", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <div style={{ width: 32, height: 32, border: `1.5px solid ${t.accent.primary}`,
            display: "grid", placeItems: "center", color: t.accent.primary }}>
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M3 14V5l5-3 5 3v9" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <path d="M6 14V9h4v5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            </svg>
          </div>
          <div style={{ fontFamily: TYPE.display, fontSize: 11, letterSpacing: ".24em",
            color: t.accent.primary }}>MyCryptoFortress / VISUAL REFRESH SPEC v1</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 60, alignItems: "end" }}>
          <div>
            <div style={{ fontFamily: TYPE.display, fontSize: 13, letterSpacing: ".4em",
              color: t.ink.tertiary, marginBottom: 18 }}>STEEL · TACTICAL · SENGOKU</div>
            <h1 style={{
              fontFamily: TYPE.jp, fontSize: "clamp(40px, 7vw, 88px)", fontWeight: 700,
              lineHeight: 1.05, margin: 0, letterSpacing: "-.01em",
            }}>
              鋼鉄ミニマル<br/>
              <span style={{ color: t.accent.primary }}>戦国タワーディフェンス</span>
            </h1>
            <div style={{ marginTop: 24, fontFamily: TYPE.jpBody, fontSize: 15, lineHeight: 1.7,
              color: t.ink.secondary, maxWidth: 720 }}>
              アークナイツの操作系・情報設計を踏まえた、黒/グレー基調 + 8 職業フル彩度のサブカラーによるリフレッシュ。
              StageScene HUD では「床/壁/障害/毒沼の差」と「攻撃範囲」「向き」を最優先で可読化する。
              ピクセルアートのキャラクタースプライトはそのまま映え、UI のラインは <code style={{
                fontFamily: TYPE.mono, color: t.ink.primary, background: t.bg.surface,
                padding: "1px 5px", borderRadius: 2, fontSize: 13,
              }}>1px hairline</code> 統一で軍事タクティカルの緊張感を出す。
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 200,
            paddingLeft: 24, borderLeft: `1px solid ${t.line.base}` }}>
            {[
              ["TARGET", "Phaser 3 + TypeScript"],
              ["SCREENS", "Battle / Party / World / Stage"],
              ["TILES", "10×8 · 64px base"],
              ["DEVICE", "Mobile 390 + Desktop 1280"],
              ["THEME", t.name],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontFamily: TYPE.display, fontSize: 9,
                  letterSpacing: ".22em", color: t.ink.tertiary }}>{k}</div>
                <div style={{ fontFamily: TYPE.jp, fontSize: 13, fontWeight: 600,
                  color: t.ink.primary }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 48, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            "01. ART DIRECTION", "02. COLOR", "03. TYPE", "04. ICONS",
            "05. COMPONENTS", "06. BATTLE HUD ★", "07. PARTY", "08. WORLD/STAGE",
            "09. MOTION", "10. APPENDIX",
          ].map((x, i) => (
            <a key={i} href={`#${
              ["art-direction","colors","type","icons","components","battle","party","world-stage","cutin","appendix"][i]
            }`} style={{
              fontFamily: TYPE.display, fontSize: 10, letterSpacing: ".18em",
              padding: "6px 10px", border: `1px solid ${t.line.base}`,
              color: x.includes("★") ? t.accent.primary : t.ink.secondary,
              borderColor: x.includes("★") ? t.accent.primary + "55" : t.line.base,
              textDecoration: "none", borderRadius: 2,
              textTransform: "uppercase",
            }}>{x}</a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Section wrapper ───────────────────────────────────
function Section({ id, theme, num, en, jp, note, emphasized, children }) {
  const t = theme;
  return (
    <section id={id} style={{
      padding: "80px clamp(24px, 6vw, 64px) 60px",
      borderBottom: `1px solid ${t.line.base}`,
      background: emphasized ? `linear-gradient(180deg, ${t.bg.surface} 0%, ${t.bg.base} 200px)` : "transparent",
    }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginBottom: 6 }}>
          <div style={{ fontFamily: TYPE.display, fontSize: 12, letterSpacing: ".24em",
            color: t.accent.primary }}>SEC.{num}</div>
          <div style={{ fontFamily: TYPE.display, fontSize: 12, letterSpacing: ".24em",
            color: t.ink.tertiary }}>{en}</div>
        </div>
        <h2 style={{ fontFamily: TYPE.jp, fontSize: 32, fontWeight: 700,
          margin: "0 0 8px", color: t.ink.primary, letterSpacing: "-.005em" }}>{jp}</h2>
        {note && (
          <div style={{ fontFamily: TYPE.jpBody, fontSize: 13, color: t.ink.secondary,
            marginBottom: 28, maxWidth: 800, lineHeight: 1.6 }}>{note}</div>
        )}
        {!note && <div style={{ marginBottom: 32 }}/>}
        {children}
      </div>
    </section>
  );
}

// ─── 01. Art Direction ─────────────────────────────────
function ArtDirectionSection({ theme }) {
  const t = theme;
  const principles = [
    { mono: "MINIMAL", jp: "情報の階層を声色で語らせる", body: "装飾は最小化。重み・色温・スペーシングだけでヒエラルキーを作る。" },
    { mono: "TACTICAL", jp: "1px hairline と直角コーナー", body: "角丸は 0–4px に抑制。軍事 UI 的な精密感を維持し、ピクセルアートの輪郭線と衝突させない。" },
    { mono: "PIXEL-FRIENDLY", jp: "ヒーロー/敵スプライトを最大に映す", body: "背景は 8% 以下の彩度。アクセント色はゲージ・カットイン・配置中の枠など能動的な瞬間にだけ。" },
    { mono: "CLARITY", jp: "床と壁が一目でわかる", body: "壁は斜線パターン + 暗値、床は均質サーフェス、毒沼は緑被ノイズ、通行不可は赤斜線。" },
    { mono: "FAST FEEDBACK", jp: "120ms / 200ms / 320ms 三段階", body: "ホバー 120ms / 配置 200ms / カットイン 560ms。すべて cubic-bezier(.2,0,.2,1) を主旋律に。" },
    { mono: "WORLD ECHO", jp: "戦国 → 三国志 → 西洋 を切替えても色構造が崩れない", body: "ベース 2 色 + 8 職業 + 1 アクセント の構造はワールド共通。ワールドのキーカラーは Banner にのみ宿る。" },
  ];
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16,
        marginBottom: 32 }}>
        {principles.map((p, i) => (
          <div key={i} style={{
            padding: 18, background: t.bg.surface, border: `1px solid ${t.line.base}`,
            borderLeft: `2px solid ${t.accent.primary}`, borderRadius: 2,
          }}>
            <div style={{ fontFamily: TYPE.display, fontSize: 10, letterSpacing: ".22em",
              color: t.accent.primary }}>0{i+1} · {p.mono}</div>
            <div style={{ fontFamily: TYPE.jp, fontSize: 16, fontWeight: 700, color: t.ink.primary,
              margin: "6px 0 6px" }}>{p.jp}</div>
            <div style={{ fontSize: 12, color: t.ink.secondary, lineHeight: 1.6 }}>{p.body}</div>
          </div>
        ))}
      </div>
      {/* A vs B */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
        {[THEME_ONYX, THEME_SENGOKU].map((th, i) => (
          <div key={th.id} style={{
            padding: 18, border: `1px solid ${t.line.base}`, background: t.bg.surface, borderRadius: 2,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ fontFamily: TYPE.display, fontSize: 11, letterSpacing: ".22em",
                color: t.ink.tertiary }}>OPTION {String.fromCharCode(65+i)}</div>
              {tw_currentMatch(th, theme) && (
                <span style={{ fontFamily: TYPE.display, fontSize: 9, padding: "2px 6px",
                  background: t.accent.primary, color: t.ink.inverse, letterSpacing: ".15em" }}>SHOWING</span>
              )}
            </div>
            <div style={{ fontFamily: TYPE.display, fontSize: 18, fontWeight: 700, color: th.accent.primary,
              letterSpacing: ".05em", marginBottom: 6 }}>{th.name}</div>
            <div style={{ fontSize: 12, color: t.ink.secondary, marginBottom: 14, lineHeight: 1.6 }}>
              {th.tagline}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {[th.bg.base, th.bg.surface, th.bg.raised, th.line.base, th.ink.primary,
                th.accent.primary, th.accent.warn].map((c, j) => (
                <div key={j} style={{ flex: 1, height: 36, background: c,
                  border: `1px solid ${t.line.weak}` }}/>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 20, padding: 14, border: `1px dashed ${t.line.base}`, fontSize: 12,
        color: t.ink.secondary, lineHeight: 1.7, fontFamily: TYPE.jpBody }}>
        <b style={{ color: t.ink.primary }}>切替方法:</b> 右下の Tweaks パネルから A / B を切替。
        どちらも同じトークン構造を共有しており、Phaser 側の <code style={{ fontFamily: TYPE.mono,
          color: t.ink.primary }}>setFillStyle(0xRRGGBB)</code> 用に HEX 値の差分のみで運用できる。
      </div>
    </div>
  );
}
function tw_currentMatch(th, current) { return th.id === current.id; }

// ─── 02. Color ─────────────────────────────────────────
function ColorSection({ theme }) {
  const t = theme;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <Group title="BACKGROUND / SURFACE" theme={theme}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {Object.entries(t.bg).map(([k, v]) => (
            <Swatch key={k} hex={v} label={`bg.${k}`} sub={k === "base" ? "Phaser canvas" : ""} theme={theme}/>
          ))}
        </div>
      </Group>
      <Group title="LINE / BORDER" theme={theme}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {Object.entries(t.line).map(([k, v]) => (
            <Swatch key={k} hex={v} label={`line.${k}`} theme={theme}/>
          ))}
        </div>
      </Group>
      <Group title="INK / TEXT" theme={theme}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {Object.entries(t.ink).map(([k, v]) => (
            <Swatch key={k} hex={v} label={`ink.${k}`} theme={theme}/>
          ))}
        </div>
      </Group>
      <Group title="ACCENT (System)" theme={theme}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {Object.entries(t.accent).map(([k, v]) => (
            <Swatch key={k} hex={v} label={`accent.${k}`}
              sub={ ({ primary: "選択/満タン", warn: "CE/警告", danger: "HP/死亡", success: "クリア/回復"})[k] || "" }
              theme={theme}/>
          ))}
        </div>
      </Group>
      <Group title="CLASS COLORS (8 職業)" theme={theme}
        sub="フル彩度。タイル配置時のオーラ・パレット枠・タグに使用。背景は #14181F (1F が乗っても 4.5:1 を超える設計)">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          {CLASS_ORDER.map(cl => {
            const c = CLASS_COLORS[cl];
            return (
              <div key={cl} style={{ display: "flex", alignItems: "center", gap: 12,
                padding: 10, background: t.bg.surface, border: `1px solid ${t.line.base}`,
                borderLeft: `3px solid ${c.hex}`, borderRadius: 2 }}>
                <div style={{ width: 36, height: 36, background: `${c.hex}1F`,
                  border: `1px solid ${c.hex}`, color: c.hex,
                  display: "grid", placeItems: "center" }}>
                  {React.createElement(CLASS_ICON[cl], { size: 22, stroke: 1.7 })}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: TYPE.jp, fontSize: 12, fontWeight: 700, color: t.ink.primary }}>
                    {c.name}<span style={{ color: t.ink.tertiary, fontWeight: 400, marginLeft: 6,
                      fontFamily: TYPE.display, fontSize: 9, letterSpacing: ".18em" }}>{c.en}</span>
                  </div>
                  <div style={{ fontFamily: TYPE.display, fontSize: 10, color: t.ink.tertiary,
                    letterSpacing: ".06em" }}>{c.hex}</div>
                  <div style={{ fontSize: 10, color: t.ink.muted }}>{c.role}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Group>
      <Group title="RARITY / ATTR" theme={theme}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {Object.entries(RARITY).map(([k, v]) => (
            <Swatch key={k} hex={v.hex} label={`rarity.${k}`} sub={v.name} theme={theme}/>
          ))}
          {Object.entries(ATTR).map(([k, v]) => (
            <Swatch key={k} hex={v.hex} label={`attr.${k}`} theme={theme}/>
          ))}
        </div>
      </Group>
      <Group title="TILE FILL / LINE" theme={theme}
        sub="setFillStyle(0xRRGGBB) で直接指定する想定。床/壁の差は背景パターン (斜線) でも強化。">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
          {Object.entries(TILE).map(([k, v]) => (
            <div key={k} style={{ background: t.bg.surface, border: `1px solid ${t.line.base}`, borderRadius: 2 }}>
              <div style={{ height: 64, background: v.fill, border: `1px solid ${v.line}` }}/>
              <div style={{ padding: 8 }}>
                <div style={{ fontFamily: TYPE.display, fontSize: 10, color: t.ink.tertiary,
                  letterSpacing: ".18em" }}>{k.toUpperCase()}</div>
                <div style={{ fontFamily: TYPE.jp, fontSize: 11, color: t.ink.primary }}>{v.label}</div>
                <div style={{ fontFamily: TYPE.display, fontSize: 10, color: t.ink.muted, marginTop: 2 }}>
                  fill {v.fill} · line {v.line}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Group>
    </div>
  );
}
function Group({ title, sub, theme, children }) {
  const t = theme;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
        <div style={{ fontFamily: TYPE.display, fontSize: 11, letterSpacing: ".22em",
          color: t.accent.primary }}>{title}</div>
        {sub && <div style={{ fontFamily: TYPE.jp, fontSize: 11, color: t.ink.tertiary, lineHeight: 1.5 }}>
          {sub}
        </div>}
      </div>
      {children}
    </div>
  );
}

// ─── 03. Type ─────────────────────────────────────────
function TypeSection({ theme }) {
  const t = theme;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14,
        marginBottom: 24 }}>
        <FontCard theme={theme} family="Zen Kaku Gothic New" stack={TYPE.jp}
          role="JP DISPLAY / 見出し" sample="鋼鉄の戦場" sample2="桶狭間 / 編成 / 出撃" weights="500 / 700"
          source="Google Fonts"/>
        <FontCard theme={theme} family="Noto Sans JP" stack={TYPE.jpBody}
          role="JP BODY / 本文" sample="範囲内の敵 1 体に ×2.4 ダメージ。" sample2="スキルゲージ最大時、自動 / タップで発動。"
          weights="400 / 500 / 600" source="Google Fonts"/>
        <FontCard theme={theme} family="Orbitron" stack={TYPE.display}
          role="DISPLAY / HUD 数値" sample="1024 / 32 / 01:24" sample2="WORLD-01 / STAGE-04"
          weights="500 / 700 / 800" source="Google Fonts" mono/>
        <FontCard theme={theme} family="JetBrains Mono" stack={TYPE.mono}
          role="MONO / コード・座標" sample="setFillStyle(0x0A0C10)" sample2="tile [04, 03] · path"
          weights="400 / 500 / 700" source="Google Fonts" mono/>
      </div>
      <div style={{ background: t.bg.surface, border: `1px solid ${t.line.base}`, borderRadius: 2 }}>
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${t.line.weak}`,
          fontFamily: TYPE.display, fontSize: 11, letterSpacing: ".22em", color: t.accent.primary }}>
          SCALE
        </div>
        {Object.entries(TYPE.scale).map(([k, v]) => (
          <div key={k} style={{
            display: "grid", gridTemplateColumns: "80px 80px 60px 1fr 200px",
            gap: 14, alignItems: "center",
            padding: "12px 14px", borderBottom: `1px solid ${t.line.weak}`,
          }}>
            <div style={{ fontFamily: TYPE.display, fontSize: 10, letterSpacing: ".18em",
              color: t.accent.primary }}>{k.toUpperCase()}</div>
            <div style={{ fontFamily: TYPE.mono, fontSize: 11, color: t.ink.tertiary }}>
              {v.px}px / {v.lh}
            </div>
            <div style={{ fontFamily: TYPE.mono, fontSize: 11, color: t.ink.tertiary }}>w {v.w}</div>
            <div style={{
              fontFamily: k === "hud" || k === "hudL" || k === "badge" ? TYPE.display : TYPE.jp,
              fontSize: v.px, fontWeight: v.w, lineHeight: v.lh,
              color: t.ink.primary,
              letterSpacing: k === "badge" ? ".15em" : "normal",
              textTransform: k === "badge" ? "uppercase" : "none",
              fontVariantNumeric: "tabular-nums",
            }}>
              {k === "hud" || k === "hudL" ? "01:24 · CE 32"
                : k === "badge" ? "PHY · INT"
                : k === "h1" ? "鋼鉄の戦場"
                : k === "h2" ? "編成スロット"
                : k === "h3" ? "前田慶次"
                : k === "body" ? "範囲内の敵 1 体に ×2.4 ダメージ"
                : k === "small" ? "スキルゲージ満タン"
                : "WORLD-01 / STAGE-04"}
            </div>
            <div style={{ fontFamily: TYPE.jp, fontSize: 11, color: t.ink.tertiary, lineHeight: 1.4 }}>
              {v.use}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function FontCard({ theme, family, stack, role, sample, sample2, weights, source, mono }) {
  const t = theme;
  return (
    <div style={{ padding: 16, background: t.bg.surface, border: `1px solid ${t.line.base}`, borderRadius: 2 }}>
      <div style={{ fontFamily: TYPE.display, fontSize: 10, letterSpacing: ".22em",
        color: t.accent.primary, marginBottom: 4 }}>{role}</div>
      <div style={{ fontFamily: stack, fontSize: 22, fontWeight: 700, color: t.ink.primary,
        marginBottom: 4 }}>{family}</div>
      <div style={{ fontFamily: TYPE.mono, fontSize: 10, color: t.ink.tertiary, marginBottom: 14 }}>
        {source}  ·  {weights}
      </div>
      <div style={{ fontFamily: stack, fontSize: 24, fontWeight: 700, color: t.ink.primary,
        letterSpacing: mono ? ".05em" : "normal" }}>{sample}</div>
      <div style={{ fontFamily: stack, fontSize: 13, color: t.ink.secondary, marginTop: 6,
        lineHeight: 1.55 }}>{sample2}</div>
    </div>
  );
}

// ─── 04. Icons ─────────────────────────────────────────
function IconSection({ theme }) {
  const t = theme;
  return (
    <div>
      <Group title="CLASS ICONS · 8 職業 (SVG / 1.5 stroke)" theme={theme}
        sub="currentColor 駆動。Tile/Token/Tag いずれも単一ファイルで運用可。Phaser へは SVG文字列のまま wrap して使う想定。">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
          {CLASS_ORDER.map(cl => {
            const c = CLASS_COLORS[cl];
            return (
              <div key={cl} style={{ background: t.bg.surface, border: `1px solid ${t.line.base}`,
                borderRadius: 2, padding: 12, display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
                  <div style={{ color: t.ink.secondary }}>
                    {React.createElement(CLASS_ICON[cl], { size: 28, stroke: 1.5 })}
                  </div>
                  <div style={{ color: c.hex, padding: "4px 6px", border: `1px solid ${c.hex}55`,
                    background: `${c.hex}1F` }}>
                    {React.createElement(CLASS_ICON[cl], { size: 22, stroke: 1.7 })}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: TYPE.jp, fontSize: 13, fontWeight: 700, color: t.ink.primary }}>{c.name}</div>
                  <div style={{ fontFamily: TYPE.display, fontSize: 9, letterSpacing: ".22em",
                    color: c.hex, marginTop: 2 }}>{c.en}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Group>
      <div style={{ height: 24 }}/>
      <Group title="STATE / MAP ICONS" theme={theme}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
          {[
            ["check", IconCheck, "編成済 / クリア", t.accent.success],
            ["blocked", IconBlocked, "配置不可"],
            ["poison", IconPoison, "毒沼"],
            ["wall", IconWall, "壁"],
            ["path", IconPath, "床 / 通行可"],
            ["obstacle", IconObstacle, "障害物"],
            ["bolt", IconBolt, "CE / スキル", t.accent.warn],
            ["heart", IconHeart, "BASE HP", t.accent.danger],
            ["clock", IconClock, "経過時間"],
            ["goal", IconGoal, "GOAL / BASE", t.accent.warn],
            ["spawn", IconSpawn, "敵スポーン", t.accent.danger],
            ["fast", IconFastForward, "倍速", t.accent.primary],
            ["pause", IconPause, "一時停止"],
            ["lock", IconLock, "ロック"],
          ].map(([k, I, name, col]) => (
            <div key={k} style={{ background: t.bg.surface, border: `1px solid ${t.line.base}`,
              borderRadius: 2, padding: 10, display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ width: 36, height: 36, display: "grid", placeItems: "center",
                background: t.bg.inset, border: `1px solid ${t.line.weak}`,
                color: col || t.ink.secondary }}>
                {React.createElement(I, { size: 20 })}
              </div>
              <div>
                <div style={{ fontFamily: TYPE.jp, fontSize: 11, color: t.ink.primary }}>{name}</div>
                <div style={{ fontFamily: TYPE.mono, fontSize: 9, color: t.ink.tertiary }}>{k}</div>
              </div>
            </div>
          ))}
        </div>
      </Group>
    </div>
  );
}

// ─── 05. Components ───────────────────────────────────
function ComponentsSection({ theme }) {
  const t = theme;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <Group title="BUTTONS" theme={theme}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn kind="primary" theme={theme} icon={IconBolt}>OUTPUT 出撃</Btn>
          <Btn kind="secondary" theme={theme}>キャンセル</Btn>
          <Btn kind="ghost" theme={theme}>戻る</Btn>
          <Btn kind="destructive" theme={theme}>降参</Btn>
          <Btn kind="primary" theme={theme} disabled>無効</Btn>
          <Btn kind="primary" theme={theme} sm icon={IconFastForward}>×2</Btn>
          <Btn kind="secondary" theme={theme} sm icon={IconPause}>PAUSE</Btn>
        </div>
      </Group>
      <Group title="GAUGES / KPI" theme={theme}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          <div style={{ padding: 14, background: t.bg.surface, border: `1px solid ${t.line.base}` }}>
            <Bar label="BASE HP" value={3} max={3} color={t.accent.danger} theme={theme} segs={3} height={12} glow/>
          </div>
          <div style={{ padding: 14, background: t.bg.surface, border: `1px solid ${t.line.base}` }}>
            <Bar label="SKILL" value={100} max={100} color={t.accent.primary} theme={theme} glow height={10}/>
          </div>
          <div style={{ padding: 14, background: t.bg.surface, border: `1px solid ${t.line.base}`,
            display: "flex", gap: 18 }}>
            <KPI label="CE" value={32} icon={IconBolt} color={t.accent.warn} theme={theme} size="lg"/>
            <KPI label="HP" value="3/3" icon={IconHeart} color={t.accent.danger} theme={theme}/>
            <KPI label="TIME" value="01:24" icon={IconClock} theme={theme}/>
          </div>
        </div>
      </Group>
      <Group title="CHIPS / TAGS / SLOTS" theme={theme}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {CLASS_ORDER.map(cl => <ClassChip key={cl} id={cl}/>)}
          </div>
          <div style={{ width: 1, height: 36, background: t.line.base }}/>
          <div style={{ display: "flex", gap: 6 }}>
            <RarityChip r="C"/>
            <RarityChip r="U"/>
          </div>
          <div style={{ width: 1, height: 36, background: t.line.base }}/>
          <div style={{ display: "flex", gap: 6 }}>
            <Tag color={ATTR.PHY.hex} theme={theme} mono>PHY</Tag>
            <Tag color={ATTR.INT.hex} theme={theme} mono>INT</Tag>
            <Tag color={t.accent.success} theme={theme} mono>CLEARED</Tag>
            <Tag color={t.accent.warn} theme={theme} mono>HARD</Tag>
            <Tag color={t.accent.danger} theme={theme} mono>NIGHTMARE</Tag>
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 18 }}>
          <Slot hero={null} idx={0} theme={theme} state="empty"/>
          <Slot hero={ROSTER[0]} idx={1} theme={theme} state="filled"/>
          <Slot hero={ROSTER[1]} idx={2} theme={theme} state="focused"/>
        </div>
      </Group>
      <Group title="HERO CARD (Roster)" theme={theme}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <HeroCard hero={ROSTER[0]} theme={theme} state="idle"/>
          <HeroCard hero={ROSTER[2]} theme={theme} state="focused"/>
          <HeroCard hero={ROSTER[5]} theme={theme} state="placed"/>
          <HeroCard hero={ROSTER[6]} theme={theme} state="disabled"/>
        </div>
        <div style={{ display: "flex", gap: 24, marginTop: 8, fontFamily: TYPE.display, fontSize: 9,
          color: t.ink.tertiary, letterSpacing: ".22em" }}>
          <span>IDLE</span><span style={{ marginLeft: 60 }}>FOCUSED</span><span style={{ marginLeft: 60 }}>PLACED</span><span style={{ marginLeft: 50 }}>DISABLED</span>
        </div>
      </Group>
      <Group title="SHAPE / SHADOW / RADIUS" theme={theme}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {[2,4,6,10].map(r => (
            <div key={r} style={{ width: 100, height: 64, background: t.bg.surface,
              border: `1px solid ${t.line.base}`, borderRadius: r,
              display: "grid", placeItems: "center",
              fontFamily: TYPE.display, fontSize: 11, color: t.ink.secondary }}>
              radius {r}
            </div>
          ))}
          <div style={{ width: 100, height: 64, background: t.bg.surface,
            border: `1px solid ${t.line.base}`,
            boxShadow: SHAPE.shadow.card,
            display: "grid", placeItems: "center",
            fontFamily: TYPE.display, fontSize: 10, color: t.ink.secondary }}>shadow.card</div>
          <div style={{ width: 100, height: 64, background: t.bg.surface,
            border: `1px solid ${t.accent.primary}`,
            boxShadow: SHAPE.shadow.glow(t.accent.primary),
            display: "grid", placeItems: "center",
            fontFamily: TYPE.display, fontSize: 10, color: t.accent.primary }}>shadow.glow</div>
        </div>
      </Group>
    </div>
  );
}

// ─── 06. Battle ────────────────────────────────────────
function BattleSection({ theme, fireCutin, cutin }) {
  const t = theme;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <DeviceFrame theme={theme} label="DESKTOP — 1280×800 (HUD width 980)">
        <BattleHUDDesktop theme={theme} fireCutin={() => fireCutin(PALETTE[0])} cutin={cutin}/>
      </DeviceFrame>
      <DeviceFrame theme={theme} label="MOBILE — 390×844 portrait">
        <BattleHUDMobile theme={theme} fireCutin={() => fireCutin(PALETTE[4])} cutin={cutin} w={390}/>
      </DeviceFrame>
      <BattleNotes theme={theme}/>
    </div>
  );
}
function BattleNotes({ theme }) {
  const t = theme;
  const notes = [
    ["床と壁の差", "壁: bg.base + 斜線 (45deg, 1/7px) + 暗い枠 / 床: bg.surface + 細枠 / 障害物: 角 90° 反転ダイヤアイコン+暗値ボックス / 毒沼: 緑被ノイズ + 緑枠 + 角ピクトグラム / 通行不可: 赤斜線 (135deg)。色だけでなくパターンで差をつけ、色弱でも判別可。"],
    ["攻撃範囲表示", "対象タイル群を accent.primary の outline (offset -2) で囲み、塗りはかぶせない (床/壁の判別を保つ)。配置中のタイルは border が accent.primary に同期。"],
    ["向き選択", "配置タイルを暗幕 0.55 で囲み、上下左右 4 方向に矢印トークン (36px / 職業色枠) を出す。タップで向き確定→ヒーロー設置。タップ外で取り消し。"],
    ["ヒーロー配置", "タイル中央に職業アイコン + 下端に HP バー (2px) + 右上に向き三角。色は職業色のグラデ (33→10) + 1px 枠。"],
    ["パレット (出撃可能)", "下部スクロール。スキル満タン時はトークンに accent.primary のリングがパルス (1.4s)。CE 不足のヒーローは opacity .4 + cursor not-allowed。"],
    ["上部 KPI", "BASE HP は 3 セグメントのバー (segs=3) + 左に heart アイコン。CE は数値強調 (display 26px) + warn 色。TIME は等幅・モノクロ。倍速ボタンは primary。"],
    ["敵 GOAL 到達警告", "Goal タイル (accent.warn) が 0.8s で 2 回フラッシュ + 画面四隅に 12px の warn 色フレーム + 2 段の DANGER テロップ (Orbitron 800)。"],
    ["タイル座標補助", "上端に 00–09 の極小ラベル (Orbitron 8px / muted)。デバッグだけでなく説明書き互換のため常時表示可。"],
  ];
  return (
    <div style={{ background: t.bg.surface, border: `1px solid ${t.line.base}` }}>
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${t.line.weak}`,
        fontFamily: TYPE.display, fontSize: 11, letterSpacing: ".22em", color: t.accent.primary }}>
        BATTLE HUD — DESIGN NOTES
      </div>
      <div>
        {notes.map(([k, v], i) => (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "200px 1fr", gap: 16,
            padding: "12px 16px", borderBottom: i < notes.length - 1 ? `1px solid ${t.line.weak}` : "none",
          }}>
            <div style={{ fontFamily: TYPE.jp, fontSize: 13, fontWeight: 700, color: t.ink.primary }}>{k}</div>
            <div style={{ fontSize: 12, color: t.ink.secondary, lineHeight: 1.65, fontFamily: TYPE.jpBody }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 07. Party ─────────────────────────────────────────
function PartySection({ theme }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <DeviceFrame theme={theme} label="DESKTOP — 1100 wide">
        <PartyFormation theme={theme} w={1100}/>
      </DeviceFrame>
      <DeviceFrame theme={theme} label="MOBILE — 390 portrait (column stack)">
        <PartyFormation theme={theme} w={390} mobile/>
      </DeviceFrame>
    </div>
  );
}

// ─── 08. World/Stage ───────────────────────────────────
function WorldStageSection({ theme }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 20 }}>
      <DeviceFrame theme={theme} label="WORLD — Mobile">
        <WorldSelect theme={theme} w={390} mobile/>
      </DeviceFrame>
      <DeviceFrame theme={theme} label="STAGE — Mobile">
        <StageSelect theme={theme} w={390} mobile/>
      </DeviceFrame>
      <DeviceFrame theme={theme} label="WORLD — Desktop">
        <WorldSelect theme={theme} w={760}/>
      </DeviceFrame>
      <DeviceFrame theme={theme} label="STAGE — Desktop">
        <StageSelect theme={theme} w={760}/>
      </DeviceFrame>
    </div>
  );
}

// ─── 09. Motion ────────────────────────────────────────
function MotionSection({ theme, fire }) {
  const t = theme;
  const motions = [
    ["120ms / hover", "border + boxShadow / cubic-bezier(.2,0,.2,1) / 全インタラクティブ要素"],
    ["200ms / select", "ヒーロー選択時のリフトアップ (translateY -4) と発光"],
    ["320ms / value", "HP/SP バーの伸縮、CE カウンタ"],
    ["560ms / cutin", "上下クリップパス sweep + スピードライン + ポートレート pop-in (cubic-bezier(.16,.7,.2,1.05))"],
    ["pulse 1.4s ∞", "スキル満タンの呼吸リング (transform scale 1 ↔ 1.06, opacity 1 ↔ .4)"],
    ["flash 0.8s × 2", "Goal 到達警告のフレームフラッシュ (warn 色)"],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 20 }}>
      <div style={{ background: t.bg.surface, border: `1px solid ${t.line.base}` }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${t.line.weak}`,
          fontFamily: TYPE.display, fontSize: 11, letterSpacing: ".22em", color: t.accent.primary }}>
          DURATION / EASING
        </div>
        {motions.map(([k, v], i) => (
          <div key={i} style={{
            padding: "10px 16px", borderBottom: i < motions.length - 1 ? `1px solid ${t.line.weak}` : "none",
            display: "grid", gridTemplateColumns: "140px 1fr", gap: 12, alignItems: "center",
          }}>
            <div style={{ fontFamily: TYPE.display, fontSize: 11, color: t.accent.primary,
              letterSpacing: ".15em" }}>{k}</div>
            <div style={{ fontSize: 11, color: t.ink.secondary, lineHeight: 1.5 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ background: t.bg.surface, border: `1px solid ${t.line.base}`,
        display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${t.line.weak}`,
          fontFamily: TYPE.display, fontSize: 11, letterSpacing: ".22em", color: t.accent.primary,
          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>SKILL CUT-IN PREVIEW</span>
          <Btn kind="primary" theme={theme} sm icon={IconBolt} onClick={fire}>RUN</Btn>
        </div>
        <div style={{ flex: 1, padding: 16, position: "relative", minHeight: 280 }}>
          <CutinStage theme={theme}/>
        </div>
        <div style={{ padding: 14, borderTop: `1px solid ${t.line.weak}`, fontSize: 11,
          color: t.ink.tertiary, lineHeight: 1.6, fontFamily: TYPE.jpBody }}>
          中庸モード: 半画面の二重 sweep (上は左から、下は右から) + 105° のスピードライン (mix-blend-mode: screen) + 中央にキャラ顔+スキル名。総尺 1.5s。
        </div>
      </div>
    </div>
  );
}
function CutinStage({ theme }) {
  const t = theme;
  const [hero, setHero] = aUseState(null);
  const fire = (h) => {
    setHero({ ...h, skill: { vanguard: "傾奇者の槍", caster: "三本の矢", sniper: "薩摩示現流" }[h.cls] || "発動" });
    setTimeout(() => setHero(null), 1500);
  };
  return (
    <div style={{ position: "relative", width: "100%", height: 240,
      background: t.bg.inset, border: `1px solid ${t.line.weak}`, overflow: "hidden" }}>
      {!hero && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {[PALETTE[0], PALETTE[2], PALETTE[5]].map(h => (
              <button key={h.id} onClick={() => fire(h)} style={{
                appearance: "none", background: "transparent",
                border: `1px solid ${CLASS_COLORS[h.cls].hex}55`,
                color: CLASS_COLORS[h.cls].hex, padding: "6px 12px",
                fontFamily: TYPE.jp, fontSize: 12, fontWeight: 600,
                cursor: "pointer", borderRadius: 2,
                display: "inline-flex", alignItems: "center", gap: 6,
              }}>
                {React.createElement(CLASS_ICON[h.cls], { size: 14, stroke: 1.7 })}
                {h.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {hero && <CutinOverlay theme={theme} hero={hero}/>}
    </div>
  );
}

// ─── 10. Appendix ──────────────────────────────────────
function Appendix({ theme }) {
  const t = theme;
  const lines = [
    `// === MyCryptoFortress · ${theme.name} ===`,
    `// Phaser: setFillStyle(0xRRGGBB) で直接利用可`,
    ``,
    `// BACKGROUND`,
    ...Object.entries(t.bg).map(([k, v]) => `bg.${k.padEnd(8)} = ${v}  // 0x${v.slice(1)}`),
    ``,
    `// LINE`,
    ...Object.entries(t.line).map(([k, v]) => `line.${k.padEnd(7)} = ${v}  // 0x${v.slice(1)}`),
    ``,
    `// INK`,
    ...Object.entries(t.ink).map(([k, v]) => `ink.${k.padEnd(9)} = ${v}  // 0x${v.slice(1)}`),
    ``,
    `// ACCENT`,
    ...Object.entries(t.accent).map(([k, v]) => `accent.${k.padEnd(9)} = ${v}  // 0x${v.slice(1)}`),
    ``,
    `// CLASS COLORS (8職業)`,
    ...CLASS_ORDER.map(cl => `class.${cl.padEnd(11)} = ${CLASS_COLORS[cl].hex}  // 0x${CLASS_COLORS[cl].hex.slice(1)}  (${CLASS_COLORS[cl].name} ${CLASS_COLORS[cl].en})`),
    ``,
    `// RARITY`,
    ...Object.entries(RARITY).map(([k, v]) => `rarity.${k} = ${v.hex}  // 0x${v.hex.slice(1)}  (${v.name})`),
    ``,
    `// ATTR`,
    ...Object.entries(ATTR).map(([k, v]) => `attr.${k}   = ${v.hex}  // 0x${v.hex.slice(1)}`),
    ``,
    `// TILE`,
    ...Object.entries(TILE).flatMap(([k, v]) => [
      `tile.${k.padEnd(13)}.fill = ${v.fill}  // 0x${v.fill.slice(1)}`,
      `tile.${k.padEnd(13)}.line = ${v.line}  // 0x${v.line.slice(1)}`,
    ]),
    ``,
    `// FONTS (Google Fonts URL に対応)`,
    `font.display = ${TYPE.display}`,
    `font.mono    = ${TYPE.mono}`,
    `font.jpHead  = ${TYPE.jp}`,
    `font.jpBody  = ${TYPE.jpBody}`,
    ``,
    `// TYPE SCALE`,
    ...Object.entries(TYPE.scale).map(([k, v]) => `type.${k.padEnd(8)} = ${v.px}px / ${v.lh} / w${v.w}   ${v.use}`),
    ``,
    `// MOTION`,
    `motion.fast  = 120ms cubic-bezier(.2,0,.2,1)`,
    `motion.base  = 200ms cubic-bezier(.2,0,.2,1)`,
    `motion.slow  = 320ms cubic-bezier(.2,0,.2,1)`,
    `motion.cutin = 560ms cubic-bezier(.16,.7,.2,1.05)`,
  ];
  const text = lines.join("\n");
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Btn kind="primary" theme={theme} icon={IconBolt}
          onClick={() => navigator.clipboard.writeText(text)}>クリップボードへコピー</Btn>
        <Btn kind="secondary" theme={theme}
          onClick={() => {
            const blob = new Blob([text], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `mcf-tokens-${theme.id}.txt`;
            document.body.appendChild(a); a.click(); a.remove();
          }}>tokens.txt を保存</Btn>
      </div>
      <pre style={{
        margin: 0, padding: 18, background: t.bg.surface, border: `1px solid ${t.line.base}`,
        borderRadius: 2, fontFamily: TYPE.mono, fontSize: 11, lineHeight: 1.65,
        color: t.ink.secondary, overflow: "auto", maxHeight: 540,
      }}>{text}</pre>
    </div>
  );
}

// ─── Footer ────────────────────────────────────────────
function Footer({ theme }) {
  const t = theme;
  return (
    <footer style={{
      padding: "28px clamp(24px, 6vw, 64px)", borderTop: `1px solid ${t.line.base}`,
      background: t.bg.surface,
      display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10,
    }}>
      <div style={{ fontFamily: TYPE.display, fontSize: 10, letterSpacing: ".22em",
        color: t.ink.tertiary }}>MYCRYPTOFORTRESS · VISUAL REFRESH SPEC v1 · {theme.name}</div>
      <div style={{ fontFamily: TYPE.jp, fontSize: 11, color: t.ink.muted }}>
        実装メモは「APPENDIX」を参照。HEX 値は theme A/B 切替で書き換わります。
      </div>
    </footer>
  );
}

// ─── DeviceFrame wrapper ───────────────────────────────
function DeviceFrame({ theme, label, children }) {
  const t = theme;
  return (
    <div>
      <div style={{ fontFamily: TYPE.display, fontSize: 10, letterSpacing: ".22em",
        color: t.ink.tertiary, marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", justifyContent: "flex-start" }}>{children}</div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
