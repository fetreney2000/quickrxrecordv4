/**
 * QuickDispensePage — Halaman Dispen Pantas.
 * 3 langkah linear: Cari pesakit → Pilih item → Bekal.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Zap,
  Search,
  Loader2,
  Pill,
  CheckCircle2,
  ShieldAlert,
  X,
  Plus,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { useAuth } from "@/hooks/use-auth";
import { useNavStore } from "@/lib/nav-store";
import { formatItemDisplay, getInitials, formatMyKad, formatDate, getTodayStrKL, toDateInputValue, formatSupplyAge, computeFefoAllocation } from "@/lib/utils";
import { toast } from "sonner";
import { AddPatientDialog } from "@/components/patient/add-patient-dialog";
import {
  usePatientSearch,
  usePatientAssignments,
  useFrequentItems,
  useQuickDispenseBatches,
  useSupplyDurationsList,
  useQuickSupplyMulti,
  useItemsActive,
  useAddAssignmentInline,
} from "@/hooks/use-quick-dispense";
import { useLatestDoseHistoryDos, useSupplyHistory, useDeclineSupply, useLastDeclination } from "@/hooks/use-patient-detail";
import { DeclineSupplyDialog } from "@/components/patient/decline-supply-dialog";
import type { Patient } from "@/types";

const inputStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text-primary)",
  height: 40,
  padding: "0 12px",
  width: "100%",
  outline: "none",
};
const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: 4,
  display: "block",
};

export default function QuickDispensePage() {
  const { can } = useAuth();
  const hasAccess = can("manage_supply");
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [quantity, setQuantity] = useState("");
  const [dose, setDose] = useState("");
  const [tempohNilai, setTempohNilai] = useState("30");
  const [tempohUnit, setTempohUnit] = useState("Hari");
  const [catatan, setCatatan] = useState("");
  const [successPatient, setSuccessPatient] = useState<string | null>(null);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [registerItemSearch, setRegisterItemSearch] = useState("");
  const [registerSelectedItem, setRegisterSelectedItem] = useState<any>(null);
  const [registerDos, setRegisterDos] = useState("");
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);

  const { data: searchResults = [], isFetching: searching } =
    usePatientSearch(searchQuery);
  const { data: assignedItems = [] } = usePatientAssignments(
    selectedPatient?.id ?? null
  );
  const assignedItemIds = useMemo(
    () => new Set(assignedItems.map((a: any) => a.item_id)),
    [assignedItems]
  );
  const assignmentIds = useMemo(
    () => (assignedItems as any[]).map((a: any) => a.assignment_id),
    [assignedItems]
  );
  const { data: latestDosMap } = useLatestDoseHistoryDos(assignmentIds);

  const effectiveDos = useCallback(
    (item: any) => {
      const fromHistory = item?.assignment_id
        ? latestDosMap?.get(item.assignment_id)
        : null;
      const fromAssignment = item?.dos;
      return fromHistory || fromAssignment || "";
    },
    [latestDosMap]
  );
  const { data: frequentItems = [] } = useFrequentItems(assignedItemIds);
  const { data: availableBatches = [] } = useQuickDispenseBatches(
    selectedItem?.item_id ?? null
  );
  const { data: supplyHistory = [], isLoading: supplyHistoryLoading } =
    useSupplyHistory(selectedItem?.assignment_id ?? null);
  const selectableBatches = useMemo(
    () => availableBatches.filter((batch) => batch.kuantiti > 0 && batch.dilupuskan !== true),
    [availableBatches]
  );
  const fefoAllocation = useMemo(
    () => computeFefoAllocation(selectableBatches, parseInt(quantity) || 0),
    [selectableBatches, quantity]
  );
  const totalAllocated = useMemo(
    () => fefoAllocation.reduce((sum, a) => sum + a.kuantitiDiambil, 0),
    [fefoAllocation]
  );
  const { data: supplyDurations = [] } = useSupplyDurationsList();
  const supplyMut = useQuickSupplyMulti(selectedPatient?.id ?? null);
  const declineMut = useDeclineSupply(selectedPatient?.id);
  const { data: lastDeclination = null } = useLastDeclination(
    selectedItem?.assignment_id ?? null
  );
  const setBreadcrumbTrail = useNavStore((s) => s.setBreadcrumbTrail);

  useEffect(() => {
    setBreadcrumbTrail([{ label: "Dispen Pantas" }]);
  }, [setBreadcrumbTrail]);
  const { data: allActiveItems = [] } = useItemsActive();
  const addAssignmentMut = useAddAssignmentInline(selectedPatient?.id ?? null);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    setDose(effectiveDos(selectedItem));
  }, [selectedItem, effectiveDos]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (selectedItem) setSelectedItem(null);
      else if (selectedPatient) {
        setSelectedPatient(null);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else if (searchQuery) {
        setSearchQuery("");
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedPatient, selectedItem, searchQuery]);

  const filteredItems = useMemo(() => {
    if (!itemSearch.trim()) return assignedItems;
    const term = itemSearch.toLowerCase();
    return (assignedItems as any[]).filter(
      (a) =>
        formatItemDisplay(a.item).toLowerCase().includes(term) ||
        a.item?.kod_item.toLowerCase().includes(term)
    );
  }, [assignedItems, itemSearch]);

  const assignedItemIdsSet = useMemo(
    () => new Set(assignedItems.map((a: any) => a.item_id)),
    [assignedItems]
  );

  const filteredRegisterItems = useMemo(() => {
    const items = allActiveItems.filter(
      (it) => !assignedItemIdsSet.has(it.id)
    );
    if (!registerItemSearch.trim()) return items;
    const term = registerItemSearch.toLowerCase();
    return items.filter(
      (it) =>
        formatItemDisplay(it).toLowerCase().includes(term) ||
        it.kod_item.toLowerCase().includes(term)
    );
  }, [allActiveItems, assignedItemIdsSet, registerItemSearch]);

  const handleSelectRegisterItem = (item: any) => {
    if (item.kuota_penuh) return;
    setRegisterSelectedItem(item);
    setRegisterDos("");
  };

  const handleConfirmRegisterItem = () => {
    if (!registerSelectedItem || !registerDos.trim()) return;
    addAssignmentMut.mutate(
      {
        itemId: registerSelectedItem.id,
        dos: registerDos.trim(),
      },
      {
        onSuccess: (assignment: any) => {
          toast.success(`${formatItemDisplay(registerSelectedItem)} telah didaftarkan.`);
          setShowRegisterDialog(false);
          setRegisterItemSearch("");
          setRegisterSelectedItem(null);
          setRegisterDos("");
          setSelectedItem({
            assignment_id: assignment?.id ?? "",
            item_id: registerSelectedItem.id,
            dos: registerDos.trim(),
            item: {
              id: registerSelectedItem.id,
              kod_item: registerSelectedItem.kod_item,
              nama_item: registerSelectedItem.nama_item,
              kekuatan: registerSelectedItem.kekuatan,
              id_bentuk: registerSelectedItem.id_bentuk,
              bentuk: registerSelectedItem.bentuk,
            },
          });
        },
      }
    );
  };

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-2 text-muted-foreground">
        <ShieldAlert className="w-10 h-10 opacity-40" />
        <p className="text-sm font-medium">Akses Terhad</p>
        <p className="text-xs">Anda tiada kebenaran untuk mendispens.</p>
      </div>
    );
  }

  const qtyNum = parseInt(quantity);
  const canSubmit =
    !!selectedPatient &&
    !!selectedItem &&
    qtyNum > 0 &&
    totalAllocated === qtyNum &&
    dose.trim() !== "";

  const latestSupply = supplyHistory[0] ?? null;
  const latestSupplyDays = latestSupply
    ? parseDurationDays(latestSupply.tempoh_dibekal)
    : null;
  const daysSinceLatestSupply = latestSupply
    ? calendarDaysSince(latestSupply.tarikh_dibekal)
    : null;
  const estimatedBalanceDays = latestSupplyDays !== null && daysSinceLatestSupply !== null
    ? latestSupplyDays - daysSinceLatestSupply
    : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    supplyMut.mutate(
      {
        assignmentId: selectedItem.assignment_id,
        itemId: selectedItem.item_id,
        dos: dose.trim(),
        kuantiti: parseInt(quantity),
        tempoh: tempohNilai.trim() ? `${tempohNilai.trim()} ${tempohUnit}`.trim() : "",
        catatan: catatan.trim(),
        allocations: fefoAllocation.map((a) => ({ batchId: a.batchId, kuantiti: a.kuantitiDiambil })),
      },
      {
        onSuccess: () => {
          setSuccessPatient(selectedPatient!.nama);
          setSelectedItem(null);
          setQuantity("");
          setCatatan("");
          setTimeout(() => setSuccessPatient(null), 2500);
        },
      }
    );
  };

  return (
    <div className="space-y-4">
      <Breadcrumb items={[{ label: "Dispen Pantas" }]} />

      <div className="flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-white flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, #f0932b, #e07a1f)",
            boxShadow: "0 4px 12px rgba(240,147,43,0.3)",
          }}
        >
          <Zap className="w-5 h-5" strokeWidth={2.5} />
        </div>
        <div>
          <h1
            className="text-xl font-bold sm:text-2xl"
            style={{ color: "var(--text-primary)" }}
          >
            Dispen Pantas
          </h1>
          <p
            className="text-xs font-medium mt-0.5"
            style={{ color: "var(--text-secondary)" }}
          >
            Bekal ubat dalam 3 langkah mudah
          </p>
        </div>
      </div>

      {successPatient && (
        <div
          className="flex items-center gap-3 p-4 rounded-2xl"
          style={{
            background: "rgba(16,185,129,0.10)",
            border: "1px solid rgba(16,185,129,0.30)",
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #10b981, #059669)",
            }}
          >
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: "#065f46" }}>
              Bekalan direkodkan untuk {successPatient}
            </p>
            <p className="text-xs" style={{ color: "#059669" }}>
              Sedia untuk pendispensan seterusnya.
            </p>
          </div>
        </div>
      )}

      {!selectedPatient && (
        <Card>
          <CardContent className="p-4 sm:p-8">
            <h2 className="text-[15px] font-bold mb-3" style={{ color: "var(--text-primary)" }}>
              Cari Pesakit
            </h2>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: searchFocused ? "#f0932b" : "var(--text-muted)" }}
              />
              <Input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
                onFocus={() => { setSearchFocused(true); setShowResults(true); }}
                onBlur={() => setTimeout(() => setShowResults(false), 200)}
                className="h-11 pl-10 text-sm font-medium"
                style={{
                  color: "var(--text-primary)",
                  background: searchFocused ? "var(--card)" : "rgba(240,147,43,0.04)",
                  border: searchFocused ? "1px solid rgba(240,147,43,0.3)" : "1px solid transparent",
                  borderRadius: 14,
                  boxShadow: searchFocused ? "0 0 0 4px rgba(240,147,43,0.08)" : "0 4px 16px rgba(240,147,43,0.06)",
                }}
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin" style={{ color: "#f0932b" }} />
              )}
              {showResults && searchQuery.trim().length >= 2 && (
                <div
                  className="absolute left-0 right-0 top-full mt-2 bg-background rounded-2xl border z-50 overflow-y-auto"
                  style={{ borderColor: "rgba(240,147,43,0.2)", boxShadow: "0 12px 40px rgba(0,0,0,0.12)", maxHeight: 320 }}
                >
                  {searchResults.length === 0 && !searching ? (
                    <div className="text-center py-6 space-y-3">
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>Tiada pesakit dijumpai.</p>
                      <Button type="button" variant="outline" size="sm" onClick={() => setShowAddPatient(true)} className="text-xs h-8" title="Daftar pesakit baharu" style={{ borderColor: "rgba(240,147,43,0.3)", color: "#f0932b" }}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Daftar Pesakit Baharu
                      </Button>
                    </div>
                  ) : (
                    searchResults.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        title={"Pilih " + p.nama}
                        onMouseDown={(e) => { e.preventDefault(); setSelectedPatient(p); setSearchQuery(""); setShowResults(false); setSelectedItem(null); }}
                        className="min-h-14 w-full text-left px-4 py-3 border-b last:border-b-0 transition-colors"
                        style={{ borderColor: "var(--border-light)" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(240,147,43,0.06)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-2xs font-bold" style={{ background: "linear-gradient(135deg, #f0932b, #e07a1f)" }}>
                            {getInitials(p.nama)}
                          </div>
                          <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{p.nama}</p>
                        </div>
                        {p.nombor_kad_pengenalan && (
                          <p className="text-2xs mt-0.5 ml-8" style={{ color: "var(--text-secondary)" }}>KP: {formatMyKad(p.nombor_kad_pengenalan)}</p>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedPatient && !selectedItem && (
        <Card>
          <CardContent className="p-4 sm:pt-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="min-w-0 truncate text-sm font-bold" style={{ color: "var(--text-primary)" }}>{selectedPatient.nama}</h3>
              <Button size="sm" variant="ghost" onClick={() => setSelectedPatient(null)} className="h-11 flex-shrink-0" title="Tukar pesakit"><X className="w-3.5 h-3.5" /> Tukar</Button>
            </div>
            {frequentItems.length > 0 && (
              <div className="mb-3">
                <p className="text-2xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-secondary)" }}>Item Kerap</p>
                <div className="flex flex-wrap gap-1.5">
                  {frequentItems.map((it: any) => {
                    const assignment = (assignedItems as any[]).find((a: any) => a.item_id === it.id);
                    return (
                      <button key={it.id} title={"Pilih " + formatItemDisplay(it.item)} onClick={() => assignment && setSelectedItem(assignment)}
                         className="min-h-11 text-xs font-medium px-3 py-1 rounded-full" style={{ background: "var(--bg-accent-blue)", color: "#1877f2", border: "1px solid rgba(24,119,242,0.2)" }}>
                        {formatItemDisplay(it.item)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <Input value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} className="mb-2" style={inputStyle} />
            <div className="border rounded-xl overflow-y-auto" style={{ borderColor: "var(--border-medium)", maxHeight: 200 }}>
              {filteredItems.length === 0 ? (
                <div className="text-center text-xs py-6" style={{ color: "var(--text-muted)" }}>Tiada padanan.</div>
              ) : (
                filteredItems.map((a: any) => (
                   <button key={a.assignment_id} title={"Pilih " + formatItemDisplay(a.item)} onClick={() => setSelectedItem(a)} className="min-h-14 w-full text-left px-3 py-2.5 text-xs border-b last:border-b-0 hover:bg-blue-50/50" style={{ borderColor: "var(--border-light)" }}>
                    <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{formatItemDisplay(a.item)}</p>
                    <p style={{ color: "var(--text-secondary)" }}>{a.item?.kod_item} · Dos: {effectiveDos(a)}</p>
                  </button>
                ))
              )}
            </div>
            <button type="button" title="Daftar item baharu untuk pesakit" onClick={() => { setShowRegisterDialog(true); setRegisterItemSearch(""); }}
               className="mt-3 min-h-11 w-full text-xs font-semibold flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 border-dashed cursor-pointer" style={{ borderColor: "rgba(16,185,129,0.4)", color: "#059669" }}>
              <Plus className="w-3.5 h-3.5" /> Daftar Item Baharu
            </button>
          </CardContent>
        </Card>
      )}

      {selectedItem && (
        <Card>
          <CardContent className="p-4 sm:pt-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Pill className="w-4 h-4 text-blue-500" />
                <p className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>{formatItemDisplay(selectedItem.item)}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelectedItem(null)} className="h-11 flex-shrink-0" title="Tukar item"><X className="w-3.5 h-3.5" /> Tukar</Button>
            </div>
            {selectedPatient && (
              <div className="flex items-center gap-2 mb-3 p-2 rounded-lg text-xs" style={{ background: "rgba(240,147,43,0.06)", border: "1px solid rgba(240,147,43,0.12)" }}>
                <span style={{ color: "var(--text-secondary)" }}>{selectedPatient.nama}{selectedPatient.nombor_kad_pengenalan && <> · KP: {formatMyKad(selectedPatient.nombor_kad_pengenalan)}</>}{selectedPatient.nombor_pendaftaran_hospital && <> · Hosp: {selectedPatient.nombor_pendaftaran_hospital}</>}</span>
              </div>
            )}
            <div
              className="mb-4 rounded-xl border p-3"
              aria-label="Rujukan bekalan terakhir"
              style={{
                background: "rgba(24,119,242,0.04)",
                borderColor: "rgba(24,119,242,0.14)",
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                  Rujukan Bekalan Terakhir
                </p>
                <span className="text-right text-2xs font-medium" style={{ color: "var(--text-muted)" }}>
                  Rujukan sahaja
                </span>
              </div>
              {supplyHistoryLoading ? (
                <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  Memuatkan rekod bekalan...
                </div>
              ) : latestSupply ? (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
                  <ReferenceValue label="Tarikh diambil" value={formatDate(latestSupply.tarikh_dibekal)} />
                  <ReferenceValue label="Dos" value={latestSupply.dos || "—"} />
                  <ReferenceValue label="Tempoh dibekal" value={latestSupply.tempoh_dibekal || "—"} />
                  <ReferenceValue label="Kuantiti" value={`${latestSupply.kuantiti} unit`} />
                  <ReferenceValue label="Baki anggaran" value={formatBalanceDays(estimatedBalanceDays)} />
                  <div className="col-span-2 sm:col-span-4">
                    <ReferenceValue
                      label="Tempoh sejak bekalan"
                      value={formatSupplyAge(latestSupply.tarikh_dibekal) ?? "—"}
                    />
                  </div>
                </div>
) : (
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  Tiada rekod bekalan terdahulu untuk item ini.
                </p>
              )}
              {lastDeclination && (
                <p className="mt-2 text-xs italic" style={{ color: "var(--text-muted)" }}>
                  Rekod terakhir: Ubat Tidak Perlu Dibekalkan — {lastDeclination.sebab}
                  {" "}({formatDate(lastDeclination.tarikh)})
                </p>
              )}
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label style={labelStyle}>Alokasi Kelompok (FEFO)</Label>
                {selectableBatches.length === 0 ? (
                  <div className="text-xs p-2 rounded-lg" style={{ background: "rgba(220,38,38,0.08)", color: "#991b1b" }}>Tiada kelompok tersedia.</div>
                ) : quantity === "" || qtyNum === 0 ? (
                  <div className="text-xs p-2 rounded-lg" style={{ background: "rgba(24,119,242,0.06)", color: "#1877f2" }}>Masukkan kuantiti untuk melihat alokasi kelompok.</div>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {fefoAllocation.map((a, idx) => (
                      <div key={a.batchId} className="flex items-center gap-2 px-3 py-2.5 text-xs border rounded-lg"
                        style={{ borderColor: "var(--border-medium)", background: "var(--card)" }}>
                        <div className="flex-1">
                          <p className="font-mono font-semibold" style={{ color: "var(--text-primary)" }}>Batch {a.nombor_kelompok}</p>
                          <p style={{ color: "var(--text-secondary)" }}>Luput: {formatDate(a.tarikh_luput)} — {a.kuantitiDiambil} unit</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {fefoAllocation.length > 0 && (
                  <div className="mt-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                    Jumlah dialokasi: <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{totalAllocated}</span> unit
                  </div>
                )}
                {fefoAllocation.length > 0 && totalAllocated < qtyNum && (
                  <p className="text-2xs mt-1" style={{ color: "#dc2626" }}>
                    Stok tidak mencukupi. Baki: {qtyNum - totalAllocated} unit lagi diperlukan.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label style={labelStyle}>Kuantiti *</Label><Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} required style={inputStyle} /></div>
                <div><Label style={labelStyle}>Dos</Label><Input value={dose} readOnly style={{ ...inputStyle, opacity: 0.6, cursor: "default" }} /></div>
                <div>
                  <Label style={labelStyle}>Tempoh</Label>
                  <div className="flex gap-1.5">
                    <Input value={tempohNilai} onChange={(e) => setTempohNilai(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                    <select value={tempohUnit} onChange={(e) => setTempohUnit(e.target.value)} style={{ ...inputStyle, width: "auto", minWidth: 90, appearance: "auto" }}>
                      {supplyDurations.map((d: any) => <option key={d.id} value={d.nama}>{d.nama}</option>)}
                    </select>
                  </div>
                </div>
                <div><Label style={labelStyle}>Catatan</Label><Input value={catatan} onChange={(e) => setCatatan(e.target.value)} style={inputStyle} /></div>
              </div>
              <Button type="submit" title="Bekalkan ubat" disabled={!canSubmit || supplyMut.isPending} className="w-full h-12 text-sm font-bold"
                style={{ background: canSubmit ? "linear-gradient(135deg, #1877f2, #0d5bd4)" : "var(--text-muted)", color: "white" }}>
                {supplyMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Zap className="w-4 h-4 mr-2" /> Bekal {quantity && `(${quantity})`}
              </Button>
              <Button type="button" title="Ubat Tidak Perlu Dibekalkan" disabled={!selectedItem || !selectedPatient} onClick={() => setShowDeclineDialog(true)}
                className="w-full h-12 text-sm font-bold"
                style={{ background: "rgba(240,147,43,0.10)", color: "#d97706", border: "1px solid rgba(240,147,43,0.25)" }}>
                <AlertCircle className="w-4 h-4 mr-2" /> Ubat Tidak Perlu Dibekalkan
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Register New Item Dialog */}
      {showRegisterDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4" style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowRegisterDialog(false); setRegisterItemSearch(""); setRegisterSelectedItem(null); setRegisterDos(""); } }}>
          <div className="w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl bg-white" style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #f0f2f5" }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(16,185,129,0.10)" }}>
                  <Plus className="w-4 h-4" style={{ color: "#059669" }} />
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{registerSelectedItem ? "Sahkan Pendaftaran" : "Daftar Item Baharu"}</p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{registerSelectedItem ? `Daftarkan ${formatItemDisplay(registerSelectedItem)} kepada ${selectedPatient?.nama}` : `Pilih item untuk didaftarkan kepada ${selectedPatient?.nama}`}</p>
                </div>
              </div>
              <button type="button" title="Tutup dialog" onClick={() => { setShowRegisterDialog(false); setRegisterItemSearch(""); setRegisterSelectedItem(null); setRegisterDos(""); }} className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
              </button>
            </div>
            {!registerSelectedItem && (
              <>
                <div className="px-5 py-3"><Input autoFocus value={registerItemSearch} onChange={(e) => setRegisterItemSearch(e.target.value)} style={inputStyle} /></div>
                <div className="px-5 pb-4 overflow-y-auto" style={{ maxHeight: 320 }}>
                  {allActiveItems.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 py-8" style={{ color: "var(--text-muted)" }}>
                      <Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">Menyemak kuota terkini...</span>
                    </div>
                  ) : filteredRegisterItems.length === 0 ? (
                    <div className="text-center text-xs py-6" style={{ color: "var(--text-muted)" }}>Tiada item padanan.</div>
                  ) : (
                    <div className="space-y-1">
                      {filteredRegisterItems.map((it: any) => (
                        <button key={it.id} type="button" title={"Pilih " + formatItemDisplay(it)} disabled={it.kuota_penuh} onClick={() => handleSelectRegisterItem(it)}
                           className="min-h-14 w-full text-left px-3 py-3 rounded-xl text-xs flex items-center justify-between gap-3 transition-colors"
                          style={{ opacity: it.kuota_penuh ? 0.45 : 1, cursor: it.kuota_penuh ? "not-allowed" : "pointer", background: "transparent" }}
                          onMouseEnter={(e) => { if (!it.kuota_penuh) e.currentTarget.style.background = "rgba(16,185,129,0.06)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                          <div>
                            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{formatItemDisplay(it)}</p>
                            <p style={{ color: "var(--text-secondary)" }}>{it.kod_item}{it.kekuatan ? ` · ${it.kekuatan}` : ""}</p>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            {it.kuota_penuh ? (
                              <span className="text-2xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(220,38,38,0.10)", color: "#dc2626" }}>Kuota Penuh</span>
                            ) : it.baki_kuota != null ? (
                              <div className="text-[10px] leading-tight" style={{ color: "var(--text-secondary)" }}>
                                <div className="font-medium">Baki: {it.baki_kuota}</div>
                                <div>{it.patient_count ?? 0}/{it.kuota}</div>
                              </div>
                            ) : (
                              <span className="text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>Pesakit: {it.patient_count ?? 0}</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
            {registerSelectedItem && (
              <div className="px-5 py-4 space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}>
                  <Pill className="w-4 h-4 flex-shrink-0" style={{ color: "#059669" }} />
                  <div>
                    <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{formatItemDisplay(registerSelectedItem)}</p>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{registerSelectedItem.kod_item}{registerSelectedItem.kekuatan ? ` · ${registerSelectedItem.kekuatan}` : ""}</p>
                  </div>
                </div>
                <div>
                  <Label style={labelStyle}>Dos *</Label>
                  <Input autoFocus value={registerDos} onChange={(e) => setRegisterDos(e.target.value.toUpperCase())} style={inputStyle}
                    onKeyDown={(e) => { if (e.key === "Enter" && registerDos.trim()) { e.preventDefault(); handleConfirmRegisterItem(); } }} />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="ghost" onClick={() => { setRegisterSelectedItem(null); setRegisterDos(""); }} className="flex-1 h-10 text-xs font-medium" title="Kembali ke senarai item">Kembali</Button>
                  <Button type="button" title="Sahkan pendaftaran item" disabled={!registerDos.trim() || addAssignmentMut.isPending} onClick={handleConfirmRegisterItem}
                    className="flex-1 h-10 text-xs font-bold" style={{ background: registerDos.trim() && !addAssignmentMut.isPending ? "linear-gradient(135deg, #10b981, #059669)" : "var(--text-muted)", color: "white" }}>
                    {addAssignmentMut.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />} Daftar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <AddPatientDialog open={showAddPatient} onOpenChange={setShowAddPatient} />
      <DeclineSupplyDialog
        open={showDeclineDialog}
        onOpenChange={setShowDeclineDialog}
        assignmentLabel={selectedItem ? formatItemDisplay(selectedItem.item) : ""}
        isPending={declineMut.isPending}
        onSubmit={(sebab, catatan, tempoh) => declineMut.mutate(
          { assignmentId: selectedItem?.assignment_id ?? "", sebab, tempoh, catatan },
          { onSuccess: () => setShowDeclineDialog(false) }
        )}
      />
    </div>
  );
}

function parseDurationDays(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.trim().match(/(\d+(?:\.\d+)?)\s*(hari|day|minggu|week|bulan|month)/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  const unit = match[2].toLowerCase();
  if (unit.startsWith("minggu") || unit.startsWith("week")) return Math.round(amount * 7);
  if (unit.startsWith("bulan") || unit.startsWith("month")) return Math.round(amount * 30);
  return Math.round(amount);
}

function calendarDaysSince(value: string): number {
  const today = new Date(`${getTodayStrKL()}T00:00:00Z`).getTime();
  const supplied = new Date(`${toDateInputValue(value)}T00:00:00Z`).getTime();
  return Math.max(0, Math.floor((today - supplied) / (1000 * 60 * 60 * 24)));
}

function formatBalanceDays(days: number | null): string {
  if (days === null) return "Tidak dapat dikira";
  if (days < 0) return `${Math.abs(days)} hari lewat`;
  return `${days} hari`;
}

function ReferenceValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-2xs font-medium" style={{ color: "var(--text-secondary)" }}>
        {label}
      </p>
      <p className="truncate text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}
