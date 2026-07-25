/**
 * StatCard — Kad statistik premium untuk Papan Pemuka.
 *
 * Ciri-ciri:
 *  - Latar kecerunan (mengikut jenis)
 *  - 2 bulatan hiasan (diagonal)
 *  - Cahaya glow (visible pada hover)
 *  - Tajuk + nilai animasi + sarikata
 *  - Ikon dengan animasi spring
 *  - Hover: angkat + zoom
 *  - Navigasi ke URL tertentu (pilihan)
 */
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { AnimatedNumber } from "./animated-number";

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle: string;
  icon: LucideIcon;
  /** Kecerunan — 2 warna hex */
  gradient: [string, string];
  /** Lengah animasi kemasukan */
  delay?: number;
  /** URL navigasi (jika klik) */
  href?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient,
  delay = 0,
  href,
}: StatCardProps) {
  const [from, to] = gradient;
  const isNumeric = typeof value === "number";

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay,
        type: "spring",
        damping: 25,
        stiffness: 200,
      }}
      whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.15 } }}
      className="relative overflow-hidden text-white p-5 transition-shadow hover:shadow-2xl cursor-pointer"
      style={{
        background: `linear-gradient(135deg, ${from}, ${to})`,
        borderRadius: 16,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      {/* Decorative circles */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 100,
          height: 100,
          top: -20,
          right: -20,
          background: "rgba(255,255,255,0.10)",
        }}
      />
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 80,
          height: 80,
          bottom: -30,
          left: -15,
          background: "rgba(255,255,255,0.06)",
        }}
      />

      {/* Icon */}
      <motion.div
        initial={{ scale: 0, rotate: -90 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{
          delay: delay + 0.1,
          type: "spring",
          damping: 18,
        }}
        className="absolute top-5 right-5 flex items-center justify-center"
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: "rgba(255,255,255,0.18)",
        }}
      >
        <Icon className="w-5 h-5 text-white" strokeWidth={2.2} />
      </motion.div>

      {/* Title */}
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-2 relative z-10"
        style={{ color: "rgba(255,255,255,0.7)" }}
      >
        {title}
      </p>

      {/* Value */}
      <p
        className="relative z-10 mb-1.5"
        style={{
          fontSize: 30,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "white",
        }}
      >
        {isNumeric ? (
          <AnimatedNumber value={value as number} />
        ) : (
          value
        )}
      </p>

      {/* Subtitle */}
      <p
        className="text-[10px] relative z-10"
        style={{ color: "rgba(255,255,255,0.5)" }}
      >
        {subtitle}
      </p>
    </motion.div>
  );

  if (href) {
    return (
      <Link to={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
