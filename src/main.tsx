import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { toast } from "sonner";
import App from "./App";
import { ThemeProvider } from "@/lib/theme-provider";
import "./index.css";

// How long to wait before auto-reloading onto the new version.
const UPDATE_RELOAD_DELAY = 4000;
// How often to actively re-check for a deployed update.
const UPDATE_POLL_INTERVAL = 30 * 60 * 1000;

// Register the service worker. With registerType: "autoUpdate" in vite.config.ts,
// when a new version is deployed the page reloads onto it so users always see the
// latest build. We show a friendly toast first (instead of an instant reload) and
// only auto-reload when the user won't be disrupted (tab visible, not in a form).
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // New version available - notify the user, then apply after a short delay.
    notifyUpdate(() => updateSW(true));
  },
  onOfflineReady() {
    // App is cached and ready to work offline. No action required by default.
  },
});

// Re-check for a newer version every 30 minutes.
setInterval(() => updateSW(), UPDATE_POLL_INTERVAL);

/**
 * Show a non-blocking toast for a new version and auto-reload onto it after a
 * short delay, unless the tab is hidden or the user is typing in a form field.
 * In those cases the pending update still applies on the next page load, so no
 * update is ever lost - the user just reloads at their own pace.
 */
function notifyUpdate(apply: () => void) {
  if (import.meta.env.DEV) {
    console.log("[update] New version available");
  }

  const isBusy = () => {
    if (document.hidden) return true;
    const el = document.activeElement;
    return (
      !!el &&
      (el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT")
    );
  };

  const applyUpdate = () => {
    toast.dismiss(updateToastId);
    apply();
  };

  const updateToastId = toast.info("Versi baharu tersedia", {
    description: "Menyegarkan secara automatik...",
    duration: UPDATE_RELOAD_DELAY,
    action: {
      label: "Muat semula sekarang",
      onClick: applyUpdate,
    },
  });

  setTimeout(() => {
    if (isBusy()) return; // defer; applies on next page load / next poll
    applyUpdate();
  }, UPDATE_RELOAD_DELAY);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
