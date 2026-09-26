import Phaser from "phaser";
import { ENEMIES } from "../../data/balance/enemies";
import { ROLES } from "../../data/balance/heroes";
import { getAsset } from "../../data/assets";
import { getLevel } from "../../data/levels";
import { DIALOGS, maycriComment } from "../../data/dialogs";
import { applyRunResult, computeModifiers, computeReward, hasSeen, markSeen } from "../../meta/progress";
import { RunSim, TARGET_MODES, TICK, type SimEvent } from "../../sim/run";
import { queueAsset } from "../assetLoader";
import { playBgm, playSe } from "../audio";
import { bindPress } from "../input/press";
import { CENTER_X, GAME_HEIGHT, GAME_WIDTH } from "../layout";
import { BOARD_BOTTOM, BOARD_TOP, BoardView, CELL, toCell } from "../run/board";
import { Hud } from "../run/hud";
import { Panel, TARGET_LABEL } from "../run/panel";
import { session } from "../session";
import { playDialog, speechBubble } from "../ui/dialog";
import { goTo } from "../ui/header";
import { COLORS, textStyle } from "../ui/theme";
import { Button, showToast, showTooltip } from "../ui/widgets";

const SPEEDS = [1, 2] as const;
/** 1 フレームで進める tick の上限（タブ復帰時などの暴走防止） */
const MAX_STEPS_PER_FRAME = 12;
/** 同じ SE を鳴らす最短間隔（ms） */
const SE_THROTTLE_MS: Record<string, number> = { "se.hit": 70, "se.area": 90, "se.treasure": 60 };

interface RunSceneData {
  levelId?: string;
}

/** SPEC-105: ラン画面。RunSim を回し、描画と入力を仲介する。 */
export class RunScene extends Phaser.Scene {
  private sim!: RunSim;
  private board!: BoardView;
  private hud!: Hud;
  private panel!: Panel;
  private levelId = "L1";
  private speedIndex = 0;
  private paused = false;
  private acc = 0;
  private selectedSlot: number | null = null;
  private resultShown = false;
  private overlay: Phaser.GameObjects.GameObject[] = [];
  private lastSe = new Map<string, number>();

  constructor() {
    super("Run");
  }

  init(data: RunSceneData): void {
    this.levelId = data.levelId ?? "L1";
    this.speedIndex = 0;
    this.paused = false;
    this.acc = 0;
    this.selectedSlot = null;
    this.resultShown = false;
    this.overlay = [];
    this.lastSe.clear();
  }

  preload(): void {
    const level = getLevel(this.levelId);
    for (const key of [level.background, "bgm.pve", "bgm.raid"]) {
      const a = getAsset(key);
      const loaded = a.type === "audio" ? this.cache.audio.exists(key) : this.textures.exists(key);
      if (!loaded) queueAsset(this, a);
    }
    if (this.load.list.size > 0) {
      this.add.text(CENTER_X, GAME_HEIGHT / 2, "LOADING", textStyle(28, { display: true, color: COLORS.inkDim })).setOrigin(0.5);
    }
  }

  create(): void {
    this.children.removeAll(true);
    this.cameras.main.fadeIn(200, 11, 13, 18);
    const level = getLevel(this.levelId);
    const cryptidId = session.data.profile.cryptidId;
    this.sim = new RunSim(level, (Date.now() ^ 0x5eed) >>> 0, computeModifiers(session.data));

    if (!this.anims.exists("fx.kill")) {
      this.anims.create({
        key: "fx.kill",
        frames: this.anims.generateFrameNumbers("fx.single_damage", { start: 0, end: 50 }),
        frameRate: 90,
      });
    }

    this.board = new BoardView(this, this.sim, cryptidId);
    this.hud = new Hud(this, cryptidId);
    this.panel = new Panel(
      this,
      this.sim,
      {
        startWave: () => this.sim.startNextWave(),
        toggleSpeed: () => (this.speedIndex = (this.speedIndex + 1) % SPEEDS.length),
        openMenu: () => this.openMenu(),
        place: (i) => this.place(i),
        levelUp: (id) => this.levelUp(id),
        cycleTarget: (id) => this.cycleTarget(id),
        deselect: () => this.select(null),
      },
      () => SPEEDS[this.speedIndex],
    );
    this.setupBoardInput();
    playBgm(this, "bgm.pve");
    this.banner(level.name, "準備して「Wave 開始」", COLORS.ink);
    this.playIntroDialog(level.id);
  }

  /** SPEC-108a: 初回のチュートリアル（マインちゃん）/ ステージ紹介（クリスくん）。再生中は一時停止 */
  private playIntroDialog(levelId: string): void {
    const id = levelId === "L1" ? "run.tutorial" : `level.${levelId}.intro`;
    const lines = DIALOGS[id];
    if (!lines || hasSeen(session.data, id)) return;
    this.paused = true;
    this.time.delayedCall(400, () => {
      void playDialog(this, lines).then(() => {
        session.update((d) => markSeen(d, id));
        this.paused = false;
      });
    });
  }

  update(time: number, delta: number): void {
    if (!this.paused && !this.sim.isOver) {
      this.acc += (Math.min(delta, 250) / 1000) * SPEEDS[this.speedIndex];
      let steps = 0;
      while (this.acc >= TICK && steps < MAX_STEPS_PER_FRAME) {
        this.sim.step();
        this.acc -= TICK;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) this.acc = 0;
    }
    for (const e of this.sim.drainEvents()) this.onEvent(e);
    this.board.sync(time);
    this.hud.update(this.sim);
    this.panel.update();
  }

  // ─── 入力 ────────────────────────────────────────────────

  private setupBoardInput(): void {
    const zone = this.add
      .zone(0, BOARD_TOP, GAME_WIDTH, BOARD_BOTTOM - BOARD_TOP)
      .setOrigin(0)
      .setInteractive();
    bindPress(zone, {
      onTap: (p) => this.onBoardTap(p.x, p.y),
      onLongPress: (p) => this.onBoardLongPress(p.x, p.y),
    });
    // GUM 回収: タッチはなぞり、マウスはカーソルを重ねるだけで回収（SPEC-104 §5）
    const collect = (p: Phaser.Input.Pointer) => {
      if (this.paused || p.y < BOARD_TOP || p.y > BOARD_BOTTOM) return;
      if (p.wasTouch && !p.isDown) return;
      const c = toCell(p.x, p.y);
      this.sim.collectDropsAt(c.x, c.y);
    };
    this.input.on(Phaser.Input.Events.POINTER_MOVE, collect);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, collect);
  }

  private onBoardTap(px: number, py: number): void {
    if (this.paused || this.sim.isOver) return;
    const c = toCell(px, py);
    const index = this.sim.level.slots.findIndex((s) => s.col === Math.floor(c.x) && s.row === Math.floor(c.y));
    this.select(index >= 0 && index !== this.selectedSlot ? index : null);
  }

  private onBoardLongPress(px: number, py: number): void {
    const c = toCell(px, py);
    const enemy = [...this.sim.enemies]
      .map((e) => ({ e, d: Math.hypot(e.x - c.x, e.y - c.y) }))
      .filter(({ d }) => d < 0.7)
      .sort((a, b) => a.d - b.d)[0]?.e;
    if (enemy) {
      const def = ENEMIES[enemy.def.id];
      showTooltip(
        this,
        px,
        py,
        def.name,
        `HP ${Math.ceil(enemy.hp)} / ${Math.ceil(enemy.maxHp)}\n速度 ${def.speed.toFixed(2)} マス/秒 ／ 撃破 ${def.reward} GUM\n幻獣に到達すると ${def.leak} ダメージ${def.boss ? "（即陥落）" : ""}`,
      );
      return;
    }
    const index = this.sim.level.slots.findIndex((s) => s.col === Math.floor(c.x) && s.row === Math.floor(c.y));
    const hero = index >= 0 ? this.sim.heroAt(index) : undefined;
    if (hero) {
      const role = ROLES[hero.role];
      const st = this.sim.heroStats(hero);
      showTooltip(
        this,
        px,
        py,
        `${role.heroName}（${role.roleName}） Lv${hero.level}`,
        `攻撃 ${st.damage.toFixed(1)} ／ 射程 ${st.range.toFixed(1)} ／ 間隔 ${st.interval.toFixed(2)}秒\n狙い: ${TARGET_LABEL[hero.targetMode]} ／ 累計ダメージ ${Math.floor(hero.totalDamage)}`,
      );
    }
  }

  private select(index: number | null): void {
    this.selectedSlot = index;
    this.board.setSelectedSlot(index);
    this.panel.setMode(index === null ? { kind: "none" } : { kind: "slot", slotIndex: index });
  }

  private place(slotIndex: number): void {
    const cost = this.sim.placeCost("archer");
    if (this.sim.gum < cost) return showToast(this, `GUM が足りません（${cost} 必要）`);
    if (this.sim.placeHero(slotIndex, "archer")) this.select(slotIndex);
  }

  private levelUp(heroId: number): void {
    const hero = this.sim.heroes.find((h) => h.id === heroId);
    if (!hero) return;
    const cost = this.sim.levelUpCost(hero);
    if (cost === null) return showToast(this, "最大レベルです");
    if (this.sim.gum < cost) return showToast(this, `GUM が足りません（${cost} 必要）`);
    this.sim.levelUp(heroId);
  }

  private cycleTarget(heroId: number): void {
    const hero = this.sim.heroes.find((h) => h.id === heroId);
    if (!hero) return;
    const next = TARGET_MODES[(TARGET_MODES.indexOf(hero.targetMode) + 1) % TARGET_MODES.length];
    this.sim.setTargetMode(heroId, next);
  }

  // ─── イベント → 演出・音 ──────────────────────────────────

  private onEvent(e: SimEvent): void {
    this.board.onEvent(e);
    switch (e.type) {
      case "waveStart": {
        const n = e.wave + 1;
        if (e.boss) {
          this.se("se.debuff");
          playBgm(this, "bgm.raid");
          this.banner(`WAVE ${n}`, "⚠ BOSS 襲来 ⚠", COLORS.danger);
        } else {
          this.banner(`WAVE ${n}`, n === this.sim.wavesTotal ? "最終 Wave" : "", COLORS.gold);
        }
        break;
      }
      case "waveClear":
        if (e.wave < this.sim.wavesTotal - 1) showToast(this, `WAVE ${e.wave + 1} クリア！ +${e.reward} GUM`);
        break;
      case "hit":
        this.se("se.hit");
        break;
      case "kill":
        this.se("se.area");
        break;
      case "collect":
        this.se("se.treasure");
        this.board.flyGum(e.x, e.y, e.value, this.hud.gumTarget.x, this.hud.gumTarget.y);
        break;
      case "heroPlaced":
        this.se("se.production");
        break;
      case "heroLevelUp":
        this.se("se.buff");
        break;
      case "leak":
        if (e.blocked) this.floatText("防いだ！", 0x5aa9ff);
        else this.se("se.crash");
        break;
      case "lastStand":
        this.se("se.buff");
        this.banner("聖女の祈り", "幻獣がボスの一撃を耐えた！", COLORS.gold);
        break;
      case "heal":
        this.se("se.heal");
        this.floatText(`+${e.amount} HP`, 0x6be675);
        break;
      case "gumOnHit":
        this.board.flyGum(e.x, e.y, 1, this.hud.gumTarget.x, this.hud.gumTarget.y);
        break;
      case "won":
      case "lost":
        this.time.delayedCall(900, () => this.showResult());
        break;
    }
  }

  /** 幻獣の上に浮かぶ短いテキスト */
  private floatText(text: string, color: number): void {
    const t = this.add.text(this.board.cryptid.x, this.board.cryptid.y - 70, text, textStyle(26, { color })).setOrigin(0.5).setDepth(65);
    this.tweens.add({ targets: t, y: t.y - 40, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }

  private se(key: string): void {
    const now = this.time.now;
    const gap = SE_THROTTLE_MS[key] ?? 0;
    if (now - (this.lastSe.get(key) ?? -Infinity) < gap) return;
    this.lastSe.set(key, now);
    playSe(this, key);
  }

  private banner(title: string, sub: string, color: number): void {
    const y = BOARD_TOP + 5 * CELL;
    const bg = this.add.rectangle(CENTER_X, y, GAME_WIDTH, sub ? 150 : 110, COLORS.bg, 0.75).setDepth(70);
    const t = this.add.text(CENTER_X, y - (sub ? 22 : 0), title, textStyle(56, { display: true, color })).setOrigin(0.5).setDepth(71);
    const s = this.add.text(CENTER_X, y + 38, sub, textStyle(26, { color })).setOrigin(0.5).setDepth(71);
    const parts = [bg, t, s];
    for (const p of parts) p.setAlpha(0);
    this.tweens.add({ targets: parts, alpha: 1, duration: 200, hold: 1100, yoyo: true, onComplete: () => parts.forEach((p) => p.destroy()) });
  }

  // ─── メニュー・リザルト ──────────────────────────────────

  private clearOverlay(): void {
    for (const o of this.overlay) o.destroy();
    this.overlay = [];
  }

  private dim(): void {
    this.overlay.push(
      this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setOrigin(0).setDepth(200).setInteractive(),
    );
  }

  private openMenu(): void {
    if (this.sim.isOver) return;
    this.paused = true;
    this.dim();
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => (this.overlay.push(o), o);
    add(this.add.text(CENTER_X, 470, "一時停止中", textStyle(44)).setOrigin(0.5).setDepth(201));
    add(new Button(this, CENTER_X, 600, { width: 420, label: "再開", kind: "primary", onTap: () => this.closeMenu() }).setDepth(201));
    add(new Button(this, CENTER_X, 720, { width: 420, label: "撤退する", sub: "ここまでの CE を受け取る", onTap: () => this.showResult(true) }).setDepth(201));
  }

  private closeMenu(): void {
    this.clearOverlay();
    this.paused = false;
  }

  private showResult(retreated = false): void {
    if (this.resultShown) return;
    this.resultShown = true;
    this.paused = true;
    this.clearOverlay();
    const won = this.sim.status === "won";
    playSe(this, won ? "jingle.win" : "jingle.lose");

    // SPEC-106: 報酬を計算してセーブに反映（負け・撤退でもクリアした Wave 分は入る）
    const level = this.sim.level;
    const result = { levelId: level.id, won, wavesReached: this.sim.stats.wavesReached, wavesCleared: this.sim.stats.wavesCleared };
    const reward = computeReward(level, result, session.data);
    session.update((d) => applyRunResult(d, result, reward));

    this.dim();
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => {
      this.overlay.push(o);
      (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(201);
      return o;
    };
    const top = 130;
    const panelH = 1020;
    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 0.98).fillRoundedRect(40, top, GAME_WIDTH - 80, panelH, 24);
    g.lineStyle(3, won ? COLORS.gold : COLORS.danger, 1).strokeRoundedRect(40, top, GAME_WIDTH - 80, panelH, 24);
    add(g);
    const title = won ? "防衛成功！" : retreated ? "撤退しました" : "幻獣が倒れた…";
    add(this.add.text(CENTER_X, top + 58, title, textStyle(50, { color: won ? COLORS.gold : COLORS.danger })).setOrigin(0.5));
    add(this.add.text(CENTER_X, top + 110, level.name, textStyle(22, { color: COLORS.inkDim })).setOrigin(0.5));

    const st = this.sim.stats;
    const rows: [string, string][] = [
      ["到達 Wave", `${st.wavesReached} / ${this.sim.wavesTotal}`],
      ["撃破数", String(st.kills)],
      ["回収した GUM", String(st.gumEarned)],
      ["残り HP", `${Math.ceil(this.sim.hp)} / ${this.sim.maxHp}`],
    ];
    rows.forEach(([k, v], i) => {
      const y = top + 160 + i * 40;
      add(this.add.text(90, y, k, textStyle(22, { weight: 500, color: COLORS.inkDim })).setOrigin(0, 0.5));
      add(this.add.text(GAME_WIDTH - 90, y, v, textStyle(24)).setOrigin(1, 0.5));
    });

    // 獲得 CE
    const rt = top + 330;
    const box = this.add.graphics();
    const lines = reward.breakdown.length > 0 ? reward.breakdown : [{ label: "クリアした Wave なし", ce: 0 }];
    const boxH = 96 + lines.length * 28;
    box.fillStyle(COLORS.bg, 0.8).fillRoundedRect(70, rt, GAME_WIDTH - 140, boxH, 16);
    box.lineStyle(2, COLORS.gold, 0.6).strokeRoundedRect(70, rt, GAME_WIDTH - 140, boxH, 16);
    add(box);
    add(this.add.text(96, rt + 34, "獲得 CE", textStyle(22, { color: COLORS.inkDim })).setOrigin(0, 0.5));
    add(this.add.image(GAME_WIDTH - 250, rt + 38, "icon.ce").setScale(0.7));
    add(this.add.text(GAME_WIDTH - 96, rt + 38, `+${reward.ce}`, textStyle(44, { display: true, color: COLORS.gold })).setOrigin(1, 0.5));
    lines.forEach((b, i) => {
      const y = rt + 84 + i * 28;
      add(this.add.text(96, y, b.label, textStyle(19, { weight: 500, color: COLORS.inkDim })).setOrigin(0, 0.5));
      add(this.add.text(GAME_WIDTH - 96, y, `+${b.ce}`, textStyle(19, { color: b.label === "初回クリア" ? COLORS.gold : COLORS.ink })).setOrigin(1, 0.5));
    });

    // ヒーロー別ダメージ（上位 3）
    const ht = rt + boxH + 36;
    add(this.add.text(90, ht, "ヒーロー別ダメージ", textStyle(20, { color: COLORS.inkDim })).setOrigin(0, 0.5));
    const heroes = [...this.sim.heroes].sort((a, b) => b.totalDamage - a.totalDamage).slice(0, 3);
    const maxDmg = Math.max(1, ...heroes.map((h) => h.totalDamage));
    heroes.forEach((h, i) => {
      const y = ht + 44 + i * 44;
      add(this.add.image(110, y, ROLES[h.role].imageKey).setScale(0.6));
      add(this.add.text(150, y, `Lv${h.level}`, textStyle(20)).setOrigin(0, 0.5));
      const bar = this.add.graphics();
      bar.fillStyle(COLORS.gold, 0.85).fillRoundedRect(220, y - 10, 300 * (h.totalDamage / maxDmg), 20, 6);
      add(bar);
      add(this.add.text(GAME_WIDTH - 90, y, String(Math.floor(h.totalDamage)), textStyle(20)).setOrigin(1, 0.5));
    });
    if (heroes.length === 0) add(this.add.text(90, ht + 44, "（ヒーローを配置しませんでした）", textStyle(20, { color: COLORS.inkMuted })).setOrigin(0, 0.5));

    // マイクリくんの実況（SPEC-108a）
    add(speechBubble(this, "maycri", 120, top + 895, maycriComment(won, st.wavesReached, reward.ce), { width: 440, depth: 201 }));

    const by = top + 950;
    const bw = 196;
    const gap = (GAME_WIDTH - 80 - 32 - bw * 3) / 2;
    const bx = (i: number) => 40 + 16 + bw / 2 + i * (bw + gap);
    add(new Button(this, bx(0), by, { width: bw, label: "ツリー", onTap: () => goTo(this, "Tree") }));
    add(new Button(this, bx(1), by, { width: bw, label: "もう一度", kind: "primary", onTap: () => this.scene.restart({ levelId: this.levelId }) }));
    add(new Button(this, bx(2), by, { width: bw, label: "ホーム", onTap: () => goTo(this, "Home") }));

    if (!hasSeen(session.data, "result.first")) {
      this.time.delayedCall(700, () => {
        void playDialog(this, DIALOGS["result.first"]).then(() => session.update((d) => markSeen(d, "result.first")));
      });
    }
  }
}
