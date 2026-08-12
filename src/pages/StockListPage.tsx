/**
 * StockListPage — Senarai Inventori dengan carian, isihan, dan pagination.
 */
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Pill, Plus, Search, ChevronLeft, ChevronRight, Loader2, Inbox, BarChart3, type LucideIcon, Hash, Tag, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { useAuth } from "@/hooks/use-auth";
import { useNavStore, HOME_CRUMB } from "@/lib/nav-store";
import { SEARCH_DEBOUNCE_MS } from "@/hooks/use-patients";
import { useItems, INVENTORY_PAGE_SIZE, type SortState } from "@/hooks/use-inventory";
import { SortIcon } from "@/components/patient/sort-icon";
import { AddItemDialog } from "@/components/inventory/add-item-dialog";
import { StockRow } from "@/components/inventory/stock-row";
import type { Item } from "@/types";
import { Skeleton, SkeletonRow } from "@/components/ui/skeleton";
import { formatItemDisplay } from "@/lib/utils";

function TagIcon(props: { className?: string }) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>;
}

export default function StockListPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const setNavSource = useNavStore((s) => s.setNavSource);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [sort, setSort] = useState<SortState | null>(null);
  const [openAdd, setOpenAdd] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const setBreadcrumbTrail = useNavStore((s) => s.setBreadcrumbTrail);

  useEffect(() => { document.title = "Inventori — QuickRxRecord"; setNavSource("list"); setBreadcrumbTrail([HOME_CRUMB, { label: "Senarai Inventori" }]); }, [setNavSource, setBreadcrumbTrail]);
  useEffect(() => { setPage(0); }, [pageSize]);
  useEffect(() => { if (debounceTimer.current) clearTimeout(debounceTimer.current); debounceTimer.current = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, SEARCH_DEBOUNCE_MS); return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); }; }, [search]);
  const { data, isLoading, isFetching } = useItems({ search: debouncedSearch, page, pageSize, sort });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const canEdit = can("manage_items");

  const toggleSort = useCallback((columnKey: string) => { setSort((prev: SortState | null) => { if (prev?.key === columnKey) return { key: columnKey, dir: prev.dir === "asc" ? "desc" : "asc" }; return { key: columnKey, dir: "asc" }; }); setPage(0); }, []);
  const handleItemClick = useCallback((item: Item) => { const displayTitle = formatItemDisplay(item); setBreadcrumbTrail([HOME_CRUMB, { label: "Senarai Inventori", href: "/stok" }, { label: displayTitle }]); navigate(`/stok/${item.id}`); }, [navigate, setBreadcrumbTrail]);

  const pageButtons = useMemo(() => {
    const buttons: (number | "...")[] = [];
    if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) buttons.push(i); }
    else { const cur = page + 1; if (cur < 5) { for (let i = 1; i <= 6; i++) buttons.push(i); buttons.push("..."); buttons.push(totalPages); } else if (cur > totalPages - 4) { buttons.push(1); buttons.push("..."); for (let i = totalPages - 5; i <= totalPages; i++) buttons.push(i); } else { buttons.push(1); buttons.push("..."); for (let i = cur - 2; i <= cur + 2; i++) buttons.push(i); buttons.push("..."); buttons.push(totalPages); } }
    return buttons;
  }, [page, totalPages]);

  return (
    <div className="space-y-4">
      <Breadcrumb items={[{ label: "Senarai Inventori" }]} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white flex-shrink-0" style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)", boxShadow: "0 4px 12px rgba(124,58,237,0.3)" }}><Pill className="w-5 h-5" strokeWidth={2.5} /></div>
          <div className="min-w-0"><h1 className="text-2xl font-bold leading-tight truncate" style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Senarai Inventori</h1><p className="text-sm font-medium mt-0.5" style={{ color: "var(--text-secondary)" }}>Urus item ubat dalam katalog</p></div>
        </div>
        {canEdit && <Button onClick={() => setOpenAdd(true)} title="Tambah item ubat baharu" className="self-start sm:self-auto" style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)", boxShadow: "0 4px 12px rgba(124,58,237,0.25)" }}><Plus className="w-4 h-4" /> Tambah Item</Button>}
      </div>
      <div><Card><CardContent className="p-0 relative">
        <div className="p-3 sm:p-5 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#f0f2f5]">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="relative flex-1 min-w-0" style={{ maxWidth: 500 }}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: searchFocused ? "#7c3aed" : "var(--text-muted)" }} />
              <Input ref={searchInputRef} type="search" value={search} onChange={(e) => setSearch(e.target.value)} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} placeholder="Cari kod, nama, atau nama dagangan..." className="h-9 pl-10 text-sm font-medium" style={{ background: "rgba(124,58,237,0.04)", border: searchFocused ? "1px solid rgba(124,58,237,0.3)" : "1px solid transparent", borderRadius: 10, boxShadow: searchFocused ? "0 0 0 4px rgba(124,58,237,0.08)" : "none" }} />
            </div>
            <div className="inline-flex min-h-10 items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold flex-shrink-0" style={{ background: "rgba(124,58,237,0.06)", color: "var(--text-secondary)", border: "1px solid rgba(124,58,237,0.10)" }}><span style={{ color: "#7c3aed" }}>{total.toLocaleString("ms-MY")}</span><span>item</span></div>
            {isFetching && !isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "#7c3aed" }} />}
          </div>
        </div>
        <div className="relative">
          {isLoading && <div>{Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={5} />)}</div>}
          {!isLoading && items.length === 0 && debouncedSearch && <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: "var(--text-muted)" }}><Inbox className="w-10 h-10 opacity-40" /><p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Tiada item dijumpai.</p><p className="text-xs">Cuba tukar kata kunci carian anda.</p></div>}
          {!isLoading && items.length === 0 && !debouncedSearch && <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: "var(--text-muted)" }}><Pill className="w-10 h-10 opacity-40" /><p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Tiada item dalam inventori.</p>{canEdit && <p className="text-xs">Klik "Tambah Item" untuk mendaftarkan item baru.</p>}</div>}
          {!isLoading && items.length > 0 && (
            <>
              <div className="hidden sm:grid stok-table-header px-4 py-2.5 text-2xs font-semibold uppercase tracking-wider" style={{ gridTemplateColumns: "1.2fr 3fr 1fr 1fr 1fr", gap: 12, color: "var(--text-secondary)", background: "rgba(0,0,0,0.02)", borderBottom: "2px solid var(--border-medium)" }}>
                <SortableHeader columnKey="kod_item" label="Kod" sort={sort} onSort={toggleSort} icon={Hash} />
                <SortableHeader columnKey="nama_item" label="Nama Item" sort={sort} onSort={toggleSort} icon={TagIcon} />
                <SortableHeader columnKey="quota" label="Kuota" sort={sort} onSort={toggleSort} icon={BarChart3} />
                 <SortableHeader columnKey="stock" label="Stok" sort={sort} onSort={toggleSort} icon={Package} />
                 <SortableHeader columnKey="remaining" label="Baki Kuota" sort={sort} onSort={toggleSort} icon={BarChart3} />
              </div>
              {items.map((it, idx) => <StockRow key={it.id} item={it as any} index={idx} onClick={() => handleItemClick(it)} />)}
            </>
          )}
        </div>
        {!isLoading && totalPages > 1 && (
          <div className="px-4 py-3 border-t border-[#f0f2f5] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Halaman {page + 1} daripada {totalPages} ({total.toLocaleString("ms-MY")} item)</p>
              <div className="flex items-center gap-1.5">
<span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Paparan:</span>
                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="h-7 text-xs px-2 rounded-lg" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} title="Halaman sebelumnya" className="h-7 px-2" style={{ opacity: page === 0 ? 0.4 : 1 }}><ChevronLeft className="w-3.5 h-3.5" /></Button>
              {pageButtons.map((b, i) => b === "..." ? <span key={`dots-${i}`} className="px-1.5 text-xs" style={{ color: "var(--text-muted)" }}>…</span> : (
                <button key={b} onClick={() => setPage(b - 1)} title={`Pergi ke halaman ${b}`} className="min-w-[28px] sm:min-w-[28px] w-8 h-8 sm:w-7 sm:h-7 px-2 text-xs font-semibold rounded-lg transition-colors" style={b === page + 1 ? { background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "white", fontWeight: 600, border: "1px solid transparent" } : { background: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)", fontWeight: 400 }}>{b}</button>
              ))}
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} title="Halaman seterusnya" className="h-7 px-2" style={{ opacity: page >= totalPages - 1 ? 0.4 : 1 }}><ChevronRight className="w-3.5 h-3.5" /></Button>
            </div>
          </div>
        )}
        {!isLoading && totalPages === 1 && total > 0 && <div className="px-4 py-2 border-t border-[#f0f2f5] text-xs flex items-center gap-3" style={{ color: "var(--text-secondary)" }}><span>{total.toLocaleString("ms-MY")} item · Halaman 1 daripada 1</span><div className="flex items-center gap-1.5"><span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Paparan:</span><select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="h-7 text-xs px-2 rounded-lg" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></div></div>}
      </CardContent></Card></div>
      <AddItemDialog open={openAdd} onOpenChange={setOpenAdd} />
    </div>
  );
}

interface SortableHeaderProps { columnKey: string; label: string; sort: SortState | null; onSort: (key: string) => void; icon: LucideIcon | typeof TagIcon; }

function SortableHeader({ columnKey, label, sort, onSort, icon: Icon }: SortableHeaderProps) {
  const isActive = sort?.key === columnKey;
   const titles: Record<string, string> = { kod_item: "Isih mengikut Kod", nama_item: "Isih mengikut Nama Item", quota: "Isih mengikut Kuota", stock: "Isih mengikut Stok", remaining: "Isih mengikut Baki Kuota" };
  return <button type="button" onClick={() => onSort(columnKey)} title={titles[columnKey]} className="flex items-center gap-1.5 hover:text-foreground transition-colors text-left" style={{ color: isActive ? "#7c3aed" : "var(--text-secondary)" }}><Icon className="w-3 h-3" /><span>{label}</span><SortIcon active={isActive} dir={sort?.dir ?? "asc"} /></button>;
}
