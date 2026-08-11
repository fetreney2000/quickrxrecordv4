import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/auth-store";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggle: () => {},
});

const STORAGE_KEY = "qrx-theme";

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

function readStoredTheme(): Theme | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return isTheme(raw) ? raw : null;
}

function applyTheme(theme: Theme, userId?: string) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem(STORAGE_KEY, theme);
  if (userId) localStorage.setItem(`${STORAGE_KEY}:${userId}`, theme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const profile = useAuthStore((state) => state.profile);
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = readStoredTheme();
    if (stored) return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  // Apply theme to DOM and localStorage immediately on change.
  useEffect(() => {
    applyTheme(theme, profile?.id);
  }, [theme, profile?.id]);

  // Sync from Supabase only on first login for a user; localStorage takes precedence afterwards.
  useEffect(() => {
    const userId = profile?.id;
    if (!userId) return;

    const stored = localStorage.getItem(`${STORAGE_KEY}:${userId}`);
    if (isTheme(stored)) {
      // Respect the user's explicit local preference.
      setTheme(stored);
      return;
    }

    let cancelled = false;
    void supabase
      .from("profiles")
      .select("tema")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && isTheme(data?.tema)) {
          setTheme(data.tema);
          applyTheme(data.tema, userId);
        }
      });

    return () => { cancelled = true; };
  }, [profile?.id]);

  const toggle = () => {
    setTheme((current) => {
      const next = current === "light" ? "dark" : "light";
      applyTheme(next, profile?.id);
      if (profile?.id) {
        void supabase.from("profiles").update({ tema: next }).eq("id", profile.id);
      }
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
