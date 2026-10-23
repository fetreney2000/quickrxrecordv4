/**
 * Vercel Serverless Function: POST /api/reset-request
 *
 * Menerima permintaan reset kata laluan dari halaman Lupa Kata Laluan.
 * Had laju: 5 permintaan / jam per IP (audit H2).
 */
import {
  adminClient,
  clientIp,
  corsHeadersFor,
  isRateLimited,
  json,
  recordAttempt,
} from "./_lib/auth";

export async function OPTIONS(request: Request): Promise<Response> {
  return new Response("ok", { headers: corsHeadersFor(request) });
}

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  try {
    const { userId, nama_pengguna } = await request.json();
    if (!userId && !nama_pengguna) {
      return json(
        400,
        { error: "userId atau nama_pengguna diperlukan." },
        { origin }
      );
    }

    const supabase = adminClient();

    // Had laju — elak spam permintaan reset (IP + sasaran).
    const ipKey = `reset:ip:${clientIp(request)}`;
    const targetKey =
      `reset:user:${String(userId ?? nama_pengguna ?? "unknown")
        .toLowerCase()
        .slice(0, 64)}`;
    if (
      await isRateLimited(
        supabase,
        [
          { key: ipKey, max: 5 },
          { key: targetKey, max: 5 },
        ],
        60 * 60
      )
    ) {
      // Kekalkan respons seragam walaupun dihadkan — elak oracle masa.
      return json(200, { success: true }, { origin });
    }

    // Selesaikan userId daripada nama_pengguna di pelayan — pelanggan tidak
    // lagi perlu membaca profiles secara terus (anon dikekang RLS).
    let resolvedUserId = userId as string | undefined;
    if (!resolvedUserId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("nama_pengguna", String(nama_pengguna).trim())
        .maybeSingle();

      // Respons seragam untuk pengguna wujud / tidak wujud / pendua —
      // elak pengecaman nama pengguna melalui API langsung.
      if (!profile) {
        await recordAttempt(supabase, ipKey);
        await recordAttempt(supabase, targetKey);
        return json(200, { success: true }, { origin });
      }
      resolvedUserId = profile.id;
    }

    // Semak permintaan sedia ada (pending)
    const { data: existing } = await supabase
      .from("password_reset_requests")
      .select("id")
      .eq("user_id", resolvedUserId)
      .eq("status", "pending")
      .maybeSingle();

    if (!existing) {
      // Cipta permintaan baru (best-effort — kegagalan tetap balas seragam)
      await supabase.from("password_reset_requests").insert({
        user_id: resolvedUserId,
        status: "pending",
        notes: "Permintaan melalui halaman Lupa Kata Laluan",
      });
    }

    // Rekod permintaan terhadap had laju IP + sasaran
    await recordAttempt(supabase, ipKey);
    await recordAttempt(supabase, targetKey);

    return json(200, { success: true }, { origin });
  } catch (err) {
    console.error("[api/reset-request]", err);
    return json(500, { error: "Ralat pelayan dalaman." }, { origin });
  }
}
