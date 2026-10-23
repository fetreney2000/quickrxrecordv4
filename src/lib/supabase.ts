import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // We don't want to throw on import for build-time safety,
  // but the app will fail to make requests.
  // eslint-disable-next-line no-console
  console.warn(
    "Supabase environment variables are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file."
  );
}

/**
 * JWT authenticated (ditandatangani oleh /api/login dengan SUPABASE_JWT_SECRET).
 * Bila diset, semua permintaan Supabase membawa Authorization ini supaya
 * PostgREST menetapkan peranan "authenticated" (diperlukan selepas RLS diaktifkan).
 */
let sbAccessToken: string | null = null;

export function setSbAccessToken(token: string | null): void {
  sbAccessToken = token;
}

const customFetch: typeof fetch = async (input, init) => {
  if (sbAccessToken) {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${sbAccessToken}`);
    init = { ...init, headers };
  }
  return fetch(input, init);
};

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    global: {
      fetch: customFetch,
    },
  }
);
