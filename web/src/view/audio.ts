import type Phaser from "phaser";
import { session } from "./session";

/** 設定 ON 時の既定音量 */
export const DEFAULT_BGM_VOLUME = 0.6;
export const DEFAULT_SE_VOLUME = 0.8;

let currentBgm: { key: string; sound: Phaser.Sound.BaseSound } | null = null;

export function playSe(scene: Phaser.Scene, key: string): void {
  const volume = session.data.settings.seVolume;
  if (volume <= 0 || !scene.cache.audio.exists(key)) return;
  scene.sound.play(key, { volume });
}

/** BGM を再生（同じ曲なら音量だけ反映）。音量 0 なら停止する */
export function playBgm(scene: Phaser.Scene, key: string): void {
  const volume = session.data.settings.bgmVolume;
  if (currentBgm && currentBgm.key !== key) {
    currentBgm.sound.destroy();
    currentBgm = null;
  }
  if (volume <= 0) {
    currentBgm?.sound.stop();
    return;
  }
  if (!currentBgm) {
    if (!scene.cache.audio.exists(key)) return;
    currentBgm = { key, sound: scene.sound.add(key, { loop: true, volume }) };
  }
  const s = currentBgm.sound as Phaser.Sound.WebAudioSound;
  s.setVolume?.(volume);
  if (!s.isPlaying) s.play();
}
