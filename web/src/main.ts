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
 * SPEC-022: Phaser.GameObjects.Text の既定 resolution を上げる。
 * Phaser 3 は Text の内部テクスチャを fontSize 等倍 (resolution=1) で生成するため、
 * Retina 環境ではテキストが粒状に見える。`prototype.resolution` を上書きすると
 * 全 Text 生成時にこの値が適用される。
 */
const TEXT_RES = Math.min(3, Math.max(2, window.devicePixelRatio || 2));
(
  Phaser.GameObjects.Text.prototype as Phaser.GameObjects.Text & {
    resolution: number;
  }
).resolution = TEXT_RES;

/**
 * SPEC-016: canvas はビューポート全体を埋める方針に切り替え。
 * `Scale.RESIZE` を使い、各シーンは `scenes/layout.ts` の `getViewport` で
 * 縦/横を判定し、レイアウトを再構築する。
 *
 * SPEC-022: `pixelArt: true` をやめ、テキスト / UI は LINEAR フィルタで滑らかに、
 * ヒーロー / エネミー等のピクセルアート画像にだけ NEAREST フィルタを明示適用する
 * 方針に変更。`pixelArt: true` は antialias=false + roundPixels=true + 全テクスチャ
 * NEAREST を強制し、Retina 環境で日本語テキストが粒状になるのを引き起こしていた。
 */
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  backgroundColor: "#0b0d12",
  antialias: true,
  roundPixels: false,
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
