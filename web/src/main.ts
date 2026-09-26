import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "./view/layout";
import { BootScene } from "./view/scenes/BootScene";
import { HomeScene } from "./view/scenes/HomeScene";
import { RunScene } from "./view/scenes/RunScene";
import { TitleScene } from "./view/scenes/TitleScene";
import { COLORS, FONT_DISPLAY, FONT_FAMILY } from "./view/ui/theme";

/** テキストテクスチャがフォールバックフォントで焼かれないよう、Web フォントを先に読む（最大 2 秒待つ） */
async function loadFonts(): Promise<void> {
  if (!document.fonts) return;
  const loads = [`700 20px ${FONT_FAMILY}`, `500 20px ${FONT_FAMILY}`, `700 20px ${FONT_DISPLAY}`].map((f) =>
    document.fonts.load(f).catch(() => undefined),
  );
  await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 2000))]);
}

async function start(): Promise<void> {
  await loadFonts();
  document.querySelector("#app .loader")?.remove();

  // SPEC-101 §5.3: 論理 720×1280（9:16）を端末に FIT。PC では左右が余白になる。
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "app",
    backgroundColor: COLORS.bg,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    antialias: true,
    disableContextMenu: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: { activePointers: 2 },
    scene: [BootScene, TitleScene, HomeScene, RunScene],
  });

  if (import.meta.env.DEV) {
    (window as unknown as { __FORTRESS_GAME__: Phaser.Game }).__FORTRESS_GAME__ = game;
  }
}

void start();
