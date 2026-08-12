import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { ThemeProvider } from "@/lib/theme-provider";
import "./index.css";

// Register the service worker. With registerType: "autoUpdate" in vite.config.ts,
// when a new version is deployed the page automatically reloads onto it so users
// always see the latest build. We also poll periodically so users who keep the
// app open for a long time still get bumped to the newest version.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // New version available - apply it, which triggers the auto-reload.
    updateSW(true);
  },
  onOfflineReady() {
    // App is cached and ready to work offline. No action required by default.
  },
});

// Re-check for a newer version every 30 minutes.
setInterval(() => updateSW(), 30 * 60 * 1000);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
