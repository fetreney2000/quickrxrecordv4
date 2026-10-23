/**
 * Mock API plugin untuk Vite dev server.
 *
 * Menyediakan endpoint:
 *  - POST   /api/login          — sahkan nama pengguna + kata laluan
 *  - GET    /api/session        — pulangkan profil + sbToken (jika ada)
 *  - DELETE /api/session        — kosongkan sesi
 *  - POST   /api/reset-request  — cipta permintaan reset kata laluan
 *  - POST   /api/create-user    — cipta pengguna (Pentadbir sahaja)
 *  - POST   /api/reset-password — set semula kata laluan (Pentadbir sahaja)
 *
 * Untuk pembangunan sahaja. Dalam produksi, gunakan Vercel serverless functions
 * (lihat api/).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  createHash,
  createHmac,
  pbkdf2Sync,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Sahkan kata laluan terhadap hash yang disimpan.
 * Menyokong: bcrypt, PBKDF2 (pbkdf2:iterations:salt:key).
 * FRASA PLAINTEXT/SHA-256 TIDAK DITERIMA — sepadan dengan api/login.ts (H3).
 */
async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  // 1. Cuba bcrypt dahulu
  if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$")) {
    try {
      const bcrypt = await import("bcryptjs");
      return bcrypt.compare(password, storedHash);
    } catch {
      // fallthrough ke bawah
    }
  }

  // 2. Cuba PBKDF2 (format: pbkdf2:iterations:salt_hex:derived_key_hex)
  if (storedHash.startsWith("pbkdf2:")) {
    const parts = storedHash.split(":");
    if (parts.length === 4) {
      const iterations = parseInt(parts[1], 10);
      const salt = Buffer.from(parts[2], "hex");
      const expectedKey = parts[3].toLowerCase();
      const derivedKey = pbkdf2Sync(password, salt, iterations, 32, "sha256");
      return derivedKey.toString("hex") === expectedKey;
    }
    return false;
  }

  // Format tidak dikenali (termasuk hash plaintext legacy) → tolak
  return false;
}

// Had laju dev (in-memory; setara api/_lib/auth.ts tanpa DB)
const RATE_WINDOW_MS = 15 * 60 * 1000;
const loginAttempts = new Map<string, number[]>();

function devRateLimited(keys: Array<{ key: string; max: number }>): boolean {
  const now = Date.now();
  for (const { key, max } of keys) {
    const hits = (loginAttempts.get(key) ?? []).filter(
      (t) => now - t < RATE_WINDOW_MS
    );
    loginAttempts.set(key, hits);
    if (hits.length >= max) return true;
  }
  return false;
}

function devRecordAttempt(key: string): void {
  const hits = loginAttempts.get(key) ?? [];
  hits.push(Date.now());
  loginAttempts.set(key, hits);
}

function devClearAttempts(key: string): void {
  loginAttempts.delete(key);
}

// Sesi dev disahkan secara kriptografi (HMAC + pwv + tamat 12j) —
// selari dengan api/_lib/auth.ts supaya perbezaan dev/prod tidak
// menyembunyikan pepijat sesi.
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const SESSION_COOKIE = "quickrx_session";
const SB_COOKIE = "quickrx_sb";

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || "dev-only-insecure-secret-change-me";
}

function signToken(payload: { userId: string; expiresAt: number; pwv: string | null }): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", getSessionSecret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verifySessionTokenFull(token: string): { userId: string; expiresAt: number; pwv: string | null } | null {
  try {
    const [data, sig] = token.split(".");
    if (!data || !sig) return null;
    const expected = createHmac("sha256", getSessionSecret()).update(data).digest("base64url");
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(data, "base64url").toString());
    if (payload.expiresAt && payload.expiresAt < Date.now()) return null;
    if (!payload.userId) return null;
    return { userId: payload.userId, expiresAt: payload.expiresAt, pwv: payload.pwv ?? null };
  } catch {
    return null;
  }
}

function parseCookies(req: IncomingMessage): Record<string, string> {
  const out: Record<string, string> = {};
  const header = (req.headers.cookie as string) || "";
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function extractBearer(req: IncomingMessage): string | null {
  const auth = (req.headers.authorization as string) || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m?.[1]?.trim()) return m[1].trim();
  return parseCookies(req)[SESSION_COOKIE] || null;
}

function setCookieHeaders(res: ServerResponse, cookies: string[]): void {
  try {
    (res as unknown as { setHeader: (k: string, v: string[]) => void }).setHeader("Set-Cookie", cookies);
  } catch {
    // abaikan
  }
}

function sessionCookies(token: string, sbToken: string | null): string[] {
  const base = "Path=/; HttpOnly; SameSite=Lax";
  const maxAge = `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
  const out = [`${SESSION_COOKIE}=${token}; ${base}; ${maxAge}`];
  if (sbToken) out.push(`${SB_COOKIE}=${sbToken}; ${base}; ${maxAge}`);
  return out;
}

function clearCookies(): string[] {
  return [
    `${SESSION_COOKIE}=deleted; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    `${SB_COOKIE}=deleted; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  ];
}

/**
 * Client Supabase untuk mock (server-side, Node).
 * Guna service_role — selepas migrasi 038, anon tidak boleh membaca profiles.
 */
function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!url || !key) return null;
  return createClient(url, key);
}

/** Sidik jari pwv — sepadan dengan SQL left(md5(kata_laluan_hash),16). */
function pwvFingerprint(storedHash: string | null | undefined): string | null {
  if (!storedHash) return null;
  return createHash("md5").update(storedHash).digest("hex").slice(0, 16);
}

/**
 * Keluarkan JWT Supabase-compat (serupa api/login.ts) untuk PostgREST —
 * diperlukan selepas RLS diaktifkan (migrasi 038/039). Claim pwv mesti
 * sepadan dengan app_session_ok() dalam migrasi 039.
 */
function mintSupabaseJwt(
  userId: string,
  expiresAt: number,
  pwv: string | null
): string | null {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) return null;
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
    "base64url"
  );
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      role: "authenticated",
      aud: "authenticated",
      iss: "supabase",
      iat: now,
      exp: Math.floor(expiresAt / 1000),
      pwv,
    })
  ).toString("base64url");
  const data = `${header}.${payload}`;
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verifySessionToken(token: string): { userId: string } | null {
  const s = verifySessionTokenFull(token);
  return s ? { userId: s.userId } : null;
}

// Dasar kata laluan dev — cermin api/_lib/auth.ts (8–128, huruf + nombor,
// sekat kata laluan umum). Kekalkan selari secara manual.
const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty123",
  "abc12345",
  "letmein123",
  "welcome123",
  "admin123",
  "admin12345",
  "farmasi123",
  "klinik123",
  "pentadbir",
]);

function passwordPolicyError(pw: unknown): string | null {
  if (typeof pw !== "string" || pw.length < 8 || pw.length > 128) {
    return "Kata laluan mestilah 8–128 aksara.";
  }
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
    return "Kata laluan mestilah mengandungi huruf dan nombor.";
  }
  if (COMMON_PASSWORDS.has(pw.toLowerCase())) {
    return "Kata laluan terlalu biasa. Sila pilih yang lebih unik.";
  }
  return null;
}

/** Pemanggil mesti Pentadbir aktif (mock token = token buatan; gunakan sesi mock + profil). */
async function requireAdmin(
  sb: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data: caller } = await sb
    .from("profiles")
    .select("peranan, aktif")
    .eq("id", userId)
    .maybeSingle();
  return !!caller && caller.peranan === "Pentadbir" && caller.aktif === true;
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: any) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export function apiMockPlugin(): Plugin {
  return {
    name: "quickrx-api-mock",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || "";
        if (!url.startsWith("/api/")) return next();

        try {
          // ===========================================================
          // POST /api/login
          // ===========================================================
          if (url === "/api/login" && req.method === "POST") {
            const body = await readBody(req);
            const { nama_pengguna, kata_laluan } = body;
            if (!nama_pengguna || !kata_laluan) {
              return sendJson(res, 400, {
                error: "Nama pengguna dan kata laluan diperlukan.",
              });
            }

            // Had laju dev (setara api/login.ts)
            const userKey = `login:user:${String(nama_pengguna).toLowerCase()}`;
            if (
              devRateLimited([
                { key: userKey, max: 5 },
                { key: "login:ip:dev", max: 20 },
              ])
            ) {
              return sendJson(res, 429, {
                error: "Terlalu banyak percubaan. Sila cuba lagi sebentar lagi.",
              });
            }

            const sb = getSupabase();
            if (!sb) {
              return sendJson(res, 503, {
                error:
                  "Supabase tidak dikonfigurasi. Sila isi .env dengan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.",
              });
            }

            const { data: profile, error } = await sb
              .from("profiles")
              .select(
                "id, nama, jawatan, nama_pengguna, peranan, aktif, kata_laluan_hash, created_at, updated_at, tema"
              )
              .eq("nama_pengguna", nama_pengguna)
              .eq("aktif", true)
              .maybeSingle();

            const stored = (profile as any)?.kata_laluan_hash as string | null;
            const valid =
              error || !profile || !stored
                ? false
                : await verifyPassword(kata_laluan, stored);

            if (!valid) {
              // Rekod percubaan gagal; mesej seragam (tiada pengecaman)
              devRecordAttempt(userKey);
              devRecordAttempt("login:ip:dev");
              return sendJson(res, 401, {
                error: "Nama pengguna atau kata laluan tidak sah.",
              });
            }

            devClearAttempts(userKey);

            // Buang kata_laluan_hash dari respons
            const { kata_laluan_hash: _, ...profileSafe } = profile as any;

            const pwv = pwvFingerprint(stored);
            const expiresAt = Date.now() + SESSION_TTL_MS;
            const token = signToken({ userId: profileSafe.id, expiresAt, pwv });
            const sbToken = mintSupabaseJwt(profileSafe.id, expiresAt, pwv);
            if (!sbToken) {
              return sendJson(res, 500, {
                error:
                  "SUPABASE_JWT_SECRET tidak diset — tambah ia ke .env (dapat dari Supabase Dashboard → Settings → API → JWT Secret).",
              });
            }
            setCookieHeaders(res, sessionCookies(token, sbToken));

            return sendJson(res, 200, {
              profile: profileSafe,
              token,
              sbToken,
            });
          }

          // ===========================================================
          // GET /api/session
          // ===========================================================
          if (url === "/api/session" && req.method === "GET") {
            const token = extractBearer(req);
            if (!token) {
              return sendJson(res, 200, { profile: null });
            }
            const session = verifySessionTokenFull(token);
            if (!session) {
              setCookieHeaders(res, clearCookies());
              return sendJson(res, 200, { profile: null });
            }

            const sb = getSupabase();
            if (!sb) {
              return sendJson(res, 503, { error: "Supabase tidak dikonfigurasi." });
            }

            const { data: profile } = await sb
              .from("profiles")
              .select(
                "id, nama, jawatan, nama_pengguna, peranan, aktif, kata_laluan_hash, created_at, updated_at, tema"
              )
              .eq("id", session.userId)
              .eq("aktif", true)
              .maybeSingle();

            if (!profile) {
              setCookieHeaders(res, clearCookies());
              return sendJson(res, 200, { profile: null });
            }

            const currentPwv = pwvFingerprint((profile as any).kata_laluan_hash as string | null);
            if (currentPwv !== (session.pwv ?? null)) {
              setCookieHeaders(res, clearCookies());
              return sendJson(res, 200, { profile: null });
            }

            const { kata_laluan_hash: _, ...profileSafe } = profile as any;
            const shouldRotate = session.expiresAt - Date.now() < SESSION_TTL_MS / 2;
            const expiresAt = shouldRotate ? Date.now() + SESSION_TTL_MS : session.expiresAt;
            const freshToken = shouldRotate
              ? signToken({ userId: session.userId, expiresAt, pwv: currentPwv })
              : token;
            const sbToken = mintSupabaseJwt(session.userId, expiresAt, currentPwv);
            if (shouldRotate) setCookieHeaders(res, sessionCookies(freshToken, sbToken));
            return sendJson(res, 200, {
              profile: profileSafe,
              sbToken,
              ...(shouldRotate ? { token: freshToken } : {}),
            });
          }

          // ===========================================================
          // DELETE /api/session
          // ===========================================================
          if (url === "/api/session" && req.method === "DELETE") {
            setCookieHeaders(res, clearCookies());
            return sendJson(res, 200, { success: true });
          }

          // ===========================================================
          // POST /api/change-password (sama ada api/change-password.ts)
          // ===========================================================
          if (url === "/api/change-password" && req.method === "POST") {
            const token = extractBearer(req);
            const session = token ? verifySessionToken(token) : null;
            if (!session) {
              return sendJson(res, 401, { error: "Sesi tidak sah. Sila log masuk semula." });
            }

            const body = await readBody(req);
            const { current_password, new_password } = body;
            if (!current_password || !new_password) {
              return sendJson(res, 400, {
                error: "Kata laluan semasa dan kata laluan baharu diperlukan.",
              });
            }
            const policyErr = passwordPolicyError(new_password);
            if (policyErr) {
              return sendJson(res, 400, { error: policyErr });
            }
            if (current_password === new_password) {
              return sendJson(res, 400, {
                error: "Kata laluan baharu mesti berbeza daripada kata laluan semasa.",
              });
            }

            const sb = getSupabase();
            if (!sb) {
              return sendJson(res, 503, { error: "Supabase tidak dikonfigurasi." });
            }
            const { data: profile } = await sb
              .from("profiles")
              .select("id, kata_laluan_hash")
              .eq("id", session.userId)
              .eq("aktif", true)
              .single();
            if (!profile) {
              return sendJson(res, 404, { error: "Profil pengguna tidak dijumpai." });
            }
            const stored = (profile as any).kata_laluan_hash as string | null;
            if (!stored || !(await verifyPassword(String(current_password), stored))) {
              return sendJson(res, 401, { error: "Kata laluan semasa tidak betul." });
            }
            const bcrypt = await import("bcryptjs");
            const newHash = await bcrypt.hash(String(new_password), 12);
            const { error: updateError } = await sb
              .from("profiles")
              .update({ kata_laluan_hash: newHash })
              .eq("id", session.userId);
            if (updateError) {
              return sendJson(res, 500, { error: "Gagal mengemas kini kata laluan." });
            }
            return sendJson(res, 200, { message: "Kata laluan berjaya dikemaskini." });
          }

          // ===========================================================
          // POST /api/reset-request
          // ===========================================================
          if (url === "/api/reset-request" && req.method === "POST") {
            const body = await readBody(req);
            const { userId, nama_pengguna } = body;
            if (!userId && !nama_pengguna) {
              return sendJson(res, 400, {
                error: "userId atau nama_pengguna diperlukan.",
              });
            }

            const sb = getSupabase();
            if (!sb) {
              return sendJson(res, 503, { error: "Supabase tidak dikonfigurasi." });
            }

            // Selesaikan userId daripada nama_pengguna di pelayan (mock)
            // Respons seragam — elak pengecaman nama pengguna.
            let resolvedUserId = userId as string | undefined;
            if (!resolvedUserId) {
              const { data: prof } = await sb
                .from("profiles")
                .select("id")
                .eq("nama_pengguna", String(nama_pengguna).trim())
                .maybeSingle();
              if (!prof) {
                return sendJson(res, 200, { success: true });
              }
              resolvedUserId = prof.id;
            }

            // Semak permintaan sedia ada (pending)
            const { data: existing } = await sb
              .from("password_reset_requests")
              .select("id")
              .eq("user_id", resolvedUserId)
              .eq("status", "pending")
              .maybeSingle();

            if (!existing) {
              await sb.from("password_reset_requests").insert({
                user_id: resolvedUserId,
                status: "pending",
                notes: "Permintaan melalui halaman Lupa Kata Laluan",
              });
            }

            return sendJson(res, 200, { success: true });
          }

          // ===========================================================
          // POST /api/create-user (admin sahaja — sama ada api/create-user.ts)
          // ===========================================================
          if (url === "/api/create-user" && req.method === "POST") {
            const auth = req.headers.authorization || "";
            const token = auth.replace(/^Bearer\s+/i, "").trim();
            const session = token ? verifySessionToken(token) : null;
            if (!session) {
              return sendJson(res, 401, { error: "Sesi tidak sah. Sila log masuk semula." });
            }

            const body = await readBody(req);
            const { nama, nama_pengguna, kata_laluan, jawatan, peranan } = body;
            if (!nama || !nama_pengguna || !kata_laluan) {
              return sendJson(res, 400, {
                error: "Nama, nama pengguna, dan kata laluan diperlukan.",
              });
            }
            const policyErr = passwordPolicyError(kata_laluan);
            if (policyErr) {
              return sendJson(res, 400, { error: policyErr });
            }
            const VALID_ROLES = [
              "Pentadbir",
              "Penjaga Stor",
              "Kakitangan Farmasi",
              "Kakitangan Klinik",
            ];
            if (peranan && !VALID_ROLES.includes(peranan)) {
              return sendJson(res, 400, { error: "Peranan tidak sah." });
            }

            const sb = getSupabase();
            if (!sb) {
              return sendJson(res, 503, { error: "Supabase tidak dikonfigurasi." });
            }
            if (!(await requireAdmin(sb, session.userId))) {
              return sendJson(res, 403, {
                error: "Hanya pentadbir boleh mencipta pengguna baharu.",
              });
            }

            const { data: existing } = await sb
              .from("profiles")
              .select("id")
              .eq("nama_pengguna", nama_pengguna)
              .maybeSingle();
            if (existing) {
              return sendJson(res, 409, { error: "Nama pengguna sudah wujud." });
            }

            const bcrypt = await import("bcryptjs");
            const kata_laluan_hash = await bcrypt.hash(kata_laluan, 12);
            const { data: profile, error: insertError } = await sb
              .from("profiles")
              .insert({
                id: randomUUID(),
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
              // eslint-disable-next-line no-console
              console.error("[api-mock/create-user]", insertError);
              return sendJson(res, 500, { error: "Gagal mencipta pengguna." });
            }
            return sendJson(res, 201, { profile });
          }

          // ===========================================================
          // POST /api/reset-password (admin sahaja — sama ada api/reset-password.ts)
          // ===========================================================
          if (url === "/api/reset-password" && req.method === "POST") {
            const auth = req.headers.authorization || "";
            const token = auth.replace(/^Bearer\s+/i, "").trim();
            const session = token ? verifySessionToken(token) : null;
            if (!session) {
              return sendJson(res, 401, { error: "Sesi tidak sah. Sila log masuk semula." });
            }

            const body = await readBody(req);
            const { userId, newPassword } = body;
            if (!userId || typeof userId !== "string") {
              return sendJson(res, 400, { error: "userId diperlukan." });
            }
            if (newPassword) {
              const policyErr = passwordPolicyError(String(newPassword));
              if (policyErr) {
                return sendJson(res, 400, { error: policyErr });
              }
            }

            const sb = getSupabase();
            if (!sb) {
              return sendJson(res, 503, { error: "Supabase tidak dikonfigurasi." });
            }
            if (!(await requireAdmin(sb, session.userId))) {
              return sendJson(res, 403, {
                error: "Hanya pentadbir boleh set semula kata laluan.",
              });
            }

            const { data: target } = await sb
              .from("profiles")
              .select("id, nama, nama_pengguna")
              .eq("id", userId)
              .maybeSingle();
            if (!target) {
              return sendJson(res, 404, { error: "Pengguna tidak dijumpai." });
            }

            const bcrypt = await import("bcryptjs");
            const password = newPassword
              ? String(newPassword)
              : randomBytes(9).toString("base64url").slice(0, 12);
            const kata_laluan_hash = await bcrypt.hash(password, 12);
            const { error: updateError } = await sb
              .from("profiles")
              .update({
                kata_laluan_hash,
                updated_at: new Date().toISOString(),
              })
              .eq("id", userId);
            if (updateError) {
              // eslint-disable-next-line no-console
              console.error("[api-mock/reset-password]", updateError);
              return sendJson(res, 500, { error: "Gagal set semula kata laluan." });
            }
            return sendJson(res, 200, { profile: target });
          }

          // Tiada padanan
          return sendJson(res, 404, { error: "Endpoint tidak dijumpai." });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("[api-mock]", err);
          return sendJson(res, 500, {
            error: "Ralat pelayan dalaman.",
          });
        }
      });
    },
  };
}