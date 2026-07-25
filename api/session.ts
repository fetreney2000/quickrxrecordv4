/**
 * Vercel Serverless Function: GET /api/session, DELETE /api/session
 *
 * GET  — pulangkan profil pengguna untuk token sesi yang sah
 * DELETE — hapus token sesi (log keluar)
 */
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";

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
    "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

function verifyToken(token: string): { userId: string; expiresAt: number } | null {
  try {
    const secret = getEnv("SESSION_SECRET");
    const [dataBase64, sig] = token.split(".");
    if (!dataBase64 || !sig) return null;

    const expectedSig = createHmac("sha256", secret)
      .update(dataBase64)
      .digest("base64url");
    if (!crypto.subtle || expectedSig !== sig) {
      // Constant-time-ish compare for old Node
      if (expectedSig.length !== sig.length) return null;
      let ok = 0;
      for (let i = 0; i < expectedSig.length; i++) {
        ok |= expectedSig.charCodeAt(i) ^ sig.charCodeAt(i);
      }
      if (ok !== 0) return null;
    }

    const payload = JSON.parse(
      Buffer.from(dataBase64, "base64url").toString("utf-8")
    );

    if (Date.now() > payload.expiresAt) return null;
    return payload;
  } catch {
    return null;
  }
}

function extractToken(request: Request): string | null {
  const auth = request.headers.get("Authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export async function OPTIONS(): Promise<Response> {
  return new Response("ok", { headers: corsHeaders() });
}

export async function GET(request: Request): Promise<Response> {
  try {
    const token = extractToken(request);
    if (!token) {
      return json(200, { profile: null });
    }

    const session = verifyToken(token);
    if (!session) {
      return json(200, { profile: null });
    }

    const supabase = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.userId)
      .maybeSingle();

    if (!profile) {
      return json(200, { profile: null });
    }

    const { kata_laluan_hash: _, ...profileSafe } = profile;
    return json(200, { profile: profileSafe });
  } catch (err) {
    console.error("[api/session]", err);
    return json(500, { error: "Ralat pelayan dalaman." });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  // Token-based sessions are stateless, so nothing to delete server-side.
  // The client simply discards the token.
  return json(200, { success: true });
}