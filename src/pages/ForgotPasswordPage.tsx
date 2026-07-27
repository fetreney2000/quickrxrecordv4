import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { KeyRound, HelpCircle, Loader2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AuthBackground } from "@/components/auth/auth-background";
import { SuccessState } from "@/components/auth/success-state";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [mounted, setMounted] = useState(false);
  const [namaPengguna, setNamaPengguna] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!namaPengguna.trim()) {
      toast.error("Sila masukkan nama pengguna.");
      return;
    }
    setLoading(true);

    try {
      // Cari profil di Supabase
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, nama_pengguna")
        .eq("nama_pengguna", namaPengguna.trim())
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile) {
        toast.error("Nama pengguna tidak dijumpai.");
        setLoading(false);
        return;
      }

      // Hantar permintaan reset
      const res = await fetch("/api/reset-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile.id }),
      });

      if (res.ok || res.status === 409) {
        // OK atau 409 (pendua) — papar skrin kejayaan untuk elakkan spam
        setSent(true);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || "Gagal menghantar permintaan. Sila cuba lagi.");
      }
    } catch (err) {
      // Jika Supabase tidak dapat dihubungi (offline/dev tanpa DB),
      // tetap tunjukkan skrin kejayaan untuk pembangunan
      // eslint-disable-next-line no-console
      console.warn("Supabase error (dev mode):", err);
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div
        className="relative min-h-screen flex items-center justify-center overflow-hidden p-4"
        style={{ background: "#0a0e27" }}
      >
        <AuthBackground orbCount={3} particleCount={16} />
        <SuccessState />
        <motion.div
          initial={{ opacity: 0 }}
          animate={mounted ? { opacity: 1 } : {}}
          transition={{ delay: 1.2, duration: 0.4 }}
          className="absolute bottom-4 left-0 right-0 text-center"
        >
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            © 2026 QuickRxRecord. Hak cipta terpelihara.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center overflow-hidden p-4"
      style={{ background: "#0a0e27" }}
    >
      <AuthBackground orbCount={3} particleCount={16} />

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={mounted ? { opacity: 1, y: 0, scale: 1 } : {}}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative w-full max-w-[440px]"
        style={{
          background: "rgba(255,255,255,0.07)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 20,
          padding: 36,
          boxShadow:
            "0 25px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
        }}
      >
        {/* Gradient border */}
        <div
          className="pointer-events-none absolute"
          style={{
            inset: 0,
            borderRadius: 20,
            padding: 1.5,
            background:
              "linear-gradient(135deg, rgba(24,119,242,0.5), rgba(124,58,237,0.4), rgba(6,182,212,0.3), rgba(24,119,242,0.5))",
            WebkitMask:
              "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />

        {/* Accent bar */}
        <div
          className="absolute top-0 left-8 right-8 h-[3px] rounded-full"
          style={{
            background:
              "linear-gradient(90deg, #1877f2, #7c3aed, #06b6d4, #1877f2)",
            backgroundSize: "200% 100%",
            animation: "gradient-x 4s linear infinite",
          }}
        />

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={mounted ? { opacity: 1, scale: 1 } : {}}
          transition={{ delay: 0.03, type: "spring", stiffness: 200 }}
          className="flex justify-center mb-5"
        >
          <div
            className="w-[72px] h-[72px] rounded-[18px] flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #1877f2 0%, #0d5bd4 100%)",
              boxShadow:
                "0 10px 30px rgba(24,119,242,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
            }}
          >
            <KeyRound className="w-8 h-8 text-white" strokeWidth={2.5} />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={mounted ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.05, duration: 0.25 }}
          className="text-center mb-6"
        >
          <h2
            className="text-[20px] font-bold text-white mb-1"
            style={{ letterSpacing: "-0.01em" }}
          >
            Lupa Kata Laluan?
          </h2>
          <p
            className="text-sm"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            Masukkan nama pengguna anda. Permintaan akan dihantar kepada pentadbir.
          </p>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={mounted ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.02, duration: 0.25 }}
            className="space-y-1.5"
          >
            <label
              htmlFor="username"
              className="text-[13px] font-semibold flex items-center gap-2"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              <HelpCircle
                className="w-3.5 h-3.5"
                style={{ color: focused ? "#1877f2" : "#9ca3af" }}
              />
              Nama Pengguna
            </label>
            <input
              id="username"
              type="text"
              value={namaPengguna}
              onChange={(e) => setNamaPengguna(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Masukkan nama pengguna"
              autoComplete="username"
              disabled={loading}
              className="w-full h-12 px-4 text-sm text-white outline-none transition-all disabled:opacity-50"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: `1px solid ${
                  focused ? "rgba(24,119,242,0.5)" : "rgba(255,255,255,0.1)"
                }`,
                borderRadius: 12,
                boxShadow: focused
                  ? "0 0 0 3px rgba(24,119,242,0.1), 0 2px 8px rgba(24,119,242,0.08)"
                  : "0 1px 3px rgba(0,0,0,0.04)",
              }}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={mounted ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.15, duration: 0.25 }}
          >
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={!loading ? { y: -2 } : {}}
              whileTap={!loading ? { scale: 0.98 } : {}}
              className="w-full h-[50px] flex items-center justify-center gap-2 text-[15px] font-bold text-white disabled:opacity-80 transition-all"
              style={{
                background: "linear-gradient(135deg, #1877f2, #0d5bd4)",
                borderRadius: 12,
                boxShadow:
                  "0 8px 24px rgba(24,119,242,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
                letterSpacing: "0.02em",
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menghantar...</span>
                </>
              ) : (
                <span>Hantar Permintaan</span>
              )}
            </motion.button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={mounted ? { opacity: 1 } : {}}
            transition={{ delay: 0.2, duration: 0.25 }}
            className="text-center pt-2"
          >
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-[13px] transition-colors"
              style={{ color: "rgba(255,255,255,0.4)" }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.color =
                  "rgba(255,255,255,0.7)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.color =
                  "rgba(255,255,255,0.4)")
              }
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Kembali ke Log Masuk</span>
            </Link>
          </motion.div>
        </form>
      </motion.div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={mounted ? { opacity: 1 } : {}}
        transition={{ delay: 0.3, duration: 0.25 }}
        className="absolute bottom-4 left-0 right-0 text-center"
      >
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
          © 2026 QuickRxRecord. Hak cipta terpelihara.
        </p>
      </motion.div>
    </div>
  );
}
