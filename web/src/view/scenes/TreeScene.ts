import Phaser from "phaser";
import { DIALOGS } from "../../data/dialogs";
import { LEVELS, getLevel } from "../../data/levels";
import { CONDITION_LABEL, FEATURE_LABEL, STAT_LABEL, TOKEN_LABEL, TREE, TREE_BY_ID, nodeCost, type TreeBranch, type TreeNode } from "../../data/tree";
import {
  buyBlock,
  buyNode,
  clearBuildSet,
  closestUnlock,
  conditionValue,
  hasSeen,
  isFeatureUnlocked,
  isReachable,
  loadBuildSet,
  markSeen,
  nextChallengeLevel,
  nextThreshold,
  nodeLevel,
  refundAll,
  refundNode,
  saveBuildSet,
  totalSpent,
  visibleNodes,
} from "../../meta/progress";
import type { SaveData } from "../../meta/save";
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
/** パネルの半径（四角は一辺 NODE_R × 2） */
const NODE_R = 40;
const SQUARE_RADIUS = 10;
/** SPEC-119 §2a: 枠の色。強化できる = 緑、CE・エンブレム・条件が足りない = 赤 */
const FRAME_OK = 0x5ee06b;
const FRAME_NG = 0xff5a5a;
/** 1 段広がるときの演出（線が伸びる → パネルが開く）の長さ（ms）と、兄弟ごとのずれ */
const GROW_MS = 520;
const POP_MS = 360;
const STAGGER_MS = 110;
/** 神経の信号（線を流れる光）が親 → 子を 1 往復する周期（ms） */
const PULSE_MS = 2400;

/** 前回ツリー画面で見えていたパネル（次に開いたとき、増えた分だけ広がる演出をする） */
let lastShown: Set<string> | null = null;

/** ID から決まる 0〜1 の値（線の曲がり方・信号のずれを毎回同じにする） */
function hash01(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}
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
  box: Phaser.GameObjects.Container;
  ring: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Image;
  level: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
  /** SPEC-119: エンブレムで買うパネルの上辺の印 */
  badge?: Phaser.GameObjects.Container;
}

/** 条件の記録を読みやすく（1500 → 1,500） */
const fmt = (v: number) => Math.floor(v).toLocaleString("ja-JP");

/** SPEC-119: パネルの効果（機能を解放するパネルは機能名） */
const effectText = (n: TreeNode, level: number) =>
  n.feature && n.effects.length === 0 ? FEATURE_LABEL[n.feature] : n.effects.map((e) => STAT_LABEL[e.stat](e.perLevel * level)).join(" ／ ");

/** 使用中のトークン（両方） */
const spentLabel = (save: SaveData) => `CE ${totalSpent(save, "ce")}` + (save.meta.tokensEarned.emblem > 0 ? ` ／ エンブレム ${totalSpent(save, "emblem")}` : "");

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
  /** SPEC-119 §2a: いま表示しているパネル */
  private shown = new Set<string>();
  /** 広がる演出中の線（子 ID → 始まった時刻） */
  private growing = new Map<string, number>();
  /** 強化できるパネルの光（緑の枠の脈動） */
  private halo!: Phaser.GameObjects.Graphics;

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
    this.halo = this.add.graphics();
    this.world.add([this.edges, this.halo]);
    // 前回見えていた分はそのまま出し、増えた分は refresh() で広がる演出をする
    const visible = visibleNodes(session.data);
    this.growing.clear();
    this.shown = lastShown ? new Set([...visible].filter((id) => lastShown!.has(id) || !TREE_BY_ID.get(id)!.parent)) : visible;
    for (const n of TREE) this.buildNode(n);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => (lastShown = new Set(this.shown)));
    this.setupPanZoom();

    // リザルトから来た場合、戻るはノード選択へ（ホームを経由しない）
    this.header = new Header(this, "スキルツリー", () => goTo(this, this.retryLevelId ? "LevelSelect" : "Home"));

    this.add.rectangle(0, PANEL_TOP, GAME_WIDTH, GAME_HEIGHT - PANEL_TOP, COLORS.bg, 0.94).setOrigin(0).setDepth(80);
    this.add.rectangle(0, PANEL_TOP, GAME_WIDTH, 2, COLORS.line).setOrigin(0).setDepth(80);
    this.refresh();

    // リザルトから来た場合: 強化したらそのまま次へ。クリア済みなら次のノード、未クリアなら再挑戦
    if (this.retryLevelId) {
      const targetId = nextChallengeLevel(session.data, this.retryLevelId);
      const level = getLevel(targetId);
      const isNext = targetId !== this.retryLevelId;
      const go = new Button(this, GAME_WIDTH - MARGIN - 170, PANEL_TOP - 66, {
        width: 340,
        label: isNext ? "▶ 次のノードへ" : "▶ 再挑戦",
        sub: `Lv${LEVELS.findIndex((l) => l.id === targetId) + 1} ${level.name}`,
        kind: "primary",
        onTap: () => goTo(this, "Run", { levelId: level.id }),
      }).setDepth(82);
      go.setAlpha(0.97);
      new Button(this, MARGIN + 110, PANEL_TOP - 66, { width: 220, label: "ノード選択", onTap: () => goTo(this, "LevelSelect") })
        .setDepth(82)
        .setAlpha(0.97);
    }

    if (!hasSeen(session.data, "tree.first")) {
      void playDialog(this, DIALOGS["tree.first"]).then(() => session.update((d) => markSeen(markSeen(d, "tree.first"), "tree.panels")));
    } else if (!hasSeen(session.data, "tree.panels")) {
      // SPEC-119: 以前から遊んでいる人には、新しいパネルの形だけ説明する
      void playDialog(this, DIALOGS["tree.panels"]).then(() => session.update((d) => markSeen(d, "tree.panels")));
    }
  }

  // ─── ノード ──────────────────────────────────────────────

  private buildNode(n: TreeNode): void {
    const x = n.pos.x * UNIT;
    const y = n.pos.y * UNIT;
    const ring = this.add.graphics();
    const icon = this.add.image(0, 0, n.icon);
    // 魔石の画像は余白が広いので大きめに
    icon.setScale((n.icon.startsWith("stone.") ? 96 : 46) / Math.max(icon.width, icon.height));
    const level = this.add.text(0, NODE_R - 12, "", { ...textStyle(15, { color: COLORS.bg }), backgroundColor: "#f5c542", padding: { x: 5, y: 1 } }).setOrigin(0.5, 0);
    const label = this.add
      .text(0, NODE_R + 20, n.name, { ...textStyle(14, { weight: 500, color: COLORS.inkDim, align: "center" }), wordWrap: jaWrap(150) })
      .setOrigin(0.5, 0);
    const parts: Phaser.GameObjects.GameObject[] = [ring, icon, level, label];
    let badge: Phaser.GameObjects.Container | undefined;
    if (n.cost.token === "emblem" && !n.condition) {
      // SPEC-119: エンブレムが要るパネルは、四角の上辺に重ねてエンブレムと枚数を出す
      const bg = this.add.graphics();
      bg.fillStyle(COLORS.bg, 0.95).fillRoundedRect(-30, -15, 60, 30, 15);
      bg.lineStyle(2, COLORS.gold, 1).strokeRoundedRect(-30, -15, 60, 30, 15);
      const em = this.add.image(-12, 0, "icon.emblem");
      em.setScale(26 / Math.max(em.width, em.height));
      const cnt = this.add.text(13, 0, `${n.cost.base}`, textStyle(18, { color: COLORS.gold })).setOrigin(0.5);
      badge = this.add.container(0, -NODE_R, [bg, em, cnt]);
      parts.push(badge);
    }
    const c = this.add.container(x, y, parts).setSize(NODE_R * 2 + 8, NODE_R * 2 + 8).setInteractive({ useHandCursor: true });
    bindPress(c, {
      onPressChange: (p) => c.setScale(p ? 0.93 : 1),
      onTap: () => this.select(n.id),
    });
    this.world.add(c);
    c.setVisible(this.shown.has(n.id));
    this.views.set(n.id, { node: n, box: c, ring, icon, level, label, badge });
  }

  private refresh(): void {
    const save = session.data;
    this.header.setTokens(save.meta.tokens.ce, save.meta.tokens.emblem, save.meta.tokensEarned.emblem > 0);

    this.syncVisible();

    for (const v of this.views.values()) {
      const n = v.node;
      const lv = nodeLevel(save, n.id);
      const reachable = isReachable(save, n);
      const canBuy = buyBlock(save, n.id) === null;
      const color = BRANCH_COLOR[n.branch];
      const maxed = lv >= n.maxLevel;
      const g = v.ring.clear();
      const selected = this.selected === n.id;
      // 枠: 強化できる = 緑、まだ解放しておらず足りない = 赤、解放済み = 系統の色（最大は金）
      const frame = maxed ? COLORS.gold : canBuy ? FRAME_OK : lv === 0 ? FRAME_NG : color;
      const frameW = maxed || canBuy ? 5 : 3;
      if (n.condition) {
        // SPEC-119: 条件つきパネルは丸。次のしきい値までの進み具合を外周の弧で見せる
        g.fillStyle(lv > 0 ? color : COLORS.panelRaised, lv > 0 ? 0.3 : 0.9).fillCircle(0, 0, NODE_R);
        g.lineStyle(frameW, frame, 1).strokeCircle(0, 0, NODE_R);
        const next = nextThreshold(save, n);
        if (next !== null) {
          const prev = lv > 0 ? n.condition.thresholds[lv - 1] : 0;
          const t = Phaser.Math.Clamp((conditionValue(save, n.condition.stat) - prev) / (next - prev), 0, 1);
          g.lineStyle(3, COLORS.line, 0.6).strokeCircle(0, 0, NODE_R + 7);
          if (t > 0) {
            g.lineStyle(5, COLORS.gold, 1).beginPath();
            g.arc(0, 0, NODE_R + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t, false).strokePath();
          }
        }
        if (selected) g.lineStyle(3, 0xffffff, 0.9).strokeCircle(0, 0, NODE_R + 14);
      } else {
        // 通常のパネルは四角
        const r = NODE_R;
        g.fillStyle(lv > 0 ? color : COLORS.panelRaised, lv > 0 ? 0.3 : reachable ? 0.95 : 0.6).fillRoundedRect(-r, -r, r * 2, r * 2, SQUARE_RADIUS);
        g.lineStyle(frameW, frame, 1).strokeRoundedRect(-r, -r, r * 2, r * 2, SQUARE_RADIUS);
        if (selected) g.lineStyle(3, 0xffffff, 0.9).strokeRoundedRect(-r - 8, -r - 8, r * 2 + 16, r * 2 + 16, SQUARE_RADIUS + 6);
      }
      v.icon.setAlpha(reachable || lv > 0 ? 1 : 0.3);
      v.badge?.setVisible(lv === 0).setAlpha(reachable ? 1 : 0.45);
      v.level.setText(`${lv}/${n.maxLevel}`).setVisible(reachable);
      v.label.setColor(`#${(lv > 0 ? COLORS.ink : reachable ? COLORS.inkDim : COLORS.inkMuted).toString(16).padStart(6, "0")}`);
    }
    this.renderPanel();
  }

  // ─── 神経網のように広がる演出（SPEC-119 §2a） ─────────────────

  /** 表示すべきパネルと今の表示を合わせる。増えた分は線が伸びてから開き、減った分（返金）はしぼむ */
  private syncVisible(): void {
    const visible = visibleNodes(session.data);
    const added = TREE.filter((n) => visible.has(n.id) && !this.shown.has(n.id));
    const removed = TREE.filter((n) => !visible.has(n.id) && this.shown.has(n.id));
    for (const n of removed) {
      if (this.selected === n.id) this.selected = null;
      this.shown.delete(n.id);
      this.growing.delete(n.id);
      const box = this.views.get(n.id)!.box;
      this.tweens.killTweensOf(box);
      this.tweens.add({ targets: box, scale: 0, alpha: 0, duration: 180, ease: "Quad.easeIn", onComplete: () => box.setVisible(false) });
    }
    if (added.length === 0) return;
    // 親ごとに少しずつずらして、枝分かれしながら伸びていくように見せる
    const order = new Map<string, number>();
    const now = this.time.now;
    for (const n of added) {
      const k = order.get(n.parent ?? "") ?? 0;
      order.set(n.parent ?? "", k + 1);
      this.shown.add(n.id);
      const start = now + k * STAGGER_MS;
      this.growing.set(n.id, start);
      const box = this.views.get(n.id)!.box;
      this.tweens.killTweensOf(box);
      box.setVisible(true).setScale(0).setAlpha(0);
      this.tweens.add({ targets: box, scale: 1, alpha: 1, delay: k * STAGGER_MS + GROW_MS, duration: POP_MS, ease: "Back.easeOut", onStart: () => this.sparkAt(n) });
    }
    this.time.delayedCall(GROW_MS * 0.4, () => playSe(this, "se.production"));
    this.revealAdded(added);
  }

  /** パネルが開く瞬間の光の輪 */
  private sparkAt(n: TreeNode): void {
    const ring = this.add.circle(n.pos.x * UNIT, n.pos.y * UNIT, NODE_R * 0.6, BRANCH_COLOR[n.branch], 0.25).setStrokeStyle(4, BRANCH_COLOR[n.branch], 0.9);
    this.world.addAt(ring, 2);
    this.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 520, ease: "Quad.easeOut", onComplete: () => ring.destroy() });
  }

  /** 新しく開いたパネルが画面の外なら、見える位置までゆっくり寄せる */
  private revealAdded(added: TreeNode[]): void {
    const s = this.world.scale;
    const top = HEADER_H + 40;
    const bottom = PANEL_TOP - 60;
    const out = added.filter((n) => {
      const x = this.world.x + n.pos.x * UNIT * s;
      const y = this.world.y + n.pos.y * UNIT * s;
      return x < 40 || x > GAME_WIDTH - 40 || y < top || y > bottom;
    });
    if (out.length === 0) return;
    const cx = out.reduce((a, n) => a + n.pos.x, 0) / out.length;
    const cy = out.reduce((a, n) => a + n.pos.y, 0) / out.length;
    const parent = TREE_BY_ID.get(out[0].parent ?? "") ?? out[0];
    const mx = (cx + parent.pos.x) / 2;
    const my = (cy + parent.pos.y) / 2;
    const target = { x: CENTER_X - mx * UNIT * s, y: (top + bottom) / 2 - my * UNIT * s };
    this.tweens.add({ targets: this.world, x: target.x, y: target.y, duration: 600, ease: "Sine.easeInOut", onUpdate: () => this.clampWorld() });
  }

  /** 親 → 子の線（少し曲がった神経のような線）上の点。t = 0（親）〜 1（子） */
  private edgePoint(n: TreeNode, t: number): { x: number; y: number } {
    const p = TREE_BY_ID.get(n.parent!)!;
    const ax = p.pos.x * UNIT;
    const ay = p.pos.y * UNIT;
    const bx = n.pos.x * UNIT;
    const by = n.pos.y * UNIT;
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const bend = (hash01(n.id) - 0.5) * 0.36 * len;
    const cx = (ax + bx) / 2 + (-(by - ay) / len) * bend;
    const cy = (ay + by) / 2 + ((bx - ax) / len) * bend;
    const u = 1 - t;
    return { x: u * u * ax + 2 * u * t * cx + t * t * bx, y: u * u * ay + 2 * u * t * cy + t * t * by };
  }

  private strokeEdge(n: TreeNode, t1: number, width: number, color: number, alpha: number): void {
    const g = this.edges;
    const steps = Math.max(2, Math.ceil(16 * t1));
    g.lineStyle(width, color, alpha).beginPath();
    for (let i = 0; i <= steps; i++) {
      const q = this.edgePoint(n, (t1 * i) / steps);
      if (i === 0) g.moveTo(q.x, q.y);
      else g.lineTo(q.x, q.y);
    }
    g.strokePath();
  }

  /** 毎フレーム: 線（伸びている途中を含む）・流れる信号・強化できるパネルの脈動を描く */
  update(time: number): void {
    const save = session.data;
    const g = this.edges.clear();
    for (const id of this.shown) {
      const n = TREE_BY_ID.get(id)!;
      if (!n.parent) continue;
      const color = BRANCH_COLOR[n.branch];
      const start = this.growing.get(id);
      const t = start === undefined ? 1 : Phaser.Math.Clamp((time - start) / GROW_MS, 0, 1);
      if (start !== undefined && t >= 1) this.growing.delete(id);
      if (t <= 0) continue;
      const owned = nodeLevel(save, id) > 0;
      if (owned) {
        this.strokeEdge(n, t, 12, color, 0.14);
        this.strokeEdge(n, t, 4, color, 0.9);
      } else {
        this.strokeEdge(n, t, 6, color, 0.08);
        this.strokeEdge(n, t, 2.5, color, 0.55);
      }
      if (t < 1) {
        // 伸びている先端の光
        const tip = this.edgePoint(n, t);
        g.fillStyle(0xffffff, 0.95).fillCircle(tip.x, tip.y, 6);
        g.fillStyle(color, 0.35).fillCircle(tip.x, tip.y, 14);
      } else if (owned || nodeLevel(save, n.parent) > 0) {
        // 神経の信号: 親から子へ光が流れる（解放済みの線は明るく）
        const phase = ((time / PULSE_MS + hash01(id)) % 1 + 1) % 1;
        const q = this.edgePoint(n, phase);
        g.fillStyle(color, owned ? 0.35 : 0.18).fillCircle(q.x, q.y, owned ? 10 : 7);
        g.fillStyle(0xffffff, owned ? 0.9 : 0.45).fillCircle(q.x, q.y, owned ? 3.5 : 2.5);
      }
    }
    // 強化できるパネルの緑の脈動
    const h = this.halo.clear();
    const a = 0.25 + 0.25 * Math.sin(time / 260);
    for (const id of this.shown) {
      const v = this.views.get(id)!;
      if (!v.box.visible || v.box.scale < 0.99 || buyBlock(save, id) !== null) continue;
      const n = v.node;
      const x = n.pos.x * UNIT;
      const y = n.pos.y * UNIT;
      h.lineStyle(8, FRAME_OK, a);
      if (n.condition) h.strokeCircle(x, y, NODE_R + 6);
      else h.strokeRoundedRect(x - NODE_R - 6, y - NODE_R - 6, NODE_R * 2 + 12, NODE_R * 2 + 12, SQUARE_RADIUS + 4);
    }
  }

  /** パネルを選んで画面の中央へ動かす */
  private focusNode(id: string): void {
    const n = TREE_BY_ID.get(id);
    if (!n) return;
    const s = this.world.scale;
    this.world.x = CENTER_X - n.pos.x * UNIT * s;
    this.world.y = (HEADER_H + PANEL_TOP) / 2 - n.pos.y * UNIT * s;
    this.clampWorld();
    this.selected = id;
    this.refresh();
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
      add(this.add.text(MARGIN, PANEL_TOP + 114, `使用中: ${spentLabel(save)} ／ 累計 CE ${save.meta.tokensEarned.ce}`, textStyle(20, { color: COLORS.inkDim })).setOrigin(0, 0.5));
      // SPEC-119: 次に届きそうな丸いパネル（タップでそのパネルを選ぶ）
      const soon = closestUnlock(save, this.shown);
      if (soon) {
        const unit = CONDITION_LABEL[soon.node.condition!.stat];
        const lv = nodeLevel(save, soon.node.id);
        const hint = add(
          this.add
            .text(MARGIN, PANEL_TOP + 148, `もうすぐ解放: ${soon.node.name}${soon.node.maxLevel > 1 ? ` Lv${lv + 1}` : ""}（${unit.name} あと ${fmt(soon.remaining)} ${unit.unit}）`, textStyle(18, { color: COLORS.gold }))
            .setOrigin(0, 0.5)
            .setInteractive({ useHandCursor: true }),
        );
        hint.on("pointerup", () => this.focusNode(soon.node.id));
      }
      // SPEC-119: 記録（条件つきパネル） / ビルドセット / 全返金
      const w = (GAME_WIDTH - MARGIN * 2 - 32) / 3;
      const by = PANEL_TOP + 212;
      add(new Button(this, MARGIN + w / 2, by, { width: w, label: "記録と解放", onTap: () => this.showRecords() }));
      const builds = isFeatureUnlocked(save, "buildSets");
      add(
        new Button(this, MARGIN + w * 1.5 + 16, by, {
          width: w,
          label: "ビルド",
          kind: builds ? "secondary" : "locked",
          onTap: () => (builds ? this.showBuildSets() : showToast(this, "丸いパネル「大日本沿海輿地全図」（累計 CE 300）で解放されます")),
        }),
      );
      add(
        new Button(this, GAME_WIDTH - MARGIN - w / 2, by, {
          width: w,
          label: "全返金",
          kind: totalSpent(save) + totalSpent(save, "emblem") > 0 ? "secondary" : "locked",
          onTap: () => this.confirmRefundAll(),
        }),
      );
      return;
    }
    const n = TREE_BY_ID.get(this.selected)!;
    const lv = nodeLevel(save, n.id);
    const block = buyBlock(save, n.id);
    const fx = (level: number) => effectText(n, level);
    if (n.condition) return this.renderConditionPanel(n, add);

    add(this.add.text(MARGIN, PANEL_TOP + 18, n.name, textStyle(28)).setOrigin(0, 0));
    add(this.add.text(GAME_WIDTH - MARGIN, PANEL_TOP + 24, `Lv ${lv} / ${n.maxLevel}`, textStyle(24, { color: COLORS.gold })).setOrigin(1, 0));
    add(this.add.text(MARGIN, PANEL_TOP + 56, `出典: ${n.source}${n.note ? `　${n.note}` : ""}`, { ...textStyle(17, { weight: 500, color: COLORS.inkMuted }), wordWrap: jaWrap(GAME_WIDTH - MARGIN * 2) }));
    add(this.add.text(MARGIN, PANEL_TOP + 96, `現在: ${lv > 0 ? fx(lv) : "—"}`, textStyle(19, { weight: 500, color: COLORS.inkDim })));
    if (lv < n.maxLevel) add(this.add.text(MARGIN, PANEL_TOP + 124, `次　: ${fx(lv + 1)}`, textStyle(19, { color: COLORS.ink })));

    const y = PANEL_TOP + 212;
    const cost = lv < n.maxLevel ? nodeCost(n, lv) : null;
    const label = block === "maxed" ? "最大レベル" : block === "locked" ? "前のスキルが必要" : `${lv === 0 ? "解放" : "強化"}  ${cost} ${TOKEN_LABEL[n.cost.token]}`;
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

  /** SPEC-119: 条件つきパネル（丸）の詳細。買えないので、条件と進み具合を出す */
  private renderConditionPanel(n: TreeNode, add: <T extends Phaser.GameObjects.GameObject>(o: T) => T): void {
    const save = session.data;
    const c = n.condition!;
    const lv = nodeLevel(save, n.id);
    const value = conditionValue(save, c.stat);
    const label = CONDITION_LABEL[c.stat];
    add(this.add.text(MARGIN, PANEL_TOP + 18, n.name, textStyle(28)).setOrigin(0, 0));
    add(this.add.text(GAME_WIDTH - MARGIN, PANEL_TOP + 24, `Lv ${lv} / ${n.maxLevel}`, textStyle(24, { color: COLORS.gold })).setOrigin(1, 0));
    add(this.add.text(MARGIN, PANEL_TOP + 56, `出典: ${n.source}${n.note ? `　${n.note}` : ""}`, { ...textStyle(17, { weight: 500, color: COLORS.inkMuted }), wordWrap: jaWrap(GAME_WIDTH - MARGIN * 2) }));
    add(this.add.text(MARGIN, PANEL_TOP + 96, `現在: ${lv > 0 ? effectText(n, lv) : "—"}`, textStyle(19, { weight: 500, color: COLORS.inkDim })));
    if (lv < n.maxLevel) add(this.add.text(MARGIN, PANEL_TOP + 124, `次　: ${effectText(n, lv + 1)}`, textStyle(19, { color: COLORS.ink })));
    const steps = c.thresholds.map((t, i) => (i < lv ? `✔${fmt(t)}` : fmt(t))).join(" → ");
    add(this.add.text(MARGIN, PANEL_TOP + 160, `条件: ${label.name} ${steps}（いま ${fmt(value)}）`, { ...textStyle(18, { weight: 500, color: COLORS.gold }), wordWrap: jaWrap(GAME_WIDTH - MARGIN * 2) }));
    const next = nextThreshold(save, n);
    add(
      new Button(this, CENTER_X, PANEL_TOP + 232, {
        width: GAME_WIDTH - MARGIN * 2,
        label: next === null ? "すべて解放済み" : `あと ${fmt(next - value)} ${label.unit}で${lv === 0 ? "解放" : "強化"}（無料）`,
        kind: "locked",
        onTap: () => showToast(this, "丸いパネルは条件を満たすと自動で解放されます（返金はありません）"),
      }),
    );
  }

  private buy(id: string): void {
    const block = buyBlock(session.data, id);
    if (block === "tokens") {
      const n = TREE_BY_ID.get(id)!;
      return showToast(
        this,
        n.cost.token === "emblem" ? "エンブレムが足りません。新しいノードを初めてクリアすると手に入ります" : "CE が足りません。ランで CE を集めよう！",
      );
    }
    if (block === "locked") return showToast(this, "先に線でつながった前のスキルを解放してください");
    if (block === "condition") return showToast(this, "丸いパネルは条件を満たすと自動で解放されます");
    if (block) return;
    session.update((d) => buyNode(d, id));
    this.refresh();
  }

  private refund(id: string): void {
    if (nodeLevel(session.data, id) === 0) return;
    const before = { ...session.data.meta.tokens };
    session.update((d) => refundNode(d, id));
    playSe(this, "se.treasure");
    const after = session.data.meta.tokens;
    const parts = [after.ce - before.ce > 0 ? `${after.ce - before.ce} CE` : "", after.emblem - before.emblem > 0 ? `エンブレム ${after.emblem - before.emblem}` : ""].filter(Boolean);
    showToast(this, `${parts.join("・")} を返金しました`);
    this.refresh();
  }

  // ─── モーダル（記録と解放 / ビルドセット） ──────────────

  private openModal(title: string): { add: <T extends Phaser.GameObjects.GameObject>(o: T) => T; close: () => void } {
    const close = () => {
      for (const o of this.modal) o.destroy();
      this.modal = [];
    };
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => {
      (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(300);
      this.modal.push(o);
      return o;
    };
    add(this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75).setOrigin(0).setInteractive());
    const g = add(this.add.graphics());
    g.fillStyle(COLORS.panel, 0.98).fillRoundedRect(32, 180, GAME_WIDTH - 64, 920, 22);
    g.lineStyle(2, COLORS.gold, 0.7).strokeRoundedRect(32, 180, GAME_WIDTH - 64, 920, 22);
    add(this.add.text(CENTER_X, 230, title, textStyle(32)).setOrigin(0.5));
    add(new Button(this, CENTER_X, 1030, { width: 300, label: "閉じる", onTap: close }));
    return { add, close };
  }

  /** SPEC-119: 記録と条件つきパネルの一覧（次に何をすれば解放されるか） */
  private showRecords(): void {
    const { add } = this.openModal("記録と解放");
    const save = session.data;
    add(this.add.text(CENTER_X, 272, "丸いパネルは記録が条件に届くと無料で解放されます", textStyle(19, { weight: 500, color: COLORS.inkDim })).setOrigin(0.5));
    const nodes = TREE.filter((n) => n.condition);
    const rowH = Math.min(64, 660 / nodes.length);
    nodes.forEach((n, i) => {
      const y = 300 + i * rowH;
      const c = n.condition!;
      const lv = nodeLevel(save, n.id);
      const value = conditionValue(save, c.stat);
      const next = nextThreshold(save, n);
      const g = add(this.add.graphics());
      g.fillStyle(lv > 0 ? COLORS.panelRaised : COLORS.bg, 0.95).fillRoundedRect(56, y, GAME_WIDTH - 112, rowH - 6, 12);
      const icon = add(this.add.image(90, y + (rowH - 6) / 2, n.icon));
      icon.setScale(40 / Math.max(icon.width, icon.height)).setAlpha(lv > 0 ? 1 : 0.45);
      add(this.add.text(122, y + 6, `${n.name}${n.maxLevel > 1 ? `  Lv${lv}/${n.maxLevel}` : lv > 0 ? "  解放済み" : ""}`, textStyle(19, { color: lv > 0 ? COLORS.ink : COLORS.inkDim })));
      add(
        this.add.text(122, y + 32, `${CONDITION_LABEL[c.stat].name} ${fmt(value)}${next !== null ? ` / ${fmt(next)}` : "（最大）"}　${effectText(n, Math.max(1, next === null ? lv : lv + 1))}`, {
          ...textStyle(14, { weight: 500, color: COLORS.inkMuted }),
          wordWrap: jaWrap(GAME_WIDTH - 200),
        }),
      );
      // 次のしきい値までのバー
      const barW = 150;
      const prev = lv > 0 ? c.thresholds[lv - 1] : 0;
      const t = next === null ? 1 : Phaser.Math.Clamp((value - prev) / (next - prev), 0, 1);
      g.fillStyle(COLORS.line, 0.8).fillRoundedRect(GAME_WIDTH - 76 - barW, y + 12, barW, 10, 5);
      g.fillStyle(COLORS.gold, 1).fillRoundedRect(GAME_WIDTH - 76 - barW, y + 12, Math.max(10, barW * t), 10, 5);
    });
  }

  /** SPEC-116: ビルドセット（5 枠）。読み込みは全返金してから買い直す */
  private showBuildSets(): void {
    const { add, close } = this.openModal("ビルドセット");
    add(this.add.text(CENTER_X, 280, "いまのスキルツリーを保存し、あとでワンタップで戻せます", textStyle(20, { weight: 500, color: COLORS.inkDim })).setOrigin(0.5));
    session.data.meta.buildSets.forEach((set, i) => {
      const y = 320 + i * 128;
      const g = add(this.add.graphics());
      g.fillStyle(COLORS.bg, 0.9).fillRoundedRect(60, y, GAME_WIDTH - 120, 116, 16);
      add(this.add.text(84, y + 22, set ? set.name : `枠 ${i + 1}：空き`, textStyle(24, { color: set ? COLORS.ink : COLORS.inkMuted })));
      if (set) {
        const count = Object.values(set.tree).reduce((a, b) => a + b, 0);
        add(this.add.text(84, y + 62, `スキル ${count} レベル分`, textStyle(18, { weight: 500, color: COLORS.inkDim })));
      }
      add(
        new Button(this, GAME_WIDTH - 80 - 250 - 8 - 60, y + 58, {
          width: 120,
          label: "保存",
          onTap: () => {
            session.update((d) => saveBuildSet(d, i, `ビルド ${i + 1}`));
            close();
            this.showBuildSets();
          },
        }),
      );
      add(
        new Button(this, GAME_WIDTH - 80 - 125 - 60, y + 58, {
          width: 120,
          label: "読込",
          kind: set ? "primary" : "locked",
          onTap: () => {
            if (!set) return;
            const res = loadBuildSet(session.data, i);
            session.update(() => res.save);
            playSe(this, "se.treasure");
            close();
            this.refresh();
            showToast(this, res.missing > 0 ? `トークンが足りず ${res.missing} レベル分は買えませんでした` : `「${set.name}」を読み込みました`);
          },
        }),
      );
      add(
        new Button(this, GAME_WIDTH - 80 - 60 + 8, y + 58, {
          width: 104,
          label: "消去",
          kind: set ? "secondary" : "locked",
          onTap: () => {
            if (!set) return;
            session.update((d) => clearBuildSet(d, i));
            close();
            this.showBuildSets();
          },
        }),
      );
    });
  }

  private confirmRefundAll(): void {
    if (totalSpent(session.data) + totalSpent(session.data, "emblem") === 0) return showToast(this, "返金するスキルがありません");
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
    add(this.add.text(CENTER_X, 500, `すべてのスキルを返金しますか？\n（${spentLabel(session.data)} が戻ります）`, textStyle(28, { align: "center" })).setOrigin(0.5));
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
    const vis = TREE.filter((n) => this.shown.has(n.id));
    const xs = vis.map((n) => n.pos.x * UNIT * s);
    const ys = vis.map((n) => n.pos.y * UNIT * s);
    const margin = 120;
    this.world.x = Phaser.Math.Clamp(this.world.x, margin - Math.max(...xs), GAME_WIDTH - margin - Math.min(...xs));
    this.world.y = Phaser.Math.Clamp(this.world.y, HEADER_H + margin - Math.max(...ys), PANEL_TOP - margin - Math.min(...ys));
  }
}
