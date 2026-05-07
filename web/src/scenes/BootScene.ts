import Phaser from "phaser";
import { HEROES } from "../game/heroData";
import { ENEMIES } from "../game/enemyData";

const PLACEHOLDER_KEY = "__placeholder";

/**
 * 画像アセットの読み込みと、失敗時のプレースホルダ生成を担当するシーン。
 *
 * Phaser の `loader` は `loaderror` イベントで個別アセットの失敗を通知してくれるが、
 * 失敗したキーは未登録のままなので、Scene 側で参照する直前にフォールバックする運用にする。
 */
export class BootScene extends Phaser.Scene {
  /** 読み込みに失敗したキーの一覧 */
  private failedKeys = new Set<string>();

  constructor() {
    super("BootScene");
  }

  preload(): void {
    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      this.failedKeys.add(file.key);
      // eslint-disable-next-line no-console
      console.warn(
        `[BootScene] image load failed: ${file.key} (${file.url}); using placeholder`,
      );
    });

    for (const h of HEROES) {
      this.load.image(this.heroKey(h.id), h.imageUrl);
    }
    for (const e of ENEMIES) {
      this.load.image(this.enemyKey(e.id), e.imageUrl);
    }
  }

  create(): void {
    // プレースホルダ（読み込み失敗時の代替テクスチャ）
    if (!this.textures.exists(PLACEHOLDER_KEY)) {
      const g = this.add.graphics({ x: 0, y: 0 });
      g.fillStyle(0x6b7280, 1);
      g.fillRect(0, 0, 64, 64);
      g.lineStyle(2, 0xffffff, 1);
      g.strokeRect(1, 1, 62, 62);
      g.generateTexture(PLACEHOLDER_KEY, 64, 64);
      g.destroy();
    }

    // 失敗したキーを placeholder のエイリアスとして登録
    for (const key of this.failedKeys) {
      if (!this.textures.exists(key)) {
        const placeholder = this.textures.get(PLACEHOLDER_KEY);
        const src = placeholder.getSourceImage(0) as HTMLImageElement;
        this.textures.addImage(key, src);
      }
    }

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
