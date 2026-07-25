import { motion } from "framer-motion";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface SuccessStateProps {
  title?: string;
  description?: string;
  buttonLabel?: string;
  buttonHref?: string;
}

/**
 * SuccessState — Skrin penuh kejayaan dengan bar aksen hijau,
 * ikon CheckCircle2 dengan animasi spring, dan butang kembali.
 */
export function SuccessState({
  title = "Permintaan Dihantar",
  description = "Permintaan reset kata laluan anda telah dihantar kepada pentadbir. Anda akan dimaklumkan apabila kata laluan anda telah ditetapkan semula.",
  buttonLabel = "Kembali ke Log Masuk",
  buttonHref = "/login",
}: SuccessStateProps) {
  const navigate = useNavigate();

  return (
    <div className="relative w-full max-w-[440px] mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative"
        style={{
          background: "rgba(255,255,255,0.07)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 20,
          padding: 40,
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
              "linear-gradient(135deg, rgba(34,197,94,0.4), rgba(6,182,212,0.3), rgba(34,197,94,0.4))",
            WebkitMask:
              "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />

        {/* Green accent bar */}
        <div
          className="absolute top-0 left-8 right-8 h-[3px] rounded-full"
          style={{
            background:
              "linear-gradient(90deg, #22c55e, #06b6d4, #22c55e)",
            backgroundSize: "200% 100%",
            animation: "gradient-x 4s linear infinite",
          }}
        />

        <div className="text-center">
          {/* Success icon with glow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: 0.01,
              type: "spring",
              stiffness: 200,
              damping: 15,
            }}
            className="relative inline-flex items-center justify-center mb-6"
          >
            <motion.div
              className="absolute rounded-full"
              style={{
                inset: -12,
                background: "rgba(34,197,94,0.3)",
                filter: "blur(20px)",
              }}
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <div
              className="relative w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                boxShadow:
                  "0 10px 30px rgba(34,197,94,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
              }}
            >
              <CheckCircle2
                className="w-10 h-10 text-white"
                strokeWidth={2.5}
              />
            </div>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.02, duration: 0.4 }}
            className="text-[20px] font-bold text-white mb-2"
          >
            {title}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="text-sm mb-6"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            {description}
          </motion.p>

          <motion.button
            type="button"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.4 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(buttonHref)}
            className="w-full h-[50px] flex items-center justify-center gap-2 text-[15px] font-bold text-white transition-all"
            style={{
              background: "linear-gradient(135deg, #22c55e, #16a34a)",
              borderRadius: 12,
              boxShadow:
                "0 8px 24px rgba(34,197,94,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
              letterSpacing: "0.02em",
            }}
          >
            <ArrowLeft className="w-[18px] h-[18px]" />
            {buttonLabel}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
