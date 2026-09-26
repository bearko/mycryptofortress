import Phaser from "phaser";
import { ROLES } from "../../data/balance/heroes";
import type { HeroState, RunSim, TargetMode } from "../../sim/run";
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
  toggleSpeed(): void;
  openMenu(): void;
  place(slotIndex: number): void;
  levelUp(heroId: number): void;
  cycleTarget(heroId: number): void;
  deselect(): void;
}

type Mode = { kind: "none" } | { kind: "slot"; slotIndex: number };

/** SPEC-105 §2: 下部の操作パネル。選択状態に応じて中身を作り直す。 */
export class Panel {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private mode: Mode = { kind: "none" };
  private renderedKey = "";
  // 毎フレーム更新する部品
  private waveBtn?: Button;
  private speedBtn?: Button;
  private actionBtn?: { btn: Button; cost: () => number | null };
  private dynamicText?: { text: Phaser.GameObjects.Text; value: () => string };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly sim: RunSim,
    private readonly actions: PanelActions,
    private readonly getSpeed: () => number,
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
    const hero = this.sim.heroAt(this.mode.slotIndex);
    return hero ? `hero:${hero.id}:${hero.level}:${hero.targetMode}` : `slot:${this.mode.slotIndex}`;
  }

  private clear(): void {
    for (const o of this.objects) o.destroy();
    this.objects = [];
    this.waveBtn = this.speedBtn = undefined;
    this.actionBtn = undefined;
    this.dynamicText = undefined;
  }

  private add<T extends Phaser.GameObjects.GameObject>(o: T): T {
    (o as unknown as Phaser.GameObjects.Components.Depth).setDepth?.(95);
    this.objects.push(o);
    return o;
  }

  private rebuild(): void {
    this.clear();
    if (this.mode.kind === "none") return this.buildIdle();
    const hero = this.sim.heroAt(this.mode.slotIndex);
    if (hero) this.buildHero(hero);
    else this.buildPlacement(this.mode.slotIndex);
  }

  private buildIdle(): void {
    const s = this.scene;
    this.add(s.add.text(MARGIN, PANEL_TOP + 40, "空きマスをタップしてヒーローを配置", textStyle(22)).setOrigin(0, 0.5));
    this.add(s.add.text(MARGIN, PANEL_TOP + 74, "画面をなぞって GUM を回収 ／ 長押しで詳細", textStyle(18, { weight: 500, color: COLORS.inkDim })).setOrigin(0, 0.5));
    const y = PANEL_TOP + 150;
    this.waveBtn = this.add(new Button(s, MARGIN + 170, y, { width: 340, label: "", sub: "", kind: "primary", onTap: () => this.actions.startWave() }));
    this.speedBtn = this.add(new Button(s, MARGIN + 340 + 16 + 75, y, { width: 150, label: "", onTap: () => this.actions.toggleSpeed() }));
    this.add(new Button(s, GAME_WIDTH - MARGIN - 67, y, { width: 134, label: "≡", onTap: () => this.actions.openMenu() }));
  }

  private portrait(imageKey: string, title: string, lines: string[]): void {
    const s = this.scene;
    const top = PANEL_TOP + 14;
    this.add(s.add.rectangle(MARGIN + 44, top + 44, 88, 88, COLORS.panelRaised).setStrokeStyle(2, COLORS.line));
    this.add(s.add.image(MARGIN + 44, top + 44, imageKey).setScale(1.25));
    this.add(s.add.text(MARGIN + 104, top + 6, title, textStyle(26)).setOrigin(0, 0));
    lines.forEach((l, i) => this.add(s.add.text(MARGIN + 104, top + 42 + i * 26, l, textStyle(19, { weight: 500, color: COLORS.inkDim })).setOrigin(0, 0)));
  }

  private statLine(stats: { damage: number; interval: number; range: number }): string {
    return `攻撃 ${stats.damage.toFixed(1)} ／ 射程 ${stats.range.toFixed(1)} ／ 間隔 ${stats.interval.toFixed(2)}秒`;
  }

  private buildPlacement(slotIndex: number): void {
    const role = ROLES.archer;
    const stats = this.sim.statsFor("archer");
    this.portrait(role.imageKey, `${role.heroName}（${role.roleName}）`, [this.statLine(stats), "単体を狙う基本のヒーロー"]);
    const y = PANEL_TOP + 150;
    const btn = this.add(
      new Button(this.scene, MARGIN + 240, y, { width: 480, label: `配置  ${this.sim.placeCost("archer")} GUM`, kind: "primary", onTap: () => this.actions.place(slotIndex) }),
    );
    this.actionBtn = { btn, cost: () => this.sim.placeCost("archer") };
    this.add(new Button(this.scene, GAME_WIDTH - MARGIN - 80, y, { width: 160, label: "閉じる", onTap: () => this.actions.deselect() }));
  }

  private buildHero(hero: HeroState): void {
    const role = ROLES[hero.role];
    const now = this.sim.heroStats(hero);
    this.portrait(role.imageKey, `${role.heroName}  Lv${hero.level}`, [this.statLine(now), ""]);
    this.dynamicText = {
      text: this.objects[this.objects.length - 1] as Phaser.GameObjects.Text,
      value: () => `累計ダメージ ${Math.floor(hero.totalDamage)}`,
    };
    const y = PANEL_TOP + 150;
    this.add(
      new Button(this.scene, MARGIN + 100, y, { width: 200, label: `狙い: ${TARGET_LABEL[hero.targetMode]}`, onTap: () => this.actions.cycleTarget(hero.id) }),
    );
    const cost = this.sim.levelUpCost(hero);
    const btn = this.add(
      new Button(this.scene, MARGIN + 216 + 150, y, {
        width: 300,
        label: cost === null ? "最大レベル" : `強化  ${cost} GUM`,
        kind: cost === null ? "locked" : "primary",
        onTap: () => this.actions.levelUp(hero.id),
      }),
    );
    this.actionBtn = { btn, cost: () => this.sim.levelUpCost(hero) };
    this.add(new Button(this.scene, GAME_WIDTH - MARGIN - 60, y, { width: 120, label: "×", onTap: () => this.actions.deselect() }));
  }

  private refreshDynamic(): void {
    const sim = this.sim;
    if (this.waveBtn) {
      const can = sim.canStartNextWave();
      const secs = Math.ceil(sim.nextWaveIn ?? 0);
      const label = sim.status === "prep" ? "Wave 開始" : can ? "次の Wave" : "Wave 進行中";
      this.waveBtn.setLabel(label);
      this.waveBtn.setSub(can ? `自動開始まで ${secs} 秒` : `${sim.enemies.length} 体が侵攻中`);
      this.waveBtn.setKind(can ? "primary" : "locked");
    }
    this.speedBtn?.setLabel(`${this.getSpeed()}x`);
    if (this.actionBtn) {
      const cost = this.actionBtn.cost();
      this.actionBtn.btn.setKind(cost === null || sim.gum < cost ? "locked" : "primary");
    }
    if (this.dynamicText) this.dynamicText.text.setText(this.dynamicText.value());
  }
}
