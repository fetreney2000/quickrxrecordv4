import { create } from "zustand";
import type { BreadcrumbItem, NavSource } from "@/types";

interface NavState {
  source: NavSource;
  customTrail: BreadcrumbItem[] | null;
  breadcrumbTrail: BreadcrumbItem[];
  setNavSource: (source: NavSource) => void;
  setCustomTrail: (trail: BreadcrumbItem[] | null) => void;
  setBreadcrumbTrail: (trail: BreadcrumbItem[]) => void;
  resetTrail: () => void;
}

export const HOME_CRUMB: BreadcrumbItem = { label: "Utama", href: "/" };

/**
 * Tracks the full breadcrumb trail based on user navigation path.
 * Pages call `setBreadcrumbTrail` with the complete path including HOME_CRUMB.
 */
export const useNavStore = create<NavState>((set) => ({
  source: "default",
  customTrail: null,
  breadcrumbTrail: [],
  setNavSource: (source) => set({ source }),
  setCustomTrail: (trail) => set({ customTrail: trail }),
  setBreadcrumbTrail: (trail) => set({ breadcrumbTrail: trail }),
  resetTrail: () => set({ source: "default", customTrail: null, breadcrumbTrail: [] }),
}));
