import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
// Muat SEMUA var .env (bukan hanya VITE_*) ke process.env untuk api-mock
// (SESSION_SECRET, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET).
import "dotenv/config";
import { apiMockPlugin } from "./vite/api-mock";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // API mock untuk pembangunan tempatan sahaja (/api/login, /api/session, dll.)
    // Tidak dimuatkan dalam binaan produksi (Vercel menggunakan serverless functions)
    ...(process.env.NODE_ENV === "production" ? [] : [apiMockPlugin()]),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "robots.txt", "apple-touch-icon.png"],
      manifest: {
        name: "QuickRxRecord v4",
        short_name: "QuickRx",
        description:
          "Sistem pengurusan inventori dan pesakit untuk klinik/farmasi - Versi 4.0",
        theme_color: "#18181b",
        background_color: "#f0f2f5",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        navigateFallback: "index.html",
        // Jangan sesekali cache/serving fallback untuk API — respons API
        // (termasuk /api/session) mesti sentiasa segar dari rangkaian.
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
