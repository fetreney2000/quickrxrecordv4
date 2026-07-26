/**
 * AuthBackground — Latar belakang animasi premium untuk halaman
 * Log Masuk dan Lupa Kata Laluan.
 *
 * Mengandungi:
 *  - 3 atau 4 orbs animasi (Framer Motion)
 *  - 16 atau 20 zarah terapung (CSS @keyframes)
 *  - Corak grid 60×60px
 *  - Mesh overlay dengan 3 kecerunan radial
 *  - Kecerunan latar animasi 15s
 */
import { motion } from "framer-motion";
import { useMemo } from "react";

interface AuthBackgroundProps {
  /** Bilangan orbs (3 untuk lupa kata laluan, 4 untuk log masuk) */
  orbCount?: 3 | 4;
  /** Bilangan zarah terapung (16 untuk lupa, 20 untuk log masuk) */
  particleCount?: number;
}

interface OrbConfig {
  size: number;
  color: string;
  position: { top?: string; left?: string; right?: string; bottom?: string };
  duration: number;
  xRange: number;
  yRange: number;
  scaleRange: number;
  blur: number;
  delay: number;
}

const ORB_CONFIGS: OrbConfig[] = [
  {
    size: 500,
    color: "rgba(24,119,242,0.20)",
    position: { top: "-10%", left: "-5%" },
    duration: 20,
    xRange: 80,
    yRange: 60,
    scaleRange: 0.1,
    blur: 60,
    delay: 0,
  },
  {
    size: 450,
    color: "rgba(124,58,237,0.18)",
    position: { top: "20%", right: "-5%" },
    duration: 25,
    xRange: 60,
    yRange: 50,
    scaleRange: 0.15,
    blur: 60,
    delay: 1,
  },
  {
    size: 350,
    color: "rgba(6,182,212,0.15)",
    position: { bottom: "-5%", left: "30%" },
    duration: 18,
    xRange: 60,
    yRange: 60,
    scaleRange: 0.2,
    blur: 50,
    delay: 2,
  },
  {
    size: 280,
    color: "rgba(245,158,11,0.10)",
    position: { top: "20%", right: "20%" },
    duration: 15,
    xRange: 40,
    yRange: 50,
    scaleRange: 0.1,
    blur: 50,
    delay: 0.5,
  },
];

export function AuthBackground({
  orbCount = 4,
  particleCount = 20,
}: AuthBackgroundProps) {
  const orbs = useMemo(
    () => ORB_CONFIGS.slice(0, orbCount),
    [orbCount]
  );

  const particles = useMemo(
    () =>
      Array.from({ length: particleCount }, (_, i) => ({
        id: i,
        size: [3, 5, 7, 9][i % 4],
        left: (i * 5.3) % 100,
        top: (i * 7.7) % 100,
        duration: 8 + (i % 15),
        delay: (i * 0.3) % 5,
        opacity: 0.15 + ((i * 0.05) % 0.2),
        xRange: 10 + (i % 3) * 5,
        yRange: 15 + (i % 5) * 2,
      })),
    [particleCount]
  );

  return (
    <>
      <style>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @-webkit-keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes floatParticle {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(var(--x-range, 10px), var(--y-range, -25px)); }
        }
        @-webkit-keyframes floatParticle {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(var(--x-range, 10px), var(--y-range, -25px)); }
        }
        .auth-bg-gradient {
          background: linear-gradient(135deg, #0a0e27 0%, #1a1145 25%, #0d1b3e 50%, #0a1628 75%, #0a0e27 100%);
          background-size: 400% 400%;
          animation: gradientShift 15s ease infinite;
          -webkit-animation: gradientShift 15s ease infinite;
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
        .auth-particle {
          position: absolute;
          background: white;
          border-radius: 50%;
          pointer-events: none;
        }
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @-webkit-keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
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

      {/* Orbs */}
      {orbs.map((orb, idx) => (
        <motion.div
          key={idx}
          className="fixed rounded-full pointer-events-none"
          style={{
            width: orb.size,
            height: orb.size,
            top: orb.position.top,
            left: orb.position.left,
            right: orb.position.right,
            bottom: orb.position.bottom,
            background: `radial-gradient(circle, ${orb.color}, transparent 70%)`,
            filter: `blur(${orb.blur}px)`,
            zIndex: -7,
          }}
          animate={{
            x: [0, orb.xRange, -orb.xRange / 2, 0],
            y: [0, -orb.yRange, orb.yRange / 2, 0],
            scale: [1, 1 + orb.scaleRange, 1 - orb.scaleRange / 2, 1],
          }}
          transition={{
            duration: orb.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: orb.delay,
          }}
        />
      ))}

      {/* Floating particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="auth-particle"
          style={
            {
              width: p.size,
              height: p.size,
              left: `${p.left}%`,
              top: `${p.top}%`,
              opacity: p.opacity,
              animation: `floatParticle ${p.duration}s ease-in-out infinite`,
              WebkitAnimation: `floatParticle ${p.duration}s ease-in-out infinite`,
              animationDelay: `${p.delay}s`,
              // CSS vars for keyframes
              ["--x-range" as any]: `${p.xRange}px`,
              ["--y-range" as any]: `-${p.yRange}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </>
  );
}
