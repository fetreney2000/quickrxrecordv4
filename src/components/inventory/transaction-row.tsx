/**
 * TransactionRow — Baris sejarah transaksi item inventori.
 */
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import type { CombinedTransaction } from "@/hooks/use-inventory";

interface TransactionRowProps {
  tx: CombinedTransaction;
  index: number;
  baki: number;
}

export function TransactionRow({ tx, index, baki }: TransactionRowProps) {
  const isUp = tx.perubahan > 0;
  const isDown = tx.perubahan < 0;

  return (
    <>
      {/* Desktop row */}
      <div
        className="hidden lg:grid px-4 py-2.5 items-center transition-colors hover:bg-[rgba(0,0,0,0.02)]"
        style={{
          gridTemplateColumns: "1.5fr 1.3fr 1.3fr 1fr 1fr 1.8fr 1.3fr 1.3fr",
          gap: 12,
          borderBottom: "1px solid var(--border-light)",
        }}
      >
        <span className="text-[13px]" style={{ color: "var(--text-primary)" }}>
          {formatDateTime(tx.tarikh)}
        </span>
        <span className="text-[13px]" style={{ color: "var(--text-primary)" }}>
          {tx.jenis_label}
        </span>
        <span className="text-[13px] font-mono" style={{ color: "#7c3aed" }}>
          {tx.kelompok || <em style={{ color: "var(--text-muted)" }}>-</em>}
        </span>
        <div className="flex items-center gap-1.5">
          {isUp ? (
            <ArrowUp className="w-3.5 h-3.5" style={{ color: "#16a34a" }} />
          ) : isDown ? (
            <ArrowDown className="w-3.5 h-3.5" style={{ color: "#e41e3f" }} />
          ) : (
            <Minus className="w-3.5 h-3.5" style={{ color: "#6b7280" }} />
          )}
          <span
            className="text-[13px] font-semibold tabular-nums"
            style={{
              color: isUp ? "#16a34a" : isDown ? "#e41e3f" : "#6b7280",
            }}
          >
            {tx.perubahan_label}
          </span>
        </div>
        <span className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
          {baki}
        </span>
        <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {tx.catatan || <em style={{ color: "var(--text-muted)" }}>-</em>}
        </span>
        <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {tx.kakitangan || <em style={{ color: "var(--text-muted)" }}>-</em>}
        </span>
        <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {tx.pesakit || <em style={{ color: "var(--text-muted)" }}>-</em>}
        </span>
      </div>

      {/* Medium screen row (tablet) */}
      <div
        className="hidden sm:grid lg:hidden px-4 py-2.5 items-center"
        style={{
          gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr",
          gap: 12,
          borderBottom: "1px solid var(--border-light)",
        }}
      >
        <span className="text-[13px]" style={{ color: "var(--text-primary)" }}>
          {formatDateTime(tx.tarikh)}
        </span>
        <div className="flex items-center gap-1.5">
          {isUp ? (
            <ArrowUp className="w-3.5 h-3.5" style={{ color: "#16a34a" }} />
          ) : isDown ? (
            <ArrowDown className="w-3.5 h-3.5" style={{ color: "#e41e3f" }} />
          ) : (
            <Minus className="w-3.5 h-3.5" style={{ color: "#6b7280" }} />
          )}
          <span
            className="text-[13px] font-semibold tabular-nums"
            style={{
              color: isUp ? "#16a34a" : isDown ? "#e41e3f" : "#6b7280",
            }}
          >
            {tx.perubahan_label}
          </span>
        </div>
        <span className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
          {baki}
        </span>
        <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {tx.jenis_label}
        </span>
        <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {tx.kakitangan || <em style={{ color: "var(--text-muted)" }}>-</em>}
        </span>
      </div>

      {/* Mobile row */}
      <div
        className="sm:hidden flex items-start gap-3 px-4 py-3"
        style={{ borderBottom: "1px solid var(--border-light)" }}
      >
        <div
          className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0"
          style={{
            background: isUp
              ? "rgba(22,163,74,0.10)"
              : isDown
              ? "rgba(228,30,63,0.10)"
              : "rgba(107,114,128,0.10)",
            color: isUp ? "#16a34a" : isDown ? "#e41e3f" : "#6b7280",
          }}
        >
          {isUp ? (
            <ArrowUp className="w-4 h-4" />
          ) : isDown ? (
            <ArrowDown className="w-4 h-4" />
          ) : (
            <Minus className="w-4 h-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {formatDateTime(tx.tarikh)}
          </p>
          <div className="flex items-center gap-2 text-[12px] mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>
            <span>{tx.jenis_label}</span>
            <span>·</span>
            <span className="font-semibold" style={{ color: isUp ? "#16a34a" : isDown ? "#e41e3f" : "#6b7280" }}>
              {tx.perubahan_label}
            </span>
            <span>·</span>
            <span className="font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
              Baki: {baki}
            </span>
          </div>
          {tx.catatan && (
            <p className="text-[12px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
              {tx.catatan}
            </p>
          )}
        </div>
      </div>
    </>
  );
}