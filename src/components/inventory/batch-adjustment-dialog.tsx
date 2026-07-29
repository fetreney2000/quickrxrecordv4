/**
 * BatchAdjustmentDialog — Dialog pengesahan untuk pelarasan & pelupusan stok.
 *
 * Ciri-ciri:
 *  - 6 kod sebab: Pelarasan Stok, Rosak, Luput, Hilang, Dijumpai, Pelupusan
 *  - Kotak amaran berkod warna (hijau untuk +, merah untuk -)
 *  - Paparan kesan penuh (sebelum → selepas)
 *  - Butang "Saya Faham, Teruskan" (destructive untuk pelupusan)
 */
import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowUp,
  ArrowDown,
  Trash2,
} from "lucide-react";
import { formatDate, formatNumber } from "@/lib/utils";
import type { ItemBatch } from "@/types";
import { useUpdateBatchQuantity } from "@/hooks/use-inventory";

type ActionType = "adjust" | "dispose";

type ReasonCode =
  | "pelarasan_stok"
  | "rosak"
  | "luput"
  | "hilang"
  | "dijumpai"
  | "pelupusan";

const REASON_LABELS: Record<ReasonCode, string> = {
  pelarasan_stok: "Pelarasan Stok",
  rosak: "Rosak",
  luput: "Pelupusan Luput",
  hilang: "Hilang",
  dijumpai: "Dijumpai",
  pelupusan: "Pelupusan Stok",
};

const REASON_CHANGES: Record<ReasonCode, "up" | "down" | "zero"> = {
  pelarasan_stok: "up", // boleh up atau down, dikira dari nilai
  rosak: "down",
  luput: "down",
  hilang: "down",
  dijumpai: "up",
  pelupusan: "zero",
};

interface BatchAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionType: ActionType;
  batch: ItemBatch | null;
  /** Kuantiti baharu untuk pelarasan (untuk actionType="adjust") */
  newKuantiti?: number;
  itemId: string;
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: 4,
  display: "block",
};

const fieldStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text-primary)",
  padding: "4px 0",
};

export function BatchAdjustmentDialog({
  open,
  onOpenChange,
  actionType,
  batch,
  newKuantiti,
  itemId,
}: BatchAdjustmentDialogProps) {
  const [reason, setReason] = useState<ReasonCode>(
    actionType === "dispose" ? "pelupusan" : "pelarasan_stok"
  );
  const updateBatch = useUpdateBatchQuantity(itemId);

  useEffect(() => {
    if (open) {
      setReason(actionType === "dispose" ? "pelupusan" : "pelarasan_stok");
    }
  }, [open, actionType]);

  const finalKuantiti = useMemo(() => {
    if (!batch) return 0;
    if (actionType === "dispose") return 0;
    return Math.max(0, newKuantiti ?? batch.kuantiti);
  }, [batch, actionType, newKuantiti]);

  const change = useMemo(() => {
    if (!batch) return 0;
    return finalKuantiti - batch.kuantiti;
  }, [batch, finalKuantiti]);

  const isUp = change > 0;
  const isDown = change < 0;
  const isZero = change === 0;

  // Force reason to be consistent (e.g. disposal only allows "pelupusan")
  const allowedReasons: ReasonCode[] = useMemo(() => {
    if (actionType === "dispose") return ["pelupusan"];
    // For adjust, filter by direction
    if (isUp) return ["dijumpai", "pelarasan_stok"];
    if (isDown) return ["pelarasan_stok", "rosak", "luput", "hilang"];
    return ["pelarasan_stok"];
  }, [actionType, isUp, isDown]);

  // Auto-correct reason when out of allowed set
  useEffect(() => {
    if (!allowedReasons.includes(reason)) {
      setReason(allowedReasons[0] ?? "pelarasan_stok");
    }
  }, [allowedReasons, reason]);

  if (!batch) return null;

  const handleConfirm = () => {
    updateBatch.mutate(
      {
        batchId: batch.id,
        newKuantiti: finalKuantiti,
        reason: REASON_LABELS[reason],
      },
      {
        onSuccess: () => onOpenChange(false),
      }
    );
  };

  // Warning styling
  const isDisposal = actionType === "dispose" || reason === "pelupusan";
  const warningColor = isDisposal
    ? { bg: "rgba(220,38,38,0.08)", border: "rgba(220,38,38,0.25)", fg: "#991b1b", icon: "#dc2626" }
    : isUp
      ? { bg: "rgba(22,163,74,0.08)", border: "rgba(22,163,74,0.25)", fg: "#15803d", icon: "#16a34a" }
      : { bg: "rgba(220,38,38,0.08)", border: "rgba(220,38,38,0.25)", fg: "#991b1b", icon: "#dc2626" };

  const warningText = isDisposal
    ? `Semua stok ${formatNumber(batch.kuantiti)} unit akan dilupuskan. Rekod pelupusan akan dicipta.`
    : isUp
      ? `Stok bertambah daripada ${formatNumber(batch.kuantiti)} kepada ${formatNumber(finalKuantiti)} unit.`
      : `Stok berkurang daripada ${formatNumber(batch.kuantiti)} kepada ${formatNumber(finalKuantiti)} unit.`;

  const WarningIcon = isDisposal
    ? ShieldAlert
    : isUp
      ? CheckCircle2
      : AlertTriangle;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
              style={
                isDisposal
                  ? {
                      background: "linear-gradient(135deg, #dc2626, #b91c1c)",
                      boxShadow: "0 4px 12px rgba(220,38,38,0.3)",
                    }
                  : {
                      background:
                        "linear-gradient(135deg, #7c3aed, #6d28d9)",
                      boxShadow: "0 4px 12px rgba(124,58,237,0.3)",
                    }
              }
            >
              {isDisposal ? (
                <Trash2 className="w-5 h-5" strokeWidth={2.5} />
              ) : isUp ? (
                <ArrowUp className="w-5 h-5" strokeWidth={2.5} />
              ) : (
                <ArrowDown className="w-5 h-5" strokeWidth={2.5} />
              )}
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                {isDisposal
                  ? "Sahkan Pelupusan Stok"
                  : isUp
                    ? "Sahkan Pelarasan (Tambah)"
                    : "Sahkan Pelarasan (Kurang)"}
              </DialogTitle>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                Sila semak maklumat sebelum meneruskan
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {/* Maklumat kelompok */}
          <div
            className="rounded-xl p-3"
            style={{ background: "rgba(0,0,0,0.03)" }}
          >
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label style={labelStyle}>Kelompok</Label>
                <p
                  className="font-mono font-semibold"
                  style={fieldStyle}
                >
                  {batch.nombor_kelompok}
                </p>
              </div>
              <div>
                <Label style={labelStyle}>Tarikh Luput</Label>
                <p style={fieldStyle}>
                  {formatDate(batch.tarikh_luput)}
                </p>
              </div>
              <div>
                <Label style={labelStyle}>Stok Semasa</Label>
                <p
                  className="font-bold"
                  style={{ ...fieldStyle, color: "var(--text-primary)" }}
                >
                  {formatNumber(batch.kuantiti)} unit
                </p>
              </div>
              <div>
                <Label style={labelStyle}>Stok Baharu</Label>
                <p
                  className="font-bold"
                  style={{
                    ...fieldStyle,
                    color: isDisposal
                      ? "#dc2626"
                      : isUp
                        ? "#16a34a"
                        : isDown
                          ? "#dc2626"
                          : "var(--text-secondary)",
                  }}
                >
                  {formatNumber(finalKuantiti)} unit{" "}
                  {!isZero && (
                    <span className="text-2xs font-normal">
                      ({isUp ? "+" : ""}
                      {formatNumber(change)})
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Kod Sebab */}
          <div>
            <Label htmlFor="reason" className="mb-1" style={labelStyle}>
              Kod Sebab <span style={{ color: "#dc2626" }}>*</span>
            </Label>
            <select
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as ReasonCode)}
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text-primary)",
                height: 40,
                padding: "0 12px",
                width: "100%",
                outline: "none",
                appearance: "auto",
              }}
            >
              {allowedReasons.map((r) => (
                <option key={r} value={r}>
                  {REASON_LABELS[r]}
                </option>
              ))}
            </select>
            <p
              className="text-2xs mt-1"
              style={{ color: "var(--text-muted)" }}
            >
              {REASON_CHANGES[reason] === "up" && "Penambahan stok"}
              {REASON_CHANGES[reason] === "down" && "Pengurangan stok"}
              {REASON_CHANGES[reason] === "zero" && "Set semua stok kepada kosong"}
            </p>
          </div>

          {/* Warning box */}
          <div
            className="flex items-start gap-2 p-3 rounded-xl"
            style={{
              background: warningColor.bg,
              border: `1px solid ${warningColor.border}`,
            }}
          >
            <WarningIcon
              className="w-4 h-4 flex-shrink-0 mt-0.5"
              style={{ color: warningColor.icon }}
            />
            <p className="text-2xs" style={{ color: warningColor.fg }}>
              {warningText}
            </p>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateBatch.isPending}
            title="Batal pelarasan"
          >
            Batal
          </Button>
          <Button
            variant={isDisposal ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={
              updateBatch.isPending ||
              (actionType === "adjust" && isZero)
            }
            style={
              !isDisposal
                ? {
                    background: isUp
                      ? "linear-gradient(135deg, #16a34a, #15803d)"
                      : "linear-gradient(135deg, #7c3aed, #6d28d9)",
                  }
                : undefined
            }
            title="Sahkan dan teruskan pelarasan stok"
          >
            {updateBatch.isPending && (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            )}
            Saya Faham, Teruskan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
