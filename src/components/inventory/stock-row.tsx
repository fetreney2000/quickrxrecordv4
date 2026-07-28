/**
 * StockRow — Baris item inventori dengan dwi-mod (desktop/mudah alih).
 */
import { ArrowRight } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import type { Item } from "@/types";

interface StockRowProps {
  item: Item & {
    item_batches: { kuantiti: number }[];
    item_forms: { id: string; nama: string } | null;
  };
  index: number;
  onClick: () => void;
}

function computeStock(item: StockRowProps["item"]): number {
  return (item.item_batches ?? []).reduce(
    (sum, b) => sum + (b.kuantiti || 0),
    0
  );
}

export function StockRow({ item, index, onClick }: StockRowProps) {
  const stock = computeStock(item);
  const displayName = [item.nama_item, item.kekuatan].filter(Boolean).join(" ");

  return (
    <>
      {/* Desktop: grid row */}
      <div
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
          "hidden sm:grid stok-row px-4 py-2.5 items-center cursor-pointer transition-colors",
          "hover:bg-[rgba(124,58,237,0.03)]"
        )}
        style={{
          gridTemplateColumns: "1.2fr 3fr 1fr 1fr 1fr",
          gap: 12,
          borderBottom: "1px solid var(--border-light)",
        }}
      >
        <span className="text-[13px] font-mono font-semibold truncate" style={{ color: "#7c3aed" }}>{item.kod_item}</span>
        <div className="min-w-0">
          <p className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {displayName || item.nama_item}
            {item.item_forms?.nama ? <span style={{ color: "var(--text-secondary)" }}> · {item.item_forms.nama}</span> : null}
          </p>
          {item.nama_dagangan && <p className="text-[11px] truncate mt-0.5" style={{ color: "var(--text-muted)" }}>{item.nama_dagangan}</p>}
        </div>
        <span className="text-[13px] font-medium tabular-nums" style={{ color: "var(--text-primary)" }}>
          {item.kuota != null ? formatNumber(item.kuota) : <em style={{ color: "var(--text-muted)" }}>-</em>}
        </span>
        <div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold"
            style={stock > 0 ? { background: "rgba(22,163,74,0.10)", color: "#16a34a", border: "1px solid rgba(22,163,74,0.25)" } : { background: "rgba(228,30,63,0.10)", color: "#e41e3f", border: "1px solid rgba(228,30,63,0.25)" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: stock > 0 ? "#16a34a" : "#e41e3f" }} />
            {formatNumber(stock)}
          </span>
        </div>
        <span className="text-[13px] font-medium tabular-nums" style={{ color: "var(--text-primary)" }}>
          {item.kuota != null ? formatNumber(Math.max(0, item.kuota - stock)) : <em style={{ color: "var(--text-muted)" }}>-</em>}
        </span>
      </div>

      {/* Mobile: card row */}
      <div
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        className={cn("sm:hidden", "flex items-center gap-3 px-4 py-3 cursor-pointer", "border-b border-[#f0f2f5] transition-colors")}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(124,58,237,0.03)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
      >
        <div className="w-10 h-10 rounded-[10px] flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}>
          <span className="font-mono" style={{ fontSize: 10 }}>{item.kod_item.slice(0, 3).toUpperCase()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium truncate" style={{ color: "var(--text-primary)" }}>{displayName || item.nama_item}</p>
          <div className="flex items-center gap-2 text-[12px] mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>
            <span className="font-mono font-semibold" style={{ color: "#7c3aed" }}>{item.kod_item}</span>
            {item.nama_dagangan && <span>· {item.nama_dagangan}</span>}
          </div>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold flex-shrink-0"
          style={stock > 0 ? { background: "rgba(22,163,74,0.10)", color: "#16a34a", border: "1px solid rgba(22,163,74,0.25)" } : { background: "rgba(228,30,63,0.10)", color: "#e41e3f", border: "1px solid rgba(228,30,63,0.25)" }}>
          {formatNumber(stock)}
        </span>
        <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
      </div>
    </>
  );
}