/**
 * BatchRow — Baris kelompok dengan dwi-mod (desktop/mudah alih).
 *
 * Ciri:
 *  - Edit kuantiti sebaris (ikon Edit → input + butang ✓/✕)
 *  - Ikon Trash2 untuk pelupusan
 *  - Status kelompok: Aktif (hijau) / Luput (merah) / Hampir Luput (amber)
 *  - Indikator kuantiti rendah
 */
import { useState, useEffect, useRef } from "react";
import { Check, X as XIcon, Edit, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import type { ItemBatch } from "@/types";

interface BatchRowProps {
  batch: ItemBatch;
  index: number;
  canEdit: boolean;
  onConfirmAdjust: (batch: ItemBatch, newKuantiti: number) => void;
  onDispose: (batch: ItemBatch) => void;
}

function getStatus(batch: ItemBatch): {
  label: string;
  bg: string;
  fg: string;
  border: string;
  isExpired: boolean;
} {
  const now = new Date();
  const exp = new Date(batch.tarikh_luput);
  const daysToExpiry = Math.floor(
    (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysToExpiry < 0) {
    return {
      label: "Luput",
      bg: "rgba(228,30,63,0.10)",
      fg: "#e41e3f",
      border: "rgba(228,30,63,0.25)",
      isExpired: true,
    };
  }
  if (daysToExpiry <= 90) {
    return {
      label: `${daysToExpiry} hari`,
      bg: "rgba(217,119,6,0.10)",
      fg: "#d97706",
      border: "rgba(217,119,6,0.25)",
      isExpired: false,
    };
  }
  if (batch.kuantiti === 0) {
    return {
      label: "Kosong",
      bg: "rgba(107,114,128,0.10)",
      fg: "#6b7280",
      border: "rgba(107,114,128,0.25)",
      isExpired: false,
    };
  }
  return {
    label: "Aktif",
    bg: "rgba(22,163,74,0.10)",
    fg: "#16a34a",
    border: "rgba(22,163,74,0.25)",
    isExpired: false,
  };
}

export function BatchRow({
  batch,
  index,
  canEdit,
  onConfirmAdjust,
  onDispose,
}: BatchRowProps) {
  const [editing, setEditing] = useState(false);
  const [draftQty, setDraftQty] = useState(String(batch.kuantiti));
  const inputRef = useRef<HTMLInputElement>(null);
  const status = getStatus(batch);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // Reset draft when not editing
  useEffect(() => {
    if (!editing) {
      setDraftQty(String(batch.kuantiti));
    }
  }, [batch.kuantiti, editing]);

  const startEdit = () => {
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraftQty(String(batch.kuantiti));
  };

  const handleSubmit = () => {
    setEditing(false);
    const qty = parseInt(draftQty, 10);
    if (isNaN(qty) || qty < 0) {
      setDraftQty(String(batch.kuantiti));
      return;
    }
    if (qty === batch.kuantiti) {
      // No change — parent page will show toast
      return;
    }
    onConfirmAdjust(batch, qty);
  };

  return (
    <>
      {/* Desktop row */}
      <div
        className="hidden sm:grid px-4 py-2.5 items-center"
        style={{
          gridTemplateColumns: "2fr 1.5fr 1.2fr 1.2fr 1fr",
          gap: 12,
          borderBottom: "1px solid var(--border-light)",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Package2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#7c3aed" }} />
          <span
            className="font-mono font-semibold text-[13px] truncate"
            style={{ color: "#7c3aed" }}
          >
            {batch.nombor_kelompok}
          </span>
        </div>
        <span className="text-[13px]" style={{ color: "var(--text-primary)" }}>
          {formatDate(batch.tarikh_luput)}
        </span>
        <div>
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                ref={inputRef}
                type="number"
                min={0}
                value={draftQty}
                onChange={(e) => setDraftQty(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmit();
                  if (e.key === "Escape") cancelEdit();
                }}
                className="w-20 h-7 text-xs font-semibold px-2 rounded-lg outline-none"
                style={{
                  border: "1px solid #7c3aed",
                  boxShadow: "0 0 0 3px rgba(124,58,237,0.15)",
                  color: "var(--text-primary)",
                  background: "var(--card)",
                }}
              />
              <button
                onClick={handleSubmit}
                className="w-6 h-6 flex items-center justify-center rounded-md"
                style={{ background: "#16a34a", color: "white" }}
                aria-label="Sahkan"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                onClick={cancelEdit}
                className="w-6 h-6 flex items-center justify-center rounded-md"
                style={{ background: "var(--text-muted)", color: "white" }}
                aria-label="Batal"
              >
                <XIcon className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <span
              className="inline-flex items-center gap-1 text-[13px] font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {formatNumber(batch.kuantiti)} unit
              {batch.kuantiti === 0 && (
                <AlertTriangle
                  className="w-3 h-3"
                  style={{ color: "#d97706" }}
                />
              )}
            </span>
          )}
        </div>
        <div>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold"
            style={{
              background: status.bg,
              color: status.fg,
              border: `1px solid ${status.border}`,
            }}
          >
            {status.label}
          </span>
        </div>
        <div className="flex items-center justify-end gap-1">
          {canEdit && !editing && !status.isExpired && (
            <>
              <button
                onClick={startEdit}
                className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-black/[0.05] transition-colors"
                style={{ color: "#7c3aed" }}
                aria-label="Edit kuantiti"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDispose(batch)}
                className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-50 transition-colors"
                style={{ color: "#dc2626" }}
                aria-label="Pelupusan"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mobile row */}
      <div
        className="sm:hidden flex items-start gap-3 px-4 py-3 border-b border-[#f0f2f5]"
      >
        <div
          className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
          }}
        >
          <Package2 className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="font-mono font-semibold text-[13px] truncate"
            style={{ color: "#7c3aed" }}
          >
            {batch.nombor_kelompok}
          </p>
          <div className="flex items-center gap-2 mt-0.5 text-[12px] flex-wrap" style={{ color: "var(--text-secondary)" }}>
            <span>Luput: {formatDate(batch.tarikh_luput)}</span>
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-2xs font-semibold"
              style={{
                background: status.bg,
                color: status.fg,
                border: `1px solid ${status.border}`,
              }}
            >
              {status.label}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {editing ? (
              <>
                <input
                  ref={inputRef}
                  type="number"
                  min={0}
                  value={draftQty}
                  onChange={(e) => setDraftQty(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmit();
                    if (e.key === "Escape") cancelEdit();
                  }}
                  className="w-20 h-7 text-xs font-semibold px-2 rounded-lg outline-none"
                  style={{
                    border: "1px solid #7c3aed",
                    boxShadow: "0 0 0 3px rgba(124,58,237,0.15)",
                    color: "var(--text-primary)",
                    background: "var(--card)",
                  }}
                />
                <button
                  onClick={handleSubmit}
                  className="w-7 h-7 flex items-center justify-center rounded-md"
                  style={{ background: "#16a34a", color: "white" }}
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={cancelEdit}
                  className="w-7 h-7 flex items-center justify-center rounded-md"
                  style={{ background: "var(--text-muted)", color: "white" }}
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <span
                  className="text-[14px] font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {formatNumber(batch.kuantiti)} unit
                </span>
                {canEdit && !status.isExpired && (
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      onClick={startEdit}
                      className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-black/[0.05] transition-colors"
                      style={{ color: "#7c3aed" }}
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDispose(batch)}
                      className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-50 transition-colors"
                      style={{ color: "#dc2626" }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Local minimal Package2 icon since lucide doesn't export one
function Package2({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
      <path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9" />
      <path d="M12 3v6" />
    </svg>
  );
}
