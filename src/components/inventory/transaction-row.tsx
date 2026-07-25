/**
 * TransactionRow — Baris sejarah transaksi item inventori.
 *
 * Ciri:
 *  - Lajur: Tarikh, Jenis, Kelompok, Perubahan, Keterangan, Kakitangan, Pesakit
 *  - Perubahan: Badge hijau (+N) atau merah (-N)
 *  - Jenis: "Bekalan" (biru) atau "Penambahan/Pelarasan" (ungu)
 */
import { motion } from "framer-motion";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import type { CombinedTransaction } from "@/hooks/use-inventory";

interface TransactionRowProps {
  tx: CombinedTransaction;
  index: number;
}

export function TransactionRow({ tx, index }: TransactionRowProps) {
  const isUp = tx.perubahan > 0;
  const isDown = tx.perubahan < 0;

  return (
    <>
      {/* Desktop row */}
      <motion.div
        initial={{ opacity: 0, y: -3 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.005, duration: 0.1 }}
        className="hidden lg:grid px-4 py-2.5 items-center"
        style={{
          gridTemplateColumns: "1.5fr 1.3fr 1.3fr 1fr 1.8fr 1.3fr 1.3fr",
          gap: 12,
          borderBottom: "1px solid #f0f2f5",
        }}
      >
        <span className="text-[12px]" style={{ color: "#1c1e21" }}>
          {formatDateTime(tx.tarikh)}
        </span>
        <div>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold"
            style={
              tx.jenis === "bekalan"
                ? {
                    background: "rgba(24,119,242,0.10)",
                    color: "#1877f2",
                    border: "1px solid rgba(24,119,242,0.25)",
                  }
                : isUp
                  ? {
                      background: "rgba(22,163,74,0.10)",
                      color: "#16a34a",
                      border: "1px solid rgba(22,163,74,0.25)",
                    }
                  : {
                      background: "rgba(217,119,6,0.10)",
                      color: "#d97706",
                      border: "1px solid rgba(217,119,6,0.25)",
                    }
            }
          >
            {tx.jenis_label}
          </span>
        </div>
        <span
          className="text-[12px] font-mono truncate"
          style={{ color: "#7c3aed" }}
        >
          {tx.kelompok}
        </span>
        <div>
          {isUp ? (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold"
              style={{
                background: "rgba(22,163,74,0.10)",
                color: "#16a34a",
                border: "1px solid rgba(22,163,74,0.25)",
              }}
            >
              <ArrowUp className="w-3 h-3" />
              {tx.perubahan_label}
            </span>
          ) : isDown ? (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold"
              style={{
                background: "rgba(228,30,63,0.10)",
                color: "#e41e3f",
                border: "1px solid rgba(228,30,63,0.25)",
              }}
            >
              <ArrowDown className="w-3 h-3" />
              {tx.perubahan_label}
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold"
              style={{
                background: "rgba(107,114,128,0.10)",
                color: "#6b7280",
                border: "1px solid rgba(107,114,128,0.25)",
              }}
            >
              <Minus className="w-3 h-3" />0
            </span>
          )}
        </div>
        <span
          className="text-[12px] truncate italic"
          style={{ color: "#65676b" }}
          title={tx.catatan ?? ""}
        >
          {tx.catatan || (
            <em style={{ color: "#9ca3af" }}>-</em>
          )}
        </span>
        <span className="text-[12px] truncate" style={{ color: "#1c1e21" }}>
          {tx.kakitangan || (
            <em style={{ color: "#9ca3af" }}>-</em>
          )}
        </span>
        <span className="text-[12px] truncate" style={{ color: "#1c1e21" }}>
          {tx.pesakit || (
            <em style={{ color: "#9ca3af" }}>-</em>
          )}
        </span>
      </motion.div>

      {/* Medium screen row (tablet) */}
      <motion.div
        initial={{ opacity: 0, y: -3 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.005, duration: 0.1 }}
        className="hidden sm:grid lg:hidden px-4 py-2.5 items-center"
        style={{
          gridTemplateColumns: "1.3fr 1fr 1fr 1.5fr 1.2fr",
          gap: 8,
          borderBottom: "1px solid #f0f2f5",
        }}
      >
        <div>
          <span className="text-[11px] block" style={{ color: "#1c1e21" }}>
            {formatDateTime(tx.tarikh)}
          </span>
          <span
            className="text-2xs"
            style={{ color: "#9ca3af" }}
          >
            {tx.kakitangan || "-"}
          </span>
        </div>
        <div>
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-2xs font-semibold"
            style={
              tx.jenis === "bekalan"
                ? {
                    background: "rgba(24,119,242,0.10)",
                    color: "#1877f2",
                    border: "1px solid rgba(24,119,242,0.25)",
                  }
                : {
                    background: "rgba(124,58,237,0.10)",
                    color: "#7c3aed",
                    border: "1px solid rgba(124,58,237,0.25)",
                  }
            }
          >
            {tx.jenis_label}
          </span>
        </div>
        <span
          className="text-[11px] font-mono truncate"
          style={{ color: "#7c3aed" }}
        >
          {tx.kelompok}
        </span>
        <div>
          {isUp ? (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-2xs font-semibold"
              style={{
                background: "rgba(22,163,74,0.10)",
                color: "#16a34a",
                border: "1px solid rgba(22,163,74,0.25)",
              }}
            >
              <ArrowUp className="w-2.5 h-2.5" />
              {tx.perubahan_label}
            </span>
          ) : isDown ? (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-2xs font-semibold"
              style={{
                background: "rgba(228,30,63,0.10)",
                color: "#e41e3f",
                border: "1px solid rgba(228,30,63,0.25)",
              }}
            >
              <ArrowDown className="w-2.5 h-2.5" />
              {tx.perubahan_label}
            </span>
          ) : null}
          <span
            className="text-2xs block mt-0.5 italic truncate"
            style={{ color: "#9ca3af" }}
            title={tx.catatan ?? ""}
          >
            {tx.catatan || ""}
          </span>
        </div>
        <span
          className="text-[11px] truncate"
          style={{ color: "#1c1e21" }}
          title={tx.pesakit ?? ""}
        >
          {tx.pesakit || (
            <em style={{ color: "#9ca3af" }}>-</em>
          )}
        </span>
      </motion.div>

      {/* Mobile row */}
      <motion.div
        initial={{ opacity: 0, y: -3 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.005, duration: 0.1 }}
        className="sm:hidden flex items-start gap-3 px-4 py-3 border-b border-[#f0f2f5]"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-2xs font-semibold"
              style={{ color: "#65676b" }}
            >
              {formatDateTime(tx.tarikh)}
            </span>
            {isUp ? (
              <span
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-2xs font-semibold"
                style={{
                  background: "rgba(22,163,74,0.10)",
                  color: "#16a34a",
                  border: "1px solid rgba(22,163,74,0.25)",
                }}
              >
                <ArrowUp className="w-2.5 h-2.5" />
                {tx.perubahan_label}
              </span>
            ) : isDown ? (
              <span
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-2xs font-semibold"
                style={{
                  background: "rgba(228,30,63,0.10)",
                  color: "#e41e3f",
                  border: "1px solid rgba(228,30,63,0.25)",
                }}
              >
                <ArrowDown className="w-2.5 h-2.5" />
                {tx.perubahan_label}
              </span>
            ) : null}
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-2xs font-semibold"
              style={
                tx.jenis === "bekalan"
                  ? {
                      background: "rgba(24,119,242,0.10)",
                      color: "#1877f2",
                      border: "1px solid rgba(24,119,242,0.25)",
                    }
                  : {
                      background: "rgba(124,58,237,0.10)",
                      color: "#7c3aed",
                      border: "1px solid rgba(124,58,237,0.25)",
                    }
              }
            >
              {tx.jenis_label}
            </span>
          </div>
          {tx.catatan && (
            <p
              className="text-2xs italic mt-0.5 truncate"
              style={{ color: "#9ca3af" }}
              title={tx.catatan}
            >
              {tx.catatan}
            </p>
          )}
          <div
            className="flex items-center gap-2 text-2xs mt-1"
            style={{ color: "#65676b" }}
          >
            {tx.pesakit && <span>Pesakit: {tx.pesakit}</span>}
            {tx.kakitangan && <span>· {tx.kakitangan}</span>}
          </div>
        </div>
      </motion.div>
    </>
  );
}
