/**
 * Mock API plugin untuk Vite dev server.
 *
 * Menyediakan endpoint:
 *  - POST   /api/login        — sahkan nama pengguna + kata laluan
 *  - GET    /api/session      — pulangkan profil (jika ada)
 *  - DELETE /api/session      — kosongkan sesi
 *  - POST   /api/reset-request — cipta permintaan reset kata laluan
 *
 * Untuk pembangunan sahaja. Dalam produksi, gunakan Supabase Edge Functions
 * (lihat supabase/functions/).
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";

// Helper: hash kata laluan dengan SHA-256 (dev only fallback)
function devHashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

// Simple session store (in-memory, dev only)
const sessions = new Map<string, { userId: string; createdAt: number }>();

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL || "";
  const key = process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!url || !key) return null;
  return createClient(url, key);
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

            const sb = getSupabase();
            if (!sb) {
              return sendJson(res, 503, {
                error:
                  "Supabase tidak dikonfigurasi. Sila isi .env dengan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.",
              });
            }

            const { data: profile, error } = await sb
              .from("profiles")
              .select("*")
              .eq("nama_pengguna", nama_pengguna)
              .eq("aktif", true)
              .maybeSingle();

            if (error || !profile) {
              return sendJson(res, 401, {
                error: "Nama pengguna atau kata laluan tidak sah.",
              });
            }

            // Verifikasi kata laluan
            const stored = (profile as any).kata_laluan_hash as string | null;
            if (!stored) {
              return sendJson(res, 401, {
                error: "Akaun belum menetapkan kata laluan. Sila hubungi pentadbir.",
              });
            }

            // Cuba bcryptjs dahulu, kemudian fallback ke SHA-256/plain (dev)
            let valid = false;
            try {
              const bcrypt = await import("bcryptjs");
              valid = await bcrypt.compare(kata_laluan, stored);
            } catch {
              const hash = devHashPassword(kata_laluan);
              valid = hash === stored || stored === kata_laluan;
            }

            if (!valid) {
              return sendJson(res, 401, {
                error: "Nama pengguna atau kata laluan tidak sah.",
              });
            }

            // Buang kata_laluan_hash dari respons
            const { kata_laluan_hash: _, ...profileSafe } = profile as any;

            // Cipta token sesi
            const token =
              Math.random().toString(36).slice(2) +
              Date.now().toString(36);
            sessions.set(token, {
              userId: profileSafe.id,
              createdAt: Date.now(),
            });

            return sendJson(res, 200, {
              profile: profileSafe,
              token,
            });
          }

          // ===========================================================
          // GET /api/session
          // ===========================================================
          if (url === "/api/session" && req.method === "GET") {
            const auth = req.headers.authorization || "";
            const token = auth.replace(/^Bearer\s+/i, "").trim();
            if (!token) {
              return sendJson(res, 200, { profile: null });
            }
            const session = sessions.get(token);
            if (!session) {
              return sendJson(res, 200, { profile: null });
            }

            const sb = getSupabase();
            if (!sb) {
              return sendJson(res, 503, { error: "Supabase tidak dikonfigurasi." });
            }

            const { data: profile } = await sb
              .from("profiles")
              .select("*")
              .eq("id", session.userId)
              .maybeSingle();

            if (!profile) {
              sessions.delete(token);
              return sendJson(res, 200, { profile: null });
            }

            const { kata_laluan_hash: _, ...profileSafe } = profile as any;
            return sendJson(res, 200, { profile: profileSafe });
          }

          // ===========================================================
          // DELETE /api/session
          // ===========================================================
          if (url === "/api/session" && req.method === "DELETE") {
            const auth = req.headers.authorization || "";
            const token = auth.replace(/^Bearer\s+/i, "").trim();
            if (token) sessions.delete(token);
            return sendJson(res, 200, { success: true });
          }

          // ===========================================================
          // POST /api/reset-request
          // ===========================================================
          if (url === "/api/reset-request" && req.method === "POST") {
            const body = await readBody(req);
            const { userId } = body;
            if (!userId) {
              return sendJson(res, 400, { error: "userId diperlukan." });
            }

            const sb = getSupabase();
            if (!sb) {
              return sendJson(res, 503, { error: "Supabase tidak dikonfigurasi." });
            }

            // Semak permintaan sedia ada (pending)
            const { data: existing } = await sb
              .from("password_reset_requests")
              .select("id")
              .eq("user_id", userId)
              .eq("status", "pending")
              .maybeSingle();

            if (existing) {
              return sendJson(res, 409, {
                error: "Permintaan reset sudah wujud.",
                duplicate: true,
              });
            }

            // Cipta permintaan baru
            const { error: insertError } = await sb
              .from("password_reset_requests")
              .insert({
                user_id: userId,
                status: "pending",
                notes: "Permintaan melalui halaman Lupa Kata Laluan",
              });

            if (insertError) {
              return sendJson(res, 500, {
                error: "Gagal mencipta permintaan.",
              });
            }

            return sendJson(res, 200, { success: true });
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
