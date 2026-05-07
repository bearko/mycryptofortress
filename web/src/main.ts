import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { StageScene, STAGE_DIMENSIONS } from "./scenes/StageScene";

const appEl = document.getElementById("app");
const loaderEl = appEl?.querySelector(".loader");
loaderEl?.remove();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: STAGE_DIMENSIONS.width,
  height: STAGE_DIMENSIONS.height,
  backgroundColor: "#0b0d12",
  pixelArt: true,
  roundPixels: true,
  // 右クリックでブラウザのコンテキストメニューが出ないように
  disableContextMenu: true,
  scene: [BootScene, StageScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});

// 開発時のデバッグ用に window へ exposed する（dev/preview 限定）。
if (import.meta.env.DEV) {
  (window as unknown as { __FORTRESS_GAME__: Phaser.Game }).__FORTRESS_GAME__ =
    game;
}
