import { defineConfig, type Plugin } from "vite";

/**
 * OGP の og:image / og:url は絶対 URL が必要。本番は Cloudflare Workers（fortress.bearko.games）。
 * 別の場所で公開するときは、ビルド時の環境変数 SITE_URL で上書きする。
 */
const SITE_URL = (process.env.SITE_URL || "https://fortress.bearko.games").replace(/\/+$/, "");

const siteUrl = (): Plugin => ({
  name: "site-url",
  transformIndexHtml: (html) => html.replaceAll("%SITE_URL%", SITE_URL),
});

export default defineConfig({
  base: "./",
  plugins: [siteUrl()],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    // Phaser 本体（約 1.2MB）は別チャンクに分けてキャッシュを効かせる
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: { manualChunks: { phaser: ["phaser"] } },
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.spec.ts"],
  },
});
