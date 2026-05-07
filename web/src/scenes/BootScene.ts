import Phaser from "phaser";
import { HEROES } from "../game/heroData";
import { ENEMIES } from "../game/enemyData";
import type { SkillCategory } from "../game/skill";

const PLACEHOLDER_KEY = "__placeholder";

const SE_BASE =
  "https://raw.githubusercontent.com/bearko/mycryptoheroes/main/Audio/SE/Battle";

/** SPEC-004: SE 5 種を読み込む。失敗時はミュート扱い。 */
const SE_FILES: Array<{ key: SkillCategory; url: string }> = [
  { key: "single_damage", url: `${SE_BASE}/1_single_damage.mp3` },
  { key: "area_damage", url: `${SE_BASE}/2_area_damage.mp3` },
  { key: "heal_resurrection", url: `${SE_BASE}/3_heal_resurrection.mp3` },
  { key: "buff", url: `${SE_BASE}/4_buff.mp3` },
  { key: "debuff_status_effect", url: `${SE_BASE}/5_debuff_status_effect.mp3` },
];

/** SPEC-005 §5.4: 戦闘 BGM */
const BGM_BATTLE_KEY = "bgm_battle";
const BGM_BATTLE_URL =
  "https://raw.githubusercontent.com/bearko/mycryptoheroes/main/Audio/BGM/land.mp3";

/**
 * SPEC-005 §5.5: UI 系 SE。
 * 元 Unity プロジェクト（MCHTowerDefence）に同梱されていた senses-circuit 提供の
 * 効果音を `web/public/assets/se/` に配置して読み込む。
 */
const UI_SE_KEYS = {
  tap: "ui_tap",
  place: "ui_place",
  attackSwipe: "ui_attack_swipe",
} as const;

const UI_SE_FILES: Array<{ key: string; url: string }> = [
  { key: UI_SE_KEYS.tap, url: "assets/se/menu.mp3" },
  { key: UI_SE_KEYS.place, url: "assets/se/tap_decision_01.mp3" },
  { key: UI_SE_KEYS.attackSwipe, url: "assets/se/swipe_01.mp3" },
];

export const SE_KEYS = {
  category: (c: SkillCategory) => `se_${c}`,
  bgmBattle: () => BGM_BATTLE_KEY,
  uiTap: () => UI_SE_KEYS.tap,
  uiPlace: () => UI_SE_KEYS.place,
  attackSwipe: () => UI_SE_KEYS.attackSwipe,
};

/**
 * 画像 / 音声アセットの読み込みと、失敗時のプレースホルダ生成を担当するシーン。
 */
export class BootScene extends Phaser.Scene {
  private failedKeys = new Set<string>();
  private failedAudio = new Set<string>();

  constructor() {
    super("BootScene");
  }

  preload(): void {
    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      if (file.type === "audio") {
        this.failedAudio.add(file.key);
      } else {
        this.failedKeys.add(file.key);
      }
      // eslint-disable-next-line no-console
      console.warn(
        `[BootScene] asset load failed: ${file.key} (${file.url}); continuing`,
      );
    });

    for (const h of HEROES) {
      this.load.image(this.heroKey(h.id), h.imageUrl);
    }
    for (const e of ENEMIES) {
      this.load.image(this.enemyKey(e.id), e.imageUrl);
    }
    for (const se of SE_FILES) {
      this.load.audio(SE_KEYS.category(se.key), [se.url]);
    }
    for (const se of UI_SE_FILES) {
      this.load.audio(se.key, [se.url]);
    }
    this.load.audio(BGM_BATTLE_KEY, [BGM_BATTLE_URL]);
  }

  create(): void {
    if (!this.textures.exists(PLACEHOLDER_KEY)) {
      const g = this.add.graphics({ x: 0, y: 0 });
      g.fillStyle(0x6b7280, 1);
      g.fillRect(0, 0, 64, 64);
      g.lineStyle(2, 0xffffff, 1);
      g.strokeRect(1, 1, 62, 62);
      g.generateTexture(PLACEHOLDER_KEY, 64, 64);
      g.destroy();
    }

    for (const key of this.failedKeys) {
      if (!this.textures.exists(key)) {
        const placeholder = this.textures.get(PLACEHOLDER_KEY);
        const src = placeholder.getSourceImage(0) as HTMLImageElement;
        this.textures.addImage(key, src);
      }
    }

    // SPEC-002 §5.8: NEAREST フィルタを全テクスチャに明示適用
    this.textures.each((texture: Phaser.Textures.Texture) => {
      texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }, this);

    this.scene.start("StageScene");
  }

  heroKey(id: number): string {
    return `hero_${id}`;
  }

  enemyKey(id: number): string {
    return `enemy_${id}`;
  }
}

export const TEXTURE_KEYS = {
  hero: (id: number) => `hero_${id}`,
  enemy: (id: number) => `enemy_${id}`,
};
