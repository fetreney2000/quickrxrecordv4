/**
 * Vercel Serverless Function: POST /api/login
 *
 * Mengesahkan nama pengguna + kata laluan terhadap jadual "profiles" di Supabase.
 * Mengembalikan profil pengguna + token sesi yang ditandatangani (HMAC).
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { createHmac } from "node:crypto";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

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

function signToken(payload: { userId: string; expiresAt: number }): string {
  const secret = getEnv("SESSION_SECRET");
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export async function OPTIONS(): Promise<Response> {
  return new Response("ok", { headers: corsHeaders() });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { nama_pengguna, kata_laluan } = await request.json();
    if (!nama_pengguna || !kata_laluan) {
      return json(400, { error: "Nama pengguna dan kata laluan diperlukan." });
    }

    const supabase = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("nama_pengguna", nama_pengguna)
      .eq("aktif", true)
      .maybeSingle();

    if (error || !profile) {
      return json(401, {
        error: "Nama pengguna atau kata laluan tidak sah.",
      });
    }

    const stored = profile.kata_laluan_hash as string | null;
    if (!stored) {
      return json(401, {
        error:
          "Akaun belum menetapkan kata laluan. Sila hubungi pentadbir.",
      });
    }

    const valid = await bcrypt.compare(kata_laluan, stored);
    if (!valid) {
      return json(401, {
        error: "Nama pengguna atau kata laluan tidak sah.",
      });
    }

    const { kata_laluan_hash: _, ...profileSafe } = profile;
    const token = signToken({
      userId: profileSafe.id as string,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });

    return json(200, { profile: profileSafe, token });
  } catch (err) {
    console.error("[api/login]", err);
    return json(500, { error: "Ralat pelayan dalaman." });
  }
}