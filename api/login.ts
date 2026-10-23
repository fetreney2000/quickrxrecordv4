/**
 * Vercel Serverless Function: POST /api/login
 *
 * Mengesahkan nama pengguna + kata laluan terhadap jadual "profiles".
 * Menyokong hash bcrypt dan PBKDF2 (plaintext tidak lagi diterima).
 * Mengembalikan profil + token sesi HMAC + sbToken (JWT Supabase-compat,
 * membawa claim pwv untuk RLS).
 *
 * Keselamatan (audit H2):
 *   - Had laju: 5 percubaan gagal / 15 minit per nama pengguna + 20 / 15 minit per IP
 *   - Mesej 401 seragam (tiada pengecaman pengguna) + bcrypt dummy pada
 *     pengguna tiada/h tanpa hash (padankan masa pengiraan)
 */
import bcrypt from "bcryptjs";
import {
  adminClient,
  clearAttempts,
  clientIp,
  corsHeadersFor,
  isRateLimited,
  json,
  mintSupabaseJwt,
  pwvFingerprint,
  recordAttempt,
  sbCookie,
  sessionCookie,
  SESSION_TTL_MS,
  signToken,
  verifyPassword,
} from "./_lib/auth";

// Hash bcrypt dummy (cost 12) — sentiasa gagal sepadan, guna utk padankan masa.
const DUMMY_HASH =
  "$2b$12$GnStAWoBKu/luQvZG/0kEOi0O1mhiPeKvKi/84205LPMnfAVkTZAi";

export async function OPTIONS(request: Request): Promise<Response> {
  return new Response("ok", { headers: corsHeadersFor(request) });
}

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  try {
    const { nama_pengguna, kata_laluan } = await request.json();
    if (!nama_pengguna || !kata_laluan) {
      return json(
        400,
        { error: "Nama pengguna dan kata laluan diperlukan." },
        { origin }
      );
    }
    // Had atas 128 aksara — elak CPU DoS + pemotongan senyap bcrypt (72B).
    if (
      typeof kata_laluan === "string" &&
      kata_laluan.length > 128
    ) {
      return json(
        400,
        { error: "Nama pengguna atau kata laluan tidak sah." },
        { origin }
      );
    }

    const supabase = adminClient();
    const ip = clientIp(request);
    const userKey = `login:user:${String(nama_pengguna).toLowerCase()}`;
    const ipKey = `login:ip:${ip}`;

    // Had laju — sebelum sebarang kerja
    const limited = await isRateLimited(
      supabase,
      [
        { key: userKey, max: 5 },
        { key: ipKey, max: 20 },
      ],
      15 * 60
    );
    if (limited) {
      return json(
        429,
        {
          error: "Terlalu banyak percubaan. Sila cuba lagi sebentar lagi.",
        },
        { origin }
      );
    }

    // Lajur eksplisit — elak pendedahan lajur sensitif baharu + hadkan
    // apa yang boleh tumpah ke log ralat (hash hanya untuk pwv di bawah).
    const { data: profile, error } = await supabase
      .from("profiles")
      .select(
        "id, nama, jawatan, nama_pengguna, peranan, aktif, kata_laluan_hash, created_at, updated_at, tema"
      )
      .eq("nama_pengguna", nama_pengguna)
      .eq("aktif", true)
      .maybeSingle();

    const stored: string | null = profile?.kata_laluan_hash ?? null;
    let valid = false;

    if (error || !profile || !stored) {
      // Pengguna tiada / akaun tanpa hash — padankan masa dgn bcrypt dummy
      await bcrypt.compare(kata_laluan, DUMMY_HASH);
      valid = false;
    } else {
      valid = await verifyPassword(kata_laluan, stored);
    }

    if (!valid) {
      // Rekod percubaan gagal untuk kedua-dua key
      await recordAttempt(supabase, userKey);
      await recordAttempt(supabase, ipKey);
      // Mesej seragam — tiada pengecaman nama pengguna wujud/salah/tanpa hash
      return json(
        401,
        {
          error: "Nama pengguna atau kata laluan tidak sah.",
        },
        { origin }
      );
    }

    // Login berjaya — reset pencacah pengguna (IP kekal utk agregat)
    await clearAttempts(supabase, userKey);

    // Pengawal TS: !valid telah return di atas, jadi profile di sini
    // semestinya wujud — kekalkan sebagai pengawal eksplisit.
    if (!profile) {
      return json(
        401,
        { error: "Nama pengguna atau kata laluan tidak sah." },
        { origin }
      );
    }
    const { kata_laluan_hash: _, ...profileSafe } = profile;
    const pwv = pwvFingerprint(stored);
    const expiresAt = Date.now() + SESSION_TTL_MS;
    const token = signToken({
      userId: profileSafe.id as string,
      expiresAt,
      pwv,
    });
    const sbToken = mintSupabaseJwt(profileSafe.id as string, expiresAt, pwv);

    // Cookie httpOnly adalah pembawa sesi utama; token dalam body dikekalkan
    // untuk keserasian (fallback Authorization) tetapi klien baharu tidak
    // menyimpannya ke localStorage.
    return json(
      200,
      { profile: profileSafe, token, sbToken },
      {
        origin,
        cookies: [
          sessionCookie(token),
          sbCookie(sbToken),
        ],
      }
    );
  } catch (err) {
    console.error("[api/login]", err);
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("SUPABASE_JWT_SECRET") || msg.includes("SESSION_SECRET")) {
      return json(
        500,
        {
          error:
            "Konfigurasi server tidak lengkap. Tambah SUPABASE_JWT_SECRET dan SESSION_SECRET dalam Vercel → Settings → Environment Variables.",
        },
        { origin }
      );
    }
    return json(500, { error: "Ralat pelayan dalaman." }, { origin });
  }
}
