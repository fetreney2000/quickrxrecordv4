/**
 * Vercel Serverless Function: POST /api/change-password
 *
 * Menukar kata laluan pengguna. Menerima kata laluan semasa (untuk pengesahan)
 * dan kata laluan baharu. Mengesahkan hash terhadap stored hash sebelum
 * mengemas kini. Selepas kemas kini, pwv berubah → semua sesi sedia ada
 * tidak sah; pelanggan perlu log masuk semula.
 */
import bcrypt from "bcryptjs";
import {
  adminClient,
  clearAttempts,
  clientIp,
  corsHeadersFor,
  extractToken,
  isRateLimited,
  json,
  passwordPolicyError,
  recordAttempt,
  verifyPassword,
  verifyToken,
} from "./_lib/auth";

export async function OPTIONS(request: Request): Promise<Response> {
  return new Response("ok", { headers: corsHeadersFor(request) });
}

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  try {
    // Authenticate via session token
    const payload = verifyToken(extractToken(request) ?? "");
    if (!payload) {
      return json(
        401,
        { error: "Sesi tidak sah. Sila log masuk semula." },
        { origin }
      );
    }

    const { current_password, new_password } = await request.json();
    if (!current_password || !new_password) {
      return json(
        400,
        { error: "Kata laluan semasa dan kata laluan baharu diperlukan." },
        { origin }
      );
    }
    const policyError = passwordPolicyError(new_password);
    if (policyError) {
      return json(400, { error: policyError }, { origin });
    }
    if (
      typeof current_password === "string" &&
      current_password.length > 128
    ) {
      return json(
        401,
        { error: "Kata laluan semasa tidak betul." },
        { origin }
      );
    }
    if (current_password === new_password) {
      return json(
        400,
        { error: "Kata laluan baharu mesti berbeza daripada kata laluan semasa." },
        { origin }
      );
    }

    const supabase = adminClient();

    // Had laju: 5 percubaan / 15 minit per pengguna + 20 / 15 minit per IP —
    // elak tekaan kata laluan semasa tanpa had.
    const userKey = `changepw:user:${payload.userId}`;
    const ipKey = `changepw:ip:${clientIp(request)}`;
    if (
      await isRateLimited(
        supabase,
        [
          { key: userKey, max: 5 },
          { key: ipKey, max: 20 },
        ],
        15 * 60
      )
    ) {
      return json(
        429,
        { error: "Terlalu banyak percubaan. Sila cuba lagi sebentar lagi." },
        { origin }
      );
    }

    // Fetch the current user profile (mesti aktif)
    const { data: profile, error: fetchError } = await supabase
      .from("profiles")
      .select("id, kata_laluan_hash")
      .eq("id", payload.userId)
      .eq("aktif", true)
      .single();

    if (fetchError || !profile) {
      return json(
        404,
        { error: "Profil pengguna tidak dijumpai." },
        { origin }
      );
    }

    const stored = profile.kata_laluan_hash as string | null;
    if (!stored) {
      return json(
        400,
        { error: "Akaun belum menetapkan kata laluan." },
        { origin }
      );
    }

    // Verify current password (bcrypt/PBKDF2 sahaja — plaintext ditolak)
    const valid = await verifyPassword(current_password, stored);
    if (!valid) {
      await recordAttempt(supabase, userKey);
      await recordAttempt(supabase, ipKey);
      return json(
        401,
        { error: "Kata laluan semasa tidak betul." },
        { origin }
      );
    }
    await clearAttempts(supabase, userKey);

    // Hash the new password with bcrypt
    const newHash = await bcrypt.hash(new_password, 12);

    // Update the password hash (service_role — satu-satunya laluan tulis hash)
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ kata_laluan_hash: newHash })
      .eq("id", payload.userId);

    if (updateError) {
      console.error("[api/change-password] update error:", updateError);
      return json(
        500,
        { error: "Gagal mengemas kini kata laluan." },
        { origin }
      );
    }

    return json(
      200,
      { message: "Kata laluan berjaya dikemaskini." },
      { origin }
    );
  } catch (err) {
    console.error("[api/change-password]", err);
    return json(500, { error: "Ralat pelayan dalaman." }, { origin });
  }
}
