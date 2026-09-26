import Phaser from "phaser";
import { assetUrl, getAsset, type AssetEntry } from "../data/assets";

/** ドット絵としてニアレストネイバーで拡大するテクスチャのキー接頭辞 */
const PIXEL_ART_PREFIXES = ["cryptid.", "chara.", "icon.", "hero.", "enemy."];

export function queueAsset(scene: Phaser.Scene, a: AssetEntry): void {
  if (a.type === "image") scene.load.image(a.key, assetUrl(a));
  else if (a.type === "spritesheet")
    scene.load.spritesheet(a.key, assetUrl(a), { frameWidth: a.frameWidth!, frameHeight: a.frameHeight! });
  else scene.load.audio(a.key, assetUrl(a));
}

export function applyPixelArtFilter(scene: Phaser.Scene, key: string): void {
  if (PIXEL_ART_PREFIXES.some((p) => key.startsWith(p)) && scene.textures.exists(key)) {
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}

/** preload: false のアセットを必要になった時点で読み込む（読み込み済みなら即 resolve） */
export function ensureImage(scene: Phaser.Scene, key: string): Promise<void> {
  if (scene.textures.exists(key)) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      applyPixelArtFilter(scene, key);
      resolve();
    };
    scene.load.once(`${Phaser.Loader.Events.FILE_COMPLETE}-image-${key}`, done);
    scene.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      if (file.key === key) resolve();
    });
    queueAsset(scene, getAsset(key));
    if (!scene.load.isLoading()) scene.load.start();
  });
}
