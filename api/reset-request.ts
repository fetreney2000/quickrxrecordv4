/**
 * Vercel Serverless Function: POST /api/reset-request
 *
 * Menerima permintaan reset kata laluan dari halaman Lupa Kata Laluan.
 */
import { createClient } from "@supabase/supabase-js";

function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing environment variable: ${key}`);
  return val;
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

export async function OPTIONS(): Promise<Response> {
  return new Response("ok", { headers: corsHeaders() });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { userId } = await request.json();
    if (!userId) {
      return json(400, { error: "userId diperlukan." });
    }

    const supabase = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    // Semak permintaan sedia ada (pending)
    const { data: existing } = await supabase
      .from("password_reset_requests")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .maybeSingle();

    if (existing) {
      return json(409, {
        error: "Permintaan reset sudah wujud.",
        duplicate: true,
      });
    }

    // Cipta permintaan baru
    const { error: insertError } = await supabase
      .from("password_reset_requests")
      .insert({
        user_id: userId,
        status: "pending",
        notes: "Permintaan melalui halaman Lupa Kata Laluan",
      });

    if (insertError) {
      return json(500, { error: "Gagal mencipta permintaan." });
    }

    return json(200, { success: true });
  } catch (err) {
    console.error("[api/reset-request]", err);
    return json(500, { error: "Ralat pelayan dalaman." });
  }
}