import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// `npm run build`       → app real (PWA instalable, usa Firebase)
// `npm run build:demo`  → demo sin Firebase ni service worker (datos de ejemplo)
export default defineConfig(({ mode }) => ({
  base: "./",
  define: { __DEMO_BUILD__: JSON.stringify(mode === "demo"), __LEGACY_BUILD__: JSON.stringify(mode === "legacy") },
  build: { outDir: mode === "legacy" ? "dist-legacy" : "dist" },
  plugins: [
    react(),
    mode !== "demo" &&
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["icon.svg"],
        manifest: {
          name: "FASE·3 Pro · Mantenimiento predictivo",
          short_name: "FASE·3 Pro",
          description: "Lecturas eléctricas, termografía, tendencias y diagnóstico con IA.",
          start_url: ".",
          scope: ".",
          display: "standalone",
          orientation: "portrait",
          background_color: "#16171A",
          theme_color: "#16171A",
          lang: "es",
          icons: [
            { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
          ]
        },
        workbox: { globPatterns: ["**/*.{js,css,html,png,svg,woff2}"] }
      })
  ].filter(Boolean)
}));
