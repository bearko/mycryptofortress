import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { StageScene } from "./scenes/StageScene";
import { WorldSelectScene } from "./scenes/WorldSelectScene";
import { StageSelectScene } from "./scenes/StageSelectScene";
import { PartyFormationScene } from "./scenes/PartyFormationScene";

const appEl = document.getElementById("app");
const loaderEl = appEl?.querySelector(".loader");
loaderEl?.remove();

/**
 * SPEC-016: canvas はビューポート全体を埋める方針に切り替え。
 * `Scale.RESIZE` を使い、各シーンは `scenes/layout.ts` の `getViewport` で
 * 縦/横を判定し、レイアウトを再構築する。
 */
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  backgroundColor: "#0b0d12",
  pixelArt: true,
  roundPixels: true,
  // 右クリックでブラウザのコンテキストメニューが出ないように
  disableContextMenu: true,
  scene: [
    BootScene,
    WorldSelectScene,
    StageSelectScene,
    PartyFormationScene,
    StageScene,
  ],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
    width: window.innerWidth,
    height: window.innerHeight,
  },
});

// 開発時のデバッグ用に window へ exposed する（dev/preview 限定）。
if (import.meta.env.DEV) {
  (window as unknown as { __FORTRESS_GAME__: Phaser.Game }).__FORTRESS_GAME__ =
    game;
}
