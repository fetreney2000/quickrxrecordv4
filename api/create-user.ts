/**
 * Vercel Serverless Function: POST /api/create-user
 *
 * Mencipta pengguna baharu: menyimpan profil ke table "profiles"
 * dengan kata laluan di-hash menggunakan bcrypt.
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

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
    const { nama, nama_pengguna, kata_laluan, jawatan, peranan } =
      await request.json();

    if (!nama || !nama_pengguna || !kata_laluan) {
      return json(400, { error: "Nama, nama pengguna, dan kata laluan diperlukan." });
    }

    const supabase = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    // Semak jika nama_pengguna sudah wujud
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("nama_pengguna", nama_pengguna)
      .maybeSingle();

    if (existing) {
      return json(409, { error: "Nama pengguna sudah wujud." });
    }

    // Hash kata laluan
    const kata_laluan_hash = await bcrypt.hash(kata_laluan, 12);

    // Cipta profil
    const { data: profile, error: insertError } = await supabase
      .from("profiles")
      .insert({
        nama,
        nama_pengguna,
        kata_laluan_hash,
        jawatan: jawatan || null,
        peranan: peranan || "Kakitangan Farmasi",
        aktif: true,
      })
      .select("id, nama, nama_pengguna, jawatan, peranan, aktif")
      .single();

    if (insertError) {
      console.error("[api/create-user] insert error:", insertError);
      return json(500, { error: `Gagal mencipta pengguna: ${insertError.message}` });
    }

    return json(201, { profile });
  } catch (err) {
    console.error("[api/create-user]", err);
    return json(500, { error: "Ralat pelayan dalaman." });
  }
}
