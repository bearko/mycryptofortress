import Phaser from "phaser";
import { ROLES, ROLE_IDS, type RoleId } from "../../data/balance/heroes";
import type { HeroState, RunSim, TargetMode } from "../../sim/run";
import { bindPress } from "../input/press";
import { GAME_WIDTH, MARGIN } from "../layout";
import { COLORS, textStyle } from "../ui/theme";
import { Button } from "../ui/widgets";

export const PANEL_TOP = 1072;

export const TARGET_LABEL: Record<TargetMode, string> = {
  first: "先頭",
  strong: "HP 最大",
  weak: "HP 最小",
  close: "最寄り",
  boss: "ボス優先",
};

export interface PanelActions {
  startWave(): void;
  callEarly(): void;
  toggleSpeed(): void;
  toggleCannon(): void;
  openMenu(): void;
  place(slotIndex: number, role: RoleId): void;
  openSlot(slotIndex: number): void;
  previewRole(role: RoleId): void;
  showRoleInfo(role: RoleId, x: number, y: number): void;
  levelUp(heroId: number): void;
  cycleTarget(heroId: number): void;
  deselect(): void;
}

type Mode = { kind: "none" } | { kind: "slot"; slotIndex: number };

/** ロール選択カードの寸法（5 枚 + 閉じるボタンで横幅に収める） */
const CARD_W = 116;
const CARD_H = 180;
const CARD_GAP = 8;

interface RoleCard {
  role: RoleId;
  cost: Phaser.GameObjects.Text;
  frame: Phaser.GameObjects.Graphics;
  unlocked: boolean;
}

/** SPEC-105 §2 / SPEC-110〜114: 下部の操作パネル。選択状態に応じて中身を作り直す。 */
export class Panel {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private mode: Mode = { kind: "none" };
  private renderedKey = "";
  // 毎フレーム更新する部品
  private waveBtn?: Button;
  private speedBtn?: Button;
  private cannonBtn?: Button;
  private actionBtn?: { btn: Button; cost: () => number | null };
  private dynamicText?: { text: Phaser.GameObjects.Text; value: () => string };
  private cards: RoleCard[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly sim: RunSim,
    private readonly actions: PanelActions,
    private readonly getSpeed: () => number,
    private readonly isCannonArmed: () => boolean,
  ) {
    scene.add.rectangle(0, PANEL_TOP, GAME_WIDTH, 1280 - PANEL_TOP, COLORS.bg, 0.92).setOrigin(0).setDepth(90);
    scene.add.rectangle(0, PANEL_TOP, GAME_WIDTH, 2, COLORS.line).setOrigin(0).setDepth(90);
  }

  setMode(mode: Mode): void {
    this.mode = mode;
    this.renderedKey = "";
  }

  /** 毎フレーム呼ぶ。構成が変わった時だけ作り直し、それ以外はラベルだけ更新する */
  update(): void {
    const key = this.structureKey();
    if (key !== this.renderedKey) {
      this.renderedKey = key;
      this.rebuild();
    }
    this.refreshDynamic();
  }

  private structureKey(): string {
    if (this.mode.kind === "none") return "none";
    const i = this.mode.slotIndex;
    if (!this.sim.isSlotOpen(i)) return `locked:${i}`;
    const hero = this.sim.heroAt(i);
    return hero ? `hero:${hero.id}:${hero.level}:${hero.targetMode}` : `slot:${i}`;
  }

  private clear(): void {
    for (const o of this.objects) o.destroy();
    this.objects = [];
    this.waveBtn = this.speedBtn = this.cannonBtn = undefined;
    this.actionBtn = undefined;
    this.dynamicText = undefined;
    this.cards = [];
  }

  private add<T extends Phaser.GameObjects.GameObject>(o: T): T {
    (o as unknown as Phaser.GameObjects.Components.Depth).setDepth?.(95);
    this.objects.push(o);
    return o;
  }

  private rebuild(): void {
    this.clear();
    if (this.mode.kind === "none") return this.buildIdle();
    const i = this.mode.slotIndex;
    if (!this.sim.isSlotOpen(i)) return this.buildLocked(i);
    const hero = this.sim.heroAt(i);
    if (hero) this.buildHero(hero);
    else this.buildPlacement(i);
  }

  private buildIdle(): void {
    const s = this.scene;
    this.add(s.add.text(MARGIN, PANEL_TOP + 40, "空きマスをタップしてヒーローを配置", textStyle(22)).setOrigin(0, 0.5));
    const hint = this.sim.cannonUnlocked ? "なぞって GUM 回収 ／ 幻獣砲 ON で狙って撃つ" : "画面をなぞって GUM を回収 ／ 長押しで詳細";
    this.add(s.add.text(MARGIN, PANEL_TOP + 74, hint, textStyle(18, { weight: 500, color: COLORS.inkDim })).setOrigin(0, 0.5));
    const y = PANEL_TOP + 150;
    const gap = 16;
    const menuW = 110;
    const speedW = 110;
    const cannonW = this.sim.cannonUnlocked ? 150 : 0;
    const waveW = GAME_WIDTH - MARGIN * 2 - menuW - speedW - cannonW - gap * (cannonW ? 3 : 2);
    let x = MARGIN;
    this.waveBtn = this.add(
      new Button(s, x + waveW / 2, y, {
        width: waveW,
        label: "",
        sub: "",
        kind: "primary",
        onTap: () => (this.sim.earlyCallBonus() !== null ? this.actions.callEarly() : this.actions.startWave()),
      }),
    );
    x += waveW + gap;
    if (cannonW) {
      this.cannonBtn = this.add(
        new Button(s, x + cannonW / 2, y, { width: cannonW, label: "幻獣砲", sub: "", accent: 0xff9d5c, onTap: () => this.actions.toggleCannon() }),
      );
      x += cannonW + gap;
    }
    this.speedBtn = this.add(new Button(s, x + speedW / 2, y, { width: speedW, label: "", onTap: () => this.actions.toggleSpeed() }));
    this.add(new Button(s, GAME_WIDTH - MARGIN - menuW / 2, y, { width: menuW, label: "≡", onTap: () => this.actions.openMenu() }));
  }

  private portrait(imageKey: string, title: string, lines: string[]): Phaser.GameObjects.Text[] {
    const s = this.scene;
    const top = PANEL_TOP + 14;
    this.add(s.add.rectangle(MARGIN + 44, top + 44, 88, 88, COLORS.panelRaised).setStrokeStyle(2, COLORS.line));
    this.add(s.add.image(MARGIN + 44, top + 44, imageKey).setScale(1.25));
    this.add(s.add.text(MARGIN + 104, top + 6, title, textStyle(26)).setOrigin(0, 0));
    return lines.map((l, i) => this.add(s.add.text(MARGIN + 104, top + 42 + i * 26, l, textStyle(19, { weight: 500, color: COLORS.inkDim })).setOrigin(0, 0)));
  }

  /** ロールごとの性能 1 行 */
  private statLine(hero: HeroState | null, role: RoleId): string {
    const st = hero ? this.sim.heroStats(hero) : this.sim.statsFor(role);
    const m = this.sim.mods;
    switch (role) {
      case "pulse": {
        const slow = ROLES.pulse.pulse!.slow + m.pulseSlowAdd;
        return `攻撃 ${st.damage.toFixed(1)} ／ 範囲 ${st.range.toFixed(1)} ／ 鈍足 ${Math.round(slow * 100)}%`;
      }
      case "miner": {
        const h = hero ?? ({ role, level: 1 } as HeroState);
        return `通行料 ${this.sim.tollFor(h)} ／ 配当 ${this.sim.payoutFor(h)} ／ 範囲 ${st.range.toFixed(1)}`;
      }
      default:
        return `攻撃 ${st.damage.toFixed(1)} ／ 射程 ${st.range.toFixed(1)} ／ 間隔 ${st.interval.toFixed(2)}秒`;
    }
  }

  /** SPEC-110〜113: 5 ロールから選んで置く。未解放はロック表示、長押しで説明 */
  private buildPlacement(slotIndex: number): void {
    const s = this.scene;
    const top = PANEL_TOP + 14;
    ROLE_IDS.forEach((role, i) => {
      const def = ROLES[role];
      const unlocked = this.sim.isRoleUnlocked(role);
      const cx = MARGIN + CARD_W / 2 + i * (CARD_W + CARD_GAP);
      const frame = this.add(s.add.graphics());
      const img = this.add(s.add.image(cx, top + 52, this.sim.heroVisual(role).imageKey).setScale(1.1));
      if (!unlocked) img.setTint(0x333333);
      this.add(s.add.text(cx, top + 104, def.roleName, textStyle(22, { color: unlocked ? COLORS.ink : COLORS.inkMuted })).setOrigin(0.5));
      let cost: Phaser.GameObjects.Text;
      if (unlocked) {
        this.add(s.add.image(cx - 30, top + 142, "icon.gum").setScale(0.3));
        cost = this.add(s.add.text(cx + 10, top + 142, String(this.sim.placeCost(role)), textStyle(22, { color: COLORS.gold })).setOrigin(0.5));
      } else {
        cost = this.add(s.add.text(cx, top + 142, "ツリーで解放", textStyle(15, { weight: 500, color: COLORS.inkMuted })).setOrigin(0.5));
      }
      const hit = this.add(s.add.zone(cx, top + CARD_H / 2, CARD_W, CARD_H).setInteractive({ useHandCursor: true }));
      bindPress(hit, {
        onPressChange: (pressed) => pressed && this.actions.previewRole(role),
        onTap: () => this.actions.place(slotIndex, role),
        onLongPress: () => this.actions.showRoleInfo(role, cx, PANEL_TOP - 20),
      });
      this.cards.push({ role, cost, frame, unlocked });
    });
    const closeW = GAME_WIDTH - MARGIN * 2 - 5 * CARD_W - 5 * CARD_GAP;
    this.add(new Button(s, GAME_WIDTH - MARGIN - closeW / 2, top + CARD_H / 2, { width: closeW, height: CARD_H, label: "×", onTap: () => this.actions.deselect() }));
    this.drawCards();
  }

  private drawCards(): void {
    const top = PANEL_TOP + 14;
    for (const [i, c] of this.cards.entries()) {
      const x = MARGIN + i * (CARD_W + CARD_GAP);
      const affordable = c.unlocked && this.sim.gum >= this.sim.placeCost(c.role);
      c.frame.clear();
      c.frame.fillStyle(affordable ? COLORS.panelRaised : COLORS.panel, 1).fillRoundedRect(x, top, CARD_W, CARD_H, 14);
      c.frame.lineStyle(2, affordable ? COLORS.gold : COLORS.line, affordable ? 0.9 : 1).strokeRoundedRect(x, top, CARD_W, CARD_H, 14);
      if (c.unlocked) c.cost.setColor(affordable ? "#f5c542" : "#e0485a");
    }
  }

  /** SPEC-113: ロックマス。GUM を払って開放する */
  private buildLocked(slotIndex: number): void {
    const s = this.scene;
    const cost = this.sim.slotOpenCost(slotIndex) ?? 0;
    this.add(s.add.text(MARGIN, PANEL_TOP + 36, "ロックマス", textStyle(26)).setOrigin(0, 0.5));
    this.add(s.add.text(MARGIN, PANEL_TOP + 72, "GUM を払って開放すると、ヒーローを置けるようになります", textStyle(18, { weight: 500, color: COLORS.inkDim })).setOrigin(0, 0.5));
    const y = PANEL_TOP + 150;
    const btn = this.add(
      new Button(s, MARGIN + 240, y, { width: 480, label: `開放  ${cost} GUM`, kind: "primary", onTap: () => this.actions.openSlot(slotIndex) }),
    );
    this.actionBtn = { btn, cost: () => this.sim.slotOpenCost(slotIndex) };
    this.add(new Button(s, GAME_WIDTH - MARGIN - 80, y, { width: 160, label: "閉じる", onTap: () => this.actions.deselect() }));
  }

  private buildHero(hero: HeroState): void {
    const visual = this.sim.heroVisual(hero.role);
    const [, dyn] = this.portrait(visual.imageKey, `${visual.heroName}  Lv${hero.level}`, [this.statLine(hero, hero.role), ""]);
    const haste = this.sim.hasteFor(hero);
    const extra = haste > 0 ? `  ／ 充電 -${Math.round(haste * 100)}%` : "";
    this.dynamicText = {
      text: dyn,
      value: () => (hero.role === "miner" ? `累計 ${hero.totalGum} GUM` : `累計ダメージ ${Math.floor(hero.totalDamage)}`) + extra,
    };
    const y = PANEL_TOP + 150;
    // 結界と採掘は狙いを持たない
    const targeted = hero.role !== "pulse" && hero.role !== "miner";
    const targetW = targeted ? 200 : 0;
    if (targeted) {
      this.add(
        new Button(this.scene, MARGIN + targetW / 2, y, { width: targetW, label: `狙い: ${TARGET_LABEL[hero.targetMode]}`, onTap: () => this.actions.cycleTarget(hero.id) }),
      );
    }
    const closeW = 120;
    const lvW = GAME_WIDTH - MARGIN * 2 - closeW - 16 - (targeted ? targetW + 16 : 0);
    const cost = this.sim.levelUpCost(hero);
    const btn = this.add(
      new Button(this.scene, MARGIN + (targeted ? targetW + 16 : 0) + lvW / 2, y, {
        width: lvW,
        label: cost === null ? "最大レベル" : `強化  ${cost} GUM`,
        kind: cost === null ? "locked" : "primary",
        onTap: () => this.actions.levelUp(hero.id),
      }),
    );
    this.actionBtn = { btn, cost: () => this.sim.levelUpCost(hero) };
    this.add(new Button(this.scene, GAME_WIDTH - MARGIN - closeW / 2, y, { width: closeW, label: "×", onTap: () => this.actions.deselect() }));
  }

  private refreshDynamic(): void {
    const sim = this.sim;
    if (this.waveBtn) {
      const bonus = sim.earlyCallBonus();
      const can = sim.canStartNextWave();
      const secs = Math.ceil(sim.nextWaveIn ?? 0);
      if (bonus !== null) {
        this.waveBtn.setLabel("次の Wave");
        this.waveBtn.setSub(`繰り上げ +${bonus} GUM`);
        this.waveBtn.setKind("primary");
      } else {
        this.waveBtn.setLabel(sim.status === "prep" ? "Wave 開始" : can ? "次の Wave" : "Wave 進行中");
        this.waveBtn.setSub(can ? `自動開始まで ${secs} 秒` : `${sim.enemies.length} 体が侵攻中`);
        this.waveBtn.setKind(can ? "primary" : "locked");
      }
    }
    this.speedBtn?.setLabel(`${this.getSpeed()}x`);
    if (this.cannonBtn) {
      const armed = this.isCannonArmed();
      this.cannonBtn.setSub(armed ? `ON ／ ${sim.cannonCost} GUM` : `${sim.cannonCost} GUM/発`);
      this.cannonBtn.setKind(armed ? "primary" : "secondary");
    }
    if (this.actionBtn) {
      const cost = this.actionBtn.cost();
      this.actionBtn.btn.setKind(cost === null || sim.gum < cost ? "locked" : "primary");
    }
    if (this.cards.length > 0) this.drawCards();
    if (this.dynamicText) this.dynamicText.text.setText(this.dynamicText.value());
  }
}
