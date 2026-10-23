/**
 * Vercel Serverless Function: GET /api/session, DELETE /api/session
 *
 * GET  — pulangkan profil + sbToken segar untuk token sesi yang sah.
 *        Menolak sesi jika: akaun dinyahaktifkan ATAU pwv token tidak
 *        sepadan dengan sidik jari hash kata laluan semasa (password change
 *        menarik balik semua sesi sedia ada — audit H5).
 * DELETE — hapus token sesi (client membuang token; token stateless)
 */
import {
  adminClient,
  clearSessionCookies,
  corsHeadersFor,
  extractToken,
  json,
  mintSupabaseJwt,
  pwvFingerprint,
  sbCookie,
  sessionCookie,
  SESSION_TTL_MS,
  signToken,
  verifyToken,
} from "./_lib/auth";

export async function OPTIONS(request: Request): Promise<Response> {
  return new Response("ok", { headers: corsHeadersFor(request) });
}

export async function GET(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  try {
    const token = extractToken(request);
    if (!token) {
      return json(200, { profile: null }, { origin });
    }

    const session = verifyToken(token);
    if (!session) {
      // Token tamat/palsu — arah klien padam cookie lapuk.
      return json(
        200,
        { profile: null },
        { origin, cookies: clearSessionCookies() }
      );
    }

    const supabase = adminClient();

    // akaun mesti AKTIF — pengguna dinyahaktifkan kehilangan sesi serta-merta
    // (lajur eksplisit; hash diperlukan untuk semakan pwv sahaja).
    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "id, nama, jawatan, nama_pengguna, peranan, aktif, kata_laluan_hash, created_at, updated_at, tema"
      )
      .eq("id", session.userId)
      .eq("aktif", true)
      .maybeSingle();

    if (!profile) {
      return json(
        200,
        { profile: null },
        { origin, cookies: clearSessionCookies() }
      );
    }

    // pwv mesti sepadan — tukar kata laluan membatalkan token lama
    const currentPwv = pwvFingerprint(
      profile.kata_laluan_hash as string | null
    );
    if (currentPwv !== (session.pwv ?? null)) {
      return json(
        200,
        { profile: null },
        { origin, cookies: clearSessionCookies() }
      );
    }

    const { kata_laluan_hash: _, ...profileSafe } = profile;
    // Putaran gelongsor: jika baki < 50% TTL, keluarkan token baharu supaya
    // sesi aktif kekal segar tanpa memaksa log masuk semula; jika tidak,
    // kekalkan expiresAt asal (tiada lanjutan tanpa had).
    const now = Date.now();
    const remaining = session.expiresAt - now;
    const shouldRotate = remaining < SESSION_TTL_MS / 2;
    const expiresAt = shouldRotate ? now + SESSION_TTL_MS : session.expiresAt;
    const freshToken = shouldRotate
      ? signToken({ userId: session.userId, expiresAt, pwv: currentPwv })
      : token;
    const sbToken = mintSupabaseJwt(session.userId, expiresAt, currentPwv);
    return json(
      200,
      {
        profile: profileSafe,
        sbToken,
        ...(shouldRotate ? { token: freshToken } : {}),
      },
      {
        origin,
        cookies: shouldRotate
          ? [sessionCookie(freshToken), sbCookie(sbToken)]
          : undefined,
      }
    );
  } catch (err) {
    console.error("[api/session]", err);
    return json(500, { error: "Ralat pelayan dalaman." }, { origin });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  // Padam cookie httpOnly di pelayan; klien turut membuang salinan memori.
  return json(200, { success: true }, { origin, cookies: clearSessionCookies() });
}
