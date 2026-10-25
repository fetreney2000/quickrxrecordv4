/**
 * AssignmentItem — Item tugasan yang boleh dikembangkan.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatItemDisplay, formatDate, formatDateTime } from "@/lib/utils";
import {
  Pill,
  Package,
  Edit,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Calendar,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FoldableCard } from "@/components/ui/foldable-card";
import { useAuth } from "@/hooks/use-auth";
import {
  useDoseHistory,
  useAssignmentActivity,
  type AssignmentWithItem,
  type DoseHistoryWithProfile,
  type SupplyActivityRow,
} from "@/hooks/use-patient-detail";

interface AssignmentItemProps {
  assignment: AssignmentWithItem;
  expanded: boolean;
  onToggle: () => void;
  onSupply: () => void;
  onUpdateDose: () => void;
  onStop: () => void;
  onDecline: () => void;
  onDeleteDeclination: (id: string) => void;
  onEditSupply: (s: { id: string; assignment_id: string; dos: string; kuantiti: number; tempoh_dibekal: string | null; catatan_bekalan: string | null; }) => void;
  onDeleteSupply: (id: string | string[]) => void;
  canSupply: boolean;
  canAssign: boolean;
  formsMap: Map<string, string>;
  /** #6: umur aktiviti terakhir (bekalan ATAU "Tak Perlu Bekal"). */
  lastActivityAge: string | null;
}

type SortDir = "asc" | "desc";

function SortableHeader({ label, sortKey, currentSort, onSort }: { label: string; sortKey: string; currentSort: { key: string; dir: SortDir } | null; onSort: (key: string) => void; }) {
  const isActive = currentSort?.key === sortKey;
  const dir = isActive ? currentSort!.dir : null;
  return (
    <th aria-sort={isActive ? (dir === "asc" ? "ascending" : "descending") : undefined} className="text-left text-xs font-semibold uppercase tracking-wider px-2 py-1.5 select-none hover:bg-muted/50 transition-colors" style={{ color: "var(--text-secondary)" }}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={`Isih mengikut ${label}`}
        aria-label={isActive ? `Isih mengikut ${label}, diisih ${dir === "asc" ? "menaik" : "menurun"}` : `Isih mengikut ${label}`}
        className="flex items-center gap-1 bg-transparent border-0 p-0 cursor-pointer"
        style={{ color: "inherit", font: "inherit", textTransform: "inherit", letterSpacing: "inherit" }}
      >
        <span className="flex items-center gap-1">
          {label}
          {isActive ? (dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ChevronDown className="w-3 h-3 opacity-30" />}
        </span>
      </button>
    </th>
  );
}

const DOSE_PAGE_SIZE = 20;
const SUPPLY_PAGE_SIZE = 20;

interface BatchInfo {
  batchId?: string | null;
  nombor_kelompok?: string | null;
  kuantiti: number;
}

interface GroupedSupplyRow extends SupplyActivityRow {
  batches: BatchInfo[];
  _allIds: string[];
  _kumpulanId: string;
}

/**
 * Kumpulkan baris bekalan secara deterministik mengikut `kumpulan_id`
 * (migrasi 065). Semua kaki satu transaksi multi-kelompok berkongsi UUID
 * yang sama — tiada lagi tekaan berasaskan masa (±5s) yang boleh menggabung
 * palsu bekalan berasingan atau memisahkan transaksi yang tulisnya lewat.
 *
 * Baris legasi tanpa kumpulan_id (NULL) tidak digabungkan — dipapar sebagai
 * baris tunggal untuk mengelakkan gabungan palsu.
 */
function groupSupplyRecords(rows: SupplyActivityRow[]): SupplyActivityRow[] {
  const groupOrder: string[] = [];
  const groups = new Map<string, SupplyActivityRow[]>();
  const result: SupplyActivityRow[] = [];

  const flushGroup = (kumpulanId: string) => {
    const group = groups.get(kumpulanId);
    if (!group || group.length === 0) return;
    if (group.length === 1) {
      result.push(group[0]);
    } else {
      const first = group[0];
      const merged: GroupedSupplyRow = {
        ...first,
        kuantiti: group.reduce((sum, r) => sum + (r.kuantiti ?? 0), 0),
        batches: group.map((r) => ({
          batchId: r.batch?.id ?? null,
          nombor_kelompok: r.batch?.nombor_kelompok ?? null,
          kuantiti: r.kuantiti ?? 0,
        })),
        _allIds: group.map((r) => r.id),
        _kumpulanId: kumpulanId,
      };
      result.push(merged);
    }
    groups.delete(kumpulanId);
  };

  for (const row of rows) {
    // Hanya bekalan dengan kumpulan_id sah layak digabungkan. Penolakan
    // (declination) dan baris legasi (NULL) sentiasa dikekalkan berasingan —
    // sebarang baris sedia ada dalam kumpulan lain disiram dahulu supaya
    // susunan tarikh terpelihara.
    if (row.kind !== "supply" || !row.kumpulanId) {
      for (const key of [...groupOrder]) {
        if (groups.has(key)) {
          flushGroup(key);
          groupOrder.splice(groupOrder.indexOf(key), 1);
        }
      }
      result.push(row);
      continue;
    }
    const key = row.kumpulanId;
    if (!groups.has(key)) {
      groups.set(key, []);
      groupOrder.push(key);
    }
    groups.get(key)!.push(row);
  }
  for (const key of groupOrder) {
    if (groups.has(key)) flushGroup(key);
  }
  return result;
}

export function AssignmentItem({ assignment, expanded, onToggle, onSupply, onUpdateDose, onStop, onDecline, onDeleteDeclination, onEditSupply, onDeleteSupply, canSupply, canAssign, formsMap, lastActivityAge }: AssignmentItemProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  // LOW-5: pemadaman penolakan dikhaskan untuk Pentadbir (pelayan 048
  // menguatkuasakan perkara sama — semakan di sini menyembunyikan butang).
  const canDeleteDeclination = canSupply && profile?.peranan === "Pentadbir";
  // Sejarah bekalan/penolakan hanya boleh diubah selagi tugasan aktif —
  // selaras dengan butang Bekal/Kemaskini/Tak-Perlu/Tamat (baris 211).
  // Rekod bekalan di bawah kebenaran bekalan (manage_supply).
  const canMutateHistory = canSupply && assignment.aktif;
  const [doseSort, setDoseSort] = useState<{ key: string; dir: SortDir } | null>(null);
  const [supplySort, setSupplySort] = useState<{ key: string; dir: SortDir } | null>(null);
  const [dosePage, setDosePage] = useState(0);
  const [supplyPage, setSupplyPage] = useState(0);
  const { data: doseHistory = [], isLoading: doseLoading, isError: doseError, refetch: refetchDose } = useDoseHistory(expanded ? assignment.id : null);
  const { data: supplyHistory = [], isLoading: supplyLoading, isError: supplyError, refetch: refetchSupply } = useAssignmentActivity(expanded ? assignment.id : null);
  const groupedSupplyHistory = useMemo(() => groupSupplyRecords(supplyHistory), [supplyHistory]);
  const item = assignment.item;
  const formName = item?.id_bentuk ? formsMap.get(item.id_bentuk) : null;

  const sortedDose = useMemo(() => {
    if (!doseSort) return doseHistory;
    // #2: nilai isihan mengikut makna paparan — tarikh sebagai cap masa,
    // perekod mengikut nama profil (bukan UUID), bukan rentetan mentah.
    const getDoseSortValue = (d: (typeof doseHistory)[number], key: string): string | number => {
      if (key === "tarikh") {
        const t = new Date((d as { tarikh?: string }).tarikh ?? "").getTime();
        return Number.isNaN(t) ? 0 : t;
      }
      if (key === "perekod" || key === "dikemaskini_oleh") {
        return (d as DoseHistoryWithProfile).dikemaskini_oleh_profile?.nama ?? "";
      }
      const v = (d as unknown as Record<string, unknown>)[key];
      return typeof v === "number" ? v : String(v ?? "");
    };
    const sorted = [...doseHistory].sort((a, b) => {
      const av = getDoseSortValue(a, doseSort.key);
      const bv = getDoseSortValue(b, doseSort.key);
      if (typeof av === "number" && typeof bv === "number") return av - bv;
      return String(av).localeCompare(String(bv), "ms");
    });
    return doseSort.dir === "asc" ? sorted : sorted.reverse();
  }, [doseHistory, doseSort]);

  const sortedSupply = useMemo(() => {
    if (!supplySort) return groupedSupplyHistory;
    // #2: sama seperti dos — tarikh sebagai cap masa, perekod mengikut nama
    // (bekalan: kakitangan_pembekal_profile; penolakan: direkod_oleh_profile).
    const getSupplySortValue = (r: SupplyActivityRow, key: string): string | number => {
      if (key === "tarikh") {
        const t = new Date(r.tarikh).getTime();
        return Number.isNaN(t) ? 0 : t;
      }
      if (key === "kuantiti") return Number(r.kuantiti ?? 0);
      if (key === "perekod" || key === "kakitangan_pembekal") {
        if (r.kind === "supply") return r.kakitangan_pembekal_profile?.nama ?? "";
        return r.direkod_oleh_profile?.nama ?? "";
      }
      const v = (r as unknown as Record<string, unknown>)[key];
      return typeof v === "number" ? v : String(v ?? "");
    };
    const sorted = [...groupedSupplyHistory].sort((a, b) => {
      const av = getSupplySortValue(a, supplySort.key);
      const bv = getSupplySortValue(b, supplySort.key);
      if (typeof av === "number" && typeof bv === "number") return av - bv;
      return String(av).localeCompare(String(bv), "ms");
    });
    return supplySort.dir === "asc" ? sorted : sorted.reverse();
  }, [groupedSupplyHistory, supplySort]);

  const pagedDose = useMemo(() => {
    const start = dosePage * DOSE_PAGE_SIZE;
    return sortedDose.slice(start, start + DOSE_PAGE_SIZE);
  }, [sortedDose, dosePage]);
  const doseTotalPages = Math.max(1, Math.ceil(sortedDose.length / DOSE_PAGE_SIZE));

  const pagedSupply = useMemo(() => {
    const start = supplyPage * SUPPLY_PAGE_SIZE;
    return sortedSupply.slice(start, start + SUPPLY_PAGE_SIZE);
  }, [sortedSupply, supplyPage]);
  const supplyTotalPages = Math.max(1, Math.ceil(sortedSupply.length / SUPPLY_PAGE_SIZE));

  const toggleSort = (type: "dose" | "supply", key: string) => {
    if (type === "dose") setDoseSort((prev) => { if (prev?.key === key) return prev.dir === "asc" ? { key, dir: "desc" } : null; return { key, dir: "asc" }; });
    else setSupplySort((prev) => { if (prev?.key === key) return prev.dir === "asc" ? { key, dir: "desc" } : null; return { key, dir: "asc" }; });
  };

  return (
    <div className="py-3 px-2">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0" style={{ background: assignment.aktif ? "linear-gradient(135deg, #1877f2, #0d5bd4)" : "var(--text-muted)", opacity: assignment.aktif ? 1 : 0.5 }}>
          <Pill className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); if (item?.id) navigate(`/stok/${item.id}`); }}
                title={item?.id ? `Lihat ${formatItemDisplay(item, formName)} di inventori` : undefined}
                className="min-w-0 max-w-full text-sm font-bold truncate bg-transparent border-0 p-0 text-left cursor-pointer"
                style={{ color: "var(--text-primary)" }}
              >
                {formatItemDisplay(item, formName)}
              </button>
              <div className="flex items-center gap-2 mt-0.5 text-xs flex-wrap" style={{ color: "var(--text-secondary)" }}>
                {item?.kod_item && <span className="font-mono">{item.kod_item}</span>}
                {assignment.dos && <span>· Dos: <strong style={{ color: "var(--text-primary)" }}>{assignment.dos}</strong></span>}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 mt-2 text-2xs" style={{ color: "var(--text-secondary)" }}>
                <span>Mula: <strong style={{ color: "var(--text-primary)" }}>{formatDate(assignment.tarikh_mula_guna)}</strong></span>
                {assignment.tarikh_tamat_guna && <span>Tamat: <strong style={{ color: "var(--text-primary)" }}>{formatDate(assignment.tarikh_tamat_guna)}</strong></span>}
                {assignment.dimulakan_oleh_profile?.nama && <span>Dimulai: <strong style={{ color: "var(--text-primary)" }}>{assignment.dimulakan_oleh_profile.nama}</strong></span>}
                {assignment.ditamatkan_oleh_profile?.nama && <span>Ditamatkan: <strong style={{ color: "var(--text-primary)" }}>{assignment.ditamatkan_oleh_profile.nama}</strong></span>}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {assignment.aktif ? <Badge variant="green" className="text-2xs">Aktif</Badge> : <Badge variant="slate" className="text-2xs">Tidak Aktif</Badge>}
                {assignment.aktif && lastActivityAge !== null && <><span className="text-2xs mr-1" style={{ color: "var(--text-secondary)" }}>Aktiviti Terakhir:</span><SupplyAgeBadge label={lastActivityAge} /></>}
              </div>
            </div>
            {(canSupply || canAssign) && assignment.aktif && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {canSupply && <Button size="sm" title="Bekal ubat kepada pesakit" onClick={(e) => { e.stopPropagation(); onSupply(); }} className="h-7 px-2"><Package className="w-3 h-3" /><span className="hidden sm:inline">Bekal</span></Button>}
                {canAssign && <Button size="sm" variant="outline" title="Kemaskini dos" onClick={(e) => { e.stopPropagation(); onUpdateDose(); }} className="h-7 px-2"><Edit className="w-3 h-3" /><span className="hidden sm:inline">Kemaskini Dos</span></Button>}
                {canSupply && <Button size="sm" variant="outline" title="Ubat Tidak Perlu Dibekalkan" onClick={(e) => { e.stopPropagation(); onDecline(); }} className="h-7 px-2" style={{ color: "#f0932b" }}><AlertCircle className="w-3 h-3" /><span className="hidden sm:inline">Tak Perlu Bekal</span></Button>}
                {canAssign && <Button size="sm" variant="outline" title="Tamatkan tugasan item" onClick={(e) => { e.stopPropagation(); onStop(); }} className="h-7 px-2" style={{ color: "#dc2626" }}><X className="w-3 h-3" /><span className="hidden sm:inline">Tamat</span></Button>}
              </div>
            )}
          </div>
          {assignment.catatan_penggunaan && <p className="text-xs mt-1 italic" style={{ color: "var(--text-secondary)" }}>{assignment.catatan_penggunaan}</p>}
          {assignment.sebab_tamat && <p className="text-xs mt-1 italic" style={{ color: "var(--text-muted)" }}>Sebab tamat: {assignment.sebab_tamat}</p>}
          <button type="button" title="Tunjuk/sembunyi sejarah" onClick={onToggle} className="mt-1.5 text-xs font-semibold flex items-center gap-1" style={{ color: "#1877f2" }}>
            {expanded ? "Sembunyikan sejarah" : "Lihat sejarah"}
            <span style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
              <ChevronDown className="w-3 h-3" />
            </span>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="ml-12 mt-2 space-y-2">
          <FoldableCard title={<span className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" style={{ color: "#1877f2" }} /> Sejarah Dos{doseHistory.length > 0 && <span className="text-2xs font-semibold px-1.5 py-0.5 rounded-md" style={{ background: "var(--bg-accent-blue)", color: "#1877f2" }}>{doseHistory.length}</span>}</span>} defaultOpen={true}>
            {doseLoading ? <div className="flex items-center gap-2 py-3"><Loader2 className="w-3 h-3 animate-spin" style={{ color: "#1877f2" }} /><span className="text-2xs" style={{ color: "var(--text-secondary)" }}>Memuatkan...</span></div> : doseError ? <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl px-3 py-2.5" role="alert" style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.25)" }}><p className="text-2xs font-medium" style={{ color: "#b91c1c" }}>Gagal memuatkan sejarah dos. Paparan mungkin tidak lengkap.</p><Button size="sm" variant="outline" onClick={() => refetchDose()} title="Cuba semula" className="h-7 text-2xs">Cuba Semula</Button></div> : doseHistory.length === 0 ? <p className="text-2xs py-2" style={{ color: "var(--text-muted)" }}>Tiada sejarah dos.</p> : <>
              <div className="overflow-x-auto mt-1">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "var(--border-light)" }}>
                      <SortableHeader label="Tarikh & Masa" sortKey="tarikh" currentSort={doseSort} onSort={(k) => { setDosePage(0); toggleSort("dose", k); }} />
                      <SortableHeader label="Dos" sortKey="dos" currentSort={doseSort} onSort={(k) => { setDosePage(0); toggleSort("dose", k); }} />
                      <SortableHeader label="Dikemaskini Oleh" sortKey="perekod" currentSort={doseSort} onSort={(k) => { setDosePage(0); toggleSort("dose", k); }} />
                      <SortableHeader label="Catatan" sortKey="catatan" currentSort={doseSort} onSort={(k) => { setDosePage(0); toggleSort("dose", k); }} />
                    </tr>
                  </thead>
                  <tbody>
                    {pagedDose.map((d) => (
                      <tr key={d.id} className="border-b last:border-b-0" style={{ borderColor: "var(--border-light)" }}>
                        <td className="px-2 py-1.5" style={{ color: "var(--text-primary)" }}>{formatDateTime(d.tarikh)}</td>
                        <td className="px-2 py-1.5 font-semibold" style={{ color: "#1877f2" }}>{d.dos}</td>
                        <td className="px-2 py-1.5" style={{ color: "var(--text-secondary)" }}>{(d as DoseHistoryWithProfile).dikemaskini_oleh_profile?.nama ?? "—"}</td>
                        <td className="px-2 py-1.5 italic" style={{ color: "var(--text-muted)" }}>{d.catatan || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {doseTotalPages > 1 && <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-[#f0f2f5]">
                <button disabled={dosePage === 0} title="Sejarah dos sebelumnya" onClick={() => setDosePage((p) => Math.max(0, p - 1))} className="h-7 sm:h-6 px-1.5 rounded-md flex items-center justify-center text-2xs font-semibold transition-colors" style={{ background: dosePage === 0 ? "transparent" : "var(--card)", color: dosePage === 0 ? "var(--text-muted)" : "var(--text-primary)", border: "1px solid var(--border)", opacity: dosePage === 0 ? 0.4 : 1, cursor: dosePage === 0 ? "default" : "pointer" }}><ChevronLeft className="w-3.5 h-3.5 sm:w-3 sm:h-3" /></button>
                {Array.from({ length: doseTotalPages }, (_, i) => (
                  <button key={i} title={`Halaman ${i + 1}`} onClick={() => setDosePage(i)} className="min-w-[28px] sm:min-w-[22px] h-7 sm:h-6 px-1 text-2xs font-semibold rounded-md transition-colors" style={i === dosePage ? { background: "linear-gradient(135deg, #1877f2, #0d5bd4)", color: "white", border: "1px solid transparent" } : { background: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)", fontWeight: 400 }}>{i + 1}</button>
                ))}
                <button disabled={dosePage >= doseTotalPages - 1} title="Sejarah dos seterusnya" onClick={() => setDosePage((p) => Math.min(doseTotalPages - 1, p + 1))} className="h-7 sm:h-6 px-1.5 rounded-md flex items-center justify-center text-2xs font-semibold transition-colors" style={{ background: dosePage >= doseTotalPages - 1 ? "transparent" : "var(--card)", color: dosePage >= doseTotalPages - 1 ? "var(--text-muted)" : "var(--text-primary)", border: "1px solid var(--border)", opacity: dosePage >= doseTotalPages - 1 ? 0.4 : 1, cursor: dosePage >= doseTotalPages - 1 ? "default" : "pointer" }}><ChevronRight className="w-3.5 h-3.5 sm:w-3 sm:h-3" /></button>
              </div>}
            </>}
          </FoldableCard>

          <FoldableCard title={<span className="flex items-center gap-2"><Package className="w-3.5 h-3.5" style={{ color: "#1877f2" }} /> Sejarah Bekalan{groupedSupplyHistory.length > 0 && <span className="text-2xs font-semibold px-1.5 py-0.5 rounded-md" style={{ background: "var(--bg-accent-blue)", color: "#1877f2" }}>{groupedSupplyHistory.length}</span>}</span>} defaultOpen={true}>
            {supplyLoading ? <div className="flex items-center gap-2 py-3"><Loader2 className="w-3 h-3 animate-spin" style={{ color: "#1877f2" }} /><span className="text-2xs" style={{ color: "var(--text-secondary)" }}>Memuatkan...</span></div> : supplyError ? <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl px-3 py-2.5" role="alert" style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.25)" }}><p className="text-2xs font-medium" style={{ color: "#b91c1c" }}>Gagal memuatkan sejarah bekalan. Paparan mungkin tidak lengkap.</p><Button size="sm" variant="outline" onClick={() => refetchSupply()} title="Cuba semula" className="h-7 text-2xs">Cuba Semula</Button></div> : groupedSupplyHistory.length === 0 ? <p className="text-2xs py-2" style={{ color: "var(--text-muted)" }}>Tiada sejarah bekalan.</p> : <>
              <div className="overflow-x-auto mt-1">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "var(--border-light)" }}>
                      <SortableHeader label="Tarikh & Masa" sortKey="tarikh" currentSort={supplySort} onSort={(k) => { setSupplyPage(0); toggleSort("supply", k); }} />
                      <SortableHeader label="Jenis" sortKey="kind" currentSort={supplySort} onSort={(k) => { setSupplyPage(0); toggleSort("supply", k); }} />
                      <SortableHeader label="Dos" sortKey="dos" currentSort={supplySort} onSort={(k) => { setSupplyPage(0); toggleSort("supply", k); }} />
                      <SortableHeader label="Kuantiti" sortKey="kuantiti" currentSort={supplySort} onSort={(k) => { setSupplyPage(0); toggleSort("supply", k); }} />
                      <th className="text-left text-xs font-semibold uppercase tracking-wider px-2 py-1.5" style={{ color: "var(--text-secondary)" }}>Tempoh</th>
                      <SortableHeader label="Direkod oleh" sortKey="perekod" currentSort={supplySort} onSort={(k) => { setSupplyPage(0); toggleSort("supply", k); }} />
                      <SortableHeader label="Catatan" sortKey="catatan" currentSort={supplySort} onSort={(k) => { setSupplyPage(0); toggleSort("supply", k); }} />
                      {canMutateHistory && <th className="text-left text-xs font-semibold uppercase tracking-wider px-2 py-1.5" style={{ color: "var(--text-secondary)" }}>Tindakan</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedSupply.map((row) => {
                      const isMerged = row.kind === "supply" && "_allIds" in row && (row as GroupedSupplyRow)._allIds.length > 1;
                      const batches = isMerged ? (row as GroupedSupplyRow).batches : [];
                      return (
                      <tr key={row.id} className="border-b last:border-b-0" style={{ borderColor: "var(--border-light)", background: row.kind === "declination" ? "rgba(240,147,43,0.04)" : "transparent" }}>
                        <td className="px-2 py-1.5" style={{ color: "var(--text-primary)" }}>{formatDateTime(row.tarikh)}</td>
                        <td className="px-2 py-1.5">
                          {row.kind === "declination" ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs font-semibold whitespace-nowrap" title="Ubat Tidak Perlu Dibekalkan" style={{ background: "rgba(240,147,43,0.12)", color: "#d97706", border: "1px solid rgba(240,147,43,0.25)" }}>
                              <AlertCircle className="w-3 h-3" /> Tak Dibekal
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs font-semibold whitespace-nowrap" style={{ background: "rgba(24,119,242,0.10)", color: "#1877f2", border: "1px solid rgba(24,119,242,0.2)" }}>
                              Bekalan
                              {isMerged && <Package className="w-2.5 h-2.5" />}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 font-semibold" style={{ color: "#1877f2" }}>
                          {row.kind === "supply" ? (row.dos || "—") : "—"}
                        </td>
                        <td className="px-2 py-1.5" style={{ color: "var(--text-primary)" }}>
                          {row.kind === "supply" ? row.kuantiti : "—"}
                        </td>
                        <td className="px-2 py-1.5" style={{ color: "var(--text-secondary)" }}>
                          {row.kind === "supply" && row.tempoh_dibekal
                            ? row.tempoh_dibekal
                            : row.kind === "declination" && row.tempoh
                            ? row.tempoh
                            : "—"}
                        </td>
                        <td className="px-2 py-1.5" style={{ color: "var(--text-secondary)" }}>
                          {row.kind === "supply"
                            ? row.kakitangan_pembekal_profile?.nama ?? "—"
                            : row.direkod_oleh_profile?.nama ?? "—"}
                        </td>
                        <td className="px-2 py-1.5" style={{ color: "var(--text-muted)" }}>
                          {row.kind === "declination"
                            ? <span className="italic">{row.sebab}{row.catatan ? ` — ${row.catatan}` : ""}</span>
                            : isMerged ? (
                              <span className="text-2xs leading-tight">
                                {batches.map((b, idx) => (
                                  <span key={idx}>
                                    {batches.length > 1 && <>{b.nombor_kelompok ?? "—"}: </>}
                                    {b.kuantiti} unit{idx < batches.length - 1 ? ", " : ""}
                                  </span>
                                ))}
                              </span>
                            ) : row.catatan || "—"}
                        </td>
                        {canMutateHistory && <td className="px-2 py-1.5">
                          {row.kind === "declination" ? (
                            <div className="flex items-center gap-1">
                              {canDeleteDeclination && (
                                <button title="Padam rekod (Pentadbir sahaja)" onClick={(e) => { e.stopPropagation(); onDeleteDeclination(row.id); }} className="hover:opacity-70" style={{ color: "#dc2626" }}><Trash2 className="w-3 h-3" /></button>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              {!isMerged && (
                                <button title="Edit rekod bekalan" onClick={(e) => { e.stopPropagation(); onEditSupply({ id: row.id, assignment_id: assignment.id, dos: row.dos ?? "", kuantiti: row.kuantiti ?? 0, tempoh_dibekal: row.tempoh_dibekal ?? null, catatan_bekalan: row.catatan ?? null }); }} className="hover:opacity-70" style={{ color: "#1877f2" }}><Edit className="w-3 h-3" /></button>
                              )}
                              {isMerged && (
                                <span title="Rekod bergabung tidak boleh disunting — padam dan bekal semula jika perlu" className="inline-flex cursor-not-allowed opacity-30" style={{ color: "var(--text-muted)" }} aria-label="Rekod bergabung tidak boleh disunting"><Edit className="w-3 h-3" /></span>
                              )}
                              <button title="Padam rekod bekalan" onClick={(e) => {
                                e.stopPropagation();
                                if (isMerged) {
                                  // Hantar sekali gus supaya induk guna laluan bulk atomik.
                                  onDeleteSupply((row as GroupedSupplyRow)._allIds);
                                } else {
                                  onDeleteSupply(row.id);
                                }
                              }} className="hover:opacity-70" style={{ color: "#dc2626" }}><Trash2 className="w-3 h-3" /></button>
                            </div>
                          )}
                        </td>}
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {supplyTotalPages > 1 && <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-[#f0f2f5]">
                <button disabled={supplyPage === 0} title="Sejarah bekalan sebelumnya" onClick={() => setSupplyPage((p) => Math.max(0, p - 1))} className="h-7 sm:h-6 px-1.5 rounded-md flex items-center justify-center text-2xs font-semibold transition-colors" style={{ background: supplyPage === 0 ? "transparent" : "var(--card)", color: supplyPage === 0 ? "var(--text-muted)" : "var(--text-primary)", border: "1px solid var(--border)", opacity: supplyPage === 0 ? 0.4 : 1, cursor: supplyPage === 0 ? "default" : "pointer" }}><ChevronLeft className="w-3.5 h-3.5 sm:w-3 sm:h-3" /></button>
                {Array.from({ length: supplyTotalPages }, (_, i) => (
                  <button key={i} title={`Halaman ${i + 1}`} onClick={() => setSupplyPage(i)} className="min-w-[28px] sm:min-w-[22px] h-7 sm:h-6 px-1 text-2xs font-semibold rounded-md transition-colors" style={i === supplyPage ? { background: "linear-gradient(135deg, #1877f2, #0d5bd4)", color: "white", border: "1px solid transparent" } : { background: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)", fontWeight: 400 }}>{i + 1}</button>
                ))}
                <button disabled={supplyPage >= supplyTotalPages - 1} title="Sejarah bekalan seterusnya" onClick={() => setSupplyPage((p) => Math.min(supplyTotalPages - 1, p + 1))} className="h-7 sm:h-6 px-1.5 rounded-md flex items-center justify-center text-2xs font-semibold transition-colors" style={{ background: supplyPage >= supplyTotalPages - 1 ? "transparent" : "var(--card)", color: supplyPage >= supplyTotalPages - 1 ? "var(--text-muted)" : "var(--text-primary)", border: "1px solid var(--border)", opacity: supplyPage >= supplyTotalPages - 1 ? 0.4 : 1, cursor: supplyPage >= supplyTotalPages - 1 ? "default" : "pointer" }}><ChevronRight className="w-3.5 h-3.5 sm:w-3 sm:h-3" /></button>
              </div>}
            </>}
          </FoldableCard>
        </div>
      )}
    </div>
  );
}

function SupplyAgeBadge({ label }: { label: string }) {
  return (
    <span className="text-2xs font-semibold px-1.5 py-0.5 rounded-md" style={{ background: "var(--bg-accent-blue)", color: "var(--text-blue)" }}>
      {label}
    </span>
  );
}
