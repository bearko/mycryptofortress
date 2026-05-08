import Phaser from "phaser";
import { HEROES, findHero } from "../game/heroData";
import {
  PARTY_LIMIT,
  getPartyHeroIds,
  setPartyHeroIds,
} from "../game/progress";
import { findStage } from "../game/stages";
import type { HeroClass, HeroDef } from "../game/types";
import { TEXTURE_KEYS } from "./BootScene";

/**
 * SPEC-015: パーティ編成シーン。
 * StageSelectScene でステージを選んだ後、StageScene 起動前に挟まれる。
 *
 * 上半分: 編成中パーティ（10 スロット 5 × 2）
 * 下半分: 全保有ヒーロー（roster, 6 列）
 * 操作:
 *   - パーティスロットをタップ → そのヒーローを roster に戻す
 *   - roster ヒーローをタップ → パーティに追加（既に編成中なら無視）
 *   - 「出撃 ▶」 → progress に保存して StageScene 起動
 *   - 「← 戻る」 → 保存せず StageSelectScene へ
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

interface SlotEntry {
  index: number;
  border: Phaser.GameObjects.Rectangle;
  sprite: Phaser.GameObjects.Sprite | null;
  cost: Phaser.GameObjects.Text | null;
  classLabel: Phaser.GameObjects.Text | null;
  emptyLabel: Phaser.GameObjects.Text | null;
}

interface RosterEntry {
  hero: HeroDef;
  border: Phaser.GameObjects.Rectangle;
  sprite: Phaser.GameObjects.Sprite;
  cost: Phaser.GameObjects.Text;
  selectedMark: Phaser.GameObjects.Text;
}

export class PartyFormationScene extends Phaser.Scene {
  private stageId = "1-1";
  /** 編成中の hero ID（順序保持、最大 PARTY_LIMIT） */
  private party: number[] = [];

  private slots: SlotEntry[] = [];
  private roster: RosterEntry[] = [];

  private partyCountText!: Phaser.GameObjects.Text;
  private startBtnBg!: Phaser.GameObjects.Rectangle;
  private startBtnText!: Phaser.GameObjects.Text;

  constructor() {
    super("PartyFormationScene");
  }

  init(data: { stageId?: string }): void {
    if (data?.stageId) this.stageId = data.stageId;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x0e1117);
    const { width } = this.scale;

    this.party = getPartyHeroIds();
    this.slots = [];
    this.roster = [];

    const stage = findStage(this.stageId);
    const stageLabel = stage ? `${stage.name}` : `ステージ ${this.stageId}`;

    // ヘッダ
    this.add
      .text(width / 2, 36, "パーティ編成", {
        fontSize: "24px",
        color: "#fde68a",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 64, `出撃先: ${stageLabel}`, {
        fontSize: "12px",
        color: "#bae6fd",
      })
      .setOrigin(0.5);

    // ── 戻るボタン
    const backBtn = this.add
      .text(20, 28, "← ステージ選択", {
        fontSize: "14px",
        color: "#93c5fd",
      })
      .setInteractive({ useHandCursor: true });
    backBtn.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      this.scene.start("StageSelectScene", {
        worldId: stage?.worldId ?? "world-1",
      });
    });

    // ── パーティ枠（5 × 2、80x96 sized slots）
    this.add
      .text(width / 2, 92, `編成中  ( 最大 ${PARTY_LIMIT} 体 )`, {
        fontSize: "12px",
        color: "#fcd34d",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const slotW = 76;
    const slotH = 92;
    const slotGap = 8;
    const partyGridW = (slotW + slotGap) * 5 - slotGap;
    const partyTopY = 110;
    for (let i = 0; i < PARTY_LIMIT; i++) {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const cx = (width - partyGridW) / 2 + col * (slotW + slotGap) + slotW / 2;
      const cy = partyTopY + row * (slotH + slotGap) + slotH / 2;
      this.slots.push(this.buildSlot(i, cx, cy, slotW, slotH));
    }

    // パーティ人数表示
    this.partyCountText = this.add
      .text(width / 2, partyTopY + slotH * 2 + slotGap + 12, "", {
        fontSize: "11px",
        color: "#cbd5e1",
      })
      .setOrigin(0.5);

    // ── Roster（保有ヒーロー、6 列）
    const rosterTopY = partyTopY + slotH * 2 + slotGap + 36;
    this.add
      .text(width / 2, rosterTopY, "保有ヒーロー", {
        fontSize: "12px",
        color: "#fcd34d",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const rosterCols = 6;
    const rosterSlotW = 86;
    const rosterSlotH = 92;
    const rosterGap = 6;
    const rosterGridW = (rosterSlotW + rosterGap) * rosterCols - rosterGap;
    const rosterStartY = rosterTopY + 22;

    HEROES.forEach((hero, i) => {
      const col = i % rosterCols;
      const row = Math.floor(i / rosterCols);
      const cx =
        (width - rosterGridW) / 2 + col * (rosterSlotW + rosterGap) + rosterSlotW / 2;
      const cy = rosterStartY + row * (rosterSlotH + rosterGap) + rosterSlotH / 2;
      this.roster.push(this.buildRosterEntry(hero, cx, cy, rosterSlotW, rosterSlotH));
    });

    // ── 出撃ボタン
    const btnW = 200;
    const btnH = 44;
    const btnY = this.scale.height - 48;
    const btnX = width / 2;
    this.startBtnBg = this.add.rectangle(btnX, btnY, btnW, btnH, 0xfacc15, 1);
    this.startBtnBg.setStrokeStyle(2, 0xfde047);
    this.startBtnBg.setInteractive({ useHandCursor: true });
    this.startBtnText = this.add
      .text(btnX, btnY, "出撃 ▶", {
        fontSize: "18px",
        color: "#1f2937",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.startBtnBg.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      this.confirmAndStart();
    });

    this.refresh();
  }

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
    const slot: SlotEntry = {
      index,
      border,
      sprite: null,
      cost: null,
      classLabel: null,
      emptyLabel: null,
    };
    border.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      this.removeFromParty(index);
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
      .sprite(cx, cy - 18, TEXTURE_KEYS.hero(hero.id))
      .setDisplaySize(48, 48);

    const rarityChip = this.add
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
    void rarityChip;

    const cost = this.add
      .text(cx + w / 2 - 4, cy - h / 2 + 4, `${hero.cost}`, {
        fontSize: "10px",
        color: "#fde68a",
        fontStyle: "bold",
      })
      .setOrigin(1, 0);

    this.add
      .text(cx, cy + 18, CLASS_LABEL[hero.class], {
        fontSize: "10px",
        color: "#fcd34d",
      })
      .setOrigin(0.5);
    this.add
      .text(cx, cy + 32, hero.name, {
        fontSize: "9px",
        color: "#e5e7eb",
        align: "center",
        wordWrap: { width: w - 6, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0);

    // 編成中マーカー（右下）
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
      this.addToParty(hero.id);
    });

    return { hero, border, sprite, cost, selectedMark };
  }

  private addToParty(heroId: number): void {
    if (this.party.includes(heroId)) return;
    if (this.party.length >= PARTY_LIMIT) {
      // 既に満員、無視
      return;
    }
    this.party.push(heroId);
    this.refresh();
  }

  private removeFromParty(slotIndex: number): void {
    if (slotIndex >= this.party.length) return;
    this.party.splice(slotIndex, 1);
    this.refresh();
  }

  private refresh(): void {
    // パーティスロット表示更新
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      const heroId = this.party[i];
      // 古い表示を破棄
      slot.sprite?.destroy();
      slot.cost?.destroy();
      slot.classLabel?.destroy();
      slot.emptyLabel?.destroy();
      slot.sprite = null;
      slot.cost = null;
      slot.classLabel = null;
      slot.emptyLabel = null;

      const cx = slot.border.x;
      const cy = slot.border.y;
      const w = slot.border.width;
      const h = slot.border.height;

      if (heroId === undefined) {
        slot.border.setStrokeStyle(2, 0x374151);
        slot.emptyLabel = this.add
          .text(cx, cy, "（空）", {
            fontSize: "11px",
            color: "#475569",
          })
          .setOrigin(0.5);
        continue;
      }
      const hero = findHero(heroId);
      if (!hero) continue;
      slot.border.setStrokeStyle(2, 0xfde047);
      slot.sprite = this.add
        .sprite(cx, cy - 18, TEXTURE_KEYS.hero(hero.id))
        .setDisplaySize(48, 48);
      slot.cost = this.add
        .text(cx + w / 2 - 4, cy - h / 2 + 4, `${hero.cost}`, {
          fontSize: "10px",
          color: "#fde68a",
          fontStyle: "bold",
        })
        .setOrigin(1, 0);
      slot.classLabel = this.add
        .text(cx, cy + 18, CLASS_LABEL[hero.class], {
          fontSize: "10px",
          color: "#fcd34d",
        })
        .setOrigin(0.5);
      slot.emptyLabel = this.add
        .text(cx, cy + 32, hero.name, {
          fontSize: "9px",
          color: "#e5e7eb",
          align: "center",
          wordWrap: { width: w - 6, useAdvancedWrap: true },
        })
        .setOrigin(0.5, 0) as Phaser.GameObjects.Text;
    }

    // Roster の編成中マーカー
    const inParty = new Set(this.party);
    for (const r of this.roster) {
      const sel = inParty.has(r.hero.id);
      r.selectedMark.setVisible(sel);
      r.border.setStrokeStyle(2, sel ? 0x4ade80 : 0x4b5563);
      r.sprite.setAlpha(sel ? 0.5 : 1);
      void r.cost;
    }

    // ボタン状態
    const ok = this.party.length > 0;
    this.partyCountText.setText(`${this.party.length} / ${PARTY_LIMIT} 体編成中`);
    this.startBtnBg.setFillStyle(ok ? 0xfacc15 : 0x374151, 1);
    this.startBtnBg.setStrokeStyle(2, ok ? 0xfde047 : 0x6b7280);
    this.startBtnText.setColor(ok ? "#1f2937" : "#9ca3af");
    this.startBtnText.setText(ok ? "出撃 ▶" : "ヒーローを編成してください");
  }

  private confirmAndStart(): void {
    if (this.party.length === 0) return;
    setPartyHeroIds(this.party);
    this.scene.start("StageScene", { stageId: this.stageId });
  }
}
