import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { supabase, setSbAccessToken } from "./supabase";
import type { Profile } from "@/types";

interface AuthState {
  profile: Profile | null;
  token: string | null;
  sbToken: string | null;
  loading: boolean;
  initialized: boolean;
  setProfile: (p: Profile | null) => void;
  setToken: (t: string | null) => void;
  setSbToken: (t: string | null) => void;
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
      sbToken: null,
      loading: true,
      initialized: false,

      setProfile: (profile) => set({ profile }),
      setToken: (token) => set({ token }),
      setSbToken: (sbToken) => {
        setSbAccessToken(sbToken);
        set({ sbToken });
      },
      setLoading: (loading) => set({ loading }),

      signIn: async (nama_pengguna, kata_laluan) => {
        try {
          set({ loading: true });
          const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
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
          const sbToken = (data?.sbToken as string | undefined) ?? null;
          if (!profile) {
            set({ loading: false });
            return { error: "Profil pengguna tidak dijumpai." };
          }
          setSbAccessToken(sbToken);
          // Token hanya dalam memori — cookie httpOnly adalah pembawa sesi
          // utama. Profil sahaja dikekalkan ke localStorage (lihat partialize).
          set({
            profile,
            token: token ?? null,
            sbToken,
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
            credentials: "include",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }).catch(() => null);
          await supabase.auth.signOut().catch(() => null);
        } finally {
          setSbAccessToken(null);
          set({ profile: null, token: null, sbToken: null, loading: false, initialized: true });
        }
      },

      refreshProfile: async () => {
        const { profile, token } = get();
        if (!profile) return;
        try {
          // Cuba API session dahulu (lebih terkini) — cookie dihantar
          // automatik; header Authorization sebagai fallback.
          const res = await fetch("/api/session", {
            credentials: "include",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.profile) {
              if (data.sbToken) setSbAccessToken(data.sbToken as string);
              set({
                profile: data.profile as Profile,
                token: (data.token as string | undefined) ?? get().token,
                sbToken: (data.sbToken as string | undefined) ?? get().sbToken,
              });
              return;
            }
          }
          // Fallback ke Supabase langsung (lajur eksplisit — hash tidak boleh
          // dipilih klien selepas sekatan lajur 039)
          const { data, error } = await supabase
            .from("profiles")
            .select("id, nama, jawatan, nama_pengguna, peranan, aktif, created_at, updated_at, tema")
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
      // Pengerasan: hanya profil (bukan token/sbToken) dikekalkan.
      // Token hidup dalam memori + cookie httpOnly — XSS tidak boleh
      // mencuri sesi daripada localStorage lagi.
      partialize: (state) => ({
        profile: state.profile,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.token = null;
          state.sbToken = null;
          state.initialized = true;
        }
      },
    }
  )
);

/** Hydrate session from server via httpOnly cookie. */
export async function hydrateAuth() {
  const { token, setProfile, setToken, setSbToken, setLoading } =
    useAuthStore.getState();
  try {
    // Cookie httpOnly dihantar automatik (credentials:include); header
    // Authorization hanya fallback untuk token memori lama.
    const res = await fetch("/api/session", {
      method: "GET",
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.profile) {
        setProfile(data.profile as Profile);
      } else {
        // Sesi mati (token tamat) — bersihkan sepenuhnya supaya tiada
        // keadaan "log masuk separa" yang disekat RLS.
        setProfile(null);
        setToken(null);
        setSbToken(null);
      }
      if (data?.sbToken) {
        setSbToken(data.sbToken as string);
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
