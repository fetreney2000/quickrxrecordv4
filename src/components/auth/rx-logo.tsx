import { motion } from "framer-motion";

interface RxLogoProps {
  size?: number;
  /** Saiz kontena (px) — lalai 72 */
  containerSize?: number;
}

/**
 * RxLogo — Ikon tersuai yang memaparkan simbol preskripsi "Rx"
 * dengan palang perubatan. Digunakan pada halaman log masuk.
 */
export function RxLogo({ size = 36, containerSize = 72 }: RxLogoProps) {
  return (
    <motion.div
      className="relative inline-flex items-center justify-center"
      style={{
        width: containerSize,
        height: containerSize,
        borderRadius: 18,
        background: "linear-gradient(135deg, #1877f2 0%, #0d5bd4 100%)",
        boxShadow:
          "0 10px 30px rgba(24,119,242,0.4), 0 0 0 1px rgba(255,255,255,0.1) inset",
      }}
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      {/* Glow pulse */}
      <motion.div
        className="absolute rounded-full"
        style={{
          inset: -8,
          background: "rgba(24,119,242,0.4)",
          filter: "blur(12px)",
        }}
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.4, 0.7, 0.4],
        }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* SVG Rx icon with medical cross */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: "relative", zIndex: 1 }}
      >
        {/* Background cross (medical) */}
        <rect x="14" y="6" width="8" height="24" rx="1.5" fill="white" opacity="0.25" />
        <rect x="6" y="14" width="24" height="8" rx="1.5" fill="white" opacity="0.25" />

        {/* Rx text */}
        <text
          x="18"
          y="24"
          textAnchor="middle"
          fontFamily="Inter, sans-serif"
          fontSize="14"
          fontWeight="800"
          fill="white"
          letterSpacing="-0.5"
        >
          Rx
        </text>
      </svg>
    </motion.div>
  );
}
