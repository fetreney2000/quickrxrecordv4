/**
 * AddItemDialog — Dialog untuk mendaftarkan item ubat baharu.
 *
 * Ciri-ciri:
 *  - 8 medan (Kod*, Kekuatan, Nama*, Nama Dagangan, Kategori, Bentuk, Kuota, Catatan)
 *  - Pemformatan automatik (onBlur): toTitleCaseKeepAcronyms, toUpperCase
 *  - Auto-redirect selepas simpan ke halaman butiran item baharu
 */
import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
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
import { Pill, Loader2 } from "lucide-react";
import {
  toTitleCaseKeepAcronyms,
  formatNumber,
} from "@/lib/utils";
import {
  useAddItem,
  useItemCategories,
  useItemForms,
} from "@/hooks/use-inventory";

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface NewItemForm {
  kod_item: string;
  nama_item: string;
  nama_dagangan: string;
  kekuatan: string;
  id_kategori: string;
  id_bentuk: string;
  kuota: string; // string untuk input
  catatan: string;
}

const EMPTY_FORM: NewItemForm = {
  kod_item: "",
  nama_item: "",
  nama_dagangan: "",
  kekuatan: "",
  id_kategori: "",
  id_bentuk: "",
  kuota: "",
  catatan: "",
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
  transition: "border-color 0.15s, box-shadow 0.15s",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  height: "auto",
  minHeight: 70,
  padding: "8px 12px",
  resize: "vertical",
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#65676b",
  marginBottom: 4,
  display: "block",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "auto",
};

export function AddItemDialog({ open, onOpenChange }: AddItemDialogProps) {
  const navigate = useNavigate();
  const [form, setForm] = useState<NewItemForm>(EMPTY_FORM);
  const { data: categories = [] } = useItemCategories();
  const { data: forms = [] } = useItemForms();

  const addItem = useAddItem();

  // Reset form when opened
  useEffect(() => {
    if (!open) return;
    setForm(EMPTY_FORM);
  }, [open]);

  const updateField = <K extends keyof NewItemForm>(
    key: K,
    value: NewItemForm[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.kod_item.trim() || !form.nama_item.trim()) return;
    const kuota = form.kuota.trim() ? parseInt(form.kuota, 10) : null;
    addItem.mutate(
      {
        kod_item: form.kod_item.trim().toUpperCase(),
        nama_item: form.nama_item.trim(),
        nama_dagangan: form.nama_dagangan.trim() || null,
        kekuatan: form.kekuatan.trim() ? form.kekuatan.trim().toUpperCase() : null,
        id_kategori: form.id_kategori || null,
        id_bentuk: form.id_bentuk || null,
        kuota: isNaN(kuota as number) ? null : kuota,
        catatan: form.catatan.trim() || null,
        aktif: true,
      } as any,
      {
        onSuccess: (data) => {
          onOpenChange(false);
          setForm(EMPTY_FORM);
          // Navigasi ke halaman butiran item baharu
          navigate(`/stok/${data.id}`);
        },
      }
    );
  };

  const isValid =
    form.kod_item.trim().length > 0 && form.nama_item.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                boxShadow: "0 4px 12px rgba(124,58,237,0.3)",
              }}
            >
              <Pill className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Tambah Item Baharu
              </DialogTitle>
              <p
                className="text-xs mt-0.5"
                style={{ color: "#65676b" }}
              >
                Masukkan maklumat item untuk mendaftarkan rekod baharu
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          {/* Kod Item + Kekuatan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="kod" className="mb-1" style={labelStyle}>
                Kod Item <span style={{ color: "#dc2626" }}>*</span>
              </Label>
              <Input
                id="kod"
                value={form.kod_item}
                onChange={(e) => updateField("kod_item", e.target.value)}
                onBlur={(e) =>
                  updateField("kod_item", e.target.value.toUpperCase())
                }
                placeholder="Cth: PCM500"
                required
                style={{ ...inputStyle, textTransform: "uppercase" }}
              />
            </div>
            <div>
              <Label htmlFor="kekuatan" className="mb-1" style={labelStyle}>
                Kekuatan
              </Label>
              <Input
                id="kekuatan"
                value={form.kekuatan}
                onChange={(e) => updateField("kekuatan", e.target.value)}
                onBlur={(e) =>
                  updateField("kekuatan", e.target.value.toUpperCase())
                }
                placeholder="Cth: 500MG"
                style={{ ...inputStyle, textTransform: "uppercase" }}
              />
            </div>
          </div>

          {/* Nama Item */}
          <div>
            <Label htmlFor="nama" className="mb-1" style={labelStyle}>
              Nama Item <span style={{ color: "#dc2626" }}>*</span>
            </Label>
            <Input
              id="nama"
              value={form.nama_item}
              onChange={(e) => updateField("nama_item", e.target.value)}
              onBlur={(e) =>
                updateField("nama_item", toTitleCaseKeepAcronyms(e.target.value))
              }
              placeholder="Cth: Paracetamol"
              required
              style={inputStyle}
            />
          </div>

          {/* Nama Dagangan */}
          <div>
            <Label htmlFor="dagangan" className="mb-1" style={labelStyle}>
              Nama Dagangan
            </Label>
            <Input
              id="dagangan"
              value={form.nama_dagangan}
              onChange={(e) => updateField("nama_dagangan", e.target.value)}
              onBlur={(e) =>
                updateField(
                  "nama_dagangan",
                  toTitleCaseKeepAcronyms(e.target.value)
                )
              }
              placeholder="Cth: Panadol"
              style={inputStyle}
            />
          </div>

          {/* Kategori + Bentuk Dos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="kategori" className="mb-1" style={labelStyle}>
                Kategori
              </Label>
              <select
                id="kategori"
                value={form.id_kategori}
                onChange={(e) => updateField("id_kategori", e.target.value)}
                style={selectStyle}
              >
                <option value="">- Pilih -</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nama}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="bentuk" className="mb-1" style={labelStyle}>
                Bentuk Dos
              </Label>
              <select
                id="bentuk"
                value={form.id_bentuk}
                onChange={(e) => updateField("id_bentuk", e.target.value)}
                style={selectStyle}
              >
                <option value="">- Pilih -</option>
                {forms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nama}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Kuota */}
          <div>
            <Label htmlFor="quota" className="mb-1" style={labelStyle}>
              Jumlah Kuota
            </Label>
            <Input
              id="quota"
              type="number"
              min={0}
              value={form.kuota}
              onChange={(e) => updateField("kuota", e.target.value)}
              placeholder="Cth: 1000"
              style={inputStyle}
            />
            {form.kuota && !isNaN(parseInt(form.kuota, 10)) && (
              <p
                className="text-2xs mt-1"
                style={{ color: "#9ca3af" }}
              >
                {formatNumber(parseInt(form.kuota, 10))} unit
              </p>
            )}
          </div>

          {/* Catatan */}
          <div>
            <Label htmlFor="catatan" className="mb-1" style={labelStyle}>
              Catatan
            </Label>
            <textarea
              id="catatan"
              value={form.catatan}
              onChange={(e) => updateField("catatan", e.target.value)}
              placeholder="Catatan tambahan (pilihan)"
              style={textareaStyle}
              rows={2}
            />
          </div>

          {addItem.isError && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs px-3 py-2 rounded-xl"
              style={{
                background: "rgba(220,38,38,0.08)",
                color: "#991b1b",
                border: "1px solid rgba(220,38,38,0.25)",
              }}
            >
              {(addItem.error as any)?.message ||
                "Gagal menambah item. Sila cuba lagi."}
            </motion.div>
          )}
        </form>

        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={addItem.isPending}
          >
            Batal
          </Button>
          <Button
            type="button"
            disabled={!isValid || addItem.isPending}
            onClick={handleSubmit}
            style={{
              background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
            }}
          >
            {addItem.isPending && (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            )}
            {addItem.isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
