/**
 * LookupManager — Komponen generik untuk CRUD data rujukan.
 * Mengendalikan item_categories, item_forms, dan supply_durations.
 */
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getNowISOKL, toTitleCase } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Edit,
  Package,
  Pill,
  CalendarDays,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─── Config ───────────────────────────────────────────────────────────────────

type LookupType = "item_categories" | "item_forms" | "supply_durations";

interface LookupConfig {
  title: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

const LOOKUP_CONFIGS: Record<LookupType, LookupConfig> = {
  item_categories: {
    title: "Kategori Item",
    label: "Kategori",
    icon: Package,
    description: "Urus kategori untuk item/ubat",
  },
  item_forms: {
    title: "Bentuk Dos",
    label: "Bentuk Dos",
    icon: Pill,
    description: "Urus bentuk dos untuk item/ubat",
  },
  supply_durations: {
    title: "Durasi Bekalan",
    label: "Durasi",
    icon: CalendarDays,
    description: "Urus tempoh durasi bekalan",
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface LookupManagerProps {
  type: LookupType;
}

interface LookupRecord {
  id: string;
  nama: string;
  created_at: string;
  updated_at: string;
}

export default function LookupManager({ type }: LookupManagerProps) {
  const config = LOOKUP_CONFIGS[type];
  const Icon = config.icon;
  const queryClient = useQueryClient();

  // ── State ─────────────────────────────────────────────────────────────────
  const [openAdd, setOpenAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [editName, setEditName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<LookupRecord | null>(null);

  const addInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // ── Query ─────────────────────────────────────────────────────────────────
  const { data: records = [], isLoading } = useQuery<LookupRecord[]>({
    queryKey: [type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(type)
        .select("*")
        .order("nama");
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const addMutation = useMutation({
    mutationFn: async (nama: string) => {
      const { error } = await supabase.from(type).insert({ nama });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [type] });
      toast.success(`${config.label} berjaya ditambah`);
      setOpenAdd(false);
      setNewName("");
    },
    onError: (err: Error) => {
      toast.error(`Gagal menambah: ${err.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, nama }: { id: string; nama: string }) => {
      const { error } = await supabase
        .from(type)
        .update({ nama, updated_at: getNowISOKL() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [type] });
      toast.success(`${config.label} berjaya dikemaskini`);
      setEditId(null);
      setEditName("");
    },
    onError: (err: Error) => {
      toast.error(`Gagal mengemaskini: ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(type).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [type] });
      toast.success(`${config.label} berjaya dipadam`);
      setDeleteConfirm(null);
    },
    onError: (err: Error) => {
      toast.error(`Gagal memadam: ${err.message}`);
    },
  });

  // ── Auto-focus ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (openAdd) {
      setTimeout(() => addInputRef.current?.focus(), 100);
    }
  }, [openAdd]);

  useEffect(() => {
    if (editId) {
      setTimeout(() => editInputRef.current?.focus(), 100);
    }
  }, [editId]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddSubmit = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    addMutation.mutate(trimmed);
  };

  const handleEditSubmit = (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    updateMutation.mutate({ id, nama: trimmed });
  };

  const startEdit = (record: LookupRecord) => {
    setEditId(record.id);
    setEditName(record.nama);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditName("");
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl border bg-card shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between p-5 pb-3">
        <div className="flex items-center gap-3">
          <div
            className="inline-flex items-center justify-center w-10 h-10 rounded-xl"
            style={{ background: "rgba(6, 182, 212, 0.1)" }}
          >
            <Icon className="h-5 w-5" style={{ color: "#06b6d4" }} />
          </div>
          <div>
            <h3 className="text-base font-semibold">{config.title}</h3>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {config.description}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => setOpenAdd(true)}
          style={{ background: "#1877f2" }}
          className="text-white"
        >
          <Plus className="h-4 w-4 mr-1" />
          Tambah {config.label}
        </Button>
      </div>

      {/* Table */}
      <div className="px-5 pb-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: "var(--text-secondary)" }}>
            Tiada {config.label.toLowerCase()} didaftarkan.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th
                  className="px-3 py-2.5 text-left text-2xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-secondary)", borderBottom: "2px solid var(--border-medium)", background: "var(--bg-secondary)" }}
                >
                  #
                </th>
                <th
                  className="px-3 py-2.5 text-left text-2xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-secondary)", borderBottom: "2px solid var(--border-medium)", background: "var(--bg-secondary)" }}
                >
                  Nama
                </th>
                <th
                  className="px-3 py-2.5 text-right text-2xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-secondary)", borderBottom: "2px solid var(--border-medium)", background: "var(--bg-secondary)" }}
                >
                  Tindakan
                </th>
              </tr>
            </thead>
            <tbody>
              {records.map((record, idx) => (
                <tr
                  key={record.id}
                  style={{
                    background: idx % 2 === 1 ? "var(--bg-secondary)" : "var(--card)",
                    borderBottom: "1px solid var(--border-light)",
                  }}
                >
                  <td className="px-3 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                    {idx + 1}
                  </td>
                  <td className="px-3 py-3 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {editId === record.id ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleEditSubmit(record.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                        onBlur={() => {
                          setEditName((prev) => toTitleCase(prev));
                        }}
                        className="flex h-8 w-full max-w-xs rounded-lg border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        style={{ borderColor: "#1877f2" }}
                      />
                    ) : (
                      record.nama
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {editId === record.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => handleEditSubmit(record.id)}
                          title="Simpan"
                        >
                          <CheckCircle2 className="h-4 w-4" style={{ color: "#42b72a" }} />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={cancelEdit}
                          title="Batal"
                        >
                          <XCircle className="h-4 w-4" style={{ color: "#e41e3f" }} />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => startEdit(record)}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => setDeleteConfirm(record)}
                          title="Padam"
                        >
                          <Trash2 className="h-4 w-4" style={{ color: "#e41e3f" }} />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Dialog */}
      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Tambah {config.label} Baharu</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              ref={addInputRef}
              placeholder={`Nama ${config.label}`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddSubmit();
              }}
              onBlur={() => {
                setNewName((prev) => toTitleCase(prev));
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAdd(false)}>
              Batal
            </Button>
            <Button
              onClick={handleAddSubmit}
              disabled={!newName.trim() || addMutation.isPending}
              style={{ background: "#1877f2" }}
              className="text-white"
            >
              {addMutation.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" style={{ color: "#e41e3f" }} />
              Padam {config.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div
              className="rounded-lg p-3 text-sm"
              style={{ background: "rgba(239,68,68,0.08)", color: "var(--destructive)" }}
            >
              <p className="font-semibold mb-1">Amaran</p>
              <p>
                Anda pasti ingin memadam <strong>"{deleteConfirm?.nama}"</strong>?
              </p>
              <p className="mt-1">Tindakan ini tidak boleh dibatalkan.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirm) deleteMutation.mutate(deleteConfirm.id);
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Memadam..." : "Ya, Padam"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}