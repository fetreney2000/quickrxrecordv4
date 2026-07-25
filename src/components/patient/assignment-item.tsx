/**
 * AssignmentItem — Item tugasan yang boleh dikembangkan.
 * Paparkan butiran tugasan, sejarah dos, dan sejarah bekalan.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pill,
  Package,
  Edit,
  X,
  ChevronDown,
  Trash2,
  Calendar,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import {
  useDoseHistory,
  useSupplyHistory,
  type AssignmentWithItem,
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
}

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
}: AssignmentItemProps) {
  const [showDoseHistory, setShowDoseHistory] = useState(false);
  const [showSupplyHistory, setShowSupplyHistory] = useState(false);
  const { data: doseHistory = [], isLoading: doseLoading } = useDoseHistory(
    expanded ? assignment.id : null
  );
  const { data: supplyHistory = [], isLoading: supplyLoading } =
    useSupplyHistory(expanded ? assignment.id : null);

  const item = assignment.item;

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
              </p>
              <div className="flex items-center gap-2 mt-0.5 text-xs flex-wrap" style={{ color: "#65676b" }}>
                {item?.kod_item && (
                  <span className="font-mono">{item.kod_item}</span>
                )}
                {assignment.dos && (
                  <span>· Dos: <strong style={{ color: "#1c1e21" }}>{assignment.dos}</strong></span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {assignment.aktif ? (
                  <Badge variant="green" className="text-2xs">Aktif</Badge>
                ) : (
                  <Badge variant="slate" className="text-2xs">Tidak Aktif</Badge>
                )}
                <span className="text-2xs" style={{ color: "#9ca3af" }}>
                  Mula: {formatDate(assignment.tarikh_mula_guna)}
                </span>
                {assignment.tarikh_tamat_guna && (
                  <span className="text-2xs" style={{ color: "#9ca3af" }}>
                    · Tamat: {formatDate(assignment.tarikh_tamat_guna)}
                  </span>
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
                  <span className="hidden sm:inline">Dos</span>
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
              {/* Dose history */}
              <div
                className="rounded-xl p-3"
                style={{ background: "rgba(0,0,0,0.02)" }}
              >
                <button
                  type="button"
                  onClick={() => setShowDoseHistory((s) => !s)}
                  className="w-full flex items-center justify-between text-xs font-semibold"
                >
                  <span style={{ color: "#1c1e21" }}>
                    Sejarah Dos ({doseHistory.length})
                  </span>
                  <ChevronDown
                    className={cn(
                      "w-3 h-3 transition-transform",
                      showDoseHistory && "rotate-180"
                    )}
                    style={{ color: "#65676b" }}
                  />
                </button>
                {showDoseHistory && (
                  <div className="mt-2 space-y-1">
                    {doseLoading ? (
                      <Loader2
                        className="w-3 h-3 animate-spin"
                        style={{ color: "#1877f2" }}
                      />
                    ) : doseHistory.length === 0 ? (
                      <p className="text-2xs" style={{ color: "#9ca3af" }}>
                        Tiada sejarah dos.
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {doseHistory.slice(0, 5).map((d) => (
                          <div
                            key={d.id}
                            className="flex items-center gap-2 text-2xs"
                          >
                            <Calendar
                              className="w-3 h-3"
                              style={{ color: "#65676b" }}
                            />
                            <span style={{ color: "#1c1e21" }}>
                              {formatDate(d.tarikh)}
                            </span>
                            <span style={{ color: "#1877f2" }} className="font-semibold">
                              {d.dos}
                            </span>
                            {d.catatan && (
                              <span
                                className="truncate italic"
                                style={{ color: "#9ca3af" }}
                              >
                                · {d.catatan}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Supply history */}
              <div
                className="rounded-xl p-3"
                style={{ background: "rgba(0,0,0,0.02)" }}
              >
                <button
                  type="button"
                  onClick={() => setShowSupplyHistory((s) => !s)}
                  className="w-full flex items-center justify-between text-xs font-semibold"
                >
                  <span style={{ color: "#1c1e21" }}>
                    Sejarah Bekalan ({supplyHistory.length})
                  </span>
                  <ChevronDown
                    className={cn(
                      "w-3 h-3 transition-transform",
                      showSupplyHistory && "rotate-180"
                    )}
                    style={{ color: "#65676b" }}
                  />
                </button>
                {showSupplyHistory && (
                  <div className="mt-2 space-y-1">
                    {supplyLoading ? (
                      <Loader2
                        className="w-3 h-3 animate-spin"
                        style={{ color: "#1877f2" }}
                      />
                    ) : supplyHistory.length === 0 ? (
                      <p className="text-2xs" style={{ color: "#9ca3af" }}>
                        Tiada sejarah bekalan.
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {supplyHistory.slice(0, 5).map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center gap-2 text-2xs"
                          >
                            <Calendar
                              className="w-3 h-3"
                              style={{ color: "#65676b" }}
                            />
                            <span style={{ color: "#1c1e21" }}>
                              {formatDate(s.tarikh_dibekal)}
                            </span>
                            <span style={{ color: "#65676b" }}>·</span>
                            <span style={{ color: "#1c1e21" }}>
                              {s.kuantiti} unit
                            </span>
                            <span style={{ color: "#1877f2" }} className="font-semibold">
                              {s.dos}
                            </span>
                            {s.tempoh_dibekal && (
                              <span style={{ color: "#65676b" }}>· {s.tempoh_dibekal}</span>
                            )}
                            {canEdit && (
                              <div className="ml-auto flex items-center gap-1">
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
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}
