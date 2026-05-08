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
 * 元 Unity プロジェクト（MCHTowerDefence）に同梱されていた Senses Circuit (hitoshi 氏) 提供の
 * 効果音を `web/public/assets/se/` に配置して読み込む。
 * 利用規約: https://www.senses-circuit.com/terms/  Copyright © Senses Circuit
 *
 * - menu.mp3            : メニュー選択（World/Stage/Party 各画面のタップ確定）
 * - tap_decision_01.mp3 : 配置確定
 * - swipe_01.mp3        : ヒーロー攻撃モーション
 */
const UI_SE_KEYS = {
  /** ステータスパネル等のタップ。menu.mp3 を共用。 */
  tap: "ui_tap",
  /** ワールド/ステージ/パーティ画面の遷移系タップ。menu.mp3 を共用。 */
  menu: "ui_menu",
  place: "ui_place",
  attackSwipe: "ui_attack_swipe",
} as const;

const UI_SE_FILES: Array<{ key: string; url: string }> = [
  { key: UI_SE_KEYS.tap, url: "assets/se/menu.mp3" },
  { key: UI_SE_KEYS.menu, url: "assets/se/menu.mp3" },
  { key: UI_SE_KEYS.place, url: "assets/se/tap_decision_01.mp3" },
  { key: UI_SE_KEYS.attackSwipe, url: "assets/se/swipe_01.mp3" },
];

export const SE_KEYS = {
  category: (c: SkillCategory) => `se_${c}`,
  bgmBattle: () => BGM_BATTLE_KEY,
  uiTap: () => UI_SE_KEYS.tap,
  uiMenu: () => UI_SE_KEYS.menu,
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

    // SPEC-020: 全ヒーロー / 全エネミー画像をロード。
    // SPEC-019 で「Rare 以上は CDN 未配置」として skip していたが、実は MCH CDN
    // (raw.githubusercontent.com/bearko/mycryptoheroes/main/Image/...) に
    // 3xxx / 4xxx / 5xxx および拡張エネミー (105 / 122 / 132 / 141 / 151 / 161)
    // も存在することを確認したため、whitelist を撤廃し全 ID を load する。
    // 万が一 404 になっても loaderror ハンドラで failedKeys に積まれて
    // placeholder にフォールバックするため安全。
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

    // SPEC-022: ヒーロー / エネミーのピクセルアートだけ NEAREST フィルタで描く。
    // テキスト / UI 等のテクスチャは LINEAR (デフォルト) のままにすることで
    // Retina 環境での日本語フォントの粒状を解消する。
    this.textures.each((texture: Phaser.Textures.Texture) => {
      if (texture.key.startsWith("hero_") || texture.key.startsWith("enemy_")) {
        texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }, this);

    // SPEC-011: アセット読み込み完了後はワールド選択画面へ
    this.scene.start("WorldSelectScene");
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
