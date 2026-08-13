/**
 * Dialog "Ubat Tidak Perlu Dibekalkan" (supply declination).
 *
 * Rekod bahawa pesakit datang tetapi TIDAK perlu dibekalkan ubat untuk
 * sesuatu item. Tidak mengurangkan stok, tidak mencipta supply_records dan
 * tidak mengubah kuota/assignment — pesakit kekal aktif.
 */
import { useEffect, useState } from "react";
import { AlertCircle, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  SUPPLY_DECLINE_REASONS,
  useSupplyDurations,
} from "@/hooks/use-patient-detail";

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: 6,
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
  outline: "none",
};

export function DeclineSupplyDialog({
  open,
  onOpenChange,
  assignmentLabel,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  assignmentLabel: string;
  isPending: boolean;
  onSubmit: (sebab: string, catatan: string, tempoh: string) => void;
}) {
  const [sebab, setSebab] = useState<string>(SUPPLY_DECLINE_REASONS[0]);
  const [tempohNilai, setTempohNilai] = useState("");
  const [tempohUnit, setTempohUnit] = useState("");
  const [catatan, setCatatan] = useState("");

  const { data: durations = [] } = useSupplyDurations();

  const tempoh = tempohNilai.trim()
    ? `${tempohNilai.trim()} ${tempohUnit}`.trim()
    : "";

  useEffect(() => {
    if (open) {
      setSebab(SUPPLY_DECLINE_REASONS[0]);
      setTempohNilai("");
      setTempohUnit(durations[0]?.nama ?? "");
      setCatatan("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, durations.length]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
              style={{
                background: "linear-gradient(135deg, #f0932b, #e07a1f)",
                boxShadow: "0 4px 12px rgba(240,147,43,0.3)",
              }}
            >
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle>Ubat Tidak Perlu Dibekalkan</DialogTitle>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                {assignmentLabel}
              </p>
            </div>
          </div>
        </DialogHeader>

        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Rekod ini mengekalkan pesakit sebagai aktif dan tidak mengurangkan
          kuota atau stok.
        </p>

        <div className="mt-3">
          <Label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-secondary)",
              marginBottom: 6,
              display: "block",
            }}
          >
            Sebab
          </Label>
          <div className="space-y-1.5">
            {SUPPLY_DECLINE_REASONS.map((r) => (
              <label
                key={r}
                className="flex min-h-11 items-center gap-2 px-3 py-2.5 text-xs border rounded-lg cursor-pointer"
                style={{
                  borderColor: sebab === r ? "#f59e0b" : "var(--border-medium)",
                  background: sebab === r ? "rgba(245,158,11,0.06)" : "var(--card)",
                }}
              >
                <input
                  type="radio"
                  name="decline-sebab"
                  checked={sebab === r}
                  onChange={() => setSebab(r)}
                  className="flex-shrink-0"
                  style={{ accentColor: "#f59e0b" }}
                />
                <span style={{ color: "var(--text-primary)" }}>{r}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <Label style={labelStyle}>
            Tempoh sepatutnya dibekal
          </Label>
          <div className="flex gap-1.5">
            <Input
              value={tempohNilai}
              onChange={(e) => setTempohNilai(e.target.value)}
              onFocus={(e) => e.target.select()}
              title="Tempoh sepatutnya dibekal"
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

        <div className="mt-3">
          <Label style={labelStyle}>
            Catatan (pilihan)
          </Label>
          <Input
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Batal
          </Button>
          <Button
            onClick={() => {
              if (sebab.trim()) onSubmit(sebab.trim(), catatan.trim(), tempoh);
            }}
            disabled={isPending}
            style={{ background: "linear-gradient(135deg, #f0932b, #e07a1f)" }}
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Simpan Rekod
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteDeclinationDialog({
  open,
  onClose,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
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
              <DialogTitle>Padam Rekod</DialogTitle>
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
              Adakah anda pasti untuk memadam rekod &ldquo;Ubat Tidak Perlu
              Dibekalkan&rdquo; ini?
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Batal
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Ya, Padam
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}