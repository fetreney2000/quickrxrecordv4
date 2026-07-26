/**
 * AssignmentItem — Item tugasan yang boleh dikembangkan.
 * Paparkan butiran tugasan, sejarah dos, dan sejarah bekalan.
 */
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pill,
  Package,
  Edit,
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
  Calendar,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FoldableCard } from "@/components/ui/foldable-card";
import { formatDate } from "@/lib/utils";
import {
  useDoseHistory,
  useSupplyHistory,
  type AssignmentWithItem,
  type DoseHistoryWithProfile,
  type SupplyRecordWithJoins,
} from "@/hooks/use-patient-detail";

interface AssignmentItemProps {
  assignment: AssignmentWithItem;
  expanded: boolean;
  onToggle: () => void;
  onSupply: () => void;
  onUpdateDose: () => void;
  onStop: () => void;
  onEditSupply: (s: {
    id: string;
    assignment_id: string;
    dos: string;
    kuantiti: number;
    tempoh_dibekal: string | null;
    catatan_bekalan: string | null;
  }) => void;
  onDeleteSupply: (id: string) => void;
  canEdit: boolean;
  formsMap: Map<string, string>;
}

// ============================================================================
// SortableHeader
// ============================================================================
type SortDir = "asc" | "desc";

function SortableHeader({
  label,
  sortKey,
  currentSort,
  onSort,
}: {
  label: string;
  sortKey: string;
  currentSort: { key: string; dir: SortDir } | null;
  onSort: (key: string) => void;
}) {
  const isActive = currentSort?.key === sortKey;
  const dir = isActive ? currentSort!.dir : null;

  return (
    <th
      onClick={() => onSort(sortKey)}
      className="text-left text-2xs font-semibold uppercase tracking-wider px-2 py-1.5 cursor-pointer select-none hover:bg-muted/50 transition-colors"
      style={{ color: "#65676b" }}
    >
      <span className="flex items-center gap-1">
        {label}
        {isActive ? (
          dir === "asc" ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )
        ) : (
          <ChevronDown className="w-3 h-3 opacity-30" />
        )}
      </span>
    </th>
  );
}

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

// ============================================================================
// AssignmentItem
// ============================================================================
export function AssignmentItem({
  assignment,
  expanded,
  onToggle,
  onSupply,
  onUpdateDose,
  onStop,
  onEditSupply,
  onDeleteSupply,
  canEdit,
  formsMap,
}: AssignmentItemProps) {
  const [doseSort, setDoseSort] = useState<{ key: string; dir: SortDir } | null>(null);
  const [supplySort, setSupplySort] = useState<{ key: string; dir: SortDir } | null>(null);

  const { data: doseHistory = [], isLoading: doseLoading } = useDoseHistory(
    expanded ? assignment.id : null
  );
  const { data: supplyHistory = [], isLoading: supplyLoading } =
    useSupplyHistory(expanded ? assignment.id : null);

  const item = assignment.item;
  const formName = item?.id_bentuk ? formsMap.get(item.id_bentuk) : null;

  // Sorted dose history
  const sortedDose = useMemo(() => {
    if (!doseSort) return doseHistory;
    const sorted = [...doseHistory].sort((a, b) => {
      const key = doseSort.key;
      const av = (a as any)[key] ?? "";
      const bv = (b as any)[key] ?? "";
      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv);
      }
      return 0;
    });
    return doseSort.dir === "asc" ? sorted : sorted.reverse();
  }, [doseHistory, doseSort]);

  // Sorted supply history
  const sortedSupply = useMemo(() => {
    if (!supplySort) return supplyHistory;
    const sorted = [...supplyHistory].sort((a, b) => {
      const key = supplySort.key;
      let av: any = (a as any)[key] ?? "";
      let bv: any = (b as any)[key] ?? "";
      if (key === "kuantiti") {
        av = Number(av);
        bv = Number(bv);
        return supplySort.dir === "asc" ? av - bv : bv - av;
      }
      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv);
      }
      return 0;
    });
    return supplySort.dir === "asc" ? sorted : sorted.reverse();
  }, [supplyHistory, supplySort]);

  const toggleSort = (type: "dose" | "supply", key: string) => {
    if (type === "dose") {
      setDoseSort((prev) => {
        if (prev?.key === key) {
          return prev.dir === "asc" ? { key, dir: "desc" } : null;
        }
        return { key, dir: "asc" };
      });
    } else {
      setSupplySort((prev) => {
        if (prev?.key === key) {
          return prev.dir === "asc" ? { key, dir: "desc" } : null;
        }
        return { key, dir: "asc" };
      });
    }
  };

  return (
    <div className="py-3 px-2">
      {/* Main row */}
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0"
          style={{
            background: assignment.aktif
              ? "linear-gradient(135deg, #1877f2, #0d5bd4)"
              : "#9ca3af",
            opacity: assignment.aktif ? 1 : 0.5,
          }}
        >
          <Pill className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <p
                className="text-sm font-bold truncate"
                style={{ color: "#1c1e21" }}
              >
                {item?.nama_item ?? "Item Tidak Dikenali"}
                {item?.kekuatan ? (
                  <span
                    className="text-xs font-medium ml-1"
                    style={{ color: "#65676b" }}
                  >
                    · {item.kekuatan}
                  </span>
                ) : null}
                {formName ? (
                  <span
                    className="text-xs font-medium ml-1"
                    style={{ color: "#65676b" }}
                  >
                    · {formName}
                  </span>
                ) : null}
              </p>
              <div className="flex items-center gap-2 mt-0.5 text-xs flex-wrap" style={{ color: "#65676b" }}>
                {item?.kod_item && (
                  <span className="font-mono">{item.kod_item}</span>
                )}
                {assignment.dos && (
                  <span>· Dos: <strong style={{ color: "#1c1e21" }}>{assignment.dos}</strong></span>
                )}
              </div>
              {/* Assignment details grid (4-col desktop, 2-col mobile) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 mt-2 text-2xs" style={{ color: "#65676b" }}>
                <span>Mula: <strong style={{ color: "#1c1e21" }}>{formatDate(assignment.tarikh_mula_guna)}</strong></span>
                {assignment.tarikh_tamat_guna && (
                  <span>Tamat: <strong style={{ color: "#1c1e21" }}>{formatDate(assignment.tarikh_tamat_guna)}</strong></span>
                )}
                {assignment.dimulakan_oleh_profile?.nama && (
                  <span>Dimulai: <strong style={{ color: "#1c1e21" }}>{assignment.dimulakan_oleh_profile.nama}</strong></span>
                )}
                {assignment.ditamatkan_oleh_profile?.nama && (
                  <span>Ditamatkan: <strong style={{ color: "#1c1e21" }}>{assignment.ditamatkan_oleh_profile.nama}</strong></span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {assignment.aktif ? (
                  <Badge variant="green" className="text-2xs">Aktif</Badge>
                ) : (
                  <Badge variant="slate" className="text-2xs">Tidak Aktif</Badge>
                )}
              </div>
            </div>

            {/* Action buttons */}
            {canEdit && assignment.aktif && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSupply();
                  }}
                  className="h-7 px-2"
                >
                  <Package className="w-3 h-3" />
                  <span className="hidden sm:inline">Bekal</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateDose();
                  }}
                  className="h-7 px-2"
                >
                  <Edit className="w-3 h-3" />
                  <span className="hidden sm:inline">Kemaskini Dos</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStop();
                  }}
                  className="h-7 px-2"
                  style={{ color: "#dc2626" }}
                >
                  <X className="w-3 h-3" />
                  <span className="hidden sm:inline">Tamat</span>
                </Button>
              </div>
            )}
          </div>

          {assignment.catatan_penggunaan && (
            <p
              className="text-xs mt-1 italic"
              style={{ color: "#65676b" }}
            >
              {assignment.catatan_penggunaan}
            </p>
          )}

          {assignment.sebab_tamat && (
            <p
              className="text-xs mt-1 italic"
              style={{ color: "#9ca3af" }}
            >
              Sebab tamat: {assignment.sebab_tamat}
            </p>
          )}

          <button
            type="button"
            onClick={onToggle}
            className="mt-1.5 text-xs font-semibold flex items-center gap-1"
            style={{ color: "#1877f2" }}
          >
            {expanded ? "Sembunyikan sejarah" : "Lihat sejarah"}
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.15 }}
            >
              <ChevronDown className="w-3 h-3" />
            </motion.span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ overflow: "hidden" }}
          >
            <div className="ml-12 mt-2 space-y-2">
              {/* Dose history — FoldableCard with sortable table */}
              <FoldableCard
                title={
                  <span className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" style={{ color: "#1877f2" }} />
                    Sejarah Dos
                    {doseHistory.length > 0 && (
                      <span
                        className="text-2xs font-semibold px-1.5 py-0.5 rounded-md"
                        style={{
                          background: "rgba(24,119,242,0.10)",
                          color: "#1877f2",
                        }}
                      >
                        {doseHistory.length}
                      </span>
                    )}
                  </span>
                }
                defaultOpen={true}
              >
                {doseLoading ? (
                  <div className="flex items-center gap-2 py-3">
                    <Loader2 className="w-3 h-3 animate-spin" style={{ color: "#1877f2" }} />
                    <span className="text-2xs" style={{ color: "#65676b" }}>Memuatkan...</span>
                  </div>
                ) : doseHistory.length === 0 ? (
                  <p className="text-2xs py-2" style={{ color: "#9ca3af" }}>
                    Tiada sejarah dos.
                  </p>
                ) : (
                  <div className="overflow-x-auto mt-1">
                    <table className="w-full text-2xs">
                      <thead>
                        <tr className="border-b" style={{ borderColor: "#f0f2f5" }}>
                          <SortableHeader label="Tarikh" sortKey="tarikh" currentSort={doseSort} onSort={(k) => toggleSort("dose", k)} />
                          <SortableHeader label="Dos" sortKey="dos" currentSort={doseSort} onSort={(k) => toggleSort("dose", k)} />
                          <SortableHeader label="Dikemaskini Oleh" sortKey="dikemaskini_oleh" currentSort={doseSort} onSort={(k) => toggleSort("dose", k)} />
                          <SortableHeader label="Catatan" sortKey="catatan" currentSort={doseSort} onSort={(k) => toggleSort("dose", k)} />
                        </tr>
                      </thead>
                      <tbody>
                        {sortedDose.map((d) => (
                          <tr key={d.id} className="border-b last:border-b-0" style={{ borderColor: "#f0f2f5" }}>
                            <td className="px-2 py-1.5" style={{ color: "#1c1e21" }}>{formatDate(d.tarikh)}</td>
                            <td className="px-2 py-1.5 font-semibold" style={{ color: "#1877f2" }}>{d.dos}</td>
                            <td className="px-2 py-1.5" style={{ color: "#65676b" }}>
                              {(d as DoseHistoryWithProfile).dikemaskini_oleh_profile?.nama ?? "—"}
                            </td>
                            <td className="px-2 py-1.5 italic" style={{ color: "#9ca3af" }}>
                              {d.catatan || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </FoldableCard>

              {/* Supply history — FoldableCard with sortable table */}
              <FoldableCard
                title={
                  <span className="flex items-center gap-2">
                    <Package className="w-3.5 h-3.5" style={{ color: "#1877f2" }} />
                    Sejarah Bekalan
                    {supplyHistory.length > 0 && (
                      <span
                        className="text-2xs font-semibold px-1.5 py-0.5 rounded-md"
                        style={{
                          background: "rgba(24,119,242,0.10)",
                          color: "#1877f2",
                        }}
                      >
                        {supplyHistory.length}
                      </span>
                    )}
                  </span>
                }
                defaultOpen={true}
              >
                {supplyLoading ? (
                  <div className="flex items-center gap-2 py-3">
                    <Loader2 className="w-3 h-3 animate-spin" style={{ color: "#1877f2" }} />
                    <span className="text-2xs" style={{ color: "#65676b" }}>Memuatkan...</span>
                  </div>
                ) : supplyHistory.length === 0 ? (
                  <p className="text-2xs py-2" style={{ color: "#9ca3af" }}>
                    Tiada sejarah bekalan.
                  </p>
                ) : (
                  <div className="overflow-x-auto mt-1">
                    <table className="w-full text-2xs">
                      <thead>
                        <tr className="border-b" style={{ borderColor: "#f0f2f5" }}>
                          <SortableHeader label="Tarikh" sortKey="tarikh_dibekal" currentSort={supplySort} onSort={(k) => toggleSort("supply", k)} />
                          <SortableHeader label="Kuantiti" sortKey="kuantiti" currentSort={supplySort} onSort={(k) => toggleSort("supply", k)} />
                          <SortableHeader label="Dos" sortKey="dos" currentSort={supplySort} onSort={(k) => toggleSort("supply", k)} />
                          <SortableHeader label="Tempoh" sortKey="tempoh_dibekal" currentSort={supplySort} onSort={(k) => toggleSort("supply", k)} />
                          <SortableHeader label="Kakitangan" sortKey="kakitangan_pembekal" currentSort={supplySort} onSort={(k) => toggleSort("supply", k)} />
                          <SortableHeader label="Catatan" sortKey="catatan_bekalan" currentSort={supplySort} onSort={(k) => toggleSort("supply", k)} />
                          {canEdit && <th className="text-left text-2xs font-semibold uppercase tracking-wider px-2 py-1.5" style={{ color: "#65676b" }}>Tindakan</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedSupply.map((s) => (
                          <tr key={s.id} className="border-b last:border-b-0" style={{ borderColor: "#f0f2f5" }}>
                            <td className="px-2 py-1.5" style={{ color: "#1c1e21" }}>{formatDate(s.tarikh_dibekal)}</td>
                            <td className="px-2 py-1.5" style={{ color: "#1c1e21" }}>{s.kuantiti}</td>
                            <td className="px-2 py-1.5 font-semibold" style={{ color: "#1877f2" }}>{s.dos}</td>
                            <td className="px-2 py-1.5" style={{ color: "#65676b" }}>{s.tempoh_dibekal || "—"}</td>
                            <td className="px-2 py-1.5" style={{ color: "#65676b" }}>
                              {(s as SupplyRecordWithJoins).kakitangan_pembekal_profile?.nama ?? "—"}
                            </td>
                            <td className="px-2 py-1.5 italic" style={{ color: "#9ca3af" }}>
                              {s.catatan_bekalan || "—"}
                            </td>
                            {canEdit && (
                              <td className="px-2 py-1.5">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onEditSupply(s);
                                    }}
                                    className="hover:opacity-70"
                                    style={{ color: "#1877f2" }}
                                  >
                                    <Edit className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteSupply(s.id);
                                    }}
                                    className="hover:opacity-70"
                                    style={{ color: "#dc2626" }}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </FoldableCard>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}