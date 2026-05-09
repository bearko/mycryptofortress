import Phaser from "phaser";
import { HEROES, findHero } from "../game/heroData";
import {
  PARTY_LIMIT,
  getPartyHeroIds,
  setPartyHeroIds,
} from "../game/progress";
import { ALL_WORLDS, findStage } from "../game/stages";
import { findSkill } from "../game/skill";
import type { HeroClass, HeroDef, HeroRarity } from "../game/types";
import { TEXTURE_KEYS, SE_KEYS } from "./BootScene";
import { playSe } from "./seUtil";
import { getViewport, onResize } from "./layout";
import {
  CLASS_COLORS,
  RARITY,
  hex2css,
  setTheme,
  textStyle,
  theme,
} from "../ui/tokens";
import { Btn, Card, ScreenHeader, StatGrid, Tag } from "../ui/components";
import { makeClassIcon } from "../ui/icons";

/**
 * SPEC-015 / SPEC-016: パーティ編成シーン。
 *
 * 横画面 (landscape): 左に編成 + 保有、右に詳細パネルの 2 ペイン構成。
 * 縦画面 (portrait): 上から「編成 → 保有 → 詳細 → 出撃」の縦スタック構成。
 *
 * 操作仕様:
 *  - 編成中スロット (hero あり) をタップ → 詳細表示 + アイコンをグレーアウト + 「外す」表示。
 *    同じスロットを再度タップで編成から外す。
 *  - 保有ヒーロー (未編成) をタップ → 詳細表示 + フォーカス状態。
 *    パーティに空きあり → 同じヒーローを再タップで編成。
 *    パーティ満員時 → 編成中ヒーローをタップすれば 1 タップで交代。
 *  - 編成済の保有ヒーローをタップ → 編成中スロットをタップしたのと同じ扱い。
 */
const CLASS_LABEL: Record<HeroClass, string> = {
  defender: "重装",
  guard: "前衛",
  vanguard: "先鋒",
  specialist: "特殊",
  sniper: "狙撃",
  caster: "術師",
  medic: "医療",
  supporter: "補助",
};

const RARITY_LABEL: Record<HeroRarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  superRare: "SuperRare",
  legendary: "Legendary",
};

interface SlotEntry {
  index: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
  border: Phaser.GameObjects.Rectangle;
  /** refresh で破棄する子要素（中身は heroId に依存して可変） */
  children: Phaser.GameObjects.GameObject[];
}

interface RosterEntry {
  hero: HeroDef;
  cx: number;
  cy: number;
  w: number;
  h: number;
  border: Phaser.GameObjects.Rectangle;
  sprite: Phaser.GameObjects.Sprite;
  selectedMark: Phaser.GameObjects.Text;
  /** スロット内に作成された全 GameObjects（scroll container 等への reparent 用） */
  members: Phaser.GameObjects.GameObject[];
}

interface DetailGeometry {
  left: number;
  width: number;
  top: number;
  height: number;
}

type RarityFilter = HeroRarity | "all";
const FILTER_ORDER: RarityFilter[] = [
  "all",
  "common",
  "uncommon",
  "rare",
  "superRare",
  "legendary",
];
const FILTER_LABEL: Record<RarityFilter, string> = {
  all: "ALL",
  common: "C",
  uncommon: "U",
  rare: "R",
  superRare: "SR",
  legendary: "L",
};

export class PartyFormationScene extends Phaser.Scene {
  private stageId = "1-1";
  private party: number[] = [];
  /** フォーカス対象の hero ID（左の編成スロット or 保有一覧、どちらでも共通） */
  private focusedHeroId: number | null = null;
  /** SPEC-021: 保有ヒーローのレアリティフィルタ */
  private rarityFilter: RarityFilter = "all";

  private slots: SlotEntry[] = [];
  private roster: RosterEntry[] = [];

  private partyCountText!: Phaser.GameObjects.Text;
  private startBtnBg!: Phaser.GameObjects.Rectangle;
  private startBtnText!: Phaser.GameObjects.Text;

  /** SPEC-021: roster scroll 用 */
  private rosterContainer: Phaser.GameObjects.Container | null = null;
  private rosterScrollMin = 0;
  private rosterScrollMax = 0;
  /**
   * SPEC-022: roster の表示中 viewport (絶対座標)。Phaser の geometry mask は
   * 描画だけクリップして input は通すので、各 slot の pointerdown 内で
   * pointer 位置をこの矩形内に制限してヒット判定の漏れを防ぐ。
   */
  private rosterViewport: { x: number; y: number; w: number; h: number } = {
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  };

  /** 詳細パネル: focus に依存して再生成する子要素 */
  private detailDynamic: Phaser.GameObjects.GameObject[] = [];
  private detailGeometry: DetailGeometry = {
    left: 0,
    width: 0,
    top: 0,
    height: 0,
  };

  constructor() {
    super("PartyFormationScene");
  }

  init(data: { stageId?: string }): void {
    if (data?.stageId) this.stageId = data.stageId;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(theme.bg.base);

    // restart 対策: scene field を毎回明示的にリセット
    this.party = getPartyHeroIds();
    this.focusedHeroId = null;
    this.slots = [];
    this.roster = [];
    this.detailDynamic = [];

    this.buildLayout();
    onResize(this, () => this.buildLayout());
  }

  // ─────────────────────────────────────────────
  // レイアウトビルダー（landscape / portrait の振り分け）
  // ─────────────────────────────────────────────
  private buildLayout(): void {
    this.children.removeAll(true);
    this.slots = [];
    this.roster = [];
    this.detailDynamic = [];
    this.rosterContainer = null;
    this.rosterScrollMin = 0;
    this.rosterScrollMax = 0;
    this.rosterViewport = { x: 0, y: 0, w: 0, h: 0 };

    const vp = getViewport(this);
    const stage = findStage(this.stageId);
    const stageLabel = stage ? `${stage.name}` : `ステージ ${this.stageId}`;

    // SPEC-019: 出撃先のワールドに紐づくテーマを適用
    if (stage) {
      const w = ALL_WORLDS.find((w) => w.id === stage.worldId);
      if (w?.themeId) {
        setTheme(w.themeId);
        this.cameras.main.setBackgroundColor(theme.bg.base);
      }
    }

    // ── ヘッダ（ScreenHeader + 出撃先サブ表示）
    new ScreenHeader(this, {
      x: 0,
      y: 0,
      width: vp.width,
      enHeading: "PARTY FORMATION",
      jpHeading: "編成",
      onBack: () => {
        playSe(this, SE_KEYS.uiMenu());
        this.scene.start("StageSelectScene", {
          worldId: stage?.worldId ?? "world-1",
        });
      },
    });

    // 出撃先（右上に小さく）
    this.add
      .text(vp.width - 14, 18, `→ ${stageLabel}`, {
        ...textStyle("small", { colorNum: theme.ink.secondary }),
      })
      .setOrigin(1, 0);

    if (vp.isLandscape) {
      this.buildLandscape(vp.width, vp.height);
    } else {
      this.buildPortrait(vp.width, vp.height);
    }
    this.refresh();
  }

  // ─── Landscape (2-pane) ───────────────────────
  private buildLandscape(width: number, height: number): void {
    const leftPaneX = 8;
    const rightPaneRightMargin = 8;
    const detailW = Math.max(320, Math.min(380, width * 0.4));
    const detailLeft = width - detailW - rightPaneRightMargin;
    const leftPaneW = detailLeft - leftPaneX - 16;
    const leftCenter = leftPaneX + leftPaneW / 2;

    this.add
      .text(leftCenter, 80, `編成中  ( 最大 ${PARTY_LIMIT} 体 )`, {
        ...textStyle("body", { colorNum: theme.accent.primary }),
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // パーティ枠 5×2
    const partyGap = 6;
    const partySlotW = Math.min(
      82,
      Math.floor((leftPaneW - 16 - partyGap * 4) / 5),
    );
    const partySlotH = Math.min(92, partySlotW + 12);
    const partyGridW = partySlotW * 5 + partyGap * 4;
    const partyStartX = leftPaneX + (leftPaneW - partyGridW) / 2;
    const partyTopY = 96;
    for (let i = 0; i < PARTY_LIMIT; i++) {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const cx =
        partyStartX + col * (partySlotW + partyGap) + partySlotW / 2;
      const cy =
        partyTopY + row * (partySlotH + partyGap) + partySlotH / 2;
      this.slots.push(this.buildSlot(i, cx, cy, partySlotW, partySlotH));
    }

    this.partyCountText = this.add
      .text(
        leftCenter,
        partyTopY + partySlotH * 2 + partyGap + 14,
        "",
        textStyle("small", { colorNum: theme.ink.secondary }),
      )
      .setOrigin(0.5);

    // 保有ヒーロー
    const rosterHeadingY =
      partyTopY + partySlotH * 2 + partyGap + 38;
    this.add
      .text(leftCenter, rosterHeadingY, "保有ヒーロー", {
        ...textStyle("body", { colorNum: theme.accent.primary }),
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // SPEC-021: rarity filter chips (rosterTopY 上)
    const filterY = rosterHeadingY + 22;
    this.buildFilterChips(leftCenter, filterY);

    // SPEC-021: roster は scroll 可能なコンテナ + mask
    const rosterCols = 6;
    const rosterGap = 4;
    const rosterSlotW = Math.min(
      80,
      Math.floor((leftPaneW - 16 - rosterGap * (rosterCols - 1)) / rosterCols),
    );
    const rosterSlotH = Math.max(76, rosterSlotW + 4);
    const rosterGridW =
      rosterSlotW * rosterCols + rosterGap * (rosterCols - 1);
    const rosterStartX = leftPaneX + (leftPaneW - rosterGridW) / 2;
    const rosterTopY = filterY + 28;
    const btnY = height - 24;
    const rosterBottomY = btnY - 32;
    const rosterViewH = rosterBottomY - rosterTopY;
    this.buildScrollableRoster(
      rosterStartX,
      rosterTopY,
      rosterGridW,
      rosterViewH,
      rosterCols,
      rosterSlotW,
      rosterSlotH,
      rosterGap,
    );

    // 出撃ボタン (左ペイン下)
    const btnW = 220;
    const btnH = 36;
    const btnX = leftCenter;
    this.startBtnBg = this.add.rectangle(btnX, btnY, btnW, btnH, theme.accent.primary, 1);
    this.startBtnBg.setStrokeStyle(2, theme.accent.primary);
    this.startBtnBg.setInteractive({ useHandCursor: true });
    this.startBtnText = this.add
      .text(btnX, btnY, "出撃 ▶", {
        ...textStyle("h3", { colorNum: theme.ink.inverse }),
      })
      .setOrigin(0.5);
    this.startBtnBg.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      this.confirmAndStart();
    });

    // 詳細パネル
    this.detailGeometry = {
      left: detailLeft,
      width: detailW,
      top: 82,
      height: height - 110,
    };
    this.buildDetailPaneFrame();
  }

  // ─── Portrait (vertical stack) ────────────────
  private buildPortrait(width: number, height: number): void {
    const sidePad = 8;
    const innerW = width - sidePad * 2;

    // 編成中ラベル
    let cursorY = 76;
    this.add
      .text(width / 2, cursorY, `編成中  ( 最大 ${PARTY_LIMIT} 体 )`, {
        ...textStyle("body", { colorNum: theme.accent.primary }),
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    cursorY += 12;

    // パーティ枠 5×2（縦画面では幅基準で）
    const partyCols = 5;
    const partyGap = 4;
    const partySlotW = Math.floor(
      (innerW - partyGap * (partyCols - 1)) / partyCols,
    );
    const partySlotH = Math.min(86, partySlotW + 8);
    const partyGridW = partySlotW * partyCols + partyGap * (partyCols - 1);
    const partyStartX = sidePad + (innerW - partyGridW) / 2;
    const partyTopY = cursorY + 6;
    for (let i = 0; i < PARTY_LIMIT; i++) {
      const col = i % partyCols;
      const row = Math.floor(i / partyCols);
      const cx =
        partyStartX + col * (partySlotW + partyGap) + partySlotW / 2;
      const cy =
        partyTopY + row * (partySlotH + partyGap) + partySlotH / 2;
      this.slots.push(this.buildSlot(i, cx, cy, partySlotW, partySlotH));
    }
    cursorY = partyTopY + partySlotH * 2 + partyGap + 6;

    // 編成中数
    this.partyCountText = this.add
      .text(width / 2, cursorY + 6, "", {
        ...textStyle("small", { colorNum: theme.ink.secondary }),
      })
      .setOrigin(0.5);
    cursorY += 22;

    // 保有ヒーロー
    this.add
      .text(width / 2, cursorY, "保有ヒーロー", {
        ...textStyle("body", { colorNum: theme.accent.primary }),
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    cursorY += 14;

    // SPEC-021: rarity filter chips
    this.buildFilterChips(width / 2, cursorY + 4);
    cursorY += 28;

    const rosterCols = 6;
    const rosterGap = 4;
    const rosterSlotW = Math.floor(
      (innerW - rosterGap * (rosterCols - 1)) / rosterCols,
    );
    const rosterSlotH = Math.max(64, rosterSlotW + 8);
    const rosterGridW =
      rosterSlotW * rosterCols + rosterGap * (rosterCols - 1);
    const rosterStartX = sidePad + (innerW - rosterGridW) / 2;
    const rosterTopY = cursorY + 6;
    const btnH = 40;
    const btnY = height - btnH / 2 - 10;
    // SPEC-023: MCH 本家 passive desc + 拡大した日本語フォント (12-14px) で
    // 4 行 wrap することがあるため、詳細パネル領域を ~280px 確保。roster は scroll で補う。
    const detailReserve = 280;
    const rosterBottomY = btnY - btnH / 2 - detailReserve;
    const rosterViewH = Math.max(rosterSlotH + 8, rosterBottomY - rosterTopY);

    this.buildScrollableRoster(
      rosterStartX,
      rosterTopY,
      rosterGridW,
      rosterViewH,
      rosterCols,
      rosterSlotW,
      rosterSlotH,
      rosterGap,
    );
    cursorY = rosterTopY + rosterViewH + 6;
    const btnW = Math.min(280, innerW);
    this.startBtnBg = this.add.rectangle(
      width / 2,
      btnY,
      btnW,
      btnH,
      theme.accent.primary,
      1,
    );
    this.startBtnBg.setStrokeStyle(2, theme.accent.primary);
    this.startBtnBg.setInteractive({ useHandCursor: true });
    this.startBtnText = this.add
      .text(width / 2, btnY, "出撃 ▶", {
        ...textStyle("h3", { colorNum: theme.ink.inverse }),
      })
      .setOrigin(0.5);
    this.startBtnBg.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      this.confirmAndStart();
    });

    // 詳細パネル: 残り領域を使う
    this.detailGeometry = {
      left: sidePad,
      width: innerW,
      top: cursorY + 4,
      height: btnY - btnH / 2 - cursorY - 12,
    };
    this.buildDetailPaneFrame();
  }

  // ─── スロット / 保有ヒーロー要素の構築 ─────────────
  private buildSlot(
    index: number,
    cx: number,
    cy: number,
    w: number,
    h: number,
  ): SlotEntry {
    const border = this.add.rectangle(cx, cy, w, h, theme.bg.surface, 1);
    border.setStrokeStyle(2, theme.line.base);
    border.setInteractive({ useHandCursor: true });
    const slot: SlotEntry = { index, cx, cy, w, h, border, children: [] };
    border.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      this.onPartySlotTap(index);
    });
    return slot;
  }

  private buildRosterEntry(
    hero: HeroDef,
    cx: number,
    cy: number,
    w: number,
    h: number,
  ): RosterEntry {
    const members: Phaser.GameObjects.GameObject[] = [];
    const track = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      members.push(o);
      return o;
    };

    const border = track(
      this.add.rectangle(cx, cy, w, h, theme.bg.surface, 1),
    );
    border.setStrokeStyle(2, theme.line.base);
    border.setInteractive({ useHandCursor: true });

    // 名前を入れる余裕があるかどうか（縦画面の細いスロットでは名前を省く）
    const compact = w < 72;
    const labelStripH = compact ? 14 : 32;
    const portraitSize = Math.min(48, Math.max(24, h - 14 - labelStripH));
    const portraitCY = cy - h / 2 + 14 + portraitSize / 2;

    const sprite = track(
      this.add
        .sprite(cx, portraitCY, TEXTURE_KEYS.hero(hero.id))
        .setDisplaySize(portraitSize, portraitSize),
    );

    track(
      this.add
        .text(cx - w / 2 + 4, cy - h / 2 + 4, RARITY[hero.rarity].label, {
          ...textStyle("small", { colorNum: RARITY[hero.rarity].hex }),
          fontStyle: "bold",
        })
        .setOrigin(0, 0),
    );

    track(
      this.add
        .text(cx + w / 2 - 4, cy - h / 2 + 4, `${hero.cost}`, {
          ...textStyle("small", { colorNum: theme.ink.primary }),
          fontStyle: "bold",
        })
        .setOrigin(1, 0),
    );

    // 職業ラベル
    track(
      this.add
        .text(
          cx,
          cy + h / 2 - (compact ? 4 : 22),
          CLASS_LABEL[hero.class],
          textStyle("small", { colorNum: theme.accent.primary }),
        )
        .setOrigin(0.5, 1),
    );

    // 名前（コンパクト時は省く: 詳細パネルで確認可能）
    if (!compact) {
      track(
        this.add
          .text(cx, cy + h / 2 - 4, hero.name, {
            ...textStyle("small", { colorNum: theme.ink.primary }),
            align: "center",
            wordWrap: { width: w - 6, useAdvancedWrap: true },
          })
          .setOrigin(0.5, 1),
      );
    }

    const selectedMark = track(
      this.add
        .text(cx + w / 2 - 4, cy + h / 2 - 4, "✓", {
          ...textStyle("small", { colorNum: theme.accent.success }),
          fontStyle: "bold",
        })
        .setOrigin(1, 1),
    );
    selectedMark.setVisible(false);

    border.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      // SPEC-022: mask は描画だけクリップして input は通す。viewport 外の
      // タップは無視（編成エリア / 詳細パネルへの通り抜けを防ぐ）。
      if (!this.isPointerInRosterViewport(pointer)) return;
      this.onRosterTap(hero.id);
    });

    return { hero, cx, cy, w, h, border, sprite, selectedMark, members };
  }

  private isPointerInRosterViewport(pointer: Phaser.Input.Pointer): boolean {
    const v = this.rosterViewport;
    if (v.w <= 0 || v.h <= 0) return true;
    return (
      pointer.x >= v.x &&
      pointer.x <= v.x + v.w &&
      pointer.y >= v.y &&
      pointer.y <= v.y + v.h
    );
  }

  // ─── SPEC-021 / SPEC-030 F3c: rarity filter chips ──
  // Tag primitive (`active` + `onClick`) で active/inactive をトグル。
  private buildFilterChips(centerX: number, y: number): void {
    const gap = 6;
    // Tag は label 長から幅を自動計算するので、各 Tag 作成後に並べ替える
    const tags: Tag[] = [];
    FILTER_ORDER.forEach((r) => {
      const accent =
        r === "all" ? theme.accent.primary : RARITY[r as HeroRarity].hex;
      const tag = new Tag(this, {
        x: 0,
        y,
        label: FILTER_LABEL[r],
        colorNum: accent,
        mono: true,
        active: this.rarityFilter === r,
        onClick: () => {
          if (this.rarityFilter === r) return;
          this.rarityFilter = r;
          if (this.focusedHeroId !== null) {
            const h = findHero(this.focusedHeroId);
            if (h && r !== "all" && h.rarity !== r && !this.party.includes(h.id)) {
              this.focusedHeroId = null;
            }
          }
          this.buildLayout();
        },
      });
      tags.push(tag);
    });

    // 中央寄せに位置を再計算 (Tag の bg は origin (0, 0.5) で 12 + label.width)
    const widths = tags.map((t) => {
      const bg = t.list[0] as Phaser.GameObjects.Rectangle;
      return bg.width;
    });
    const totalW = widths.reduce((a, b) => a + b, 0) + gap * (FILTER_ORDER.length - 1);
    let cursorX = centerX - totalW / 2;
    tags.forEach((tag, i) => {
      tag.setX(cursorX);
      cursorX += widths[i] + gap;
    });
  }

  private getFilteredHeroes(): HeroDef[] {
    if (this.rarityFilter === "all") return HEROES;
    return HEROES.filter((h) => h.rarity === this.rarityFilter);
  }

  // ─── SPEC-021: スクロール可能 roster ────────────────
  private buildScrollableRoster(
    startX: number,
    topY: number,
    gridW: number,
    viewH: number,
    cols: number,
    slotW: number,
    slotH: number,
    gap: number,
  ): void {
    // SPEC-022: ヒット判定漏れ防止のため viewport 矩形を保持
    this.rosterViewport = { x: startX, y: topY, w: gridW, h: viewH };
    const heroes = this.getFilteredHeroes();
    if (heroes.length === 0) {
      this.add
        .text(startX + gridW / 2, topY + viewH / 2, "該当するヒーローがいません", {
          ...textStyle("body", { colorNum: theme.ink.muted }),
        })
        .setOrigin(0.5);
      return;
    }

    // スクロール可能なコンテナを viewport 位置に置く
    const container = this.add.container(startX, topY);
    this.rosterContainer = container;

    // 各 slot を container 相対座標で作り、members を一括で container へ reparent
    heroes.forEach((hero, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = col * (slotW + gap) + slotW / 2;
      const cy = row * (slotH + gap) + slotH / 2;
      const entry = this.buildRosterEntry(hero, cx, cy, slotW, slotH);
      for (const obj of entry.members) container.add(obj);
      this.roster.push(entry);
    });

    const rows = Math.ceil(heroes.length / cols);
    const totalH = slotH * rows + gap * Math.max(0, rows - 1);

    // mask: viewport 外の slot は描画しない
    const maskShape = this.make.graphics({ x: 0, y: 0 }, false);
    maskShape.fillStyle(0xffffff, 1);
    maskShape.fillRect(startX, topY, gridW, viewH);
    container.setMask(maskShape.createGeometryMask());

    // scroll 上限
    this.rosterScrollMax = 0; // y=0 を最上端
    this.rosterScrollMin = Math.min(0, viewH - totalH); // 負の値（上に押し上げる）

    // wheel scroll
    this.input.on(
      "wheel",
      (
        pointer: Phaser.Input.Pointer,
        _go: Phaser.GameObjects.GameObject[],
        _dx: number,
        dy: number,
      ) => {
        if (
          pointer.x < startX ||
          pointer.x > startX + gridW ||
          pointer.y < topY ||
          pointer.y > topY + viewH
        )
          return;
        if (!this.rosterContainer) return;
        const next = Phaser.Math.Clamp(
          this.rosterContainer.y - dy * 0.5,
          topY + this.rosterScrollMin,
          topY + this.rosterScrollMax,
        );
        this.rosterContainer.y = next;
      },
    );

    // touch / drag scroll
    let dragStart = -1;
    let scrollStart = 0;
    let dragging = false;
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (
        pointer.x < startX ||
        pointer.x > startX + gridW ||
        pointer.y < topY ||
        pointer.y > topY + viewH
      ) {
        dragStart = -1;
        return;
      }
      dragStart = pointer.y;
      scrollStart = this.rosterContainer?.y ?? topY;
      dragging = false;
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (dragStart < 0 || !this.rosterContainer) return;
      const dy = pointer.y - dragStart;
      if (Math.abs(dy) > 6) dragging = true;
      if (dragging) {
        this.rosterContainer.y = Phaser.Math.Clamp(
          scrollStart + dy,
          topY + this.rosterScrollMin,
          topY + this.rosterScrollMax,
        );
      }
    });
    const endDrag = () => {
      if (dragging) {
        // 直後の click が roster slot に届かないように一度 disable する
        // ※ 簡易対応: dragging フラグを残し、roster click 側では参照する
        this.events.emit("rosterDragEnd");
      }
      dragStart = -1;
      dragging = false;
    };
    this.input.on("pointerup", endDrag);
    this.input.on("pointerupoutside", endDrag);
  }

  // ─── 詳細パネル ─────────────────────────────────
  // SPEC-030 F3c: Card primitive で frame + ヘッダを描画。
  private buildDetailPaneFrame(): void {
    const { left, width, top, height } = this.detailGeometry;
    new Card(this, {
      x: left,
      y: top,
      width,
      height,
      title: "ヒーロー詳細",
      titleColor: theme.accent.primary,
      alpha: 0.95,
    });
  }

  private clearDetailDynamic(): void {
    for (const obj of this.detailDynamic) obj.destroy();
    this.detailDynamic = [];
  }

  private refreshDetail(): void {
    this.clearDetailDynamic();

    const { left, width, top, height } = this.detailGeometry;
    const cardCX = left + width / 2;
    const cardCY = top + height / 2;
    const compact = height < 280;

    if (this.focusedHeroId === null) {
      const empty = this.add
        .text(
          cardCX,
          cardCY,
          "ヒーローをタップすると\nここに詳細が表示されます",
          {
            ...textStyle("body", { colorNum: theme.ink.muted }),
            align: "center",
            wordWrap: { width: width - 32, useAdvancedWrap: true },
          },
        )
        .setOrigin(0.5);
      this.detailDynamic.push(empty);
      return;
    }

    const hero = findHero(this.focusedHeroId);
    if (!hero) return;
    const skill = findSkill(this.focusedHeroId);
    const inParty = this.party.includes(this.focusedHeroId);
    const partyFull = this.party.length >= PARTY_LIMIT;

    if (compact) {
      this.layoutDetailCompact(hero, skill, inParty, partyFull);
    } else {
      this.layoutDetailFull(hero, skill, inParty, partyFull);
    }
  }

  private layoutDetailFull(
    hero: HeroDef,
    skill: ReturnType<typeof findSkill>,
    inParty: boolean,
    partyFull: boolean,
  ): void {
    const { left, width, top, height } = this.detailGeometry;
    const cardCX = left + width / 2;

    const portraitY = top + 72;
    this.detailDynamic.push(
      this.add
        .sprite(cardCX, portraitY, TEXTURE_KEYS.hero(hero.id))
        .setDisplaySize(96, 96),
    );

    // 職業アイコン（ポートレート右上に職業色で）
    this.detailDynamic.push(
      makeClassIcon(
        this,
        cardCX + 48,
        portraitY - 36,
        hero.class,
        24,
        CLASS_COLORS[hero.class].hex,
      ),
    );

    let y = portraitY + 60;
    this.detailDynamic.push(
      this.add
        .text(cardCX, y, hero.name, {
          ...textStyle("h3", { colorNum: theme.ink.primary }),
          align: "center",
          wordWrap: { width: width - 24, useAdvancedWrap: true },
        })
        .setOrigin(0.5),
    );
    y += 24;

    const rarityColor = RARITY[hero.rarity].hex;
    this.detailDynamic.push(
      this.add
        .text(
          cardCX,
          y,
          `[${RARITY_LABEL[hero.rarity]}]  ${CLASS_LABEL[hero.class]}  /  ${hero.attackType}`,
          textStyle("small", { colorNum: rarityColor }),
        )
        .setOrigin(0.5),
    );
    y += 18;

    this.detailDynamic.push(
      this.add
        .text(cardCX, y, `配置コスト: ${hero.cost} CE`, {
          ...textStyle("small", { colorNum: theme.ink.primary }),
        })
        .setOrigin(0.5),
    );
    y += 18;

    this.detailDynamic.push(
      this.add.rectangle(cardCX, y, width - 32, 1, theme.line.weak, 1),
    );
    y += 10;

    // SPEC-030 F3c: 2 列レイアウトを 2 つの StatGrid (左 / 右) に分割。
    const colW = (width - 56) / 2;
    const leftGrid = new StatGrid(this, {
      x: left + 28,
      y: y + 6,
      width: colW,
      rows: [
        ["HP", `${hero.hp}`],
        ["PHY", `${hero.phy}`],
        ["PHY DEF", `${hero.phyDef}`],
      ],
      rowHeight: 22,
      step: "small",
    });
    const rightGrid = new StatGrid(this, {
      x: left + width / 2 + 14,
      y: y + 6,
      width: colW,
      rows: [
        ["AGI", `${hero.agi}`],
        ["INT", `${hero.int}`],
        ["INT DEF", `${hero.intDef}`],
      ],
      rowHeight: 22,
      step: "small",
    });
    this.detailDynamic.push(leftGrid, rightGrid);
    y += 3 * 22 + 8;

    this.detailDynamic.push(
      this.add.rectangle(cardCX, y, width - 32, 1, theme.line.weak, 1),
    );
    y += 10;

    this.detailDynamic.push(
      this.add
        .text(left + 16, y, "■ スキル", {
          ...textStyle("body", { colorNum: theme.accent.primary }),
          fontStyle: "bold",
        })
        .setOrigin(0, 0.5),
    );
    y += 16;

    if (skill) {
      this.detailDynamic.push(
        this.add
          .text(left + 16, y, skill.name, {
            ...textStyle("small", { colorNum: theme.ink.primary }),
            fontStyle: "bold",
            wordWrap: { width: width - 32, useAdvancedWrap: true },
          })
          .setOrigin(0, 0.5),
      );
      y += 16;
      this.detailDynamic.push(
        this.add
          .text(left + 16, y, skill.description, {
            ...textStyle("small", { colorNum: theme.ink.primary }),
            wordWrap: { width: width - 32, useAdvancedWrap: true },
          })
          .setOrigin(0, 0),
      );
      y += 36;
      const meta =
        skill.durationSec > 0
          ? `効果: ${skill.value}×  /  持続 ${skill.durationSec} 秒  /  Cost ${skill.cost}`
          : `効果: ${skill.value}×  /  即発  /  Cost ${skill.cost}`;
      this.detailDynamic.push(
        this.add
          .text(left + 16, y, meta, {
            ...textStyle("small", { colorNum: theme.ink.tertiary }),
          })
          .setOrigin(0, 0),
      );
    } else {
      this.detailDynamic.push(
        this.add
          .text(left + 16, y, "(スキル未定義)", {
            ...textStyle("small", { colorNum: theme.ink.muted }),
          })
          .setOrigin(0, 0.5),
      );
    }

    this.attachActionButton(inParty, partyFull, top + height - 56);
    this.attachHint(inParty, partyFull, top + height - 16);
  }

  private layoutDetailCompact(
    hero: HeroDef,
    skill: ReturnType<typeof findSkill>,
    inParty: boolean,
    partyFull: boolean,
  ): void {
    const { left, width, top, height } = this.detailGeometry;
    // 上から: ヘッダ "ヒーロー詳細" (14px) → portrait/text 行 → stats 1 行 →
    // skill name → skill desc (wrap) → action btn → hint
    // ボトム端からの予約 (action btn + hint = 30 + 12 = ~46) を確保。
    const bottomReserve = 50;

    // ── ポートレート + 名前/レアリティ/コスト
    const portraitSize = 56;
    const portraitX = left + 12 + portraitSize / 2;
    const portraitY = top + 36 + portraitSize / 2;
    this.detailDynamic.push(
      this.add
        .sprite(portraitX, portraitY, TEXTURE_KEYS.hero(hero.id))
        .setDisplaySize(portraitSize, portraitSize),
    );
    this.detailDynamic.push(
      makeClassIcon(
        this,
        portraitX + portraitSize / 2 - 10,
        portraitY + portraitSize / 2 - 10,
        hero.class,
        18,
        CLASS_COLORS[hero.class].hex,
      ),
    );

    const textLeft = portraitX + portraitSize / 2 + 12;
    const textW = Math.max(80, left + width - 12 - textLeft);
    const rarityColor = RARITY[hero.rarity].hex;
    this.detailDynamic.push(
      this.add
        .text(textLeft, top + 32, hero.name, {
          ...textStyle("body", { colorNum: theme.ink.primary }),
          fontStyle: "bold",
          wordWrap: { width: textW, useAdvancedWrap: true },
        })
        .setOrigin(0, 0),
    );
    this.detailDynamic.push(
      this.add
        .text(
          textLeft,
          top + 50,
          `[${RARITY_LABEL[hero.rarity]}] ${CLASS_LABEL[hero.class]} / ${hero.attackType}  ·  Cost ${hero.cost}`,
          textStyle("body", { colorNum: rarityColor }),
        )
        .setOrigin(0, 0),
    );

    // ── ステータス 1 行（HP / AGI / PHY / INT / 防御は省略）
    let cursorY = top + 36 + portraitSize + 6;
    const statsLine = `HP ${hero.hp} · AGI ${hero.agi} · PHY ${hero.phy} · INT ${hero.int} · DEF ${hero.phyDef}/${hero.intDef}`;
    const statsText = this.add
      .text(left + 12, cursorY, statsLine, {
        ...textStyle("body", { colorNum: theme.ink.secondary }),
        wordWrap: { width: width - 24, useAdvancedWrap: true },
      })
      .setOrigin(0, 0);
    this.detailDynamic.push(statsText);
    cursorY += statsText.height + 6;

    // ── スキル名 + 説明（wrap で実高を計測）
    if (skill) {
      const skillName = this.add
        .text(left + 12, cursorY, `■ ${skill.name}`, {
          ...textStyle("small", { colorNum: theme.accent.primary }),
          fontStyle: "bold",
          wordWrap: { width: width - 24, useAdvancedWrap: true },
        })
        .setOrigin(0, 0);
      this.detailDynamic.push(skillName);
      cursorY += skillName.height + 2;

      // action ボタン用に確保する縦幅（bottomReserve）を引いた残りで desc を描き、
      // はみ出たら可視範囲のみ。
      const descMaxBottom = top + height - bottomReserve;
      const descMaxH = Math.max(20, descMaxBottom - cursorY);
      const descText = this.add
        .text(left + 12, cursorY, skill.description, {
          ...textStyle("body", { colorNum: theme.ink.primary }),
          wordWrap: { width: width - 24, useAdvancedWrap: true },
          // 行数制限の代わり: max height を超えそうなら fixedHeight + 切り捨て
          fixedHeight: descMaxH,
        })
        .setOrigin(0, 0);
      this.detailDynamic.push(descText);
    }

    // ── アクションボタン + ヒント (パネル下端に固定)
    this.attachActionButton(inParty, partyFull, top + height - 30);
    this.attachHint(inParty, partyFull, top + height - 10);
  }

  private attachActionButton(
    inParty: boolean,
    partyFull: boolean,
    y: number,
  ): void {
    const { left, width } = this.detailGeometry;
    const cardCX = left + width / 2;

    let label: string;
    let kind: "primary" | "destructive" | "secondary";
    let enabled = true;

    if (inParty) {
      label = "外す";
      kind = "destructive";
    } else if (partyFull) {
      label = "枠 FULL  /  編成中ヒーローをタップで交代";
      kind = "secondary";
      enabled = false;
    } else {
      label = "編成する";
      kind = "primary";
    }

    const btn = new Btn(this, {
      x: cardCX,
      y,
      width: width - 24,
      height: 30,
      label,
      kind,
      size: "sm",
      disabled: !enabled,
      onClick: () => this.onActionConfirm(),
    });
    this.detailDynamic.push(btn);
  }

  private attachHint(
    inParty: boolean,
    partyFull: boolean,
    y: number,
  ): void {
    const { left, width } = this.detailGeometry;
    const cardCX = left + width / 2;
    const hint = inParty
      ? "もう一度同じヒーローをタップでも外せます"
      : partyFull
        ? "編成中スロットをタップで 1 タップ交代"
        : "もう一度タップで編成";
    this.detailDynamic.push(
      this.add
        .text(cardCX, y, hint, {
          ...textStyle("body", { colorNum: theme.ink.muted }),
          wordWrap: { width: width - 16, useAdvancedWrap: true },
          align: "center",
        })
        .setOrigin(0.5),
    );
  }

  // ─── 操作 ──────────────────────────────────────
  private onPartySlotTap(slotIndex: number): void {
    const heroId = this.party[slotIndex];

    if (heroId === undefined) {
      if (
        this.focusedHeroId !== null &&
        !this.party.includes(this.focusedHeroId)
      ) {
        playSe(this, SE_KEYS.uiMenu());
        this.party.push(this.focusedHeroId);
        this.focusedHeroId = null;
        this.refresh();
      }
      return;
    }

    if (
      this.focusedHeroId !== null &&
      !this.party.includes(this.focusedHeroId) &&
      this.party.length >= PARTY_LIMIT
    ) {
      playSe(this, SE_KEYS.uiMenu());
      this.party[slotIndex] = this.focusedHeroId;
      this.focusedHeroId = null;
      this.refresh();
      return;
    }

    if (this.focusedHeroId === heroId) {
      playSe(this, SE_KEYS.uiMenu());
      this.party.splice(slotIndex, 1);
      this.focusedHeroId = null;
      this.refresh();
      return;
    }

    playSe(this, SE_KEYS.uiMenu());
    this.focusedHeroId = heroId;
    this.refresh();
  }

  private onRosterTap(heroId: number): void {
    const inParty = this.party.includes(heroId);

    if (this.focusedHeroId === heroId) {
      if (inParty) {
        playSe(this, SE_KEYS.uiMenu());
        const idx = this.party.indexOf(heroId);
        if (idx >= 0) this.party.splice(idx, 1);
        this.focusedHeroId = null;
        this.refresh();
        return;
      }
      if (this.party.length < PARTY_LIMIT) {
        playSe(this, SE_KEYS.uiMenu());
        this.party.push(heroId);
        this.focusedHeroId = null;
        this.refresh();
        return;
      }
      return;
    }

    playSe(this, SE_KEYS.uiMenu());
    this.focusedHeroId = heroId;
    this.refresh();
  }

  private onActionConfirm(): void {
    if (this.focusedHeroId === null) return;
    const inParty = this.party.includes(this.focusedHeroId);

    if (inParty) {
      const idx = this.party.indexOf(this.focusedHeroId);
      if (idx >= 0) this.party.splice(idx, 1);
      this.focusedHeroId = null;
      playSe(this, SE_KEYS.uiMenu());
      this.refresh();
      return;
    }

    if (this.party.length < PARTY_LIMIT) {
      this.party.push(this.focusedHeroId);
      this.focusedHeroId = null;
      playSe(this, SE_KEYS.uiMenu());
      this.refresh();
    }
  }

  // ─── 表示更新 ──────────────────────────────────
  private refresh(): void {
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      for (const c of slot.children) c.destroy();
      slot.children = [];

      const heroId = this.party[i];
      const isFocused =
        this.focusedHeroId !== null && heroId === this.focusedHeroId;

      if (heroId === undefined) {
        slot.border.setStrokeStyle(2, theme.line.weak);
        slot.border.setFillStyle(theme.bg.surface, 1);
        slot.children.push(
          this.add
            .text(slot.cx, slot.cy, "（空）", {
              ...textStyle("small", { colorNum: theme.ink.muted }),
            })
            .setOrigin(0.5),
        );
        continue;
      }

      const hero = findHero(heroId);
      if (!hero) continue;

      // 編成中スロットの枠は職業色（focus 時は太く + 上書き）
      const classColor = CLASS_COLORS[hero.class].hex;
      const stroke = isFocused ? classColor : theme.line.base;
      const fill = isFocused ? theme.bg.raised : theme.bg.surface;
      slot.border.setStrokeStyle(isFocused ? 2 : 1, stroke);
      slot.border.setFillStyle(fill, 1);

      const compact = slot.w < 72;
      const labelStripH = compact ? 14 : 32;
      const portraitSize = Math.min(
        48,
        Math.max(24, slot.h - 14 - labelStripH),
      );
      const portraitCY = slot.cy - slot.h / 2 + 14 + portraitSize / 2;

      slot.children.push(
        this.add
          .sprite(slot.cx, portraitCY, TEXTURE_KEYS.hero(hero.id))
          .setDisplaySize(portraitSize, portraitSize)
          .setAlpha(isFocused ? 0.45 : 1),
      );

      slot.children.push(
        this.add
          .text(
            slot.cx + slot.w / 2 - 4,
            slot.cy - slot.h / 2 + 4,
            `${hero.cost}`,
            {
              ...textStyle("small", { colorNum: theme.ink.primary }),
              fontStyle: "bold",
            },
          )
          .setOrigin(1, 0),
      );

      slot.children.push(
        this.add
          .text(
            slot.cx,
            slot.cy + slot.h / 2 - (compact ? 4 : 22),
            CLASS_LABEL[hero.class],
            textStyle("small", { colorNum: theme.accent.primary }),
          )
          .setOrigin(0.5, 1),
      );

      if (!compact) {
        slot.children.push(
          this.add
            .text(slot.cx, slot.cy + slot.h / 2 - 4, hero.name, {
              ...textStyle("small", { colorNum: theme.ink.primary }),
              align: "center",
              wordWrap: { width: slot.w - 6, useAdvancedWrap: true },
            })
            .setOrigin(0.5, 1),
        );
      }

      if (isFocused) {
        slot.children.push(
          this.add
            .text(slot.cx, slot.cy - slot.h / 2 + 4, "外す", {
              ...textStyle("small", { colorNum: theme.accent.danger }),
              fontStyle: "bold",
            })
            .setOrigin(0.5, 0),
        );
      }
    }

    const inParty = new Set(this.party);
    for (const r of this.roster) {
      const sel = inParty.has(r.hero.id);
      const isFocused =
        this.focusedHeroId !== null && r.hero.id === this.focusedHeroId;
      r.selectedMark.setVisible(sel);
      // フォーカス時は職業色 + 太枠、編成済みは accent.success の細枠
      const classColor = CLASS_COLORS[r.hero.class].hex;
      const stroke = isFocused
        ? classColor
        : sel
          ? theme.accent.success
          : theme.line.base;
      r.border.setStrokeStyle(isFocused ? 2 : 1, stroke);
      r.border.setFillStyle(isFocused ? theme.bg.raised : theme.bg.surface, 1);
      r.sprite.setAlpha(isFocused ? 0.45 : sel ? 0.5 : 1);
    }

    this.partyCountText.setText(`${this.party.length} / ${PARTY_LIMIT} 体編成中`);

    const ok = this.party.length > 0;
    this.startBtnBg.setFillStyle(ok ? theme.accent.primary : theme.line.weak, 1);
    this.startBtnBg.setStrokeStyle(2, ok ? theme.accent.primary : theme.line.bright);
    this.startBtnText.setColor(ok ? hex2css(theme.ink.inverse) : hex2css(theme.ink.tertiary));
    this.startBtnText.setText(ok ? "出撃 ▶" : "ヒーローを編成してください");

    this.refreshDetail();
  }

  private confirmAndStart(): void {
    if (this.party.length === 0) return;
    setPartyHeroIds(this.party);
    playSe(this, SE_KEYS.uiMenu());
    this.scene.start("StageScene", { stageId: this.stageId });
  }
}
