// ============================================================================
// Supabase Edge Function: login
// Path: supabase/functions/login/index.ts
// Digunakan untuk: POST /functions/v1/login
//
// Cara deploy:
//   supabase functions deploy login --no-verify-jwt
// ============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://esm.sh/bcryptjs@2";

// In-memory session store (production should use KV or DB)
const sessions = new Map<string, { userId: string; expiresAt: number }>();

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }

  try {
    const { nama_pengguna, kata_laluan } = await req.json();
    if (!nama_pengguna || !kata_laluan) {
      return new Response(
        JSON.stringify({ error: "Nama pengguna dan kata laluan diperlukan." }),
        { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("nama_pengguna", nama_pengguna)
      .eq("aktif", true)
      .maybeSingle();

    if (error || !profile) {
      return new Response(
        JSON.stringify({ error: "Nama pengguna atau kata laluan tidak sah." }),
        { status: 401, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    const stored = profile.kata_laluan_hash as string | null;
    if (!stored) {
      return new Response(
        JSON.stringify({
          error: "Akaun belum menetapkan kata laluan. Sila hubungi pentadbir.",
        }),
        { status: 401, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    const valid = await bcrypt.compare(kata_laluan, stored);
    if (!valid) {
      return new Response(
        JSON.stringify({ error: "Nama pengguna atau kata laluan tidak sah." }),
        { status: 401, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    // Buang hash dari respons
    const { kata_laluan_hash, ...profileSafe } = profile;

    // Cipta token sesi
    const token = crypto.randomUUID();
    sessions.set(token, {
      userId: profileSafe.id,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });

    return new Response(
      JSON.stringify({ profile: profileSafe, token }),
      { status: 200, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Ralat pelayan dalaman." }),
      { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }
});
