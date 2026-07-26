/**
 * Vercel Serverless Function: POST /api/change-password
 *
 * Menukar kata laluan pengguna. Menerima kata laluan semasa (untuk pengesahan)
 * dan kata laluan baharu. Mengesahkan hash terhadap stored hash sebelum mengemas kini.
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { createHmac, pbkdf2Sync } from "node:crypto";

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

function verifyToken(token: string): { userId: string } | null {
  try {
    const secret = getEnv("SESSION_SECRET");
    const [data, sig] = token.split(".");
    if (!data || !sig) return null;
    const expectedSig = createHmac("sha256", secret)
      .update(data)
      .digest("base64url");
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(data, "base64url").toString());
    if (payload.expiresAt && payload.expiresAt < Date.now()) return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

/**
 * Sahkan kata laluan terhadap hash yang disimpan.
 * Menyokong bcrypt ($2a/$2b), PBKDF2, dan plaintext fallback.
 */
async function verifyPassword(
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
        const derivedKey = pbkdf2Sync(
          password,
          salt,
          iterations,
          32,
          "sha256"
        );
        return derivedKey.toString("hex") === expectedKey;
      } catch {
        return false;
      }
    }
    return false;
  }
  return password === storedHash;
}

export async function OPTIONS(): Promise<Response> {
  return new Response("ok", { headers: corsHeaders() });
}

export async function POST(request: Request): Promise<Response> {
  try {
    // Authenticate via session token
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "Sesi tidak sah. Sila log masuk semula." });
    }
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (!payload) {
      return json(401, { error: "Sesi telah tamat tempoh. Sila log masuk semula." });
    }

    const { current_password, new_password } = await request.json();
    if (!current_password || !new_password) {
      return json(400, { error: "Kata laluan semasa dan kata laluan baharu diperlukan." });
    }
    if (new_password.length < 6) {
      return json(400, { error: "Kata laluan baharu mestilah sekurang-kurangnya 6 aksara." });
    }
    if (current_password === new_password) {
      return json(400, { error: "Kata laluan baharu mesti berbeza daripada kata laluan semasa." });
    }

    const supabase = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    // Fetch the current user profile
    const { data: profile, error: fetchError } = await supabase
      .from("profiles")
      .select("id, kata_laluan_hash")
      .eq("id", payload.userId)
      .eq("aktif", true)
      .single();

    if (fetchError || !profile) {
      return json(404, { error: "Profil pengguna tidak dijumpai." });
    }

    const stored = profile.kata_laluan_hash as string | null;
    if (!stored) {
      return json(400, { error: "Akaun belum menetapkan kata laluan." });
    }

    // Verify current password
    const valid = await verifyPassword(current_password, stored);
    if (!valid) {
      return json(401, { error: "Kata laluan semasa tidak betul." });
    }

    // Hash the new password with bcrypt
    const newHash = await bcrypt.hash(new_password, 12);

    // Update the password hash
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ kata_laluan_hash: newHash })
      .eq("id", payload.userId);

    if (updateError) {
      console.error("[api/change-password] update error:", updateError);
      return json(500, { error: "Gagal mengemas kini kata laluan." });
    }

    return json(200, { message: "Kata laluan berjaya dikemaskini." });
  } catch (err) {
    console.error("[api/change-password]", err);
    return json(500, { error: "Ralat pelayan dalaman." });
  }
}