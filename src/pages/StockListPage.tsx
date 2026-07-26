/**
 * StockListPage — Senarai Inventori dengan carian, isihan, dan pagination.
 *
 * Tema: Ungu (#7c3aed)
 * Ciri:
 *  - Bar carian dengan lencana kiraan
 *  - Jadual 5 lajur (Kod, Nama, Kuota, Stok, Tindakan)
 *  - Isihan 3 lajur boleh isih (Kod, Nama, Kuota) — Stok dikira di klien
 *  - Pagination 50/halaman
 *  - Dialog Tambah Item (8 medan)
 *  - Orb ungu, breadcrumb, header dengan ikon Pill
 */
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Pill,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Inbox,
  BarChart3,
  type LucideIcon,
  Hash,
  Tag,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { useAuth } from "@/hooks/use-auth";
import { useNavStore } from "@/lib/nav-store";
import { SEARCH_DEBOUNCE_MS } from "@/hooks/use-patients";
import {
  useItems,
  INVENTORY_PAGE_SIZE,
  type SortState,
} from "@/hooks/use-inventory";
import { SortIcon } from "@/components/patient/sort-icon";
import { AddItemDialog } from "@/components/inventory/add-item-dialog";
import { StockRow } from "@/components/inventory/stock-row";
import type { Item } from "@/types";

// Custom SVG icon untuk header
function TagIcon(props: { className?: string }) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

export default function StockListPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const setNavSource = useNavStore((s) => s.setNavSource);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortState | null>(null);
  const [openAdd, setOpenAdd] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.title = "Inventori — QuickRxRecord";
    setNavSource("list");
  }, [setNavSource]);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [search]);

  const { data, isLoading, isFetching } = useItems({
    search: debouncedSearch,
    page,
    sort,
  });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const canEdit = can("manage_items");

  const toggleSort = useCallback((columnKey: string) => {
    setSort((prev: SortState | null) => {
      if (prev?.key === columnKey) {
        return { key: columnKey, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key: columnKey, dir: "asc" };
    });
    setPage(0);
  }, []);

  const handleItemClick = useCallback(
    (item: Item) => {
      navigate(`/stok/${item.id}`);
    },
    [navigate]
  );

  const pageButtons = useMemo(() => {
    const buttons: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) buttons.push(i);
    } else {
      const cur = page + 1;
      if (cur < 5) {
        for (let i = 1; i <= 6; i++) buttons.push(i);
        buttons.push("...");
        buttons.push(totalPages);
      } else if (cur > totalPages - 4) {
        buttons.push(1);
        buttons.push("...");
        for (let i = totalPages - 5; i <= totalPages; i++) buttons.push(i);
      } else {
        buttons.push(1);
        buttons.push("...");
        for (let i = cur - 2; i <= cur + 2; i++) buttons.push(i);
        buttons.push("...");
        buttons.push(totalPages);
      }
    }
    return buttons;
  }, [page, totalPages]);

  return (
    <div className="space-y-4">
      <Breadcrumb
        showBackButton={false}
        items={[{ label: "Senarai Inventori" }]}
        icon={Pill}
      />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.02, duration: 0.15 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-white flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
              boxShadow: "0 4px 12px rgba(124,58,237,0.3)",
            }}
          >
            <Pill className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h1
              className="text-[22px] font-bold leading-tight truncate"
              style={{ color: "#1c1e21", letterSpacing: "-0.01em" }}
            >
              Senarai Inventori
            </h1>
            <p
              className="text-[13px] font-medium mt-0.5"
              style={{ color: "#65676b" }}
            >
              Urus item ubat dalam katalog
            </p>
          </div>
        </div>

        {canEdit && (
          <Button
            onClick={() => setOpenAdd(true)}
            className="self-start sm:self-auto"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
              boxShadow: "0 4px 12px rgba(124,58,237,0.25)",
            }}
          >
            <Plus className="w-4 h-4" />
            Tambah Item
          </Button>
        )}
      </motion.div>

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.01, duration: 0.15 }}
      >
        <Card>
          <CardContent className="p-0 relative">
            {/* Accent bar (purple-blue-cyan) */}
            <div
              className="absolute top-0 left-6 right-6 h-[3px] rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, #7c3aed, #06b6d4, #1877f2, #7c3aed)",
                backgroundSize: "200% 100%",
                animation: "gradient-x 4s linear infinite",
              }}
            />

            {/* Search bar */}
            <div className="p-4 sm:p-5 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#f0f2f5]">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div
                  className="relative flex-1 min-w-0"
                  style={{ maxWidth: 400 }}
                >
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                    style={{
                      color: searchFocused ? "#7c3aed" : "#9ca3af",
                    }}
                  />
                  <Input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    placeholder="Cari kod, nama, atau nama dagangan..."
                    className="h-9 pl-10 text-[13px] font-medium"
                    style={{
                      background: "rgba(124,58,237,0.04)",
                      border: searchFocused
                        ? "1px solid rgba(124,58,237,0.3)"
                        : "1px solid transparent",
                      borderRadius: 10,
                      boxShadow: searchFocused
                        ? "0 0 0 4px rgba(124,58,237,0.08)"
                        : "none",
                    }}
                  />
                </div>
                <div
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[12px] font-semibold flex-shrink-0"
                  style={{
                    background: "rgba(124,58,237,0.06)",
                    color: "#65676b",
                    border: "1px solid rgba(124,58,237,0.10)",
                  }}
                >
                  <span style={{ color: "#7c3aed" }}>
                    {total.toLocaleString("ms-MY")}
                  </span>
                  <span>item</span>
                </div>
                {isFetching && !isLoading && (
                  <Loader2
                    className="w-3.5 h-3.5 animate-spin"
                    style={{ color: "#7c3aed" }}
                  />
                )}
              </div>
            </div>

            {/* Content area */}
            <div className="relative">
              {isLoading && (
                <div
                  className="flex flex-col items-center justify-center py-12 gap-2"
                  style={{ color: "#65676b" }}
                >
                  <Loader2
                    className="w-6 h-6 animate-spin"
                    style={{ color: "#7c3aed" }}
                  />
                  <p className="text-sm">Memuatkan item...</p>
                </div>
              )}

              {!isLoading && items.length === 0 && debouncedSearch && (
                <div
                  className="flex flex-col items-center justify-center py-12 gap-2"
                  style={{ color: "#9ca3af" }}
                >
                  <Inbox className="w-10 h-10 opacity-40" />
                  <p className="text-sm font-medium" style={{ color: "#65676b" }}>
                    Tiada item dijumpai.
                  </p>
                  <p className="text-xs">
                    Cuba tukar kata kunci carian anda.
                  </p>
                </div>
              )}

              {!isLoading && items.length === 0 && !debouncedSearch && (
                <div
                  className="flex flex-col items-center justify-center py-12 gap-2"
                  style={{ color: "#9ca3af" }}
                >
                  <Pill className="w-10 h-10 opacity-40" />
                  <p className="text-sm font-medium" style={{ color: "#65676b" }}>
                    Tiada item dalam inventori.
                  </p>
                  {canEdit && (
                    <p className="text-xs">
                      Klik "Tambah Item" untuk mendaftarkan item baru.
                    </p>
                  )}
                </div>
              )}

              {!isLoading && items.length > 0 && (
                <>
                  <div
                    className="hidden sm:grid stok-table-header px-4 py-2.5 text-2xs font-semibold uppercase tracking-wider"
                    style={{
                      gridTemplateColumns: "1.2fr 3fr 1fr 1fr 1fr",
                      gap: 12,
                      color: "#65676b",
                      background: "rgba(0,0,0,0.02)",
                      borderBottom: "2px solid #e4e6eb",
                    }}
                  >
                    <SortableHeader
                      columnKey="kod_item"
                      label="Kod"
                      sort={sort}
                      onSort={toggleSort}
                      icon={Hash}
                    />
                    <SortableHeader
                      columnKey="nama_item"
                      label="Nama Item"
                      sort={sort}
                      onSort={toggleSort}
                      icon={TagIcon}
                    />
                    <SortableHeader
                      columnKey="quota"
                      label="Kuota"
                      sort={sort}
                      onSort={toggleSort}
                      icon={BarChart3}
                    />
                    <div
                      className="flex items-center gap-1.5"
                      style={{ color: "#65676b" }}
                    >
                      <Package className="w-3 h-3" />
                      <span>Stok</span>
                    </div>
                    <div>Baki Kuota</div>
                  </div>

                  {items.map((it, idx) => (
                    <StockRow
                      key={it.id}
                      item={it as any}
                      index={idx}
                      onClick={() => handleItemClick(it)}
                    />
                  ))}
                </>
              )}
            </div>

            {/* Pagination */}
            {!isLoading && totalPages > 1 && (
              <div className="px-4 py-3 border-t border-[#f0f2f5] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-xs" style={{ color: "#65676b" }}>
                  Halaman {page + 1} daripada {totalPages} (
                  {total.toLocaleString("ms-MY")} item)
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    className="h-7 px-2"
                    style={{ opacity: page === 0 ? 0.4 : 1 }}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  {pageButtons.map((b, i) =>
                    b === "..." ? (
                      <span
                        key={`dots-${i}`}
                        className="px-1.5 text-xs"
                        style={{ color: "#9ca3af" }}
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={b}
                        onClick={() => setPage(b - 1)}
                        className="min-w-[28px] h-7 px-2 text-xs font-semibold rounded-lg transition-colors"
                        style={
                          b === page + 1
                            ? {
                                background:
                                  "linear-gradient(135deg, #7c3aed, #6d28d9)",
                                color: "white",
                                fontWeight: 600,
                                border: "1px solid transparent",
                              }
                            : {
                                background: "white",
                                color: "#1c1e21",
                                border: "1px solid #dddfe2",
                                fontWeight: 400,
                              }
                        }
                      >
                        {b}
                      </button>
                    )
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() =>
                      setPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                    className="h-7 px-2"
                    style={{ opacity: page >= totalPages - 1 ? 0.4 : 1 }}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
            {!isLoading && totalPages === 1 && total > 0 && (
              <div
                className="px-4 py-2 border-t border-[#f0f2f5] text-xs"
                style={{ color: "#65676b" }}
              >
                {total.toLocaleString("ms-MY")} item · Halaman 1 daripada 1
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <AddItemDialog open={openAdd} onOpenChange={setOpenAdd} />
    </div>
  );
}

interface SortableHeaderProps {
  columnKey: string;
  label: string;
  sort: SortState | null;
  onSort: (key: string) => void;
  icon: LucideIcon | typeof TagIcon;
}

function SortableHeader({
  columnKey,
  label,
  sort,
  onSort,
  icon: Icon,
}: SortableHeaderProps) {
  const isActive = sort?.key === columnKey;
  return (
    <button
      type="button"
      onClick={() => onSort(columnKey)}
      className="flex items-center gap-1.5 hover:text-foreground transition-colors text-left"
      style={{ color: isActive ? "#7c3aed" : "#65676b" }}
    >
      <Icon className="w-3 h-3" />
      <span>{label}</span>
      <SortIcon active={isActive} dir={sort?.dir ?? "asc"} />
    </button>
  );
}
