import Phaser from "phaser";
import { HEROES, findHero } from "../game/heroData";
import {
  PARTY_LIMIT,
  getPartyHeroIds,
  setPartyHeroIds,
} from "../game/progress";
import { findStage } from "../game/stages";
import { findSkill } from "../game/skill";
import type { HeroClass, HeroDef, HeroRarity } from "../game/types";
import { TEXTURE_KEYS, SE_KEYS } from "./BootScene";
import { playSe } from "./seUtil";

/**
 * SPEC-015: パーティ編成シーン（2 ペイン版）。
 *
 * 左ペイン:
 *  - 編成中スロット (5 × 2)
 *  - 保有ヒーロー一覧 (6 × 3)
 *  - 出撃 ボタン
 *
 * 右ペイン:
 *  - フォーカス中ヒーローの詳細（ステータス + スキル + アクションボタン）
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
}

const DETAIL_CARD = {
  left: 524,
  width: 376,
  top: 82,
  height: 512,
};

export class PartyFormationScene extends Phaser.Scene {
  private stageId = "1-1";
  private party: number[] = [];
  /** フォーカス対象の hero ID（左の編成スロット or 右の保有一覧、どちらでも共通） */
  private focusedHeroId: number | null = null;

  private slots: SlotEntry[] = [];
  private roster: RosterEntry[] = [];

  private partyCountText!: Phaser.GameObjects.Text;
  private startBtnBg!: Phaser.GameObjects.Rectangle;
  private startBtnText!: Phaser.GameObjects.Text;

  /** 詳細パネル: focus に依存して再生成する子要素 */
  private detailDynamic: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super("PartyFormationScene");
  }

  init(data: { stageId?: string }): void {
    if (data?.stageId) this.stageId = data.stageId;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x0e1117);
    const { width, height } = this.scale;

    // restart 対策: scene field を毎回明示的にリセット
    this.party = getPartyHeroIds();
    this.slots = [];
    this.roster = [];
    this.focusedHeroId = null;
    this.detailDynamic = [];

    const stage = findStage(this.stageId);
    const stageLabel = stage ? `${stage.name}` : `ステージ ${this.stageId}`;

    // ── ヘッダ
    this.add
      .text(width / 2, 28, "パーティ編成", {
        fontSize: "20px",
        color: "#fde68a",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 50, `出撃先: ${stageLabel}`, {
        fontSize: "11px",
        color: "#bae6fd",
      })
      .setOrigin(0.5);

    const backBtn = this.add
      .text(20, 24, "← ステージ選択", {
        fontSize: "14px",
        color: "#93c5fd",
      })
      .setInteractive({ useHandCursor: true });
    backBtn.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      playSe(this, SE_KEYS.uiMenu());
      this.scene.start("StageSelectScene", {
        worldId: stage?.worldId ?? "world-1",
      });
    });

    // ── 左ペイン: パーティ + 保有 + 出撃ボタン
    const leftPaneX = 8;
    const leftPaneW = 504;
    const leftCenter = leftPaneX + leftPaneW / 2;

    this.add
      .text(leftCenter, 80, `編成中  ( 最大 ${PARTY_LIMIT} 体 )`, {
        fontSize: "12px",
        color: "#fcd34d",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const slotW = 78;
    const slotH = 88;
    const slotGap = 6;
    const partyGridW = slotW * 5 + slotGap * 4;
    const partyStartX = leftPaneX + (leftPaneW - partyGridW) / 2;
    const partyTopY = 96;
    for (let i = 0; i < PARTY_LIMIT; i++) {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const cx = partyStartX + col * (slotW + slotGap) + slotW / 2;
      const cy = partyTopY + row * (slotH + slotGap) + slotH / 2;
      this.slots.push(this.buildSlot(i, cx, cy, slotW, slotH));
    }

    this.partyCountText = this.add
      .text(leftCenter, partyTopY + slotH * 2 + slotGap + 14, "", {
        fontSize: "11px",
        color: "#cbd5e1",
      })
      .setOrigin(0.5);

    // 保有ヒーロー
    const rosterHeadingY = partyTopY + slotH * 2 + slotGap + 38;
    this.add
      .text(leftCenter, rosterHeadingY, "保有ヒーロー", {
        fontSize: "12px",
        color: "#fcd34d",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const rosterCols = 6;
    const rosterSlotW = 78;
    const rosterSlotH = 84;
    const rosterGap = 4;
    const rosterGridW = rosterSlotW * rosterCols + rosterGap * (rosterCols - 1);
    const rosterStartX = leftPaneX + (leftPaneW - rosterGridW) / 2;
    const rosterTopY = rosterHeadingY + 22;

    HEROES.forEach((hero, i) => {
      const col = i % rosterCols;
      const row = Math.floor(i / rosterCols);
      const cx =
        rosterStartX + col * (rosterSlotW + rosterGap) + rosterSlotW / 2;
      const cy = rosterTopY + row * (rosterSlotH + rosterGap) + rosterSlotH / 2;
      this.roster.push(
        this.buildRosterEntry(hero, cx, cy, rosterSlotW, rosterSlotH),
      );
    });

    // 出撃ボタン (左ペイン下)
    const btnW = 220;
    const btnH = 36;
    const btnX = leftCenter;
    const btnY = height - 24;
    this.startBtnBg = this.add.rectangle(btnX, btnY, btnW, btnH, 0xfacc15, 1);
    this.startBtnBg.setStrokeStyle(2, 0xfde047);
    this.startBtnBg.setInteractive({ useHandCursor: true });
    this.startBtnText = this.add
      .text(btnX, btnY, "出撃 ▶", {
        fontSize: "16px",
        color: "#1f2937",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.startBtnBg.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      this.confirmAndStart();
    });

    // ── 右ペイン: 詳細
    this.buildDetailPane();

    this.refresh();
  }

  // ─── スロット / 保有ヒーロー要素の構築 ─────────────
  private buildSlot(
    index: number,
    cx: number,
    cy: number,
    w: number,
    h: number,
  ): SlotEntry {
    const border = this.add.rectangle(cx, cy, w, h, 0x111827, 1);
    border.setStrokeStyle(2, 0x4b5563);
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
    const border = this.add.rectangle(cx, cy, w, h, 0x111827, 1);
    border.setStrokeStyle(2, 0x4b5563);
    border.setInteractive({ useHandCursor: true });

    const sprite = this.add
      .sprite(cx, cy - 16, TEXTURE_KEYS.hero(hero.id))
      .setDisplaySize(44, 44);

    this.add
      .text(
        cx - w / 2 + 4,
        cy - h / 2 + 4,
        hero.rarity === "uncommon" ? "U" : "C",
        {
          fontSize: "10px",
          color: hero.rarity === "uncommon" ? "#a5f3fc" : "#fcd34d",
          fontStyle: "bold",
        },
      )
      .setOrigin(0, 0);

    this.add
      .text(cx + w / 2 - 4, cy - h / 2 + 4, `${hero.cost}`, {
        fontSize: "10px",
        color: "#fde68a",
        fontStyle: "bold",
      })
      .setOrigin(1, 0);

    this.add
      .text(cx, cy + 14, CLASS_LABEL[hero.class], {
        fontSize: "10px",
        color: "#fcd34d",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy + 27, hero.name, {
        fontSize: "9px",
        color: "#e5e7eb",
        align: "center",
        wordWrap: { width: w - 6, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0);

    const selectedMark = this.add
      .text(cx + w / 2 - 4, cy + h / 2 - 4, "✓", {
        fontSize: "12px",
        color: "#4ade80",
        fontStyle: "bold",
      })
      .setOrigin(1, 1);
    selectedMark.setVisible(false);

    border.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      this.onRosterTap(hero.id);
    });

    return { hero, cx, cy, w, h, border, sprite, selectedMark };
  }

  // ─── 詳細パネル ─────────────────────────────────
  private buildDetailPane(): void {
    const { left, width, top, height } = DETAIL_CARD;
    const cardCX = left + width / 2;
    const cardCY = top + height / 2;

    const bg = this.add.rectangle(cardCX, cardCY, width, height, 0x111827, 0.95);
    bg.setStrokeStyle(2, 0x374151);
    void bg;
    this.add
      .text(cardCX, top + 14, "ヒーロー詳細", {
        fontSize: "12px",
        color: "#fcd34d",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
  }

  private clearDetailDynamic(): void {
    for (const obj of this.detailDynamic) obj.destroy();
    this.detailDynamic = [];
  }

  private refreshDetail(): void {
    this.clearDetailDynamic();

    const { left, width } = DETAIL_CARD;
    const cardCX = left + width / 2;

    // ── 何も選んでいない時の placeholder
    if (this.focusedHeroId === null) {
      const empty = this.add
        .text(
          cardCX,
          DETAIL_CARD.top + DETAIL_CARD.height / 2,
          "ヒーローをタップすると\nここに詳細が表示されます",
          {
            fontSize: "12px",
            color: "#64748b",
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

    // ── ポートレート
    const portrait = this.add
      .sprite(cardCX, 154, TEXTURE_KEYS.hero(hero.id))
      .setDisplaySize(96, 96);
    this.detailDynamic.push(portrait);

    // 名前
    this.detailDynamic.push(
      this.add
        .text(cardCX, 214, hero.name, {
          fontSize: "16px",
          color: "#f9fafb",
          fontStyle: "bold",
          align: "center",
          wordWrap: { width: width - 24, useAdvancedWrap: true },
        })
        .setOrigin(0.5),
    );

    // レアリティ + 職業 + 攻撃属性
    const rarityColor = hero.rarity === "uncommon" ? "#a5f3fc" : "#fcd34d";
    this.detailDynamic.push(
      this.add
        .text(
          cardCX,
          238,
          `[${RARITY_LABEL[hero.rarity]}]  ${CLASS_LABEL[hero.class]}  /  ${hero.attackType}`,
          {
            fontSize: "11px",
            color: rarityColor,
          },
        )
        .setOrigin(0.5),
    );

    // コスト
    this.detailDynamic.push(
      this.add
        .text(cardCX, 256, `配置コスト: ${hero.cost} CE`, {
          fontSize: "11px",
          color: "#fde68a",
        })
        .setOrigin(0.5),
    );

    // 区切り線
    this.detailDynamic.push(
      this.add.rectangle(cardCX, 274, width - 32, 1, 0x374151, 1),
    );

    // ステータス（2 列）
    const statL = left + 28;
    const statR = left + width / 2 + 14;
    const statRows: Array<[string, string, string, string]> = [
      ["HP", `${hero.hp}`, "AGI", `${hero.agi}`],
      ["PHY", `${hero.phy}`, "INT", `${hero.int}`],
      ["PHY DEF", `${hero.phyDef}`, "INT DEF", `${hero.intDef}`],
    ];
    for (let r = 0; r < statRows.length; r++) {
      const [k1, v1, k2, v2] = statRows[r];
      const y = 290 + r * 22;
      this.detailDynamic.push(
        this.add
          .text(statL, y, k1, { fontSize: "11px", color: "#94a3b8" })
          .setOrigin(0, 0.5),
      );
      this.detailDynamic.push(
        this.add
          .text(statL + 78, y, v1, {
            fontSize: "12px",
            color: "#e5e7eb",
            fontStyle: "bold",
          })
          .setOrigin(0, 0.5),
      );
      this.detailDynamic.push(
        this.add
          .text(statR, y, k2, { fontSize: "11px", color: "#94a3b8" })
          .setOrigin(0, 0.5),
      );
      this.detailDynamic.push(
        this.add
          .text(statR + 78, y, v2, {
            fontSize: "12px",
            color: "#e5e7eb",
            fontStyle: "bold",
          })
          .setOrigin(0, 0.5),
      );
    }

    // 区切り線
    this.detailDynamic.push(
      this.add.rectangle(cardCX, 372, width - 32, 1, 0x374151, 1),
    );

    // スキル
    this.detailDynamic.push(
      this.add
        .text(left + 16, 388, "■ スキル", {
          fontSize: "12px",
          color: "#fcd34d",
          fontStyle: "bold",
        })
        .setOrigin(0, 0.5),
    );

    if (skill) {
      this.detailDynamic.push(
        this.add
          .text(left + 16, 410, skill.name, {
            fontSize: "13px",
            color: "#fde68a",
            fontStyle: "bold",
            wordWrap: { width: width - 32, useAdvancedWrap: true },
          })
          .setOrigin(0, 0.5),
      );

      this.detailDynamic.push(
        this.add
          .text(left + 16, 428, skill.description, {
            fontSize: "11px",
            color: "#e5e7eb",
            wordWrap: { width: width - 32, useAdvancedWrap: true },
          })
          .setOrigin(0, 0),
      );

      const meta =
        skill.durationSec > 0
          ? `効果: ${skill.value}×  /  持続 ${skill.durationSec} 秒  /  Cost ${skill.cost}`
          : `効果: ${skill.value}×  /  即発  /  Cost ${skill.cost}`;
      this.detailDynamic.push(
        this.add
          .text(left + 16, 478, meta, {
            fontSize: "10px",
            color: "#94a3b8",
          })
          .setOrigin(0, 0),
      );
    } else {
      this.detailDynamic.push(
        this.add
          .text(left + 16, 408, "(スキル未定義)", {
            fontSize: "11px",
            color: "#64748b",
          })
          .setOrigin(0, 0.5),
      );
    }

    // ── アクションボタン
    let btnLabel: string;
    let btnEnabled: boolean;
    let btnFill = 0xfacc15;
    let btnStroke = 0xfde047;
    let btnTextColor = "#1f2937";

    if (inParty) {
      btnLabel = "外す";
      btnEnabled = true;
      btnFill = 0xef4444;
      btnStroke = 0xfca5a5;
      btnTextColor = "#fef2f2";
    } else if (partyFull) {
      btnLabel = "枠 FULL — 編成中ヒーローをタップで交代";
      btnEnabled = false;
      btnFill = 0x374151;
      btnStroke = 0x6b7280;
      btnTextColor = "#cbd5e1";
    } else {
      btnLabel = "編成する";
      btnEnabled = true;
    }

    const actX = cardCX;
    const actY = 540;
    const actW = width - 40;
    const actH = 36;
    const actBg = this.add.rectangle(actX, actY, actW, actH, btnFill, 1);
    actBg.setStrokeStyle(2, btnStroke);
    if (btnEnabled) actBg.setInteractive({ useHandCursor: true });
    const actTxt = this.add
      .text(actX, actY, btnLabel, {
        fontSize: "13px",
        color: btnTextColor,
        fontStyle: "bold",
        wordWrap: { width: actW - 16, useAdvancedWrap: true },
        align: "center",
      })
      .setOrigin(0.5);

    if (btnEnabled) {
      actBg.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (pointer.rightButtonDown()) return;
        this.onActionConfirm();
      });
    }
    this.detailDynamic.push(actBg, actTxt);

    // ヒント
    const hint = inParty
      ? "もう一度同じヒーローをタップでも外せます"
      : partyFull
        ? "編成中スロット（左）をタップで 1 タップ交代"
        : "もう一度タップで編成";
    this.detailDynamic.push(
      this.add
        .text(cardCX, 580, hint, {
          fontSize: "10px",
          color: "#64748b",
        })
        .setOrigin(0.5),
    );
  }

  // ─── 操作 ──────────────────────────────────────
  private onPartySlotTap(slotIndex: number): void {
    const heroId = this.party[slotIndex];

    // 空スロット
    if (heroId === undefined) {
      // フォーカス中の未編成ヒーローがいるなら、空きに追加
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

    // フォーカスが「未編成 roster ヒーロー」かつ満員 → 1 タップで交代
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

    // 同じヒーローを 2 度タップ → 外す
    if (this.focusedHeroId === heroId) {
      playSe(this, SE_KEYS.uiMenu());
      this.party.splice(slotIndex, 1);
      this.focusedHeroId = null;
      this.refresh();
      return;
    }

    // それ以外 → フォーカス切替
    playSe(this, SE_KEYS.uiMenu());
    this.focusedHeroId = heroId;
    this.refresh();
  }

  private onRosterTap(heroId: number): void {
    const inParty = this.party.includes(heroId);

    // 同じヒーローを 2 度タップ → 確定アクション
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
      // 満員 + 未編成 → 維持（編成中スロットをタップしてもらう）
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
    // パーティスロット
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      for (const c of slot.children) c.destroy();
      slot.children = [];

      const heroId = this.party[i];
      const isFocused =
        this.focusedHeroId !== null && heroId === this.focusedHeroId;

      if (heroId === undefined) {
        slot.border.setStrokeStyle(2, 0x374151);
        slot.border.setFillStyle(0x111827, 1);
        slot.children.push(
          this.add
            .text(slot.cx, slot.cy, "（空）", {
              fontSize: "11px",
              color: "#475569",
            })
            .setOrigin(0.5),
        );
        continue;
      }

      const hero = findHero(heroId);
      if (!hero) continue;

      const stroke = isFocused ? 0xef4444 : 0xfde047;
      const fill = isFocused ? 0x1f2937 : 0x111827;
      slot.border.setStrokeStyle(2, stroke);
      slot.border.setFillStyle(fill, 1);

      slot.children.push(
        this.add
          .sprite(slot.cx, slot.cy - 14, TEXTURE_KEYS.hero(hero.id))
          .setDisplaySize(44, 44)
          .setAlpha(isFocused ? 0.45 : 1),
      );

      slot.children.push(
        this.add
          .text(
            slot.cx + slot.w / 2 - 4,
            slot.cy - slot.h / 2 + 4,
            `${hero.cost}`,
            {
              fontSize: "10px",
              color: "#fde68a",
              fontStyle: "bold",
            },
          )
          .setOrigin(1, 0),
      );

      slot.children.push(
        this.add
          .text(slot.cx, slot.cy + 14, CLASS_LABEL[hero.class], {
            fontSize: "10px",
            color: "#fcd34d",
          })
          .setOrigin(0.5),
      );

      slot.children.push(
        this.add
          .text(slot.cx, slot.cy + 27, hero.name, {
            fontSize: "9px",
            color: "#e5e7eb",
            align: "center",
            wordWrap: { width: slot.w - 6, useAdvancedWrap: true },
          })
          .setOrigin(0.5, 0),
      );

      if (isFocused) {
        slot.children.push(
          this.add
            .text(slot.cx, slot.cy - slot.h / 2 + 4, "外す", {
              fontSize: "10px",
              color: "#fca5a5",
              fontStyle: "bold",
            })
            .setOrigin(0.5, 0),
        );
      }
    }

    // 保有ヒーロー
    const inParty = new Set(this.party);
    for (const r of this.roster) {
      const sel = inParty.has(r.hero.id);
      const isFocused =
        this.focusedHeroId !== null && r.hero.id === this.focusedHeroId;
      r.selectedMark.setVisible(sel);
      const stroke = isFocused ? 0x60a5fa : sel ? 0x4ade80 : 0x4b5563;
      r.border.setStrokeStyle(2, stroke);
      r.border.setFillStyle(isFocused ? 0x1e293b : 0x111827, 1);
      r.sprite.setAlpha(isFocused ? 0.45 : sel ? 0.5 : 1);
    }

    // 編成人数
    this.partyCountText.setText(`${this.party.length} / ${PARTY_LIMIT} 体編成中`);

    // 出撃ボタン
    const ok = this.party.length > 0;
    this.startBtnBg.setFillStyle(ok ? 0xfacc15 : 0x374151, 1);
    this.startBtnBg.setStrokeStyle(2, ok ? 0xfde047 : 0x6b7280);
    this.startBtnText.setColor(ok ? "#1f2937" : "#9ca3af");
    this.startBtnText.setText(ok ? "出撃 ▶" : "ヒーローを編成してください");

    // 詳細パネル
    this.refreshDetail();
  }

  private confirmAndStart(): void {
    if (this.party.length === 0) return;
    setPartyHeroIds(this.party);
    playSe(this, SE_KEYS.uiMenu());
    this.scene.start("StageScene", { stageId: this.stageId });
  }
}
