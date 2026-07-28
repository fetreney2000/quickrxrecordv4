/**
 * Dialog tambahan untuk PatientDetailPage.
 * Stop Assignment, Edit Supply, Delete Supply
 */
import { useEffect, useState } from "react";
import { useSupplyDurations } from "@/hooks/use-patient-detail";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  X,
  Edit,
  Trash2,
  AlertTriangle,
  Loader2,
} from "lucide-react";

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: 4,
  display: "block",
};
const inputBaseStyle: React.CSSProperties = {
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
};

// Stop Assignment Dialog
export function StopAssignmentDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (sebab: string) => void;
  isPending: boolean;
}) {
  const [sebab, setSebab] = useState("");
  useEffect(() => {
    if (!open) setSebab("");
  }, [open]);
  const canSubmit = sebab.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
              style={{
                background: "linear-gradient(135deg, #dc2626, #b91c1c)",
                boxShadow: "0 4px 12px rgba(220,38,38,0.3)",
              }}
            >
              <X className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle>Tamatkan Item</DialogTitle>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                Tindakan ini boleh diterbalikkan
              </p>
            </div>
          </div>
        </DialogHeader>
        <div className="my-4 space-y-3">
          <div
            className="flex items-start gap-2 p-3 rounded-xl"
            style={{
              background: "rgba(220,38,38,0.08)",
              border: "1px solid rgba(220,38,38,0.25)",
            }}
          >
            <AlertTriangle
              className="w-4 h-4 flex-shrink-0 mt-0.5"
              style={{ color: "#dc2626" }}
            />
              <p className="text-xs" style={{ color: "#991b1b" }}>
              Tindakan ini tidak boleh dibatalkan. Pesakit tidak akan
              dibekalkan ubat ini lagi melainkan anda mendaftarkan semula.
            </p>
          </div>
          <div>
            <Label style={labelStyle}>Sebab Tamat *</Label>
            <Input
              value={sebab}
              onChange={(e) => setSebab(e.target.value)}
              style={inputBaseStyle}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={() => canSubmit && onSubmit(sebab.trim())}
            disabled={!canSubmit || isPending}
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Ya, Tamatkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Edit Supply Record Dialog
export function EditSupplyDialog({
  supply,
  onClose,
  onSubmit,
  isPending,
}: {
  supply: {
    id: string;
    assignment_id: string;
    dos: string;
    kuantiti: number;
    tempoh_dibekal: string | null;
    catatan_bekalan: string | null;
  } | null;
  onClose: () => void;
  onSubmit: (data: {
    supplyId: string;
    dos: string;
    kuantiti: number;
    tempoh: string;
    catatan: string;
  }) => void;
  isPending: boolean;
}) {
  const [dos, setDos] = useState("");
  const [kuantiti, setKuantiti] = useState(1);
  const [tempohNilai, setTempohNilai] = useState("");
  const [tempohUnit, setTempohUnit] = useState("");
  const [catatan, setCatatan] = useState("");

  const { data: durations = [] } = useSupplyDurations();

  // Parse existing tempoh into value + unit
  useEffect(() => {
    if (supply) {
      setDos(supply.dos);
      setKuantiti(supply.kuantiti);
      setCatatan(supply.catatan_bekalan ?? "");
      // Parse tempoh_dibekal (e.g. "30 Hari" → value="30", unit="Hari")
      const existingTempoh = supply.tempoh_dibekal ?? "";
      const parts = existingTempoh.trim().split(/\s+/);
      if (parts.length >= 2) {
        setTempohNilai(parts[0]);
        const unit = parts.slice(1).join(" ");
        setTempohUnit(unit);
      } else {
        setTempohNilai(existingTempoh);
        setTempohUnit("");
      }
    }
  }, [supply]);

  // Combine tempoh value + unit
  const tempoh = tempohNilai.trim()
    ? `${tempohNilai.trim()} ${tempohUnit}`.trim()
    : "";

  if (!supply) return null;

  return (
    <Dialog open={!!supply} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
              style={{
                background: "linear-gradient(135deg, #1877f2, #0d5bd4)",
                boxShadow: "0 4px 12px rgba(24,119,242,0.3)",
              }}
            >
              <Edit className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle>Edit Rekod Bekalan</DialogTitle>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                Kemaskini dos, kuantiti, dan catatan
              </p>
            </div>
          </div>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              supplyId: supply.id,
              dos: dos.trim(),
              kuantiti: Math.max(1, kuantiti),
              tempoh: tempoh.trim(),
              catatan: catatan.trim(),
            });
          }}
          className="space-y-3 mt-2"
        >
          <div>
            <Label style={labelStyle}>Dos</Label>
            <Input
              value={dos}
              readOnly
              style={{ ...inputBaseStyle, background: "var(--bg-secondary)", cursor: "not-allowed" }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label style={labelStyle}>Tempoh</Label>
              <div className="flex gap-1.5">
                <Input
                  value={tempohNilai}
                  onChange={(e) => setTempohNilai(e.target.value)}
                  style={{ ...inputBaseStyle, flex: 1 }}
                />
                <select
                  value={tempohUnit}
                  onChange={(e) => setTempohUnit(e.target.value)}
                  style={{
                    ...inputBaseStyle,
                    width: "auto",
                    minWidth: 90,
                    appearance: "auto",
                  }}
                >
                  {durations.map((d) => (
                    <option key={d.id} value={d.nama}>
                      {d.nama}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label style={labelStyle}>Kuantiti</Label>
              <Input
                type="number"
                min={1}
                value={kuantiti}
                onChange={(e) => setKuantiti(parseInt(e.target.value) || 1)}
                style={inputBaseStyle}
              />
            </div>
          </div>
          <div>
            <Label style={labelStyle}>Catatan</Label>
            <Input
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              style={inputBaseStyle}
            />
          </div>
        </form>
        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isPending}
          >
            Batal
          </Button>
          <Button
            onClick={() =>
              onSubmit({
                supplyId: supply.id,
                dos: dos.trim(),
                kuantiti: Math.max(1, kuantiti),
                tempoh: tempoh.trim(),
                catatan: catatan.trim(),
              })
            }
            disabled={isPending}
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Delete Supply Record Dialog
export function DeleteSupplyDialog({
  target,
  onClose,
  onConfirm,
  isPending,
}: {
  target: { id: string; assignmentId: string } | null;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
              style={{
                background: "linear-gradient(135deg, #dc2626, #b91c1c)",
                boxShadow: "0 4px 12px rgba(220,38,38,0.3)",
              }}
            >
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle>Padam Rekod Bekalan</DialogTitle>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                Tindakan ini tidak boleh diterbalikkan
              </p>
            </div>
          </div>
        </DialogHeader>
        <div className="my-4">
          <div
            className="flex items-start gap-2 p-3 rounded-xl"
            style={{
              background: "rgba(220,38,38,0.08)",
              border: "1px solid rgba(220,38,38,0.25)",
            }}
          >
            <AlertTriangle
              className="w-4 h-4 flex-shrink-0 mt-0.5"
              style={{ color: "#dc2626" }}
            />
            <p className="text-xs" style={{ color: "#991b1b" }}>
              Adakah anda pasti untuk memadam rekod bekalan ini? Tindakan
              ini tidak boleh dibatalkan.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isPending}
          >
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Ya, Padam
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
