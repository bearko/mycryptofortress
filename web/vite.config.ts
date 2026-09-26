import { defineConfig, type Plugin } from "vite";

/**
 * OGP の og:image / og:url は絶対 URL が必要。Vercel のビルドでは本番ドメイン
 * （VERCEL_PROJECT_PRODUCTION_URL）を使い、それ以外は既定の本番 URL にする。
 */
const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "https://mycryptofortress.vercel.app";

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
