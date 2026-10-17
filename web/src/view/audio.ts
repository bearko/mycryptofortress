import type Phaser from "phaser";
import { session } from "./session";

// 音量はセーブの settings.bgmVolume / seVolume（0..1、既定 0.6 / 0.8 は meta/save.ts）。
// SPEC-127: 5% 刻みの上げ下げと表示は view/ui/volume.ts

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
