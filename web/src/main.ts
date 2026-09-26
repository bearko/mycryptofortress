import "@fontsource/orbitron/700.css";
import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "./view/layout";
import { BootScene } from "./view/scenes/BootScene";
import { HomeScene } from "./view/scenes/HomeScene";
import { LevelSelectScene } from "./view/scenes/LevelSelectScene";
import { RunScene } from "./view/scenes/RunScene";
import { TreeScene } from "./view/scenes/TreeScene";
import { TitleScene } from "./view/scenes/TitleScene";
import { COLORS, FONT_DISPLAY } from "./view/ui/theme";

/**
 * テキストテクスチャがフォールバックフォントで焼かれないよう、同梱の Orbitron を先に読む（最大 2 秒待つ）。
 * 日本語はシステムの日本語フォント（FONT_JA）を使うので読み込み待ちは不要。
 */
async function loadFonts(): Promise<void> {
  if (!document.fonts) return;
  const loads = [`700 20px ${FONT_DISPLAY}`].map((f) => document.fonts.load(f, "WAVE 0123").catch(() => undefined));
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
    scene: [BootScene, TitleScene, HomeScene, LevelSelectScene, TreeScene, RunScene],
  });

  if (import.meta.env.DEV) {
    (window as unknown as { __FORTRESS_GAME__: Phaser.Game }).__FORTRESS_GAME__ = game;
  }
}

void start();
