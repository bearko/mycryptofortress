import Phaser from "phaser";
import { CRYPTIDS, getCryptid, type CryptidId } from "../../data/cryptids";
import { LEVELS } from "../../data/levels";
import { goTo } from "../ui/header";
import { DEFAULT_BGM_VOLUME, DEFAULT_SE_VOLUME, playBgm, playSe } from "../audio";
import { bindPress } from "../input/press";
import { CENTER_X, GAME_WIDTH, MARGIN } from "../layout";
import { session } from "../session";
import { COLORS, css, textStyle } from "../ui/theme";
import { Button, CryptidDisplay, LandBackground, showTooltip } from "../ui/widgets";

const GRID_COLS = 3;
const CELL_GAP = 16;
const CELL_W = (GAME_WIDTH - MARGIN * 2 - CELL_GAP * (GRID_COLS - 1)) / GRID_COLS;
const CELL_H = 140;
const GRID_TOP = 580;

/** SPEC-101 §5.7: ホーム。幻獣選択・メニュー（準備中）・音設定。 */
export class HomeScene extends Phaser.Scene {
  private background!: LandBackground;
  private showcase!: CryptidDisplay;
  private nameText!: Phaser.GameObjects.Text;
  private cells = new Map<CryptidId, { frame: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text }>();

  constructor() {
    super("Home");
  }

  create(): void {
    this.cells.clear();
    this.cameras.main.fadeIn(250, 11, 13, 18);
    playBgm(this, "bgm.land");
    const selected = session.data.profile.cryptidId;
    this.background = new LandBackground(this, 0.62);
    void this.background.show(selected);

    this.buildHeader();

    this.showcase = new CryptidDisplay(this, CENTER_X, 320, selected, 2.2);
    this.nameText = this.add.text(CENTER_X, 480, "", textStyle(32)).setOrigin(0.5);
    this.add
      .text(CENTER_X, 520, "拠点として配置され、ヒーローたちが守る守護神", textStyle(18, { weight: 500, color: COLORS.inkDim }))
      .setOrigin(0.5);

    this.add.text(MARGIN, GRID_TOP - 16, "幻獣をえらぶ（長押しで詳細）", textStyle(20, { color: COLORS.inkDim })).setOrigin(0, 1);
    CRYPTIDS.forEach((c, i) => this.buildCell(c.id, i));

    this.buildMenu();
    this.select(selected, false);
  }

  private buildHeader(): void {
    const logo = this.add.image(MARGIN, 64, "logo.mch").setOrigin(0, 0.5);
    logo.setScale(56 / logo.height);
    const slotLabel = `SLOT ${session.slot}${session.persistent ? "" : "（保存不可）"}`;
    const chip = this.add.text(GAME_WIDTH - MARGIN - 14, 64, slotLabel, textStyle(20, { color: session.persistent ? COLORS.inkDim : COLORS.danger })).setOrigin(1, 0.5);
    this.add.rectangle(chip.x - chip.width / 2, 64, chip.width + 28, 44).setStrokeStyle(2, COLORS.line).setOrigin(0.5);
  }

  private buildCell(id: CryptidId, index: number): void {
    const c = getCryptid(id);
    const col = index % GRID_COLS;
    const row = Math.floor(index / GRID_COLS);
    const x = MARGIN + col * (CELL_W + CELL_GAP) + CELL_W / 2;
    const y = GRID_TOP + row * (CELL_H + CELL_GAP) + CELL_H / 2;

    const frame = this.add.graphics();
    const icon = this.add.image(0, -8, c.imageKey).setScale(0.82);
    const label = this.add.text(0, CELL_H / 2 - 20, c.landName, textStyle(18, { color: COLORS.inkDim })).setOrigin(0.5);
    const cell = this.add.container(x, y, [frame, icon, label]).setSize(CELL_W, CELL_H).setInteractive({ useHandCursor: true });
    this.cells.set(id, { frame, label });

    bindPress(cell, {
      onPressChange: (p) => cell.setScale(p ? 0.95 : 1),
      onTap: () => this.select(id, true),
      onLongPress: (p) =>
        showTooltip(this, p.x, p.y, `${c.landName} の幻獣`, `ランド「${c.landName}」の守護神クリプタイド。選ぶと拠点として盤面に配置されます。（性能差は今後のアップデートで追加予定）`),
    });
  }

  private buildMenu(): void {
    const fullW = GAME_WIDTH - MARGIN * 2;
    const cleared = LEVELS.filter((l) => session.data.meta.levels[l.id]?.cleared).length;
    new Button(this, CENTER_X, 1100, {
      width: fullW,
      height: 96,
      label: "出撃",
      sub: `ノードを選ぶ（クリア ${cleared} / ${LEVELS.length}）`,
      kind: "primary",
      onTap: () => goTo(this, "LevelSelect"),
    });

    const y = 1210;
    const treeW = 312;
    const smallW = (fullW - treeW - CELL_GAP * 2) / 2;
    new Button(this, MARGIN + treeW / 2, y, {
      width: treeW,
      label: "スキルツリー",
      sub: `CE ${session.data.meta.tokens.ce}`,
      onTap: () => goTo(this, "Tree"),
    });

    const bgmX = MARGIN + treeW + CELL_GAP + smallW / 2;
    const bgm: Button = new Button(this, bgmX, y, {
      width: smallW,
      label: this.volumeLabel("BGM", session.data.settings.bgmVolume),
      onTap: () => {
        const on = session.data.settings.bgmVolume <= 0;
        session.update((d) => ({ ...d, settings: { ...d.settings, bgmVolume: on ? DEFAULT_BGM_VOLUME : 0 } }));
        bgm.setLabel(this.volumeLabel("BGM", session.data.settings.bgmVolume));
        playBgm(this, "bgm.land");
      },
    });
    const se: Button = new Button(this, bgmX + smallW + CELL_GAP, y, {
      width: smallW,
      label: this.volumeLabel("SE", session.data.settings.seVolume),
      onTap: () => {
        const on = session.data.settings.seVolume <= 0;
        session.update((d) => ({ ...d, settings: { ...d.settings, seVolume: on ? DEFAULT_SE_VOLUME : 0 } }));
        se.setLabel(this.volumeLabel("SE", session.data.settings.seVolume));
      },
    });
  }

  private volumeLabel(name: string, volume: number): string {
    return `${name} ${volume > 0 ? "ON" : "OFF"}`;
  }

  private select(id: CryptidId, byUser: boolean): void {
    const c = getCryptid(id);
    if (byUser) {
      if (session.data.profile.cryptidId === id) return;
      session.update((d) => ({ ...d, profile: { ...d.profile, cryptidId: id } }));
      playSe(this, "se.treasure");
      void this.background.show(id);
    }
    this.showcase.setCryptid(id);
    this.nameText.setText(`${c.landName} の幻獣`);
    for (const [cid, { frame, label }] of this.cells) {
      const on = cid === id;
      const color = getCryptid(cid).color;
      frame.clear();
      frame.fillStyle(COLORS.panel, 0.9).fillRoundedRect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, 16);
      if (on) frame.fillStyle(color, 0.18).fillRoundedRect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, 16);
      frame.lineStyle(on ? 4 : 2, on ? color : COLORS.line, 1).strokeRoundedRect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, 16);
      label.setColor(css(on ? COLORS.ink : COLORS.inkDim));
    }
  }
}
