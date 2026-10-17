import Phaser from "phaser";
import { CRYPTIDS, getCryptid, type CryptidId } from "../../data/cryptids";
import { LEVELS } from "../../data/levels";
import { goTo } from "../ui/header";
import { playBgm, playSe } from "../audio";
import { bindPress } from "../input/press";
import { CENTER_X, GAME_HEIGHT, GAME_WIDTH, MARGIN } from "../layout";
import { session } from "../session";
import { COLORS, css, textStyle } from "../ui/theme";
import { Button, CryptidDisplay, LandBackground, showToast, showTooltip } from "../ui/widgets";
import { VolumeStepper } from "../ui/volumeStepper";
import { volumeLabel } from "../ui/volume";
import { abortRta, openPlatformRanking, startRta, setChatVisible } from "../platform";
import { jaWrap } from "../ui/jaWrap";
import { RTA_REGULATION, RTA_SPEED } from "../../meta/rta";

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
    setChatVisible(true);   // SPEC-128: 全体チャットの 💬 を出す
    // SPEC-123: RTA を終えた（完走・中断・再読み込み）あとは、ホームでふだんのセーブに戻る
    if (session.onRtaSave && !session.rta) session.leaveRtaSave();
    this.cells.clear();
    this.cameras.main.fadeIn(250, 11, 13, 18);
    playBgm(this, "bgm.land");
    // セーブ移行のお知らせ（ツリー改訂による自動返金など）
    const notice = session.takeNotice();
    if (notice) this.time.delayedCall(500, () => showToast(this, notice));
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
    const slotLabel = session.rta ? "RTA 計測中" : `SLOT ${session.slot}${session.persistent ? "" : "（保存不可）"}`;
    const chip = this.add.text(GAME_WIDTH - MARGIN - 14, 64, slotLabel, textStyle(20, { color: session.persistent ? COLORS.inkDim : COLORS.danger })).setOrigin(1, 0.5);
    this.add.rectangle(chip.x - chip.width / 2, 64, chip.width + 28, 44).setStrokeStyle(2, COLORS.line).setOrigin(0.5);
    // SPEC-123: RTA（レベル 01〜09）。計測中は「やめる」
    const rtaW = session.rta ? 200 : 140;
    new Button(this, chip.x - chip.width - 28 - 16 - rtaW / 2, 64, {
      width: rtaW,
      label: session.rta ? "RTA をやめる" : "RTA",
      onTap: () => (session.rta ? this.confirmAbortRta() : this.confirmStartRta()),
    });
    // SPEC-125: bearko.games の総合ランキングへ（新しいタブ）
    const ranking = this.add
      .text(MARGIN, 124, "bearko.games の総合ランキング ↗", textStyle(18, { color: COLORS.gold }))
      .setOrigin(0, 0.5)
      .setPadding(0, 10, 0, 10)
      .setInteractive({ useHandCursor: true });
    bindPress(ranking, { onTap: () => openPlatformRanking() });
  }

  private modal(title: string, body: string, okLabel: string, onOk: () => void): void {
    const parts: Phaser.GameObjects.GameObject[] = [];
    const close = () => parts.forEach((p) => p.destroy());
    parts.push(this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setOrigin(0).setDepth(200).setInteractive());
    const g = this.add.graphics().setDepth(201);
    g.fillStyle(COLORS.panel, 0.98).fillRoundedRect(MARGIN, 300, GAME_WIDTH - MARGIN * 2, 520, 24);
    g.lineStyle(3, COLORS.gold, 1).strokeRoundedRect(MARGIN, 300, GAME_WIDTH - MARGIN * 2, 520, 24);
    parts.push(g);
    parts.push(this.add.text(CENTER_X, 360, title, textStyle(36, { color: COLORS.gold })).setOrigin(0.5).setDepth(201));
    parts.push(
      this.add
        .text(MARGIN + 40, 420, body, { ...textStyle(22, { weight: 500 }), wordWrap: jaWrap(GAME_WIDTH - MARGIN * 2 - 80), lineSpacing: 8 })
        .setDepth(201),
    );
    const bw = (GAME_WIDTH - MARGIN * 2 - 48 - 16) / 2;
    parts.push(new Button(this, MARGIN + 24 + bw / 2, 750, { width: bw, label: "やめておく", onTap: close }).setDepth(201));
    parts.push(new Button(this, GAME_WIDTH - MARGIN - 24 - bw / 2, 750, { width: bw, label: okLabel, kind: "primary", onTap: () => (close(), onOk()) }).setDepth(201));
  }

  private confirmStartRta(): void {
    this.modal(
      "RTA レベル 01〜09",
      [
        "新しいセーブでレベル 01 から始め、レベル 09 のクリアまでの実時間を bearko.games で測ります。",
        `・速さは ${RTA_SPEED} 倍に固定（5 倍速は使えません）`,
        "・負けてもやり直せます。スキルツリーを育てる時間も含みます",
        "・いまのセーブはそのまま残ります（RTA は別のセーブで遊びます）",
        "・再読み込みすると計測は消えます",
      ].join("\n"),
      "始める",
      () => void this.beginRta(),
    );
  }

  private async beginRta(): Promise<void> {
    if (!(await startRta(RTA_REGULATION, 0))) {
      showToast(this, "RTA は bearko.games につながっているときだけ遊べます");
      return;
    }
    session.beginRta();
    goTo(this, "Run", { levelId: "L1" });
  }

  private confirmAbortRta(): void {
    this.modal("RTA をやめる", "計測を中断して、いつものセーブに戻ります。", "やめる", () => {
      abortRta();
      session.leaveRtaSave();
      this.scene.restart();
    });
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
    new Button(this, MARGIN + treeW / 2, y, {
      width: treeW,
      label: "スキルツリー",
      sub: `CE ${session.data.meta.tokens.ce}`,
      onTap: () => goTo(this, "Tree"),
    });

    // SPEC-127: 音の設定（BGM・SE の 20 段階）。いまの段階を sub に出し、押すと上げ下げの画面
    const soundW = fullW - treeW - CELL_GAP;
    const sound: Button = new Button(this, GAME_WIDTH - MARGIN - soundW / 2, y, {
      width: soundW,
      label: "音の設定",
      sub: this.soundSummary(),
      onTap: () => this.openSoundSettings(() => sound.setSub(this.soundSummary())),
    });
  }

  private soundSummary(): string {
    const s = session.data.settings;
    return `BGM ${volumeLabel(s.bgmVolume)} / SE ${volumeLabel(s.seVolume)}`;
  }

  /**
   * SPEC-127: BGM・SE を「−」「＋」で 5% ずつ（0 は OFF）上げ下げする。押した瞬間に保存し、
   * BGM は再生中の曲にその場で反映、SE はステッパーのタップ音が新しい大きさの試し聞きになる。
   */
  private openSoundSettings(onClose: () => void): void {
    const parts: Phaser.GameObjects.GameObject[] = [];
    const close = () => {
      parts.forEach((p) => p.destroy());
      onClose();
    };
    const top = 360;
    const h = 460;
    const w = GAME_WIDTH - MARGIN * 2;
    parts.push(this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setOrigin(0).setDepth(200).setInteractive());
    const g = this.add.graphics().setDepth(201);
    g.fillStyle(COLORS.panel, 0.98).fillRoundedRect(MARGIN, top, w, h, 24);
    g.lineStyle(3, COLORS.gold, 1).strokeRoundedRect(MARGIN, top, w, h, 24);
    parts.push(g);
    parts.push(this.add.text(CENTER_X, top + 60, "音の設定", textStyle(36, { color: COLORS.gold })).setOrigin(0.5).setDepth(201));
    const rowW = w - 80;
    parts.push(
      new VolumeStepper(this, CENTER_X, top + 150, {
        width: rowW,
        label: "BGM",
        value: session.data.settings.bgmVolume,
        onChange: (v) => {
          session.update((d) => ({ ...d, settings: { ...d.settings, bgmVolume: v } }));
          playBgm(this, "bgm.land");
        },
      }).setDepth(201),
    );
    parts.push(
      new VolumeStepper(this, CENTER_X, top + 255, {
        width: rowW,
        label: "SE",
        value: session.data.settings.seVolume,
        onChange: (v) => session.update((d) => ({ ...d, settings: { ...d.settings, seVolume: v } })),
      }).setDepth(201),
    );
    parts.push(new Button(this, CENTER_X, top + h - 74, { width: rowW, label: "閉じる", kind: "primary", onTap: close }).setDepth(201));
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
