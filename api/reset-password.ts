/**
 * Vercel Serverless Function: POST /api/reset-password
 *
 * Set semula kata laluan pengguna (dipanggil oleh ManagementPage:
 * - tetapan semula terus oleh pentadbir
 * - kelulusan permintaan reset)
 *
 * Keselamatan: token sesi sah (termasuk pwv) DAN Pentadbir aktif.
 * Body: { userId: string, newPassword?: string }
 * Tanpa newPassword, kata laluan sementara rawak dijana (tiada lagi lalai
 * umum — audit). Dasar kata laluan manual: 8–128 aksara, huruf + nombor.
 */
import bcrypt from "bcryptjs";
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
} from "./_lib/auth.js";

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

    const { userId, newPassword } = await request.json();
    if (!userId || typeof userId !== "string") {
      return json(400, { error: "userId diperlukan." }, { origin });
    }
    if (newPassword) {
      const policyError = passwordPolicyError(String(newPassword));
      if (policyError) {
        return json(400, { error: policyError }, { origin });
      }
    }

    const supabase = adminClient();

    // Had laju: 20 reset / jam per IP — elak lambakan reset dengan token curi.
    const ipKey = `resetpw:ip:${clientIp(request)}`;
    if (await isRateLimited(supabase, [{ key: ipKey, max: 20 }], 60 * 60)) {
      return json(
        429,
        { error: "Terlalu banyak percubaan. Sila cuba lagi sebentar lagi." },
        { origin }
      );
    }
    await recordAttempt(supabase, ipKey);

    // 2. Pengesahan autorisasi: pemanggil mesti Pentadbir aktif + pwv sah
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

    // 3. Semak sasaran wujud
    const { data: target } = await supabase
      .from("profiles")
      .select("id, nama, nama_pengguna")
      .eq("id", userId)
      .maybeSingle();

    if (!target) {
      return json(404, { error: "Pengguna tidak dijumpai." }, { origin });
    }

    // 4. Hash + kemas kini (pwv berubah → semua sesi sasaran dibatalkan)
    // Kata laluan rawak 12 aksara jika tidak dibekalkan — elak rahsia
    // umum "password123" (audit). UI memaparkan nilai yang dijana ini.
    const { randomBytes } = await import("node:crypto");
    const password = newPassword
      ? String(newPassword)
      : randomBytes(9).toString("base64url").slice(0, 12);
    const kata_laluan_hash = await bcrypt.hash(password, 12);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        kata_laluan_hash,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      console.error("[api/reset-password] update error:", updateError);
      return json(
        500,
        { error: "Gagal set semula kata laluan." },
        { origin }
      );
    }

    // Jejak audit (060, service_role — tidak boleh dipintas klien).
    // Kegagalan log tidak menggagalkan reset (catat sahaja). Kata laluan
    // TIDAK direkodkan — hanya fakta bahawa reset berlaku.
    try {
      await supabase.from("admin_audit_log").insert({
        actor_id: session.userId,
        action: "reset_kata_laluan",
        target_user_id: userId,
        details: {
          nama_pengguna: (target as { nama_pengguna?: string }).nama_pengguna ?? null,
        },
      });
    } catch (auditErr) {
      console.error("[api/reset-password] audit log gagal:", auditErr);
    }

    return json(
      200,
      { profile: target, tempPassword: newPassword ? undefined : password },
      { origin }
    );
  } catch (err) {
    console.error("[api/reset-password]", err);
    return json(500, { error: "Ralat pelayan dalaman." }, { origin });
  }
}
