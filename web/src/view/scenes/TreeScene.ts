import Phaser from "phaser";
import { DIALOGS } from "../../data/dialogs";
import { getLevel } from "../../data/levels";
import { STAT_LABEL, TREE, TREE_BY_ID, nodeCost, type TreeBranch, type TreeNode } from "../../data/tree";
import { buyBlock, buyNode, hasSeen, isReachable, markSeen, nodeLevel, refundAll, refundNode, totalSpent } from "../../meta/progress";
import { playBgm, playSe } from "../audio";
import { bindPress } from "../input/press";
import { CENTER_X, GAME_HEIGHT, GAME_WIDTH, MARGIN } from "../layout";
import { session } from "../session";
import { playDialog } from "../ui/dialog";
import { Header, HEADER_H, goTo } from "../ui/header";
import { COLORS, textStyle } from "../ui/theme";
import { Button, LandBackground, showToast } from "../ui/widgets";
import { jaWrap } from "../ui/jaWrap";

/** ツリー座標 1 あたりの px */
const UNIT = 120;
const NODE_R = 40;
const PANEL_TOP = 1000;
const ZOOM_MIN = 0.55;
const ZOOM_MAX = 1.6;

const BRANCH_COLOR: Record<TreeBranch, number> = {
  core: COLORS.gold,
  archer: 0x6be675,
  lightning: 0xffe066,
  pulse: 0xb48cff,
  fire: 0xff7043,
  miner: 0xe8c07a,
  cannon: 0x5ee0ff,
  defense: 0x5aa9ff,
  economy: 0xf5a142,
  stone: 0xff5fa2,
};

interface NodeView {
  node: TreeNode;
  ring: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Image;
  level: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
}

/** SPEC-107: スキルツリー画面。ドラッグで移動、ピンチ / ホイールで拡大縮小、タップで詳細。 */
export class TreeScene extends Phaser.Scene {
  private world!: Phaser.GameObjects.Container;
  private edges!: Phaser.GameObjects.Graphics;
  private views = new Map<string, NodeView>();
  private header!: Header;
  private panel: Phaser.GameObjects.GameObject[] = [];
  private selected: string | null = null;
  private pinch: { dist: number; scale: number } | null = null;
  private modal: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super("Tree");
  }

  /** リザルトから来た場合の再挑戦先 */
  private retryLevelId: string | null = null;

  init(data: { retryLevelId?: string }): void {
    this.retryLevelId = data?.retryLevelId ?? null;
  }

  create(): void {
    this.views.clear();
    this.selected = null;
    this.pinch = null;
    this.modal = [];
    this.panel = [];
    this.cameras.main.fadeIn(180, 11, 13, 18);
    playBgm(this, "bgm.land");
    void new LandBackground(this, 0.82).show(session.data.profile.cryptidId);

    this.world = this.add.container(CENTER_X, 600).setDepth(10);
    this.edges = this.add.graphics();
    this.world.add(this.edges);
    for (const n of TREE) this.buildNode(n);
    this.setupPanZoom();

    this.header = new Header(this, "スキルツリー", () => goTo(this, "Home"));

    this.add.rectangle(0, PANEL_TOP, GAME_WIDTH, GAME_HEIGHT - PANEL_TOP, COLORS.bg, 0.94).setOrigin(0).setDepth(80);
    this.add.rectangle(0, PANEL_TOP, GAME_WIDTH, 2, COLORS.line).setOrigin(0).setDepth(80);
    this.refresh();

    // リザルトから来た場合は、強化したらそのまま再挑戦できるようにする
    if (this.retryLevelId) {
      const level = getLevel(this.retryLevelId);
      const retry = new Button(this, GAME_WIDTH - MARGIN - 160, PANEL_TOP - 66, {
        width: 320,
        label: "▶ 再挑戦",
        sub: level.name,
        kind: "primary",
        onTap: () => goTo(this, "Run", { levelId: level.id }),
      }).setDepth(82);
      retry.setAlpha(0.97);
    }

    if (!hasSeen(session.data, "tree.first")) {
      void playDialog(this, DIALOGS["tree.first"]).then(() => session.update((d) => markSeen(d, "tree.first")));
    }
  }

  // ─── ノード ──────────────────────────────────────────────

  private buildNode(n: TreeNode): void {
    const x = n.pos.x * UNIT;
    const y = n.pos.y * UNIT;
    const ring = this.add.graphics();
    const icon = this.add.image(0, 0, n.icon);
    icon.setScale(46 / Math.max(icon.width, icon.height));
    const level = this.add.text(0, NODE_R - 2, "", { ...textStyle(16, { color: COLORS.bg }), backgroundColor: "#f5c542", padding: { x: 5, y: 1 } }).setOrigin(0.5, 0);
    const label = this.add
      .text(0, NODE_R + 24, n.name, { ...textStyle(14, { weight: 500, color: COLORS.inkDim, align: "center" }), wordWrap: jaWrap(176) })
      .setOrigin(0.5, 0);
    const c = this.add.container(x, y, [ring, icon, level, label]).setSize(NODE_R * 2 + 8, NODE_R * 2 + 8).setInteractive({ useHandCursor: true });
    bindPress(c, {
      onPressChange: (p) => c.setScale(p ? 0.93 : 1),
      onTap: () => this.select(n.id),
    });
    this.world.add(c);
    this.views.set(n.id, { node: n, ring, icon, level, label });
  }

  private refresh(): void {
    const save = session.data;
    this.header.setCe(save.meta.tokens.ce);

    this.edges.clear();
    for (const n of TREE) {
      if (!n.parent) continue;
      const p = TREE_BY_ID.get(n.parent)!;
      const owned = nodeLevel(save, n.id) > 0;
      this.edges.lineStyle(owned ? 6 : 3, owned ? BRANCH_COLOR[n.branch] : COLORS.line, owned ? 0.9 : 0.8);
      this.edges.lineBetween(p.pos.x * UNIT, p.pos.y * UNIT, n.pos.x * UNIT, n.pos.y * UNIT);
    }

    for (const v of this.views.values()) {
      const n = v.node;
      const lv = nodeLevel(save, n.id);
      const reachable = isReachable(save, n);
      const canBuy = buyBlock(save, n.id) === null;
      const color = BRANCH_COLOR[n.branch];
      const maxed = lv >= n.maxLevel;
      const g = v.ring.clear();
      g.fillStyle(lv > 0 ? color : COLORS.panelRaised, lv > 0 ? 0.3 : reachable ? 0.95 : 0.6).fillCircle(0, 0, NODE_R);
      g.lineStyle(maxed ? 5 : canBuy ? 4 : 2, maxed ? COLORS.gold : canBuy ? COLORS.gold : lv > 0 ? color : COLORS.line, 1).strokeCircle(0, 0, NODE_R);
      if (this.selected === n.id) g.lineStyle(3, 0xffffff, 0.9).strokeCircle(0, 0, NODE_R + 8);
      v.icon.setAlpha(reachable ? 1 : 0.3);
      v.level.setText(`${lv}/${n.maxLevel}`).setVisible(reachable);
      v.label.setColor(`#${(lv > 0 ? COLORS.ink : reachable ? COLORS.inkDim : COLORS.inkMuted).toString(16).padStart(6, "0")}`);
    }
    this.renderPanel();
  }

  private select(id: string): void {
    this.selected = this.selected === id ? null : id;
    this.refresh();
  }

  // ─── 詳細パネル ─────────────────────────────────────────

  private renderPanel(): void {
    for (const o of this.panel) o.destroy();
    this.panel = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => {
      (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(85);
      this.panel.push(o);
      return o;
    };
    const save = session.data;
    if (!this.selected) {
      add(this.add.text(MARGIN, PANEL_TOP + 40, "スキルをタップすると詳細が表示されます", textStyle(22)).setOrigin(0, 0.5));
      add(this.add.text(MARGIN, PANEL_TOP + 80, "ドラッグで移動 ／ ピンチ・ホイールで拡大縮小 ／ 返金は無料", textStyle(18, { weight: 500, color: COLORS.inkDim })).setOrigin(0, 0.5));
      add(this.add.text(MARGIN, PANEL_TOP + 130, `使用中の CE: ${totalSpent(save)} ／ 累計獲得: ${save.meta.tokensEarned.ce}`, textStyle(20, { color: COLORS.inkDim })).setOrigin(0, 0.5));
      add(
        new Button(this, GAME_WIDTH - MARGIN - 110, PANEL_TOP + 212, {
          width: 220,
          label: "全返金",
          kind: totalSpent(save) > 0 ? "secondary" : "locked",
          onTap: () => this.confirmRefundAll(),
        }),
      );
      return;
    }
    const n = TREE_BY_ID.get(this.selected)!;
    const lv = nodeLevel(save, n.id);
    const block = buyBlock(save, n.id);
    const fx = (level: number) => n.effects.map((e) => STAT_LABEL[e.stat](e.perLevel * level)).join(" ／ ");

    add(this.add.text(MARGIN, PANEL_TOP + 18, n.name, textStyle(28)).setOrigin(0, 0));
    add(this.add.text(GAME_WIDTH - MARGIN, PANEL_TOP + 24, `Lv ${lv} / ${n.maxLevel}`, textStyle(24, { color: COLORS.gold })).setOrigin(1, 0));
    add(this.add.text(MARGIN, PANEL_TOP + 56, `出典: ${n.source}${n.note ? `　${n.note}` : ""}`, { ...textStyle(17, { weight: 500, color: COLORS.inkMuted }), wordWrap: jaWrap(GAME_WIDTH - MARGIN * 2) }));
    add(this.add.text(MARGIN, PANEL_TOP + 96, `現在: ${lv > 0 ? fx(lv) : "—"}`, textStyle(19, { weight: 500, color: COLORS.inkDim })));
    if (lv < n.maxLevel) add(this.add.text(MARGIN, PANEL_TOP + 124, `次　: ${fx(lv + 1)}`, textStyle(19, { color: COLORS.ink })));

    const y = PANEL_TOP + 212;
    const cost = lv < n.maxLevel ? nodeCost(n, lv) : null;
    const label = block === "maxed" ? "最大レベル" : block === "locked" ? "前のスキルが必要" : `${lv === 0 ? "解放" : "強化"}  ${cost} CE`;
    add(
      new Button(this, MARGIN + 210, y, {
        width: 420,
        label,
        kind: block === null ? "primary" : "locked",
        onTap: () => this.buy(n.id),
      }),
    );
    add(
      new Button(this, GAME_WIDTH - MARGIN - 110, y, {
        width: 220,
        label: "返金",
        kind: lv > 0 ? "secondary" : "locked",
        onTap: () => this.refund(n.id),
      }),
    );
  }

  private buy(id: string): void {
    const block = buyBlock(session.data, id);
    if (block === "tokens") return showToast(this, "CE が足りません。ランで CE を集めよう！");
    if (block === "locked") return showToast(this, "先に線でつながった前のスキルを解放してください");
    if (block) return;
    session.update((d) => buyNode(d, id));
    playSe(this, "se.buff");
    this.refresh();
  }

  private refund(id: string): void {
    if (nodeLevel(session.data, id) === 0) return;
    const before = session.data.meta.tokens.ce;
    session.update((d) => refundNode(d, id));
    playSe(this, "se.treasure");
    showToast(this, `${session.data.meta.tokens.ce - before} CE を返金しました`);
    this.refresh();
  }

  private confirmRefundAll(): void {
    if (totalSpent(session.data) === 0) return showToast(this, "返金するスキルがありません");
    const close = () => {
      for (const o of this.modal) o.destroy();
      this.modal = [];
    };
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => {
      (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(300);
      this.modal.push(o);
      return o;
    };
    add(this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setOrigin(0).setInteractive());
    add(this.add.text(CENTER_X, 500, `すべてのスキルを返金しますか？\n（${totalSpent(session.data)} CE が戻ります）`, textStyle(28, { align: "center" })).setOrigin(0.5));
    add(new Button(this, CENTER_X - 150, 640, { width: 260, label: "返金する", kind: "primary", onTap: () => {
      session.update((d) => refundAll(d));
      playSe(this, "se.treasure");
      close();
      this.refresh();
    } }));
    add(new Button(this, CENTER_X + 150, 640, { width: 260, label: "やめる", onTap: close }));
  }

  // ─── パン・ズーム ───────────────────────────────────────

  private setupPanZoom(): void {
    const inTreeArea = (p: Phaser.Input.Pointer) => p.downY > HEADER_H && p.downY < PANEL_TOP;
    this.input.addPointer(1);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (this.modal.length > 0) return;
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;
      if (p1.isDown && p2.isDown) {
        const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        if (!this.pinch) this.pinch = { dist, scale: this.world.scale };
        this.zoomTo(this.pinch.scale * (dist / this.pinch.dist), (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
        return;
      }
      this.pinch = null;
      if (p.isDown && inTreeArea(p)) {
        this.world.x += p.x - p.prevPosition.x;
        this.world.y += p.y - p.prevPosition.y;
        this.clampWorld();
      }
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, () => (this.pinch = null));
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.zoomTo(this.world.scale * (dy > 0 ? 0.9 : 1.1), p.x, p.y);
    });
  }

  private zoomTo(scale: number, fx: number, fy: number): void {
    const s = Phaser.Math.Clamp(scale, ZOOM_MIN, ZOOM_MAX);
    const k = s / this.world.scale;
    this.world.x = fx - (fx - this.world.x) * k;
    this.world.y = fy - (fy - this.world.y) * k;
    this.world.setScale(s);
    this.clampWorld();
  }

  /** ツリーが画面外へ行き過ぎないようにする */
  private clampWorld(): void {
    const s = this.world.scale;
    const xs = TREE.map((n) => n.pos.x * UNIT * s);
    const ys = TREE.map((n) => n.pos.y * UNIT * s);
    const margin = 120;
    this.world.x = Phaser.Math.Clamp(this.world.x, margin - Math.max(...xs), GAME_WIDTH - margin - Math.min(...xs));
    this.world.y = Phaser.Math.Clamp(this.world.y, HEADER_H + margin - Math.max(...ys), PANEL_TOP - margin - Math.min(...ys));
  }
}
