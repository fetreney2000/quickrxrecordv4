/**
 * MergeDialog — Dialog penggabungan pesakit pendua.
 *
 * Dua langkah:
 * 1. Carian & pemilihan pesakit pendua
 * 2. Pengesahan & penggabungan
 */
import { useEffect, useState } from "react";
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
  Search,
  AlertTriangle,
  Merge,
  Loader2,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import {
  useSearchPatients,
  useMergePatients,
  type AssignmentWithItem,
} from "@/hooks/use-patient-detail";
import type { Patient } from "@/types";

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

interface MergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  primaryPatient: Pick<Patient, "id" | "nama" | "nombor_kad_pengenalan" | "nombor_pendaftaran_hospital">;
}

export function MergeDialog({ open, onOpenChange, primaryPatient }: MergeDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<"search" | "confirm">("search");
  // LOW-3: cache pesakit yang pernah dipaparkan, supaya cip "Dipilih" dan
  // senarai pengesahan tidak hilang apabila pertanyaan carian berubah.
  const [patientCache, setPatientCache] = useState<
    Map<string, { id: string; nama: string; nombor_kad_pengenalan: string | null; nombor_pendaftaran_hospital: string | null; aktif: boolean }>
  >(new Map());

  const { data: searchResults = [], isLoading: searching } = useSearchPatients(searchQuery);
  const mergeMutation = useMergePatients();

  useEffect(() => {
    if (searchResults.length === 0) return;
    setPatientCache((prev) => {
      const next = new Map(prev);
      for (const p of searchResults) next.set(p.id, p);
      return next;
    });
  }, [searchResults]);

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSelectedIds(new Set());
      setStep("search");
      setPatientCache(new Map());
    }
  }, [open]);

  // LOW-4: had 10 pendua setiap gabungan — setiap sekunder memanjangkan
  // satu transaksi yang memegang kunci baris; gabungan besar menyekat
  // bekalan serentak pada baris tersebut.
  const MAX_DUPLICATES = 10;
  const toggleSelect = (id: string) => {
    let rejected = false;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= MAX_DUPLICATES) {
          rejected = true;
          return prev;
        }
        next.add(id);
      }
      return next;
    });
    if (rejected) {
      toast.warning(`Maksimum ${MAX_DUPLICATES} pesakit pendua setiap gabungan.`);
    }
  };

  const selectedIdList = [...selectedIds].sort();
  // Selesaikan daripada cache (bukan hasil carian semasa) — pilihan kekal
  // kelihatan walaupun pengguna menaip pertanyaan baharu.
  const selectedPatients = selectedIdList.flatMap((id) => {
    const cached = patientCache.get(id);
    if (cached) return [cached];
    const live = searchResults.find((p) => p.id === id);
    return live ? [live] : [];
  });
  // MEDIUM-3: pengesahan eksplisit — pendua tidak aktif kekal tidak aktif
  // selepas gabungan (tugasannya dipindahkan tanpa diaktifkan semula).
  const inactiveSelected = selectedPatients.filter((p) => !p.aktif);

  // MEDIUM-2: kesan konflik dos — tugasan aktif untuk item yang sama di
  // kedua-dua pihak. Pelayan mengekalkan dos UTAMA (lihat merge_patients);
  // dedahkan di sini supaya klinisian membuat keputusan termaklum.
  const { data: conflictRows = [] } = useQuery({
    queryKey: ["merge-conflicts", primaryPatient.id, selectedIdList],
    enabled: open && selectedIdList.length > 0,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_item_assignments")
        .select("id, patient_id, item_id, dos, item:items(id, nama_item)")
        .eq("aktif", true)
        .in("patient_id", [primaryPatient.id, ...selectedIdList]);
      if (error) throw error;
      return ((data ?? []) as unknown as {
        id: string;
        patient_id: string;
        item_id: string;
        dos: string | null;
        item:
          | { id: string; nama_item: string }
          | { id: string; nama_item: string }[]
          | null;
      }[]).map((a) => ({
        ...a,
        item: Array.isArray(a.item) ? (a.item[0] ?? null) : a.item,
      }));
    },
  });
  const dosConflicts = (() => {
    const primaryByItem = new Map<string, { dos: string | null; name: string }>();
    for (const a of conflictRows) {
      if (a.patient_id === primaryPatient.id) {
        primaryByItem.set(a.item_id, {
          dos: a.dos,
          name: a.item?.nama_item ?? "Ubat",
        });
      }
    }
    const out: {
      itemName: string;
      secondaryName: string;
      secondaryDos: string;
      primaryDos: string;
    }[] = [];
    const seen = new Set<string>();
    for (const a of conflictRows) {
      if (a.patient_id === primaryPatient.id) continue;
      const prim = primaryByItem.get(a.item_id);
      if (!prim) continue;
      const key = `${a.patient_id}:${a.item_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const sec = selectedPatients.find((p) => p.id === a.patient_id);
      out.push({
        itemName: prim.name,
        secondaryName: sec?.nama ?? "Pendua",
        secondaryDos: a.dos || "—",
        primaryDos: prim.dos || "—",
      });
    }
    return out;
  })();

  const handleMerge = () => {
    if (selectedIds.size === 0) return;
    mergeMutation.mutate(
      {
        primaryPatientId: primaryPatient.id,
        duplicateIds: Array.from(selectedIds),
      },
      {
        onSuccess: () => onOpenChange(false),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                boxShadow: "0 4px 12px rgba(124,58,237,0.3)",
              }}
            >
              <Merge className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle>Gabungkan Pesakit</DialogTitle>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                {step === "search"
                  ? "Cari dan pilih pesakit pendua"
                  : "Sahkan penggabungan"}
              </p>
            </div>
          </div>
        </DialogHeader>

        {step === "search" && (
          <div className="space-y-3 mt-2">
            <div>
              <Label style={labelStyle}>Cari Pesakit</Label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-9"
                  style={inputBaseStyle}
                />
              </div>
            </div>

              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-2xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                    Dipilih ({selectedIds.size}/{MAX_DUPLICATES}):
                  </span>
                {selectedPatients.map((p) => (
                  <span
                    key={p.id}
                    className="text-2xs font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: p.aktif
                        ? "rgba(124,58,237,0.1)"
                        : "rgba(107,114,128,0.12)",
                      color: p.aktif ? "#7c3aed" : "#4b5563",
                    }}
                    title={p.aktif ? undefined : "Rekod tidak aktif — tugasannya dipindahkan tanpa diaktifkan semula"}
                  >
                    {p.nama}
                    {!p.aktif && " (tidak aktif)"}
                    <button
                      type="button"
                      onClick={() => toggleSelect(p.id)}
                      className="ml-1 hover:opacity-70"
                      aria-label={`Buang ${p.nama} daripada pilihan`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div
              className="border rounded-xl overflow-y-auto"
              style={{ borderColor: "var(--border-medium)", maxHeight: 300 }}
            >
              {searching ? (
                <div className="flex items-center justify-center py-8 gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Mencari...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center text-xs py-8" style={{ color: "var(--text-muted)" }}>
                  {searchQuery.trim().length < 2
                    ? "Taip sekurang-kurangnya 2 aksara untuk mencari."
                    : "Tiada pesakit dijumpai."}
                </div>
              ) : (
                searchResults
                  .filter((p) => p.id !== primaryPatient.id)
                  .map((p) => {
                    const isSelected = selectedIds.has(p.id);
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => toggleSelect(p.id)}
                        className={cn(
                          "w-full text-left px-3 py-2 text-xs border-b last:border-b-0 transition-colors",
                          isSelected ? "bg-purple-50" : "hover:bg-purple-50/50"
                        )}
                        style={{ borderColor: "var(--border-light)" }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                              {p.nama}
                            </p>
                            <p style={{ color: "var(--text-secondary)" }}>
                              {p.nombor_kad_pengenalan || "Tiada KP"}
                              {p.nombor_pendaftaran_hospital
                                ? ` · ${p.nombor_pendaftaran_hospital}`
                                : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {!p.aktif && (
                              <span
                                className="text-2xs font-semibold px-2 py-0.5 rounded-full"
                                style={{
                                  background: "rgba(107,114,128,0.1)",
                                  color: "#6b7280",
                                }}
                              >
                                Tidak Aktif
                              </span>
                            )}
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(p.id)}
                              className="w-3.5 h-3.5"
                              style={{ accentColor: "#7c3aed" }}
                            />
                          </div>
                        </div>
                      </button>
                    );
                  })
              )}
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-3 mt-2">
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
              <div className="text-xs" style={{ color: "#92400e" }}>
                <p className="font-semibold mb-1">Amaran: Tindakan ini tidak boleh dibatalkan.</p>
                <p>
                  Rekod bekalan, sejarah dos dan rekod penolakan pesakit pendua
                  akan dipindahkan ke pesakit utama. Pesakit pendua akan
                  dinyahaktifkan.
                </p>
                {inactiveSelected.length > 0 && (
                  <p className="font-semibold mt-1" role="alert">
                    {inactiveSelected.length} pendua yang dipilih telah dinyahaktifkan
                    ({inactiveSelected.map((p) => p.nama).join(", ")}) — tugasan
                    tidak aktifnya dipindahkan tanpa diaktifkan semula.
                  </p>
                )}
              </div>
            </div>

            {dosConflicts.length > 0 && (
              <div
                className="flex items-start gap-2 p-3 rounded-xl"
                style={{
                  background: "rgba(220,38,38,0.06)",
                  border: "1px solid rgba(220,38,38,0.25)",
                }}
              >
                <AlertTriangle
                  className="w-4 h-4 flex-shrink-0 mt-0.5"
                  style={{ color: "#dc2626" }}
                />
                <div className="text-xs" style={{ color: "#7f1d1d" }}>
                  <p className="font-semibold mb-1">
                    Konflik dos ({dosConflicts.length}) — dos utama dikekalkan:
                  </p>
                  <ul className="space-y-1 list-disc pl-4">
                    {dosConflicts.map((c, i) => (
                      <li key={i}>
                        <strong>{c.itemName}</strong>: {c.secondaryName} (
                        {c.secondaryDos}) → utama ({c.primaryDos})
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1">
                    Semak dos utama dahulu — ubah jika perlu sebelum menggabungkan.
                  </p>
                </div>
              </div>
            )}

            <div className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
              Pesakit Utama:
            </div>
            <div
              className="p-2 rounded-lg text-xs"
              style={{ background: "var(--bg-accent-blue)", border: "1px solid rgba(24,119,242,0.15)" }}
            >
              <span className="font-semibold" style={{ color: "#1877f2" }}>
                {primaryPatient.nama}
              </span>
              <span style={{ color: "var(--text-secondary)" }}>
                {" "}— {primaryPatient.nombor_kad_pengenalan || "Tiada KP"}
              </span>
            </div>

            <div className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
              Pesakit Pendua ({selectedIds.size}):
            </div>
            <div className="space-y-1">
              {selectedPatients.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 p-2 rounded-lg text-xs"
                  style={{ background: "rgba(220,38,38,0.04)", border: "1px solid rgba(220,38,38,0.12)" }}
                >
                  <User className="w-3 h-3" style={{ color: "#dc2626" }} />
                  <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                    {p.nama}
                  </span>
                  <span style={{ color: "var(--text-secondary)" }}>
                    — {p.nombor_kad_pengenalan || "Tiada KP"}
                  </span>
                  {!p.aktif && (
                    <span
                      className="text-2xs font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: "rgba(107,114,128,0.1)",
                        color: "#6b7280",
                      }}
                    >
                      Tidak Aktif
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="mt-4">
          {step === "search" ? (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Batal
              </Button>
              <Button
                onClick={() => setStep("confirm")}
                disabled={selectedIds.size === 0}
                style={{
                  background: selectedIds.size > 0
                    ? "linear-gradient(135deg, #7c3aed, #6d28d9)"
                    : undefined,
                }}
              >
                <Merge className="w-3.5 h-3.5" />
                Seterusnya ({selectedIds.size})
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setStep("search")}
                disabled={mergeMutation.isPending}
              >
                Kembali
              </Button>
              <Button
                variant="destructive"
                onClick={handleMerge}
                disabled={mergeMutation.isPending}
              >
                {mergeMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Gabungkan Sekarang
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}