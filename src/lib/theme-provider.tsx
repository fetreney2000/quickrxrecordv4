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

function getFallbackTheme(storageKey = STORAGE_KEY): Theme {
  const stored = localStorage.getItem(storageKey) ?? localStorage.getItem(STORAGE_KEY);
  if (isTheme(stored)) return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const profile = useAuthStore((state) => state.profile);
  const [theme, setTheme] = useState<Theme>(() => getFallbackTheme());

  useEffect(() => {
    let cancelled = false;
    const userStorageKey = profile?.id ? `${STORAGE_KEY}:${profile.id}` : STORAGE_KEY;
    setTheme(isTheme(profile?.tema) ? profile.tema : getFallbackTheme(userStorageKey));

    if (!profile?.id) return () => { cancelled = true; };

    void supabase
      .from("profiles")
      .select("tema")
      .eq("id", profile.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && isTheme(data?.tema)) setTheme(data.tema);
      });

    return () => { cancelled = true; };
  }, [profile?.id]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem(STORAGE_KEY, theme);
    if (profile?.id) localStorage.setItem(`${STORAGE_KEY}:${profile.id}`, theme);
  }, [profile?.id, theme]);

  const toggle = () => {
    setTheme((current) => {
      const next = current === "light" ? "dark" : "light";
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
