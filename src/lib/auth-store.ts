import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { supabase } from "./supabase";
import type { Profile } from "@/types";

interface AuthState {
  profile: Profile | null;
  token: string | null;
  loading: boolean;
  initialized: boolean;
  setProfile: (p: Profile | null) => void;
  setToken: (t: string | null) => void;
  setLoading: (loading: boolean) => void;
  signIn: (
    nama_pengguna: string,
    kata_laluan: string
  ) => Promise<{ error: string | null; profile?: Profile }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const SESSION_KEY = "quickrx_session";

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      profile: null,
      token: null,
      loading: true,
      initialized: false,

      setProfile: (profile) => set({ profile }),
      setToken: (token) => set({ token }),
      setLoading: (loading) => set({ loading }),

      signIn: async (nama_pengguna, kata_laluan) => {
        try {
          set({ loading: true });
          const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nama_pengguna, kata_laluan }),
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            const msg = data?.error || "Nama pengguna atau kata laluan tidak sah.";
            set({ loading: false });
            return { error: msg };
          }

          const data = await res.json();
          const profile = data?.profile as Profile;
          const token = data?.token as string | undefined;
          if (!profile) {
            set({ loading: false });
            return { error: "Profil pengguna tidak dijumpai." };
          }
          set({
            profile,
            token: token ?? null,
            loading: false,
            initialized: true,
          });
          return { error: null, profile };
        } catch (err: any) {
          set({ loading: false });
          return {
            error:
              err?.message ||
              "Tidak dapat menghubungi pelayan. Sila cuba sebentar lagi.",
          };
        }
      },

      signOut: async () => {
        const { token } = get();
        try {
          await fetch("/api/session", {
            method: "DELETE",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }).catch(() => null);
          await supabase.auth.signOut().catch(() => null);
        } finally {
          set({ profile: null, token: null, loading: false, initialized: true });
        }
      },

      refreshProfile: async () => {
        const { profile, token } = get();
        if (!profile) return;
        try {
          // Cuba API session dahulu (lebih terkini)
          if (token) {
            const res = await fetch("/api/session", {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const data = await res.json();
              if (data?.profile) {
                set({ profile: data.profile as Profile });
                return;
              }
            }
          }
          // Fallback ke Supabase langsung
          const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", profile.id)
            .single();
          if (error) throw error;
          if (data) set({ profile: data as Profile });
        } catch {
          // Silent — keep existing profile if refresh fails.
        }
      },
    }),
    {
      name: SESSION_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ profile: state.profile, token: state.token }),
      onRehydrateStorage: () => (state) => {
        if (state) state.initialized = true;
      },
    }
  )
);

/** Hydrate session from server if localStorage is empty. */
export async function hydrateAuth() {
  const { profile, token, setProfile, setToken, setLoading } =
    useAuthStore.getState();
  if (profile) {
    setLoading(false);
    useAuthStore.setState({ initialized: true });
    return;
  }
  try {
    const res = await fetch("/api/session", {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.profile) {
        setProfile(data.profile as Profile);
      }
      if (data?.token) {
        setToken(data.token as string);
      }
    }
  } catch {
    // No-op
  } finally {
    setLoading(false);
    useAuthStore.setState({ initialized: true });
  }
}
