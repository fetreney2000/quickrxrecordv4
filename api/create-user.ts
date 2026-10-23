/**
 * Vercel Serverless Function: POST /api/create-user
 *
 * Mencipta pengguna baharu: menyimpan profil ke table "profiles"
 * dengan kata laluan di-hash menggunakan bcrypt.
 *
 * Keselamatan: token sesi yang sah (termasuk pwv) DAN Pentadbir aktif.
 */
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import {
  adminClient,
  clientIp,
  corsHeadersFor,
  extractToken,
  isRateLimited,
  json,
  passwordPolicyError,
  pwvFingerprint,
  recordAttempt,
  verifyToken,
} from "./_lib/auth";

const VALID_ROLES = [
  "Pentadbir",
  "Penjaga Stor",
  "Kakitangan Farmasi",
  "Kakitangan Klinik",
] as const;

export async function OPTIONS(request: Request): Promise<Response> {
  return new Response("ok", { headers: corsHeadersFor(request) });
}

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  try {
    // 1. Pengesahan sesi
    const token = extractToken(request);
    if (!token) {
      return json(
        401,
        { error: "Sesi tidak sah. Sila log masuk semula." },
        { origin }
      );
    }
    const session = verifyToken(token);
    if (!session) {
      return json(
        401,
        { error: "Sesi telah tamat tempoh. Sila log masuk semula." },
        { origin }
      );
    }

    const { nama, nama_pengguna, kata_laluan, jawatan, peranan } =
      await request.json();

    if (!nama || !nama_pengguna || !kata_laluan) {
      return json(
        400,
        { error: "Nama, nama pengguna, dan kata laluan diperlukan." },
        { origin }
      );
    }
    const policyError = passwordPolicyError(kata_laluan);
    if (policyError) {
      return json(400, { error: policyError }, { origin });
    }
    if (peranan && !VALID_ROLES.includes(peranan)) {
      return json(400, { error: "Peranan tidak sah." }, { origin });
    }

    const supabase = adminClient();

    // Had laju: 10 ciptaan / jam per IP — laluan pentadbir sahaja, tetapi
    // elak penyalahgunaan token curi untuk lambakan akaun.
    const ipKey = `createuser:ip:${clientIp(request)}`;
    if (
      await isRateLimited(supabase, [{ key: ipKey, max: 10 }], 60 * 60)
    ) {
      return json(
        429,
        { error: "Terlalu banyak percubaan. Sila cuba lagi sebentar lagi." },
        { origin }
      );
    }
    await recordAttempt(supabase, ipKey);

    // 2. Pengesahan autorisasi: pemanggil mesti Pentadbir yang aktif + pwv sah
    const { data: caller } = await supabase
      .from("profiles")
      .select("id, peranan, aktif, kata_laluan_hash")
      .eq("id", session.userId)
      .maybeSingle();

    if (
      !caller ||
      caller.peranan !== "Pentadbir" ||
      caller.aktif !== true ||
      pwvFingerprint(caller.kata_laluan_hash as string | null) !==
        (session.pwv ?? null)
    ) {
      return json(
        401,
        { error: "Sesi tidak sah atau telah tamat tempoh." },
        { origin }
      );
    }

    // Semak jika nama_pengguna sudah wujud
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("nama_pengguna", nama_pengguna)
      .maybeSingle();

    if (existing) {
      return json(409, { error: "Nama pengguna sudah wujud." }, { origin });
    }

    // Hash kata laluan
    const kata_laluan_hash = await bcrypt.hash(kata_laluan, 12);

    // Cipta profil
    const { data: profile, error: insertError } = await supabase
      .from("profiles")
      .insert({
        id: crypto.randomUUID(),
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
      // Jangan bocorkan mesej dalaman Postgres kepada pelanggan.
      console.error("[api/create-user] insert error:", insertError);
      return json(500, { error: "Gagal mencipta pengguna." }, { origin });
    }

    return json(201, { profile }, { origin });
  } catch (err) {
    console.error("[api/create-user]", err);
    return json(500, { error: "Ralat pelayan dalaman." }, { origin });
  }
}
