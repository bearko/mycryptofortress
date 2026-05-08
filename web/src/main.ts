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
 * SPEC-022 / SPEC-023: Phaser Text を高解像度で描く。
 *
 * Phaser 3 の `Text` は内部テクスチャを生成する際 `text.style.resolution`
 * を参照する（`text.resolution` ではない）。プロトタイプ書き換えだけでは
 * `style.resolution = 1` のデフォルトが効いてしまうので、`scene.add.text(...)`
 * を呼ぶたびに `setResolution(value)` を呼んでスタイル側の値を上書きする。
 *
 * これにより Retina 環境で日本語フォントが粒状感なく描画される。
 */
const TEXT_RES = Math.min(3, Math.max(2, window.devicePixelRatio || 2));
{
  const factoryProto = Phaser.GameObjects.GameObjectFactory.prototype as {
    text: (
      x: number,
      y: number,
      text: string | string[],
      style?: Phaser.Types.GameObjects.Text.TextStyle,
    ) => Phaser.GameObjects.Text;
  };
  const original = factoryProto.text;
  factoryProto.text = function (
    this: Phaser.GameObjects.GameObjectFactory,
    x: number,
    y: number,
    text: string | string[],
    style?: Phaser.Types.GameObjects.Text.TextStyle,
  ): Phaser.GameObjects.Text {
    const t = original.call(this, x, y, text, style);
    t.setResolution(TEXT_RES);
    return t;
  };
}

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
