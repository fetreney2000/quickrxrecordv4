/**
 * AddBatchDialog — Dialog untuk menambah kelompok (batch) stok baharu.
 *
 * Ciri-ciri:
 *  - 3 medan (Nombor Kelompok*, Tarikh Luput*, Kuantiti*)
 *  - Jika nombor kelompok sedia ada → tambah kuantiti ke kelompok sedia ada
 *    (ditunjukkan mesej ambar kepada pengguna)
 *  - Pemformatan automatik: nombor kelompok uppercase
 */
import { useEffect, useState, type FormEvent } from "react";
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
import { Package, AlertTriangle, Loader2, Info } from "lucide-react";
import { toDateInputValue, fromDateInputValue } from "@/lib/utils";
import { useAddBatch, useBatches } from "@/hooks/use-inventory";

interface AddBatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
}

interface NewBatchForm {
  nombor_kelompok: string;
  tarikh_luput: string; // YYYY-MM-DD (untuk input date)
  kuantiti: string; // string untuk input
}

const EMPTY_FORM: NewBatchForm = {
  nombor_kelompok: "",
  tarikh_luput: "",
  kuantiti: "1",
};

const inputStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #dddfe2",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 500,
  color: "#1c1e21",
  height: 40,
  padding: "0 12px",
  width: "100%",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#65676b",
  marginBottom: 4,
  display: "block",
};

export function AddBatchDialog({
  open,
  onOpenChange,
  itemId,
}: AddBatchDialogProps) {
  const [form, setForm] = useState<NewBatchForm>(EMPTY_FORM);
  const addBatch = useAddBatch(itemId);

  // Semak kelompok sedia ada
  const { data: existingBatches = [] } = useBatches(
    open ? itemId : undefined
  );

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY_FORM);
  }, [open]);

  const updateField = <K extends keyof NewBatchForm>(
    key: K,
    value: NewBatchForm[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const matchedBatch = existingBatches.find(
    (b) =>
      b.nombor_kelompok.trim().toUpperCase() ===
      form.nombor_kelompok.trim().toUpperCase()
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (
      !form.nombor_kelompok.trim() ||
      !form.tarikh_luput ||
      !form.kuantiti ||
      parseInt(form.kuantiti, 10) < 1
    )
      return;
    addBatch.mutate(
      {
        nombor_kelompok: form.nombor_kelompok.trim().toUpperCase(),
        tarikh_luput: fromDateInputValue(form.tarikh_luput),
        kuantiti: parseInt(form.kuantiti, 10),
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setForm(EMPTY_FORM);
        },
      }
    );
  };

  const isValid =
    form.nombor_kelompok.trim().length > 0 &&
    form.tarikh_luput.length > 0 &&
    !isNaN(parseInt(form.kuantiti, 10)) &&
    parseInt(form.kuantiti, 10) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                boxShadow: "0 4px 12px rgba(124,58,237,0.3)",
              }}
            >
              <Package className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Tambah Stok / Kelompok
              </DialogTitle>
              <p
                className="text-xs mt-0.5"
                style={{ color: "#65676b" }}
              >
                Tambah kelompok baharu atau tambah stok ke kelompok sedia ada
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          <div>
            <Label htmlFor="kelompok" className="mb-1" style={labelStyle}>
              Nombor Kelompok <span style={{ color: "#dc2626" }}>*</span>
            </Label>
            <Input
              id="kelompok"
              value={form.nombor_kelompok}
              onChange={(e) => updateField("nombor_kelompok", e.target.value)}
              onBlur={(e) =>
                updateField("nombor_kelompok", e.target.value.toUpperCase())
              }
              placeholder="Cth: BATCH2024001"
              required
              style={{
                ...inputStyle,
                textTransform: "uppercase",
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
              }}
            />
          </div>

          {matchedBatch && (
            <div
              className="flex items-start gap-2 p-2.5 rounded-xl"
              style={{
                background: "rgba(124,58,237,0.08)",
                border: "1px solid rgba(124,58,237,0.25)",
              }}
            >
              <Info
                className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
                style={{ color: "#7c3aed" }}
              />
              <p className="text-2xs" style={{ color: "#5b21b6" }}>
                Kelompok <strong>{matchedBatch.nombor_kelompok}</strong>{" "}
                sedia ada dengan stok semasa{" "}
                <strong>{matchedBatch.kuantiti}</strong> unit. Stok baharu
                akan ditambah ke kelompok ini.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="luput" className="mb-1" style={labelStyle}>
                Tarikh Luput <span style={{ color: "#dc2626" }}>*</span>
              </Label>
              <Input
                id="luput"
                type="date"
                value={form.tarikh_luput}
                onChange={(e) => updateField("tarikh_luput", e.target.value)}
                required
                style={inputStyle}
              />
            </div>
            <div>
              <Label htmlFor="qty" className="mb-1" style={labelStyle}>
                Kuantiti <span style={{ color: "#dc2626" }}>*</span>
              </Label>
              <Input
                id="qty"
                type="number"
                min={1}
                value={form.kuantiti}
                onChange={(e) => updateField("kuantiti", e.target.value)}
                required
                style={inputStyle}
              />
            </div>
          </div>

          {addBatch.isError && (
            <div
              className="flex items-start gap-2 p-2.5 rounded-xl"
              style={{
                background: "rgba(220,38,38,0.08)",
                border: "1px solid rgba(220,38,38,0.25)",
              }}
            >
              <AlertTriangle
                className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
                style={{ color: "#dc2626" }}
              />
              <p className="text-2xs" style={{ color: "#991b1b" }}>
                {(addBatch.error as any)?.message ||
                  "Gagal menambah kelompok."}
              </p>
            </div>
          )}
        </form>

        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={addBatch.isPending}
          >
            Batal
          </Button>
          <Button
            type="button"
            disabled={!isValid || addBatch.isPending}
            onClick={handleSubmit}
            style={{
              background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
            }}
          >
            {addBatch.isPending && (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            )}
            {addBatch.isPending ? "Menyimpan..." : "Tambah"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
