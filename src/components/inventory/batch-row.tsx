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
import { Check, X as XIcon, Edit, Trash2, AlertTriangle, Loader2, Pencil } from "lucide-react";
import { cn, formatDate, formatNumber, getKLDayStartISO, getTodayStrKL, toDateInputValue } from "@/lib/utils";
import { DateInput } from "@/components/ui/date-input";
import type { ItemBatch } from "@/types";

interface BatchRowProps {
  batch: ItemBatch;
  index: number;
  canEdit: boolean;
  onConfirmAdjust: (batch: ItemBatch, newKuantiti: number) => void;
  onDispose: (batch: ItemBatch) => void;
  onUpdateBatch?: (batchId: string, nombor_kelompok: string, tarikh_luput: string) => void;
}

function getStatus(batch: ItemBatch): {
  label: string;
  bg: string;
  fg: string;
  border: string;
  isExpired: boolean;
} {
  const daysToExpiry = Math.floor(
    (new Date(getKLDayStartISO(batch.tarikh_luput)).getTime() - new Date(getKLDayStartISO(getTodayStrKL())).getTime()) /
      (1000 * 60 * 60 * 24)
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
  onUpdateBatch,
}: BatchRowProps) {
  const [editing, setEditing] = useState(false);
  const [draftQty, setDraftQty] = useState(String(batch.kuantiti));
  const [editingInfo, setEditingInfo] = useState(false);
  const [draftKelompok, setDraftKelompok] = useState(batch.nombor_kelompok);
  const [draftLuput, setDraftLuput] = useState(toDateInputValue(batch.tarikh_luput));
  const inputRef = useRef<HTMLInputElement>(null);
  const infoInputRef = useRef<HTMLInputElement>(null);
  const status = batch.dilupuskan
    ? { label: "Dilupuskan", bg: "rgba(220,38,38,0.10)", fg: "#dc2626", border: "rgba(220,38,38,0.25)", isExpired: true }
    : getStatus(batch);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    if (editingInfo && infoInputRef.current) {
      infoInputRef.current.focus();
      infoInputRef.current.select();
    }
  }, [editingInfo]);

  // Reset drafts when not editing
  useEffect(() => {
    if (!editing) setDraftQty(String(batch.kuantiti));
  }, [batch.kuantiti, editing]);

  useEffect(() => {
    if (!editingInfo) {
      setDraftKelompok(batch.nombor_kelompok);
      setDraftLuput(toDateInputValue(batch.tarikh_luput));
    }
  }, [batch.nombor_kelompok, batch.tarikh_luput, editingInfo]);

  const startEdit = () => setEditing(true);

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
    if (qty === batch.kuantiti) return;
    onConfirmAdjust(batch, qty);
  };

  const startEditInfo = () => setEditingInfo(true);

  const cancelEditInfo = () => {
    setEditingInfo(false);
    setDraftKelompok(batch.nombor_kelompok);
    setDraftLuput(toDateInputValue(batch.tarikh_luput));
  };

  const handleInfoSubmit = () => {
    const kelompok = draftKelompok.trim().toUpperCase();
    if (!kelompok || !draftLuput) return;
    if (kelompok === batch.nombor_kelompok && draftLuput === toDateInputValue(batch.tarikh_luput)) return;
    setEditingInfo(false);
    onUpdateBatch?.(batch.id, kelompok, draftLuput);
  };

  const infoDirty =
    draftKelompok.trim().toUpperCase() !== batch.nombor_kelompok ||
    draftLuput !== toDateInputValue(batch.tarikh_luput);

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
        {editingInfo ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <Package2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#7c3aed" }} />
            <input
              ref={infoInputRef}
              value={draftKelompok}
              onChange={(e) => setDraftKelompok(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleInfoSubmit(); if (e.key === "Escape") cancelEditInfo(); }}
              className="w-full h-7 text-xs font-mono font-semibold px-2 rounded-lg outline-none"
              style={{
                border: "1px solid #7c3aed",
                boxShadow: "0 0 0 3px rgba(124,58,237,0.15)",
                color: "#7c3aed",
                background: "var(--card)",
                textTransform: "uppercase",
              }}
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <Package2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#7c3aed" }} />
            <span className="font-mono font-semibold text-[13px] truncate" style={{ color: "#7c3aed" }}>
              {batch.nombor_kelompok}
            </span>
          </div>
        )}
        {editingInfo ? (
          <DateInput
            value={draftLuput}
            onChange={(v) => setDraftLuput(v)}
            onKeyDown={(e) => { if (e.key === "Enter") handleInfoSubmit(); if (e.key === "Escape") cancelEditInfo(); }}
            className="h-7 text-xs px-2 rounded-lg outline-none w-full"
            style={{
              border: "1px solid #7c3aed",
              boxShadow: "0 0 0 3px rgba(124,58,237,0.15)",
              color: "var(--text-primary)",
              background: "var(--card)",
            }}
          />
        ) : (
          <span className="text-[13px]" style={{ color: "var(--text-primary)" }}>
            {formatDate(batch.tarikh_luput)}
          </span>
        )}
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
                className="w-7 h-7 flex items-center justify-center rounded-md"
                style={{ background: "#16a34a", color: "white" }}
                aria-label="Sahkan"
                title="Sahkan kuantiti"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                onClick={cancelEdit}
                className="w-7 h-7 flex items-center justify-center rounded-md"
                style={{ background: "var(--text-muted)", color: "white" }}
                aria-label="Batal"
                title="Batal edit kuantiti"
              >
                <XIcon className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <span
              className="inline-flex items-center gap-1 text-[13px] font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
               {formatNumber(batch.kuantiti)}
              {batch.kuantiti === 0 && (
                <AlertTriangle className="w-3 h-3" style={{ color: "#d97706" }} />
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
          {canEdit && !editing && !editingInfo && !status.isExpired && (
            <>
              <button
                onClick={startEditInfo}
                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-black/[0.05] transition-colors"
                style={{ color: "#7c3aed" }}
                aria-label="Edit info kelompok"
                title="Edit maklumat kelompok"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={startEdit}
                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-black/[0.05] transition-colors"
                style={{ color: "#7c3aed" }}
                aria-label="Edit kuantiti"
                title="Edit kuantiti"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDispose(batch)}
                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-50 transition-colors"
                style={{ color: "#dc2626" }}
                aria-label="Pelupusan"
                title="Lupuskan kelompok"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {editingInfo && (
            <>
              <button
                onClick={handleInfoSubmit}
                disabled={!infoDirty}
                className="w-7 h-7 flex items-center justify-center rounded-md"
                style={{ background: infoDirty ? "#16a34a" : "var(--text-muted)", color: "white" }}
                aria-label="Sahkan info"
                title="Sahkan maklumat kelompok"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                onClick={cancelEditInfo}
                className="w-7 h-7 flex items-center justify-center rounded-md"
                style={{ background: "var(--text-muted)", color: "white" }}
                aria-label="Batal info"
                title="Batal edit maklumat"
              >
                <XIcon className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mobile row */}
      <div className="sm:hidden flex items-start gap-3 px-4 py-3 border-b border-[#f0f2f5]">
        <div
          className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}
        >
          <Package2 className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          {editingInfo ? (
            <input
              ref={infoInputRef}
              value={draftKelompok}
              onChange={(e) => setDraftKelompok(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleInfoSubmit(); if (e.key === "Escape") cancelEditInfo(); }}
              className="w-full h-7 text-xs font-mono font-semibold px-2 rounded-lg outline-none mb-1"
              style={{
                border: "1px solid #7c3aed",
                boxShadow: "0 0 0 3px rgba(124,58,237,0.15)",
                color: "#7c3aed",
                background: "var(--card)",
                textTransform: "uppercase",
              }}
            />
          ) : (
            <p className="font-mono font-semibold text-[13px] truncate" style={{ color: "#7c3aed" }}>
              {batch.nombor_kelompok}
            </p>
          )}
          <div className="flex items-center gap-2 mt-0.5 text-[12px] flex-wrap" style={{ color: "var(--text-secondary)" }}>
            {editingInfo ? (
              <DateInput
                value={draftLuput}
                onChange={(v) => setDraftLuput(v)}
                onKeyDown={(e) => { if (e.key === "Enter") handleInfoSubmit(); if (e.key === "Escape") cancelEditInfo(); }}
                className="h-7 text-xs px-2 rounded-lg outline-none"
                style={{
                  border: "1px solid #7c3aed",
                  boxShadow: "0 0 0 3px rgba(124,58,237,0.15)",
                  color: "var(--text-primary)",
                  background: "var(--card)",
                }}
              />
            ) : (
              <span>Luput: {formatDate(batch.tarikh_luput)}</span>
            )}
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-2xs font-semibold"
              style={{ background: status.bg, color: status.fg, border: `1px solid ${status.border}` }}
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
                  className="w-9 h-9 flex items-center justify-center rounded-md"
                  style={{ background: "#16a34a", color: "white" }}
                  title="Sahkan kuantiti"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={cancelEdit}
                  className="w-9 h-9 flex items-center justify-center rounded-md"
                  style={{ background: "var(--text-muted)", color: "white" }}
                  title="Batal edit kuantiti"
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              </>
            ) : editingInfo ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleInfoSubmit}
                  disabled={!infoDirty}
                  className="w-9 h-9 flex items-center justify-center rounded-md"
                  style={{ background: infoDirty ? "#16a34a" : "var(--text-muted)", color: "white" }}
                  title="Sahkan maklumat kelompok"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={cancelEditInfo}
                  className="w-9 h-9 flex items-center justify-center rounded-md"
                  style={{ background: "var(--text-muted)", color: "white" }}
                  title="Batal edit maklumat"
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <span className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  {formatNumber(batch.kuantiti)} unit
                </span>
                {canEdit && !status.isExpired && (
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      onClick={startEditInfo}
                      className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-black/[0.05] transition-colors"
                      style={{ color: "#7c3aed" }}
                      title="Edit maklumat kelompok"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={startEdit}
                      className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-black/[0.05] transition-colors"
                      style={{ color: "#7c3aed" }}
                      title="Edit kuantiti"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDispose(batch)}
                      className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-red-50 transition-colors"
                      style={{ color: "#dc2626" }}
                      title="Lupuskan kelompok"
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
