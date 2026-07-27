import { create } from "zustand";
import type { BreadcrumbItem, NavSource } from "@/types";

interface NavState {
  source: NavSource;
  customTrail: BreadcrumbItem[] | null;
  breadcrumbTrail: BreadcrumbItem[];
  setNavSource: (source: NavSource) => void;
  setCustomTrail: (trail: BreadcrumbItem[] | null) => void;
  setBreadcrumbTrail: (trail: BreadcrumbItem[]) => void;
  pushBreadcrumb: (item: BreadcrumbItem) => void;
  popBreadcrumb: (count?: number) => void;
  popBreadcrumbToLabel: (label: string) => void;
  resetTrail: () => void;
}

/**
 * Tracks navigation source and breadcrumb trail.
 * Each page pushes its breadcrumb entry when it loads.
 */
export const useNavStore = create<NavState>((set, get) => ({
  source: "default",
  customTrail: null,
  breadcrumbTrail: [],
  setNavSource: (source) => set({ source }),
  setCustomTrail: (trail) => set({ customTrail: trail }),
  setBreadcrumbTrail: (trail) => set({ breadcrumbTrail: trail }),
  pushBreadcrumb: (item) =>
    set((state) => ({
      breadcrumbTrail: [...state.breadcrumbTrail, item],
    })),
  popBreadcrumb: (count = 1) =>
    set((state) => ({
      breadcrumbTrail: state.breadcrumbTrail.slice(0, -count),
    })),
  popBreadcrumbToLabel: (label) =>
    set((state) => {
      const idx = state.breadcrumbTrail.findIndex((i) => i.label === label);
      if (idx >= 0) {
        return { breadcrumbTrail: state.breadcrumbTrail.slice(0, idx + 1) };
      }
      return state;
    }),
  resetTrail: () => set({ source: "default", customTrail: null, breadcrumbTrail: [] }),
}));
