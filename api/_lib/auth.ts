/**
 * Kongsi helpers untuk semua endpoint Vercel (api/*.ts).
 * Fail ini berada dalam api/_lib/ supaya tidak dijadikan route.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import {
  createHash,
  createHmac,
  pbkdf2Sync,
  timingSafeEqual,
} from "node:crypto";

export function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing environment variable: ${key}`);
  return val;
}

/** TTL sesi: 12 jam (dikurangkan daripada 7 hari — hadkan tetingkap curi token). */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** Nama cookie sesi httpOnly (token HMAC + sbToken JWT). */
export const SESSION_COOKIE = "quickrx_session";
export const SB_COOKIE = "quickrx_sb";

// ── CORS senarai-putih (ganti wildcard "*") ──────────────────────────────────
// Panggilan aplikasi adalah same-origin (/api/*), jadi tiada ACAO diperlukan.
// Hanya echo Origin jika ia disahkan — menghalang mana-mana origin daripada
// membaca respons API dengan token yang dicuri melalui XSS.
function getAllowedOrigins(): string[] {
  const list: string[] = [];
  const extra = process.env.ALLOWED_ORIGINS || "";
  for (const o of extra.split(",")) {
    const t = o.trim().replace(/\/$/, "");
    if (t) list.push(t);
  }
  if (process.env.VERCEL_URL) {
    list.push(`https://${process.env.VERCEL_URL.replace(/\/$/, "")}`);
  }
  return list;
}

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  // Benarkan localhost untuk pembangunan tempatan.
  if (/^http:\/\/localhost(:\d+)?$/i.test(origin)) return true;
  if (/^http:\/\/127\.0\.0\.1(:\d+)?$/i.test(origin)) return true;
  return getAllowedOrigins().includes(origin.replace(/\/$/, ""));
}

export function corsHeaders(origin?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    Vary: "Origin",
  };
  if (origin && isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
}

export function corsHeadersFor(request?: Request): Record<string, string> {
  try {
    return corsHeaders(request?.headers.get("origin") ?? null);
  } catch {
    return corsHeaders(null);
  }
}

export function json(
  status: number,
  body: unknown,
  init?: {
    origin?: string | null;
    cookies?: string[];
  }
): Response {
  const headers: Record<string, string> = {
    ...corsHeaders(init?.origin ?? null),
    "Content-Type": "application/json",
  };
  const res = new Response(JSON.stringify(body), { status, headers });
  // Response headers adalah immutable — guna Headers untuk Set-Cookie.
  if (init?.cookies?.length) {
    const h = new Headers(headers);
    for (const c of init.cookies) h.append("Set-Cookie", c);
    return new Response(JSON.stringify(body), { status, headers: h });
  }
  return res;
}

// ── Cookie sesi httpOnly ─────────────────────────────────────────────────────
function isSecureContext(): boolean {
  return (
    process.env.VERCEL === "1" || process.env.NODE_ENV === "production"
  );
}

export function sessionCookie(
  token: string,
  maxAgeSec: number = SESSION_TTL_MS / 1000
): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(maxAgeSec)}`,
  ];
  if (isSecureContext()) parts.push("Secure");
  return parts.join("; ");
}

export function sbCookie(
  sbToken: string,
  maxAgeSec: number = SESSION_TTL_MS / 1000
): string {
  const parts = [
    `${SB_COOKIE}=${sbToken}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(maxAgeSec)}`,
  ];
  if (isSecureContext()) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookies(): string[] {
  const base = ["Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (isSecureContext()) base.push("Secure");
  return [
    `${SESSION_COOKIE}=deleted; ${base.join("; ")}`,
    `${SB_COOKIE}=deleted; ${base.join("; ")}`,
  ];
}

export function parseCookies(request: Request): Record<string, string> {
  const out: Record<string, string> = {};
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function adminClient(): SupabaseClient {
  return createClient(
    getEnv("SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY")
  );
}

// ── Sidik jari versi kata laluan (pwv) ─────────────────────────────────────
// Mesti sepadan dengan SQL: left(md5(kata_laluan_hash), 16) dalam
// app_session_ok() (migrasi 039). Menukar kata laluan → semua token lama
// tidak sah serta-merta (H5).
export function pwvFingerprint(storedHash: string | null | undefined): string | null {
  if (!storedHash) return null;
  return createHash("md5").update(storedHash).digest("hex").slice(0, 16);
}

// ── Token sesi HMAC ────────────────────────────────────────────────────────
export interface SessionPayload {
  userId: string;
  expiresAt: number;
  pwv: string | null;
}

export function signToken(payload: SessionPayload): string {
  const secret = getEnv("SESSION_SECRET");
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyToken(token: string): SessionPayload | null {
  try {
    const secret = getEnv("SESSION_SECRET");
    const [data, sig] = token.split(".");
    if (!data || !sig) return null;
    const expectedSig = createHmac("sha256", secret)
      .update(data)
      .digest("base64url");
    // Perbandingan masa-seragam — elak timing side-channel.
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expectedSig, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(data, "base64url").toString());
    if (payload.expiresAt && payload.expiresAt < Date.now()) return null;
    if (!payload.userId) return null;
    return {
      userId: payload.userId as string,
      expiresAt: payload.expiresAt as number,
      pwv: (payload.pwv as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

export function extractToken(request: Request): string | null {
  const auth = request.headers.get("Authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (match?.[1]?.trim()) return match[1].trim();
  // Fallback: cookie httpOnly (laluan utama selepas pengerasan).
  try {
    return parseCookies(request)[SESSION_COOKIE] || null;
  } catch {
    return null;
  }
}

// ── JWT Supabase-compat (PostgREST) ────────────────────────────────────────
export function mintSupabaseJwt(
  userId: string,
  expiresAt: number,
  pwv: string | null
): string {
  const secret = getEnv("SUPABASE_JWT_SECRET");
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  ).toString("base64url");
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

// ── Pengesahan kata laluan ─────────────────────────────────────────────────
// bcrypt dan PBKDF2 sahaja. FRASA PLAINTEXT TIDAK LAGI DITERIMA (audit H3).
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$")) {
    return bcrypt.compare(password, storedHash);
  }
  if (storedHash.startsWith("pbkdf2:")) {
    const parts = storedHash.split(":");
    if (parts.length === 4) {
      try {
        const iterations = parseInt(parts[1], 10);
        const salt = Buffer.from(parts[2], "hex");
        const expectedKey = parts[3].toLowerCase();
        const derivedKey = pbkdf2Sync(password, salt, iterations, 32, "sha256");
        // Perbandingan masa-seragam
        const a = Buffer.from(derivedKey.toString("hex"), "utf8");
        const b = Buffer.from(expectedKey, "utf8");
        if (a.length !== b.length) return false;
        let diff = 0;
        for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
        return diff === 0;
      } catch {
        return false;
      }
    }
    return false;
  }
  // Format tidak dikenali (termasuk hash plaintext legacy) → tolak.
  return false;
}

// ── Had laju percubaan (DB-backed, merentas instance) ──────────────────────
// NOTA spoofing: X-Forwarded-For boleh dipalsukan pelanggan. Utamakan
// pengepala yang disahkan Vercel, jika tidak gunakan hop proksi TERDEKAT
// (entri terakhir XFF — paling sukar dipalsukan) dan bukannya yang pertama.
export function clientIp(request: Request): string {
  const vercelFwd = request.headers.get("x-vercel-forwarded-for");
  if (vercelFwd) {
    const first = vercelFwd.split(",")[0].trim();
    if (first) return first.slice(0, 45);
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim().slice(0, 45);
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1].slice(0, 45);
  }
  return "unknown";
}

/** Had panjang input kata laluan — elak CPU DoS / pemotongan senyap bcrypt 72B. */
export function isPasswordLengthValid(pw: unknown): boolean {
  return typeof pw === "string" && pw.length >= 8 && pw.length <= 128;
}

// Senarai sekat kata laluan umum (audit: dasar >=6 membenarkan "password123").
// Semakan tidak peka huruf besar/kecil; API menjana kata laluan rawak untuk
// reset, jadi senarai ini hanya menjejaskan pilihan manual yang lemah.
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

/**
 * Dasar kata laluan: 8–128 aksara, mesti ada huruf + nombor, bukan kata
 * laluan umum. Pulangkan mesej ralat atau null jika sah.
 */
export function passwordPolicyError(pw: unknown): string | null {
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

/**
 * Semak had laju untuk semua keys. Benarkan jika mana-mana key dilanggar.
 * Fail-open jika jadual auth_attempts belum wujud (sebelum migrasi 039).
 */
export async function isRateLimited(
  supabase: SupabaseClient,
  checks: Array<{ key: string; max: number }>,
  windowSec: number
): Promise<boolean> {
  const cutoff = new Date(Date.now() - windowSec * 1000).toISOString();
  for (const check of checks) {
    try {
      const { count, error } = await supabase
        .from("auth_attempts")
        .select("id", { count: "exact", head: true })
        .eq("key", check.key)
        .gte("ts", cutoff);
      if (error) {
        // Fail-open sementara (jadual auth_attempts belum wujud sebelum
        // migrasi 039) — JANGAN biarkan keadaan ini kekal: deploy 039
        // dengan segera. Log sebagai ERROR supaya amaran dikesan.
        console.error(
          "[rate-limit] FAIL-OPEN — semakan gagal, had laju tidak berkuatkuasa. " +
            "Deploy migrasi 039 (jadual auth_attempts):",
          error.message
        );
        continue;
      }
      if ((count ?? 0) >= check.max) return true;
    } catch (err) {
      console.error(
        "[rate-limit] FAIL-OPEN — semakan gagal, had laju tidak berkuatkuasa. Deploy migrasi 039:",
        err
      );
    }
  }
  return false;
}

/** Rekod percubaan (gagal atau permintaan terhad). Best-effort. */
export async function recordAttempt(
  supabase: SupabaseClient,
  key: string
): Promise<void> {
  try {
    const { error } = await supabase.from("auth_attempts").insert({ key });
    if (error) console.warn("[rate-limit] gagal rekod percubaan:", error.message);
  } catch (err) {
    console.warn("[rate-limit] gagal rekod percubaan:", err);
  }
}

/** Padam percubaan untuk key (dipanggil selepas login berjaya). */
export async function clearAttempts(
  supabase: SupabaseClient,
  key: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from("auth_attempts")
      .delete()
      .eq("key", key);
    if (error) console.warn("[rate-limit] gagal padam percubaan:", error.message);
  } catch (err) {
    console.warn("[rate-limit] gagal padam percubaan:", err);
  }
}
