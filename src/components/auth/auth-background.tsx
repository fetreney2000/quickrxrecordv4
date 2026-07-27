/**
 * AuthBackground — Latar belakang statik untuk halaman
 * Log Masuk dan Lupa Kata Laluan.
 *
 * Mengandungi:
 *  - Corak grid 60×60px
 *  - Mesh overlay dengan 3 kecerunan radial
 *  - Kecerunan latar
 */
interface AuthBackgroundProps {
  /** Bilangan orbs (tidak digunakan lagi — dikekalkan untuk keserasian) */
  orbCount?: 3 | 4;
  /** Bilangan zarah terapung (tidak digunakan lagi — dikekalkan untuk keserasian) */
  particleCount?: number;
}

export function AuthBackground({
  orbCount: _orbCount = 4,
  particleCount: _particleCount = 20,
}: AuthBackgroundProps) {
  return (
    <>
      <style>{`
        .auth-bg-gradient {
          background: linear-gradient(135deg, #0a0e27 0%, #1a1145 25%, #0d1b3e 50%, #0a1628 75%, #0a0e27 100%);
          background-size: 400% 400%;
        }
        .auth-mesh-overlay {
          background:
            radial-gradient(ellipse 800px 600px at 20% 30%, rgba(24,119,242,0.08), transparent 60%),
            radial-gradient(ellipse 700px 500px at 80% 70%, rgba(124,58,237,0.06), transparent 60%),
            radial-gradient(ellipse 600px 400px at 50% 50%, rgba(6,182,212,0.05), transparent 60%);
        }
        .auth-grid-pattern {
          background-image:
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 60px 60px;
        }
      `}</style>

      <div
        className="fixed inset-0 -z-10 auth-bg-gradient"
        style={{ zIndex: -10 }}
      />
      <div
        className="fixed inset-0 -z-10 auth-mesh-overlay"
        style={{ zIndex: -9 }}
      />
      <div
        className="fixed inset-0 -z-10 auth-grid-pattern"
        style={{ zIndex: -8 }}
      />
    </>
  );
}