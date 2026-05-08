import type Phaser from "phaser";

/**
 * 失敗を握り潰しつつ UI 系 SE を再生する小さなヘルパー。
 * BootScene 経由で読み込まれた `key` がキャッシュに無い場合は黙って何もしない。
 */
export function playSe(scene: Phaser.Scene, key: string, volume = 0.6): void {
  if (!scene.cache.audio.exists(key)) return;
  try {
    scene.sound.play(key, { volume });
  } catch (_) {
    // 音声再生失敗は無視
  }
}
