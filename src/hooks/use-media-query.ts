import { useEffect, useState } from "react";

/**
 * Reactive media query hook.
 * Returns true if the media query matches, false otherwise.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** True if the viewport is mobile (≤768px). */
export function useIsMobile() {
  return useMediaQuery("(max-width: 768px)");
}

/** True if the viewport is desktop (≥769px). */
export function useIsDesktop() {
  return useMediaQuery("(min-width: 769px)");
}

/** True if the viewport is small (≤480px). */
export function useIsSmallPhone() {
  return useMediaQuery("(max-width: 480px)");
}

/** True if the viewport is tablet (≤768px but >480px). */
export function useIsTablet() {
  return useMediaQuery("(max-width: 768px) and (min-width: 481px)");
}
