import { create } from "zustand";
import type { BreadcrumbItem, NavSource } from "@/types";

interface NavState {
  source: NavSource;
  customTrail: BreadcrumbItem[] | null;
  setNavSource: (source: NavSource) => void;
  setCustomTrail: (trail: BreadcrumbItem[] | null) => void;
  resetTrail: () => void;
}

/**
 * Tracks where the user came from when navigating to a detail page.
 * Used by the Breadcrumb component to render "Kembali ke Senarai" vs
 * "Kembali ke Carian" links.
 */
export const useNavStore = create<NavState>((set) => ({
  source: "default",
  customTrail: null,
  setNavSource: (source) => set({ source }),
  setCustomTrail: (trail) => set({ customTrail: trail }),
  resetTrail: () => set({ source: "default", customTrail: null }),
}));
