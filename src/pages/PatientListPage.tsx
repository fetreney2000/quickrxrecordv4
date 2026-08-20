/**
 * PatientListPage — Senarai Pesakit dengan carian, isihan, dan pagination.
 */
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Users,
  Search,
  IdCard,
  Activity,
  ChevronRight,
  ChevronLeft,
  Inbox,
  UserPlus,
  Loader2,
  Stethoscope,
  FileText,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { useAuth } from "@/hooks/use-auth";
import { useNavStore, HOME_CRUMB } from "@/lib/nav-store";
import {
  SEARCH_DEBOUNCE_MS,
  usePatients,
  type SortState,
} from "@/hooks/use-patients";
import { SortIcon } from "@/components/patient/sort-icon";
import { AddPatientDialog } from "@/components/patient/add-patient-dialog";
import { PatientRow } from "@/components/patient/patient-row";
import { formatDate, formatMyKad } from "@/lib/utils";
import type { Patient } from "@/types";
import { Skeleton, SkeletonRow } from "@/components/ui/skeleton";

function User(props: { className?: string }) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export default function PatientListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { can } = useAuth();
  const setNavSource = useNavStore((s) => s.setNavSource);
  const setBreadcrumbTrail = useNavStore((s) => s.setBreadcrumbTrail);

  const initialQuery = searchParams.get("q") ?? "";
  const [search, setSearch] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [searchFocused, setSearchFocused] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [sort, setSort] = useState<SortState | null>(null);
  const [openAdd, setOpenAdd] = useState(false);
  const [activeTab, setActiveTab] = useState<"aktif" | "dinyahaktif">("aktif");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (initialQuery) searchInputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
      setBreadcrumbTrail([HOME_CRUMB, { label: "Senarai Pesakit" }]);
    }, SEARCH_DEBOUNCE_MS);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [search]);

  useEffect(() => { setPage(0); }, [pageSize]);
  useEffect(() => { setPage(0); setSort(null); }, [activeTab]);

  const isActive = activeTab === "aktif";
  const { data, isLoading, isFetching } = usePatients({ search: debouncedSearch, page, pageSize, sort, active: isActive });
  const patients = data?.patients ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const canEdit = can("manage_patients");

  const toggleSort = useCallback((columnKey: string) => {
    setSort((prev) => {
      if (prev?.key === columnKey) return { key: columnKey, dir: prev.dir === "asc" ? "desc" : "asc" };
      return { key: columnKey, dir: "asc" };
    });
    setPage(0);
  }, []);

  const handlePatientClick = useCallback((patient: Patient) => {
    setNavSource("list");
    setBreadcrumbTrail([HOME_CRUMB, { label: "Senarai Pesakit", href: "/pesakit" }, { label: patient.nama }]);
    navigate(`/pesakit/${patient.id}?from=list`);
  }, [navigate, setNavSource, setBreadcrumbTrail]);

  const pageButtons = useMemo(() => {
    const buttons: (number | "...")[] = [];
    if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) buttons.push(i); }
    else if (page < 3) { for (let i = 1; i <= 7; i++) buttons.push(i); }
    else if (page > totalPages - 4) { for (let i = totalPages - 6; i <= totalPages; i++) buttons.push(i); }
    else { buttons.push(1); buttons.push("..."); for (let i = page - 1; i <= page + 3; i++) buttons.push(i); buttons.push("..."); buttons.push(totalPages); }
    return buttons;
  }, [page, totalPages]);

  return (
    <div className="relative space-y-4">
      <div className="pointer-events-none absolute -top-[60px] -right-[60px] z-0" style={{ width: 300, height: 300, borderRadius: "50%", background: "rgba(24,119,242,0.03)", filter: "blur(30px)" }} />

      <Breadcrumb items={[{ label: "Senarai Pesakit" }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white flex-shrink-0" style={{ background: "linear-gradient(135deg, #1877f2, #0d5bd4)", boxShadow: "0 4px 12px rgba(24,119,242,0.3)" }}>
            <Users className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight truncate" style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Senarai Pesakit</h1>
            <p className="text-sm font-medium mt-0.5" style={{ color: "var(--text-secondary)" }}>Urus rekod pesakit berdaftar</p>
          </div>
        </div>
        {canEdit && isActive && (
          <Button onClick={() => setOpenAdd(true)} className="min-h-11 w-full self-start sm:w-auto sm:self-auto" title="Daftar pesakit baharu" style={{ background: "linear-gradient(135deg, #1877f2, #0d5bd4)", boxShadow: "0 4px 12px rgba(24,119,242,0.25)" }}>
            <UserPlus className="w-4 h-4" /> Daftar Pesakit
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "aktif" | "dinyahaktif")}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="aktif" className="flex-1 sm:flex-none gap-2 min-h-11 sm:min-h-0">
            <Activity className="w-4 h-4" />
            Aktif
          </TabsTrigger>
          <TabsTrigger value="dinyahaktif" className="flex-1 sm:flex-none gap-2 min-h-11 sm:min-h-0">
            <ShieldAlert className="w-4 h-4" />
            Dinyahaktif
          </TabsTrigger>
        </TabsList>

        <TabsContent value="aktif" className="mt-3">
          <PatientListContent
            patients={patients}
            isLoading={isLoading}
            isFetching={isFetching}
            total={total}
            totalPages={totalPages}
            page={page}
            pageSize={pageSize}
            sort={sort}
            search={search}
            debouncedSearch={debouncedSearch}
            searchFocused={searchFocused}
            setSearch={setSearch}
            setSearchFocused={setSearchFocused}
            searchInputRef={searchInputRef}
            setPage={setPage}
            setPageSize={setPageSize}
            toggleSort={toggleSort}
            handlePatientClick={handlePatientClick}
            pageButtons={pageButtons}
            canEdit={canEdit}
            mode="aktif"
          />
        </TabsContent>

        <TabsContent value="dinyahaktif" className="mt-3">
          <PatientListContent
            patients={patients}
            isLoading={isLoading}
            isFetching={isFetching}
            total={total}
            totalPages={totalPages}
            page={page}
            pageSize={pageSize}
            sort={sort}
            search={search}
            debouncedSearch={debouncedSearch}
            searchFocused={searchFocused}
            setSearch={setSearch}
            setSearchFocused={setSearchFocused}
            searchInputRef={searchInputRef}
            setPage={setPage}
            setPageSize={setPageSize}
            toggleSort={toggleSort}
            handlePatientClick={handlePatientClick}
            pageButtons={pageButtons}
            canEdit={canEdit}
            mode="dinyahaktif"
          />
        </TabsContent>
      </Tabs>
      <AddPatientDialog open={openAdd} onOpenChange={setOpenAdd} />
    </div>
  );
}

interface SortableHeaderProps { columnKey: string; label: string; sort: SortState | null; onSort: (key: string) => void; icon: LucideIcon | typeof User; }

function SortableHeader({ columnKey, label, sort, onSort, icon: Icon }: SortableHeaderProps) {
  const isActive = sort?.key === columnKey;
  return (
    <button type="button" onClick={() => onSort(columnKey)} title={`Isih mengikut ${label}`} className="flex items-center gap-1.5 hover:text-foreground transition-colors text-left" style={{ color: isActive ? "#1877f2" : "var(--text-secondary)" }}>
      <Icon className="w-3 h-3" /><span>{label}</span><SortIcon active={isActive} dir={sort?.dir ?? "asc"} />
    </button>
  );
}

// ============================================================================
// PatientListContent — reusable list content for both tabs
// ============================================================================
interface PatientListContentProps {
  patients: (Patient & { bilangan_item?: number; dinyahaktif_oleh_nama?: string })[];
  isLoading: boolean;
  isFetching: boolean;
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
  sort: SortState | null;
  search: string;
  debouncedSearch: string;
  searchFocused: boolean;
  setSearch: (v: string) => void;
  setSearchFocused: (v: boolean) => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
  setPage: (v: number | ((p: number) => number)) => void;
  setPageSize: (v: number) => void;
  toggleSort: (key: string) => void;
  handlePatientClick: (p: Patient) => void;
  pageButtons: (number | "...")[];
  canEdit: boolean;
  mode: "aktif" | "dinyahaktif";
}

function PatientListContent({
  patients,
  isLoading,
  isFetching,
  total,
  totalPages,
  page,
  pageSize,
  sort,
  search,
  debouncedSearch,
  searchFocused,
  setSearch,
  setSearchFocused,
  searchInputRef,
  setPage,
  setPageSize,
  toggleSort,
  handlePatientClick,
  pageButtons,
  canEdit,
  mode,
}: PatientListContentProps) {
  const isDeactivated = mode === "dinyahaktif";

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ background: "var(--card)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
      <div className="p-3 sm:p-5 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b" style={{ borderColor: "var(--border-light)" }}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 min-w-0" style={{ maxWidth: 500 }}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: searchFocused ? "#1877f2" : "var(--text-muted)" }} />
            <Input ref={searchInputRef} type="search" value={search} onChange={(e) => setSearch(e.target.value)} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} placeholder="Cari nama, No. KP, atau No. Hospital..." className="h-9 pl-10 text-sm font-medium" style={{ background: "var(--bg-accent-blue)", border: searchFocused ? "1px solid rgba(24,119,242,0.3)" : "1px solid transparent", borderRadius: 10, boxShadow: searchFocused ? "0 0 0 4px rgba(24,119,242,0.08)" : "none" }} />
          </div>
          <div className="inline-flex min-h-10 items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold flex-shrink-0" style={{ background: isDeactivated ? "rgba(217,119,6,0.08)" : "var(--bg-accent-blue)", color: "var(--text-secondary)", border: isDeactivated ? "1px solid rgba(217,119,6,0.25)" : "1px solid var(--bg-accent-blue)" }}>
            <span style={{ color: isDeactivated ? "#d97706" : "#1877f2" }}>{total.toLocaleString("ms-MY")}</span><span>pesakit</span>
          </div>
          {isFetching && !isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "#1877f2" }} />}
        </div>
      </div>
      <div className="relative">
        {isLoading && <div>{Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={isDeactivated ? 4 : 5} />)}</div>}
        {!isLoading && patients.length === 0 && debouncedSearch && <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: "var(--text-muted)" }}><Inbox className="w-10 h-10 opacity-40" /><p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Tiada pesakit dijumpai.</p><p className="text-xs">Cuba tukar kata kunci carian anda.</p></div>}
        {!isLoading && patients.length === 0 && !debouncedSearch && (
          <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: "var(--text-muted)" }}>
            {isDeactivated ? <ShieldAlert className="w-10 h-10 opacity-40" /> : <Users className="w-10 h-10 opacity-40" />}
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              {isDeactivated ? "Tiada pesakit yang dinyahaktifkan." : "Tiada pesakit berdaftar."}
            </p>
            {!isDeactivated && canEdit && <p className="text-xs">Klik "Daftar Pesakit" untuk mendaftarkan pesakit baru.</p>}
          </div>
        )}
        {!isLoading && patients.length > 0 && (
          <>
            {isDeactivated ? (
              <div className="hidden sm:grid px-4 py-2.5 text-2xs font-semibold uppercase tracking-wider" style={{ gridTemplateColumns: "3fr 3fr 3fr 3fr", gap: 12, color: "var(--text-secondary)", background: "var(--bg-secondary)", borderBottom: "2px solid var(--border-medium)" }}>
                <SortableHeader columnKey="nama" label="Nama" sort={sort} onSort={toggleSort} icon={User} />
                <SortableHeader columnKey="nombor_kad_pengenalan" label="No. Kad Pengenalan" sort={sort} onSort={toggleSort} icon={IdCard} />
                <SortableHeader columnKey="nombor_pendaftaran_hospital" label="No. Pendaftaran Hospital" sort={sort} onSort={toggleSort} icon={Activity} />
                <div>Tarikh Nyahaktif</div>
              </div>
            ) : (
              <div className="hidden sm:grid px-4 py-2.5 text-2xs font-semibold uppercase tracking-wider" style={{ gridTemplateColumns: "3fr 3fr 3fr 2fr 2fr", gap: 12, color: "var(--text-secondary)", background: "var(--bg-secondary)", borderBottom: "2px solid var(--border-medium)" }}>
                <SortableHeader columnKey="nama" label="Nama" sort={sort} onSort={toggleSort} icon={User} />
                <SortableHeader columnKey="nombor_kad_pengenalan" label="No. Kad Pengenalan" sort={sort} onSort={toggleSort} icon={IdCard} />
                <SortableHeader columnKey="nombor_pendaftaran_hospital" label="No. Pendaftaran Hospital" sort={sort} onSort={toggleSort} icon={Activity} />
                <SortableHeader columnKey="dokumen_lain" label="Dokumen Lain" sort={sort} onSort={toggleSort} icon={FileText} />
                <div>Bilangan Item</div>
              </div>
            )}
            {patients.map((p, idx) => isDeactivated ? (
              <DeactivatedPatientRow key={p.id} patient={p} index={idx} onClick={() => handlePatientClick(p)} />
            ) : (
              <PatientRow key={p.id} patient={p} index={idx} onClick={() => handlePatientClick(p)} />
            ))}
          </>
        )}
      </div>
      {!isLoading && totalPages > 1 && (
        <div className="px-3 py-3 sm:px-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderColor: "var(--border-light)" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Halaman {page + 1} daripada {totalPages} ({total.toLocaleString("ms-MY")} pesakit)</p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Paparan:</span>
              <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="h-11 min-w-16 text-xs px-2 rounded-lg sm:h-8" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-primary)" }} aria-label="Bilangan pesakit setiap halaman">
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
          <div className="flex items-center justify-end gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} title="Halaman sebelumnya" className="h-11 w-11 p-0 sm:h-8 sm:w-auto sm:px-2" style={{ opacity: page === 0 ? 0.4 : 1, cursor: page === 0 ? "default" : "pointer" }}><ChevronLeft className="w-3.5 h-3.5" /></Button>
            {pageButtons.map((b, i) => b === "..." ? <span key={`dots-${i}`} className="px-1.5 text-xs" style={{ color: "var(--text-muted)" }}>…</span> : (
               <button key={b} onClick={() => setPage(b - 1)} title={`Pergi ke halaman ${b}`} className="min-h-11 min-w-11 px-2 text-xs font-semibold rounded-lg transition-colors sm:h-7 sm:min-h-0 sm:min-w-[28px]" style={b === page + 1 ? { background: "linear-gradient(135deg, #1877f2, #0d5bd4)", color: "white", fontWeight: 600, border: "1px solid transparent" } : { background: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)", fontWeight: 400 }}>{b}</button>
            ))}
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} title="Halaman seterusnya" className="h-11 w-11 p-0 sm:h-8 sm:w-auto sm:px-2" style={{ opacity: page >= totalPages - 1 ? 0.4 : 1, cursor: page >= totalPages - 1 ? "default" : "pointer" }}><ChevronRight className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// DeactivatedPatientRow — read-only row for deactivated patients
// ============================================================================
function DeactivatedPatientRow({ patient, index, onClick }: { patient: Patient & { dinyahaktif_oleh_nama?: string }; index: number; onClick: () => void }) {
  return (
    <>
      {/* Desktop: grid row */}
      <div
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
        className="hidden sm:grid px-4 py-2.5 items-center cursor-pointer transition-colors hover:bg-[rgba(217,119,6,0.05)]"
        style={{ gridTemplateColumns: "3fr 3fr 3fr 3fr", gap: 12, borderBottom: "1px solid var(--border-light)" }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-[10px] flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: "linear-gradient(135deg, #9ca3af, #6b7280)" }}>
            {patient.nama?.[0]?.toUpperCase() || "?"}
          </div>
          <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{patient.nama}</span>
        </div>
        <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>
          {patient.nombor_kad_pengenalan ? formatMyKad(patient.nombor_kad_pengenalan) : <em style={{ color: "var(--text-muted)" }}>-</em>}
        </span>
        <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>
          {patient.nombor_pendaftaran_hospital || <em style={{ color: "var(--text-muted)" }}>-</em>}
        </span>
        <span className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>
          {formatDate(patient.tarikh_nyahaktif) || <em style={{ color: "var(--text-muted)" }}>-</em>}
        </span>
      </div>

      {/* Mobile: card row */}
      <div
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
        className="sm:hidden flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-[#f0f2f5] transition-colors hover:bg-[rgba(217,119,6,0.05)]"
      >
        <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: "linear-gradient(135deg, #9ca3af, #6b7280)" }}>
          {patient.nama?.[0]?.toUpperCase() || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{patient.nama}</p>
          <div className="flex items-center gap-2 text-xs truncate" style={{ color: "var(--text-secondary)" }}>
            {patient.nombor_kad_pengenalan && (
              <span className="flex items-center gap-0.5">
                <IdCard className="w-3 h-3" />
                {formatMyKad(patient.nombor_kad_pengenalan)}
              </span>
            )}
            {patient.tarikh_nyahaktif && (
              <span className="flex items-center gap-0.5">
                <ShieldAlert className="w-3 h-3" style={{ color: "#d97706" }} />
                {formatDate(patient.tarikh_nyahaktif)}
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
      </div>
    </>
  );
}
