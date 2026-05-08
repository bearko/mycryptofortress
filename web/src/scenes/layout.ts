import type Phaser from "phaser";

/**
 * SPEC-016: レスポンシブレイアウトのヘルパー。
 *
 * Phaser 側は `Scale.RESIZE` モードで動作し、canvas はビューポート全体を埋める。
 * 各シーンは `getViewport(this)` で現在の幅/高さ/向きを取得し、`onResize` で
 * 変化に追従する。
 */
export type LayoutMode = "landscape" | "portrait";

export interface ViewportLayout {
  mode: LayoutMode;
  width: number;
  height: number;
  isPortrait: boolean;
  isLandscape: boolean;
}

export function getViewport(scene: Phaser.Scene): ViewportLayout {
  const w = Math.max(1, Math.round(scene.scale.width));
  const h = Math.max(1, Math.round(scene.scale.height));
  const isPortrait = h > w;
  return {
    mode: isPortrait ? "portrait" : "landscape",
    width: w,
    height: h,
    isPortrait,
    isLandscape: !isPortrait,
  };
}

/**
 * シーンの resize 監視を 1 行で登録するヘルパー。
 * `shutdown` / `destroy` のタイミングで自動で off する。
 */
export function onResize(scene: Phaser.Scene, fn: () => void): void {
  const handler = () => fn();
  scene.scale.on("resize", handler);
  const cleanup = (): void => {
    scene.scale.off("resize", handler);
  };
  scene.events.once("shutdown", cleanup);
  scene.events.once("destroy", cleanup);
}
