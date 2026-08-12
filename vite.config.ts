import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
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
