/**
 * AddPatientDialog — Dialog untuk mendaftarkan pesakit baharu.
 *
 * Ciri-ciri:
 *  - 6 medan (Nama*, No. KP, No. Hospital, Telefon, Alamat, Catatan)
 *  - Pemformatan automatik (onBlur): toTitleCase, formatMyKad, formatPhone
 *  - Pengesanan pendua masa nyata (debounced 600ms)
 *  - Amaran ambar dengan pautan ke pesakit sedia ada
 *  - Auto-redirect selepas simpan
 */
import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
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
import { Activity, AlertTriangle, Loader2, ExternalLink, X } from "lucide-react";
import { cn, toTitleCase, formatMyKad, formatPhone } from "@/lib/utils";
import {
  EMPTY_NEW_PATIENT,
  useAddPatient,
  useCheckDuplicate,
  type NewPatientForm,
} from "@/hooks/use-patients";

interface AddPatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

export function AddPatientDialog({ open, onOpenChange }: AddPatientDialogProps) {
  const navigate = useNavigate();
  const [form, setForm] = useState<NewPatientForm>(EMPTY_NEW_PATIENT);
  const addPatient = useAddPatient({
    onSuccess: () => {
      onOpenChange(false);
      setForm(EMPTY_NEW_PATIENT);
    },
  });
  const duplicate = useCheckDuplicate(form);

  // Reset form on close
  useEffect(() => {
    if (!open) {
      // Jangan reset semasa animation keluar — biar useEffect onSuccess kendalikan
    }
  }, [open]);

  const updateField = <K extends keyof NewPatientForm>(
    key: K,
    value: NewPatientForm[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleBlurNama = () => {
    setForm((p) => ({ ...p, nama: toTitleCase(p.nama) }));
  };
  const handleBlurKp = () => {
    setForm((p) => ({ ...p, nombor_kad_pengenalan: formatMyKad(p.nombor_kad_pengenalan) }));
  };
  const handleBlurPhone = () => {
    setForm((p) => ({ ...p, nombor_telefon: formatPhone(p.nombor_telefon) }));
  };
  const handleBlurHospital = () => {
    setForm((p) => ({
      ...p,
      nombor_pendaftaran_hospital: p.nombor_pendaftaran_hospital.toUpperCase(),
    }));
  };
  const handleBlurAlamat = () => {
    setForm((p) => ({ ...p, alamat: toTitleCase(p.alamat) }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.nama.trim()) return;
    addPatient.mutate(form);
  };

  const isValid = form.nama.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, #1877f2, #0d5bd4)",
                boxShadow: "0 4px 12px rgba(24,119,242,0.3)",
              }}
            >
              <Activity className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Daftar Pesakit Baharu
              </DialogTitle>
              <p
                className="text-xs mt-0.5"
                style={{ color: "#65676b" }}
              >
                Masukkan maklumat pesakit untuk mendaftarkan rekod baharu
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          {/* Nama */}
          <div>
            <Label htmlFor="nama" className="mb-1" style={labelStyle}>
              Nama <span style={{ color: "#dc2626" }}>*</span>
            </Label>
            <Input
              id="nama"
              value={form.nama}
              onChange={(e) => updateField("nama", e.target.value)}
              onBlur={handleBlurNama}
              required
              style={inputStyle}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#1877f2";
                e.currentTarget.style.boxShadow =
                  "0 0 0 3px rgba(24,119,242,0.1)";
              }}
              onBlurCapture={(e) => {
                e.currentTarget.style.borderColor = "#dddfe2";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          {/* Grid: KP + Hospital */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="kp" className="mb-1" style={labelStyle}>
                No. Kad Pengenalan
              </Label>
              <Input
                id="kp"
                value={form.nombor_kad_pengenalan}
                onChange={(e) =>
                  updateField("nombor_kad_pengenalan", e.target.value)
                }
                onBlur={handleBlurKp}
                style={inputStyle}
              />
            </div>
            <div>
              <Label htmlFor="hospital" className="mb-1" style={labelStyle}>
                No. Pendaftaran Hospital
              </Label>
              <Input
                id="hospital"
                value={form.nombor_pendaftaran_hospital}
                onChange={(e) =>
                  updateField("nombor_pendaftaran_hospital", e.target.value)
                }
                onBlur={handleBlurHospital}
                style={{
                  ...inputStyle,
                  textTransform: "uppercase",
                }}
              />
            </div>
          </div>

          {/* Dokumen Lain */}
          <div>
            <Label htmlFor="dokumen" className="mb-1" style={labelStyle}>
              Dokumen Lain
            </Label>
            <Input
              id="dokumen"
              value={form.dokumen_lain}
              onChange={(e) => updateField("dokumen_lain", e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Telefon */}
          <div>
            <Label htmlFor="telefon" className="mb-1" style={labelStyle}>
              No. Telefon
            </Label>
            <Input
              id="telefon"
              value={form.nombor_telefon}
              onChange={(e) => updateField("nombor_telefon", e.target.value)}
              onBlur={handleBlurPhone}
              style={inputStyle}
            />
          </div>

          {/* Alamat */}
          <div>
            <Label htmlFor="alamat" className="mb-1" style={labelStyle}>
              Alamat
            </Label>
            <textarea
              id="alamat"
              value={form.alamat}
              onChange={(e) => updateField("alamat", e.target.value)}
              onBlur={handleBlurAlamat}
              style={textareaStyle}
              rows={2}
            />
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
              style={textareaStyle}
              rows={2}
            />
          </div>

          {/* Duplicate warning */}
          {duplicate && (
            <div
              className="flex items-start gap-2 p-3 rounded-xl"
              style={{
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.25)",
              }}
            >
              <AlertTriangle
                className="w-4 h-4 flex-shrink-0 mt-0.5"
                style={{ color: "#d97706" }}
              />
              <div className="flex-1 text-xs">
                <p
                  className="font-semibold"
                  style={{ color: "#92400e" }}
                >
                  Pesakit dengan{" "}
                  {duplicate.type === "kad_pengenalan"
                    ? "No. Kad Pengenalan"
                    : "No. Pendaftaran Hospital"}{" "}
                  yang sama telah didaftarkan:
                </p>
                <p style={{ color: "#a16207" }}>
                  <strong>{duplicate.patient.nama}</strong>
                  {duplicate.patient.nombor_kad_pengenalan && (
                    <> · KP: {duplicate.patient.nombor_kad_pengenalan}</>
                  )}
                </p>
                <p
                  className="mt-1"
                  style={{ color: "#a16207" }}
                >
                  Anda boleh teruskan pendaftaran jika perlu.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    navigate(`/pesakit/${duplicate.patient.id}`);
                    onOpenChange(false);
                  }}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold"
                  style={{ color: "#92400e" }}
                >
                  Lihat butiran pesakit
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </form>

        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={addPatient.isPending}
          >
            Batal
          </Button>
          <Button
            type="button"
            disabled={!isValid || addPatient.isPending}
            onClick={handleSubmit}
          >
            {addPatient.isPending && (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            )}
            {addPatient.isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
