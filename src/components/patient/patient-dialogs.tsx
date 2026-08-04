/**
 * PatientDialogs — Kumpulan dialog untuk PatientDetailPage.
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
import {
  ShieldAlert,
  AlertTriangle,
  Trash2,
  Search,
  Pill,
  Package,
  Edit,
  Loader2,
} from "lucide-react";
import { cn, formatDate, formatItemDisplay, formatMyKad } from "@/lib/utils";
import {
  useAvailableBatches,
  useSupplyDurations,
  type AssignmentWithItem,
} from "@/hooks/use-patient-detail";
import type { Item } from "@/types";

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

// ============================================================================
// Deactivate Dialog
// ============================================================================
export function DeactivateDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
  patientName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
  patientName: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
              style={{
                background: "linear-gradient(135deg, #d97706, #b45309)",
                boxShadow: "0 4px 12px rgba(217,119,6,0.3)",
              }}
            >
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle>Nyahaktifkan Pesakit</DialogTitle>
            </div>
          </div>
        </DialogHeader>
        <div className="my-4 space-y-3">
          <div
            className="flex items-start gap-2 p-3 rounded-xl"
            style={{
              background: "rgba(217,119,6,0.08)",
              border: "1px solid rgba(217,119,6,0.25)",
            }}
          >
            <AlertTriangle
              className="w-4 h-4 flex-shrink-0 mt-0.5"
              style={{ color: "#d97706" }}
            />
            <p className="text-xs" style={{ color: "#92400e" }}>
              Pesakit <strong>{patientName}</strong> tidak akan dapat menerima
              bekalan ubat baharu. Semua rekod sedia ada kekal dalam sistem.
              Pesakit yang dinyahaktifkan tidak boleh diaktifkan semula.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            title="Batal nyahaktifkan"
          >
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
            title="Sahkan nyahaktifkan pesakit"
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Nyahaktifkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Add Assignment Dialog
// ============================================================================
export function AddAssignmentDialog({
  open,
  onOpenChange,
  items,
  activeItemIds,
  onSubmit,
  isPending,
  formsMap,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: (Item & { active_assignments?: number })[];
  activeItemIds: Set<string>;
  onSubmit: (data: { item_id: string; dos: string; catatan: string }) => void;
  isPending: boolean;
  formsMap: Map<string, string>;
}) {
  const [search, setSearch] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [dos, setDos] = useState("");
  const [catatan, setCatatan] = useState("");

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelectedItemId(null);
      setDos("");
      setCatatan("");
    }
  }, [open]);

  const filtered = items.filter((i) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      i.nama_item.toLowerCase().includes(term) ||
      i.kod_item.toLowerCase().includes(term) ||
      (i.nama_dagangan ?? "").toLowerCase().includes(term) ||
      (i.kekuatan ?? "").toLowerCase().includes(term)
    );
  });

  const selectedItem = items.find((i) => i.id === selectedItemId);
  const isAlreadyActive = selectedItemId
    ? activeItemIds.has(selectedItemId)
    : false;

  const canSubmit = !!selectedItemId && dos.trim().length > 0 && !isAlreadyActive;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
              style={{
                background: "linear-gradient(135deg, #1877f2, #0d5bd4)",
                boxShadow: "0 4px 12px rgba(24,119,242,0.3)",
              }}
            >
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle>Tambah Item Baharu</DialogTitle>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                Pilih item, tetapkan dos, dan simpan
              </p>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            onSubmit({
              item_id: selectedItemId!,
              dos: dos.trim(),
              catatan: catatan.trim(),
            });
          }}
          className="space-y-3 mt-2"
        >
          <div>
            <Label style={labelStyle}>Cari Item</Label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-9"
                style={inputBaseStyle}
              />
            </div>
          </div>

          {/* Item list */}
          <div
            className="border rounded-xl overflow-y-auto"
            style={{ borderColor: "var(--border-medium)", maxHeight: 200 }}
          >
            {filtered.length === 0 ? (
              <div
                className="text-center text-xs py-6"
                style={{ color: "var(--text-muted)" }}
              >
                Tiada item dijumpai.
              </div>
            ) : (
              filtered.map((i) => {
                const active = activeItemIds.has(i.id);
                const kuota = i.kuota;
                const activeCount = i.active_assignments ?? 0;
                const hasKuota = kuota != null && kuota > 0;
                const baki = hasKuota ? Math.max(0, kuota - activeCount) : null;
                const kuotaPenuh = hasKuota ? activeCount >= kuota : false;
                return (
                  <button
                    type="button"
                    key={i.id}
                    onClick={() => !active && !kuotaPenuh && setSelectedItemId(i.id)}
                    disabled={active || kuotaPenuh}
                    title={`Pilih ${formatItemDisplay(i, i.id_bentuk ? formsMap.get(i.id_bentuk) : null)}`}
                    className={cn(
                      "w-full text-left px-3 py-2 text-xs border-b last:border-b-0 transition-colors",
                      (active || kuotaPenuh) && "opacity-50 cursor-not-allowed",
                      !active && !kuotaPenuh && selectedItemId === i.id
                        ? "bg-blue-50"
                        : "hover:bg-blue-50/50"
                    )}
                    style={{ borderColor: "var(--border-light)" }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                          {formatItemDisplay(i, i.id_bentuk ? formsMap.get(i.id_bentuk) : null)}
                        </p>
                        <p style={{ color: "var(--text-secondary)" }}>
                          {i.kod_item}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {kuotaPenuh && !active ? (
                          <span
                            className="text-2xs font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              background: "rgba(220,38,38,0.10)",
                              color: "#dc2626",
                            }}
                          >
                            Kuota Penuh
                          </span>
                        ) : active ? (
                          <span
                            className="text-2xs font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              background: "rgba(217,119,6,0.1)",
                              color: "#d97706",
                            }}
                          >
                            Aktif
                          </span>
                        ) : selectedItemId === i.id ? (
                          <span
                            className="text-2xs font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              background: "var(--bg-accent-blue)",
                              color: "#1877f2",
                            }}
                          >
                            Dipilih
                          </span>
                        ) : hasKuota ? (
                          <span
                            className="text-2xs font-medium"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            Baki: {baki}/{kuota}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {isAlreadyActive && (
            <div
              className="flex items-start gap-2 p-2 rounded-xl"
              style={{
                background: "rgba(217,119,6,0.08)",
                border: "1px solid rgba(217,119,6,0.25)",
              }}
            >
              <AlertTriangle
                className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
                style={{ color: "#d97706" }}
              />
              <p className="text-2xs" style={{ color: "#92400e" }}>
                Item ini sudah aktif untuk pesakit. Tamatkan dahulu.
              </p>
            </div>
          )}

          <div>
            <Label style={labelStyle}>Dos *</Label>
            <Input
              value={dos}
              onChange={(e) => setDos(e.target.value.toUpperCase())}
              required
              style={inputBaseStyle}
            />
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
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            title="Batal tambah item"
          >
            Batal
          </Button>
          <Button
            onClick={() => {
              if (!canSubmit) return;
              onSubmit({
                item_id: selectedItemId!,
                dos: dos.trim(),
                catatan: catatan.trim(),
              });
            }}
            disabled={!canSubmit || isPending}
            title="Tambah item untuk pesakit"
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Tambah
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Supply Dialog (with FEFO batch picker)
// ============================================================================
export function SupplyDialog({
  open,
  onOpenChange,
  assignment,
  formsMap,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  assignment: AssignmentWithItem;
  formsMap: Map<string, string>;
  onSubmit: (data: {
    dos: string;
    kuantiti: number;
    tempoh: string;
    batchId: string;
    catatan: string;
  }) => void;
  isPending: boolean;
}) {
  const [kuantiti, setKuantiti] = useState(1);
  const [tempohNilai, setTempohNilai] = useState("");
  const [tempohUnit, setTempohUnit] = useState("");
  const [batchId, setBatchId] = useState<string | null>(null);
  const [catatan, setCatatan] = useState("");

  const { data: batches = [], isLoading: batchesLoading } = useAvailableBatches(
    open ? assignment.item_id : null
  );
  const selectableBatches = batches.filter(
    (batch) => batch.kuantiti > 0 && batch.dilupuskan !== true
  );
  const { data: durations = [] } = useSupplyDurations();

  // Combine tempoh value + unit
  const tempoh = tempohNilai.trim()
    ? `${tempohNilai.trim()} ${tempohUnit}`.trim()
    : "";

  // Auto-select first batch (FEFO) and default duration
  useEffect(() => {
    if (open && selectableBatches.length > 0 && !batchId) {
      setBatchId(selectableBatches[0].id);
    }
    if (batchId && !selectableBatches.some((batch) => batch.id === batchId)) {
      setBatchId(selectableBatches[0]?.id ?? null);
    }
    if (open && durations.length > 0 && !tempohUnit) {
      setTempohUnit(durations[0]?.nama ?? "");
    }
    if (!open) {
      setKuantiti(1);
      setTempohNilai("");
      setTempohUnit("");
      setBatchId(null);
      setCatatan("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectableBatches, durations.length, batchId]);

  const selectedBatch = selectableBatches.find((b) => b.id === batchId);
  const maxQty = selectedBatch?.kuantiti ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                boxShadow: "0 4px 12px rgba(124,58,237,0.3)",
              }}
            >
              <Package className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle>Bekal Ubat</DialogTitle>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                {formatItemDisplay(assignment.item, assignment.item?.id_bentuk ? formsMap.get(assignment.item.id_bentuk) : null)}
              </p>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!selectedBatch || kuantiti <= 0 || kuantiti > maxQty) return;
            onSubmit({
              dos: assignment.dos ?? "",
              kuantiti,
              tempoh: tempoh.trim(),
               batchId: batchId!,
              catatan: catatan.trim(),
            });
          }}
          className="space-y-3 mt-2"
        >
          <div>
            <Label style={labelStyle}>Dos</Label>
            <Input
              value={assignment.dos ?? ""}
              readOnly
              style={{ ...inputBaseStyle, opacity: 0.6, cursor: "default" }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
              <Label style={labelStyle}>Kuantiti *</Label>
              <Input
                type="number"
                min={1}
                max={maxQty || undefined}
                value={kuantiti}
                onChange={(e) =>
                  setKuantiti(Math.max(1, parseInt(e.target.value) || 1))
                }
                required
                style={inputBaseStyle}
              />
            </div>
          </div>

          <div>
            <Label style={labelStyle}>Nombor Kelompok</Label>
            {batchesLoading ? (
              <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                <Loader2 className="w-3 h-3 animate-spin" /> Memuatkan kelompok...
              </div>
            ) : selectableBatches.length === 0 ? (
              <div
                className="text-xs p-2 rounded-lg"
                style={{
                  background: "rgba(220,38,38,0.08)",
                  color: "#991b1b",
                }}
              >
                Tiada kelompok tersedia untuk item ini.
              </div>
            ) : (
              <div
                className="border rounded-xl overflow-y-auto"
                style={{ borderColor: "var(--border-medium)", maxHeight: 160 }}
              >
                {selectableBatches.map((b) => (
                  <label
                    key={b.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-xs border-b last:border-b-0 cursor-pointer",
                      batchId === b.id ? "bg-blue-50" : "hover:bg-blue-50/50"
                    )}
                    style={{ borderColor: "var(--border-light)" }}
                  >
                    <input
                      type="radio"
                      name="batch"
                      checked={batchId === b.id}
                      onChange={() => setBatchId(b.id)}
                      className="w-3.5 h-3.5"
                      style={{ accentColor: "#1877f2" }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
                        {b.nombor_kelompok}
                      </p>
                      <p style={{ color: "var(--text-secondary)" }}>
                        Luput: {formatDate(b.tarikh_luput)} · Stok:{" "}
                        {b.kuantiti}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
            {maxQty > 0 && kuantiti > maxQty && (
              <p className="text-2xs" style={{ color: "#dc2626" }}>
                Kuantiti melebihi stok tersedia ({maxQty}).
              </p>
            )}
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
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            title="Batal bekalan"
          >
            Batal
          </Button>
          <Button
            onClick={() => {
               if (!selectedBatch || kuantiti <= 0 || kuantiti > maxQty) return;
              onSubmit({
                dos: assignment.dos ?? "",
                kuantiti,
                tempoh: tempoh.trim(),
                 batchId: batchId!,
                catatan: catatan.trim(),
              });
            }}
            disabled={!selectedBatch || kuantiti <= 0 || kuantiti > maxQty || isPending}
            title="Bekalkan ubat"
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Bekalkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Update Dose Dialog
// ============================================================================
export function UpdateDoseDialog({
  open,
  onOpenChange,
  currentDose,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  currentDose: string | null;
  onSubmit: (data: { dos: string; catatan: string }) => void;
  isPending: boolean;
}) {
  const [dos, setDos] = useState("");
  const [catatan, setCatatan] = useState("");

  useEffect(() => {
    if (open) {
      setDos(currentDose ?? "");
      setCatatan("");
    }
  }, [open, currentDose]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
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
              <DialogTitle>Kemaskini Dos</DialogTitle>
            </div>
          </div>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!dos.trim()) return;
            onSubmit({ dos: dos.trim(), catatan: catatan.trim() });
          }}
          className="space-y-3 mt-2"
        >
          <div>
            <Label style={labelStyle}>Dos Baharu *</Label>
            <Input
              value={dos}
              onChange={(e) => setDos(e.target.value.toUpperCase())}
              required
              style={inputBaseStyle}
            />
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
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            title="Batal kemaskini dos"
          >
            Batal
          </Button>
          <Button
            onClick={() => {
              if (!dos.trim()) return;
              onSubmit({ dos: dos.trim(), catatan: catatan.trim() });
            }}
            disabled={!dos.trim() || isPending}
            title="Simpan dos baharu"
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

