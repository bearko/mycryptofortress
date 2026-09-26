import Phaser from "phaser";
import { ENEMIES } from "../../data/balance/enemies";
import { CHRIS_TIPS, DIALOGS } from "../../data/dialogs";
import { LEVELS } from "../../data/levels";
import { hasSeen, isLevelUnlocked, markSeen } from "../../meta/progress";
import type { LevelDef } from "../../sim/level";
import { playBgm } from "../audio";
import { bindPress } from "../input/press";
import { GAME_WIDTH, MARGIN } from "../layout";
import { session } from "../session";
import { playDialog, speechBubble } from "../ui/dialog";
import { Header, HEADER_H, goTo } from "../ui/header";
import { COLORS, textStyle } from "../ui/theme";
import { LandBackground, showToast } from "../ui/widgets";
import { jaWrap } from "../ui/jaWrap";

const CARD_H = 196;
const CARD_GAP = 18;
const CARD_TOP = HEADER_H + 28;
/** リストが見える下端（クリスくんの吹き出しの上） */
const LIST_BOTTOM = 1080;

/** SPEC-106 §3: ステージ（ノード）選択。クリスくんが案内する。 */
export class LevelSelectScene extends Phaser.Scene {
  /** カードを載せてスクロールするコンテナ */
  private list!: Phaser.GameObjects.Container;
  private scrollY = 0;
  private maxScroll = 0;

  constructor() {
    super("LevelSelect");
  }

  create(): void {
    this.cameras.main.fadeIn(180, 11, 13, 18);
    playBgm(this, "bgm.land");
    void new LandBackground(this, 0.7).show(session.data.profile.cryptidId);
    new Header(this, "ノードを選ぶ", () => goTo(this, "Home")).setTokens(session.data.meta.tokens.ce, session.data.meta.tokens.emblem, session.data.meta.tokensEarned.emblem > 0);

    this.list = this.add.container(0, 0).setDepth(10);
    LEVELS.forEach((lv, i) => this.card(lv, i));
    const contentH = LEVELS.length * (CARD_H + CARD_GAP) - CARD_GAP;
    this.maxScroll = Math.max(0, CARD_TOP + contentH - LIST_BOTTOM);
    this.setupScroll();
    // 最初は「次に挑むノード」（解放済みで未クリアの最初）が見える位置へ
    const frontier = LEVELS.findIndex((l) => isLevelUnlocked(session.data, l.id) && !session.data.meta.levels[l.id]?.cleared);
    if (frontier > 0) this.scrollTo(frontier * (CARD_H + CARD_GAP) - (CARD_H + CARD_GAP));

    // 吹き出しの後ろはリストを隠す（スクロールしたカードが透けないように）
    this.add.rectangle(0, LIST_BOTTOM, GAME_WIDTH, 1280 - LIST_BOTTOM, COLORS.bg, 0.88).setOrigin(0).setDepth(50);
    const tip = CHRIS_TIPS[Math.floor(Math.random() * CHRIS_TIPS.length)];
    speechBubble(this, "chris", 110, 1240, tip, { width: 480, depth: 60 });

    if (!hasSeen(session.data, "levelSelect.first")) {
      void playDialog(this, DIALOGS["levelSelect.first"]).then(() => session.update((d) => markSeen(d, "levelSelect.first")));
    }
  }

  private card(lv: LevelDef, index: number): void {
    const unlocked = isLevelUnlocked(session.data, lv.id);
    const progress = session.data.meta.levels[lv.id];
    const w = GAME_WIDTH - MARGIN * 2;
    const y = CARD_TOP + index * (CARD_H + CARD_GAP);
    const bossId = lv.waves.flatMap((wv) => wv.groups.map((g) => g.enemy)).find((e) => ENEMIES[e].boss);
    const boss = bossId ? ENEMIES[bossId] : undefined;

    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, unlocked ? 0.94 : 0.75).fillRoundedRect(0, 0, w, CARD_H, 18);
    g.lineStyle(progress?.cleared ? 3 : 2, progress?.cleared ? COLORS.gold : COLORS.line, 1).strokeRoundedRect(0, 0, w, CARD_H, 18);
    const parts: Phaser.GameObjects.GameObject[] = [g];
    parts.push(this.add.rectangle(92, CARD_H / 2, 144, 144, COLORS.bg, 0.8).setStrokeStyle(2, COLORS.line));
    if (boss) parts.push(this.add.image(92, CARD_H / 2 + 8, boss.imageKey).setScale(2).setAlpha(unlocked ? 1 : 0.3));
    parts.push(this.add.text(184, 24, `Lv${index + 1}  ${lv.name}`, textStyle(28, { color: unlocked ? COLORS.ink : COLORS.inkMuted })));
    parts.push(
      this.add.text(184, 68, `入口 ${lv.paths.length} ／ ${lv.waves.length} Wave ／ ボス: ${boss?.name ?? "なし"}`, {
        ...textStyle(19, { weight: 500, color: COLORS.inkDim }),
        wordWrap: jaWrap(w - 200),
      }),
    );
    const status = !unlocked
      ? `🔒 Lv${index} をクリアで解放`
      : progress?.cleared
        ? `✓ クリア済み（${progress.clears} 回）`
        : progress
          ? `最高 Wave ${progress.bestWave} / ${lv.waves.length}`
          : "未挑戦";
    parts.push(this.add.text(184, 118, status, textStyle(22, { color: progress?.cleared ? COLORS.gold : unlocked ? COLORS.ink : COLORS.inkMuted })));
    parts.push(
      this.add.text(184, 152, `CE: Wave ×${lv.reward.perWave} ／ 防衛 +${lv.reward.clear}${progress?.cleared ? "" : ` ／ 初回 +${lv.reward.firstClear}`}`, textStyle(18, { weight: 500, color: COLORS.inkDim })),
    );

    // Container の当たり判定は中心基準なので、中身を左上基準の内側コンテナに入れて中央に置く
    const inner = this.add.container(-w / 2, -CARD_H / 2, parts);
    const card = this.add.container(MARGIN + w / 2, y + CARD_H / 2, [inner]).setSize(w, CARD_H).setInteractive({ useHandCursor: true });
    this.list.add(card);
    bindPress(card, {
      onPressChange: (p) => card.setAlpha(p ? 0.8 : 1),
      onTap: () => {
        if (!unlocked) return showToast(this, `Lv${index} をクリアすると解放されます`);
        goTo(this, "Run", { levelId: lv.id });
      },
    });
  }

  // ─── スクロール（スマホはドラッグ、PC はホイール） ─────────────

  private scrollTo(y: number): void {
    this.scrollY = Phaser.Math.Clamp(y, 0, this.maxScroll);
    this.list.y = -this.scrollY;
  }

  private setupScroll(): void {
    let lastY: number | null = null;
    let velocity = 0;
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      lastY = p.y;
      velocity = 0;
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (lastY === null || !p.isDown) return;
      const dy = p.y - lastY;
      lastY = p.y;
      velocity = dy;
      this.scrollTo(this.scrollY - dy);
    });
    const release = () => {
      lastY = null;
    };
    this.input.on(Phaser.Input.Events.POINTER_UP, release);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, release);
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.scrollTo(this.scrollY + dy));
    // 指を離した後の慣性
    this.events.on(Phaser.Scenes.Events.UPDATE, () => {
      if (lastY !== null || Math.abs(velocity) < 0.5) return;
      velocity *= 0.92;
      this.scrollTo(this.scrollY - velocity);
    });
  }
}
