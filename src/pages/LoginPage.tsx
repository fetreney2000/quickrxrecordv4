import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Loader2,
  Eye,
  EyeOff,
  Lock,
  User,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { AuthBackground } from "@/components/auth/auth-background";
import { RxLogo } from "@/components/auth/rx-logo";
import { useAuth } from "@/hooks/use-auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn, profile } = useAuth();
  const [namaPengguna, setNamaPengguna] = useState("");
  const [kataLaluan, setKataLaluan] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<"username" | "password" | null>(
    null
  );

  // If already logged in, redirect to dashboard
  if (profile) {
    navigate("/", { replace: true });
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!namaPengguna.trim() || !kataLaluan) {
      toast.error("Sila isi nama pengguna dan kata laluan.");
      return;
    }
    setLoading(true);
    const { error } = await signIn(namaPengguna.trim(), kataLaluan);
    setLoading(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Log masuk berjaya!");
    navigate("/", { replace: true });
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center overflow-hidden p-4"
      style={{ background: "#0a0e27" }}
    >
      <AuthBackground orbCount={4} particleCount={20} />

      <div className="relative w-full max-w-5xl mx-auto flex flex-col md:flex-row items-stretch gap-6 md:gap-0">
        {/* ===== KAWASAN PENJENAMAAN (KIRI — DESKTOP SAHAJA) ===== */}
        <div className="hidden md:flex flex-col justify-center pr-8 lg:pr-12 flex-1">
          {/* Version badge */}
          <div
            className="inline-flex items-center gap-2 self-start mb-5 px-3 py-1.5 rounded-full"
            style={{
              background: "rgba(24,119,242,0.15)",
              border: "1px solid rgba(24,119,242,0.3)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "#60a5fa", boxShadow: "0 0 8px #60a5fa" }}
            />
            <span
              className="text-[11px] font-bold uppercase tracking-[0.1em]"
              style={{ color: "#60a5fa" }}
            >
              v4.0
            </span>
          </div>

          {/* Title */}
          <h1 className="text-[42px] font-extrabold text-white leading-[1.1] mb-3">
            Quick
            <span
              style={{
                background: "linear-gradient(135deg, #60a5fa, #a78bfa)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Rx
            </span>
            Record
          </h1>

          <p
            className="text-base mb-6"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            Jabatan Farmasi Hospital Keningau
          </p>

          {/* Divider */}
          <div
            className="w-12 h-[3px] rounded-full mb-6"
            style={{
              background: "linear-gradient(90deg, #1877f2, #7c3aed)",
            }}
          />

          {/* Features list */}
          <ul className="space-y-3">
            {[
              "Pengurusan Stok Ubat",
              "Pembekalan Ubat Pesakit",
              "Rekod Pesakit Digital",
              "Laporan Analitikal",
            ].map((feature) => (
              <li
                key={feature}
                className="flex items-center gap-3"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    background: "linear-gradient(135deg, #60a5fa, #a78bfa)",
                    boxShadow: "0 0 8px rgba(96,165,250,0.5)",
                  }}
                />
                <span
                  className="text-sm font-medium"
                  style={{ color: "rgba(255,255,255,0.6)" }}
                >
                  {feature}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* ===== KAD LOG MASUK (KANAN) ===== */}
        <div
          className="relative w-full md:w-[440px] flex-shrink-0"
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
          {/* Gradient border via pseudo-element */}
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
            }}
          />

          {/* Mobile logo (only on small screens) */}
          <div className="md:hidden flex justify-center mb-4">
            <RxLogo />
          </div>

          <div className="text-center md:text-left mb-6">
            <h2
              className="text-[20px] font-bold text-white mb-1"
              style={{ letterSpacing: "-0.01em" }}
            >
              Selamat Datang
            </h2>
            <p
              className="text-sm"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              Masukkan nama pengguna dan kata laluan anda
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username field */}
            <div className="space-y-1.5">
              <label
                htmlFor="username"
                className="text-[13px] font-semibold flex items-center gap-2"
                style={{ color: "rgba(255,255,255,0.7)" }}
              >
                <User
                  className="w-3.5 h-3.5"
                  style={{
                    color:
                      focusedField === "username" ? "#1877f2" : "#9ca3af",
                  }}
                />
                Nama Pengguna
              </label>
              <input
                id="username"
                type="text"
                value={namaPengguna}
                onChange={(e) => setNamaPengguna(e.target.value)}
                onFocus={() => setFocusedField("username")}
                onBlur={() => setFocusedField(null)}
                placeholder="Masukkan nama pengguna"
                autoComplete="username"
                disabled={loading}
                className="w-full h-12 px-4 text-sm text-white outline-none transition-all disabled:opacity-50"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${
                    focusedField === "username"
                      ? "rgba(24,119,242,0.5)"
                      : "rgba(255,255,255,0.1)"
                  }`,
                  borderRadius: 12,
                  boxShadow:
                    focusedField === "username"
                      ? "0 0 0 3px rgba(24,119,242,0.1), 0 2px 8px rgba(24,119,242,0.08)"
                      : "0 1px 3px rgba(0,0,0,0.04)",
                }}
              />
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-[13px] font-semibold flex items-center gap-2"
                style={{ color: "rgba(255,255,255,0.7)" }}
              >
                <Lock
                  className="w-3.5 h-3.5"
                  style={{
                    color:
                      focusedField === "password" ? "#1877f2" : "#9ca3af",
                  }}
                />
                Kata Laluan
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={kataLaluan}
                  onChange={(e) => setKataLaluan(e.target.value)}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Masukkan kata laluan"
                  autoComplete="current-password"
                  disabled={loading}
                  className="w-full h-12 px-4 pr-12 text-sm text-white outline-none transition-all disabled:opacity-50"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: `1px solid ${
                      focusedField === "password"
                        ? "rgba(24,119,242,0.5)"
                        : "rgba(255,255,255,0.1)"
                    }`,
                    borderRadius: 12,
                    boxShadow:
                      focusedField === "password"
                        ? "0 0 0 3px rgba(24,119,242,0.1), 0 2px 8px rgba(24,119,242,0.08)"
                        : "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center transition-colors"
                  style={{
                    color: showPassword
                      ? "#60a5fa"
                      : "rgba(255,255,255,0.5)",
                  }}
                  aria-label={
                    showPassword ? "Sembunyikan kata laluan" : "Tunjuk kata laluan"
                  }
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <div>
              <button
                type="submit"
                disabled={loading}
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
                    <span>Log Masuk...</span>
                  </>
                ) : (
                  <>
                    <span>Log Masuk</span>
                    <ArrowRight className="w-[18px] h-[18px]" />
                  </>
                )}
              </button>
            </div>

            {/* Forgot password link */}
            <div className="text-center pt-2">
              <Link
                to="/lupa-kata-laluan"
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
                <Lock className="w-3 h-3" />
                <span>Lupa kata laluan?</span>
              </Link>
            </div>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 left-0 right-0 text-center">
        <p
          className="text-xs"
          style={{ color: "rgba(255,255,255,0.25)" }}
        >
          © 2026 QuickRxRecord. Hak cipta terpelihara.
        </p>
      </div>
    </div>
  );
}