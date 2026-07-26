/**
 * PatientRow — Baris pesakit dengan dwi-mod (desktop/mudah alih).
 * Desktop: grid 5 lajur
 * Mudah alih: card dengan avatar, nama, meta, ChevronRight
 */
import { motion } from "framer-motion";
import { ArrowRight, IdCard, FileText, Phone } from "lucide-react";
import { cn, formatMyKad, formatPhone } from "@/lib/utils";
import type { Patient } from "@/types";

interface PatientRowProps {
  patient: Patient & { bilangan_item?: number };
  index: number;
  onClick: () => void;
}

export function PatientRow({ patient, index, onClick }: PatientRowProps) {
  return (
    <>
      {/* Desktop: grid row */}
      <motion.div
        initial={{ opacity: 0, y: -3 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.008, duration: 0.1 }}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        className="hidden sm:grid px-4 py-2.5 items-center cursor-pointer transition-colors"
        style={{
          gridTemplateColumns: "3fr 3fr 3fr 2fr 2fr",
          gap: 12,
          borderBottom: "1px solid #f0f2f5",
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLElement).style.background =
            "rgba(24,119,242,0.03)")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLElement).style.background = "transparent")
        }
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-[10px] flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #1877f2, #0d5bd4)",
            }}
          >
            {patient.nama?.[0]?.toUpperCase() || "?"}
          </div>
          <span
            className="text-[13px] font-medium truncate"
            style={{ color: "#1c1e21" }}
          >
            {patient.nama}
          </span>
        </div>
        <span
          className="text-[13px] truncate"
          style={{ color: "#1c1e21" }}
        >
          {patient.nombor_kad_pengenalan ? (
            formatMyKad(patient.nombor_kad_pengenalan)
          ) : (
            <em style={{ color: "#9ca3af" }}>-</em>
          )}
        </span>
        <span
          className="text-[13px] truncate"
          style={{ color: "#1c1e21" }}
        >
          {patient.nombor_pendaftaran_hospital || (
            <em style={{ color: "#9ca3af" }}>-</em>
          )}
        </span>
        <span
          className="text-[13px] truncate"
          style={{ color: "#1c1e21" }}
        >
          {patient.dokumen_lain || (
            <em style={{ color: "#9ca3af" }}>-</em>
          )}
        </span>
        <span
          className="text-[13px] font-medium tabular-nums"
          style={{ color: "#1c1e21" }}
        >
          {patient.bilangan_item ?? 0}
        </span>
      </motion.div>

      {/* Mobile: card row */}
      <motion.div
        initial={{ opacity: 0, y: -3 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.008, duration: 0.1 }}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        className={cn(
          "sm:hidden",
          "flex items-center gap-3 px-4 py-3 cursor-pointer",
          "border-b border-[#f0f2f5] transition-colors"
        )}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLElement).style.background =
            "rgba(24,119,242,0.03)")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLElement).style.background = "transparent")
        }
      >
        <div
          className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, #1877f2, #0d5bd4)",
          }}
        >
          {patient.nama?.[0]?.toUpperCase() || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-[14px] font-medium truncate"
            style={{ color: "#1c1e21" }}
          >
            {patient.nama}
          </p>
          <div
            className="flex items-center gap-2 text-[12px] truncate"
            style={{ color: "#65676b" }}
          >
            {patient.nombor_kad_pengenalan && (
              <span className="flex items-center gap-0.5">
                <IdCard className="w-3 h-3" />
                {formatMyKad(patient.nombor_kad_pengenalan)}
              </span>
            )}
            {patient.nombor_telefon && (
              <span className="flex items-center gap-0.5">
                <Phone className="w-3 h-3" />
                {formatPhone(patient.nombor_telefon)}
              </span>
            )}
          </div>
        </div>
        <ArrowRight
          className="w-4 h-4 flex-shrink-0"
          style={{ color: "#9ca3af" }}
        />
      </motion.div>
    </>
  );
}
