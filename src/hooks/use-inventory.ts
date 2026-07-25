/**
 * Hooks untuk Pengurusan Inventori.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import type {
  Item,
  ItemBatch,
  ItemForm,
  ItemCategory,
  PatientItemAssignment,
  Patient,
  SupplyRecord,
} from "@/types";

// ============================================================================
// ITEMS
// ============================================================================
export const INVENTORY_PAGE_SIZE = 50;

export type SortDir = "asc" | "desc";
export interface SortState {
  key: string;
  dir: SortDir;
}

export function useItems({
  search,
  page,
  sort,
}: {
  search: string;
  page: number;
  sort: { key: string; dir: "asc" | "desc" } | null;
}) {
  return useQuery({
    queryKey: ["items", search, page, sort],
    queryFn: async () => {
      let query = supabase
        .from("items")
        .select(
          "*, item_batches(kuantiti)",
          { count: "exact" }
        )
        .eq("aktif", true);

      if (search.trim()) {
        const like = `%${search.trim()}%`;
        query = query.or(
          `nama_item.ilike.${like},kod_item.ilike.${like},nama_dagangan.ilike.${like}`
        );
      }

      const sortKey = sort?.key ?? "nama_item";
      const sortDir = sort?.dir ?? "asc";
      query = query.order(sortKey, { ascending: sortDir === "asc" });

      const from = page * INVENTORY_PAGE_SIZE;
      const to = from + INVENTORY_PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      return {
        items: (data ?? []) as (Item & {
          item_batches: { kuantiti: number }[];
          item_forms: { id: string; nama: string } | null;
        })[],
        total: count ?? 0,
        totalPages: Math.max(1, Math.ceil((count ?? 0) / INVENTORY_PAGE_SIZE)),
      };
    },
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
  });
}

export function useItem(id: string | undefined) {
  return useQuery({
    queryKey: ["item", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      // Fetch related data separately to avoid join issues
      let itemCategories: { id: string; nama: string } | null = null;
      let itemForms: { id: string; nama: string } | null = null;
      if (data?.id_kategori) {
        const { data: cat } = await supabase
          .from("item_categories")
          .select("id, nama")
          .eq("id", data.id_kategori)
          .maybeSingle();
        itemCategories = cat ?? null;
      }
      if (data?.id_bentuk) {
        const { data: form } = await supabase
          .from("item_forms")
          .select("id, nama")
          .eq("id", data.id_bentuk)
          .maybeSingle();
        itemForms = form ?? null;
      }
      return data
        ? { ...data, item_categories: itemCategories, item_forms: itemForms }
        : null;
    },
  });
}

/** Senarai pesakit (untuk penapis sejarah transaksi). */
export function usePatientsList() {
  return useQuery({
    queryKey: ["patients-list-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("id, nama")
        .eq("aktif", true)
        .is("merged_into", null)
        .order("nama", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as { id: string; nama: string }[];
    },
    staleTime: 60_000,
  });
}

/** Senarai kakitangan (untuk penapis sejarah transaksi). */
export function useStaffList() {
  return useQuery({
    queryKey: ["staff-list-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nama")
        .eq("aktif", true)
        .order("nama", { ascending: true });
      if (error) throw error;
      return (data ?? []) as { id: string; nama: string }[];
    },
    staleTime: 60_000,
  });
}

export function useAddItem() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async (data: Partial<Item>) => {
      const { data: result, error } = await supabase
        .from("items")
        .insert({
          ...data,
          dicipta_oleh: profile?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return result as { id: string };
    },
    onSuccess: () => {
      toast.success("Item berjaya ditambah.");
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Gagal menambah item.");
    },
  });
}

export function useUpdateItem(itemId: string | undefined) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async (data: Partial<Item>) => {
      const { error } = await supabase
        .from("items")
        .update({ ...data, dikemaskini_oleh: profile?.id ?? null })
        .eq("id", itemId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item dikemaskini.");
      queryClient.invalidateQueries({ queryKey: ["item", itemId] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Gagal mengemaskini item.");
    },
  });
}

// ============================================================================
// BATCHES
// ============================================================================
export function useBatches(itemId: string | undefined) {
  return useQuery({
    queryKey: ["batches", itemId],
    enabled: !!itemId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_batches")
        .select("*")
        .eq("item_id", itemId!)
        .order("tarikh_luput", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ItemBatch[];
    },
  });
}

export function useAddBatch(itemId: string | undefined) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async (data: {
      nombor_kelompok: string;
      tarikh_luput: string;
      kuantiti: number;
    }) => {
      // Check if batch exists with same number
      const { data: existing, error: findErr } = await supabase
        .from("item_batches")
        .select("id, kuantiti")
        .eq("item_id", itemId!)
        .eq("nombor_kelompok", data.nombor_kelompok)
        .maybeSingle();
      if (findErr) throw findErr;

      if (existing) {
        // Add to existing batch
        const newKuantiti = existing.kuantiti + data.kuantiti;
        const { error: updErr } = await supabase
          .from("item_batches")
          .update({ kuantiti: newKuantiti })
          .eq("id", existing.id);
        if (updErr) throw updErr;

        // Record adjustment
        await supabase.from("batch_adjustments").insert({
          batch_id: existing.id,
          previous_kuantiti: existing.kuantiti,
          new_kuantiti: newKuantiti,
          change: data.kuantiti,
          reason: "Penambahan stok",
          adjusted_by: profile?.id ?? null,
        });
        return { id: existing.id, action: "updated" as const };
      } else {
        // Create new batch
        const { data: created, error: insErr } = await supabase
          .from("item_batches")
          .insert({
            item_id: itemId!,
            nombor_kelompok: data.nombor_kelompok,
            tarikh_luput: data.tarikh_luput,
            kuantiti: data.kuantiti,
            dicipta_oleh: profile?.id ?? null,
          })
          .select("id")
          .single();
        if (insErr) throw insErr;
        if (created) {
          await supabase.from("batch_adjustments").insert({
            batch_id: created.id,
            previous_kuantiti: 0,
            new_kuantiti: data.kuantiti,
            change: data.kuantiti,
            reason: "Stok awal kelompok baharu",
            adjusted_by: profile?.id ?? null,
          });
        }
        return { id: created!.id, action: "created" as const };
      }
    },
    onSuccess: (result) => {
      toast.success(
        result.action === "created"
          ? "Kelompok baharu ditambah."
          : "Stok ditambah ke kelompok sedia ada."
      );
      queryClient.invalidateQueries({ queryKey: ["batches", itemId] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Gagal menambah kelompok.");
    },
  });
}

export function useUpdateBatchQuantity(itemId: string | undefined) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async (data: {
      batchId: string;
      newKuantiti: number;
      reason: string;
    }) => {
      const { data: existing, error: findErr } = await supabase
        .from("item_batches")
        .select("kuantiti")
        .eq("id", data.batchId)
        .single();
      if (findErr) throw findErr;
      if (!existing) throw new Error("Kelompok tidak dijumpai");

      const { error: updErr } = await supabase
        .from("item_batches")
        .update({ kuantiti: data.newKuantiti })
        .eq("id", data.batchId);
      if (updErr) throw updErr;

      const change = data.newKuantiti - existing.kuantiti;
      await supabase.from("batch_adjustments").insert({
        batch_id: data.batchId,
        previous_kuantiti: existing.kuantiti,
        new_kuantiti: data.newKuantiti,
        change,
        reason: data.reason,
        adjusted_by: profile?.id ?? null,
      });
    },
    onSuccess: () => {
      toast.success("Kuantiti kelompok dikemaskini.");
      queryClient.invalidateQueries({ queryKey: ["batches", itemId] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Gagal mengemaskini kuantiti.");
    },
  });
}

// ============================================================================
// PATIENTS USING ITEM
// ============================================================================
export function useItemPatients(itemId: string | undefined) {
  return useQuery({
    queryKey: ["item-patients", itemId],
    enabled: !!itemId,
    queryFn: async () => {
      // Get active assignments
      const { data: assignments, error: aErr } = await supabase
        .from("patient_item_assignments")
        .select("id, patient_id, dos, tarikh_mula_guna")
        .eq("item_id", itemId!)
        .eq("aktif", true);
      if (aErr) throw aErr;
      if (!assignments || assignments.length === 0) return [];

      // Get patients
      const patientIds = assignments.map((a: any) => String(a.patient_id));
      const { data: patients, error: pErr } = await supabase
        .from("patients")
        .select("id, nama, nombor_kad_pengenalan")
        .in("id", patientIds.length > 0 ? patientIds : [""]);
      if (pErr) throw pErr;
      void patients;

      // Get latest supply for each assignment
      const { data: supplies, error: sErr } = await supabase
        .from("supply_records")
        .select("assignment_id, tarikh_dibekal, kuantiti")
        .in("assignment_id", assignments.map((a) => a.id))
        .order("tarikh_dibekal", { ascending: false });
      if (sErr) throw sErr;

      const lastSupplyMap = new Map<string, { tarikh: string; qty: number }>();
      ((supplies ?? []) as any[]).forEach((s) => {
        if (!lastSupplyMap.has(s.assignment_id)) {
          lastSupplyMap.set(s.assignment_id, {
            tarikh: s.tarikh_dibekal,
            qty: s.kuantiti,
          });
        }
      });

      // Get patient data via separate query
      const { data: patientsData, error: ppErr } = await supabase
        .from("patients")
        .select("id, nama, nombor_kad_pengenalan, nombor_pendaftaran_hospital")
        .in("id", patientIds);
      if (ppErr) throw ppErr;

      const patientMap = new Map<string, any>();
      ((patientsData ?? []) as any[]).forEach((p) => patientMap.set(p.id, p));

      return assignments.map((a) => ({
        ...a,
        patient: patientMap.get(a.patient_id) ?? null,
        last_supply: lastSupplyMap.get(a.id) ?? null,
      }));
    },
  });
}

// ============================================================================
// TRANSACTION HISTORY
// ============================================================================
export interface CombinedTransaction {
  id: string;
  tarikh: string;
  jenis: "bekalan" | "pelarasan";
  jenis_label: string;
  kelompok: string;
  perubahan: number;
  perubahan_label: string;
  pesakit: string | null;
  kakitangan: string | null;
  catatan: string | null;
}

export function useItemTransactionHistory(itemId: string | undefined) {
  return useQuery({
    queryKey: ["transaction-history", itemId],
    enabled: !!itemId,
    queryFn: async () => {
      // Get supplies
      const { data: supplies, error: sErr } = await supabase
        .from("supply_records")
        .select(
          "id, tarikh_dibekal, kuantiti, catatan_bekalan, assignment_id"
        )
        .order("tarikh_dibekal", { ascending: false })
        .limit(200);
      void sErr;
      // Filter to this item via assignment
      const { data: assignments, error: aErr } = await supabase
        .from("patient_item_assignments")
        .select("id, patient_id, item_id, kakitangan_farmasi_perekod")
        .eq("item_id", itemId!);
      if (aErr) throw aErr;
      const itemAssignmentIds = new Set(
        ((assignments ?? []) as any[]).map((a) => a.id)
      );

      // Get batch adjustments
      const { data: adjustments, error: bErr } = await supabase
        .from("batch_adjustments")
        .select("id, batch_id, change, reason, created_at, adjusted_by")
        .order("created_at", { ascending: false })
        .limit(200);
      if (bErr) throw bErr;

      // Get batches for adjustments
      const batchIds = ((adjustments ?? []) as any[]).map((a) => a.batch_id);
      const { data: batches, error: bbErr } = await supabase
        .from("item_batches")
        .select("id, item_id, nombor_kelompok")
        .in("id", batchIds.length > 0 ? batchIds : [""]);
      if (bbErr) throw bbErr;
      const batchMap = new Map<string, any>();
      ((batches ?? []) as any[]).forEach((b) => batchMap.set(b.id, b));

      // Get patient names
      const patientIds = [
        ...new Set(((assignments ?? []) as any[]).map((a) => a.patient_id)),
      ];
      const { data: patients, error: pErr } = await supabase
        .from("patients")
        .select("id, nama")
        .in("id", patientIds.length > 0 ? patientIds : [""]);
      if (pErr) throw pErr;
      const patientNameMap = new Map<string, string>();
      ((patients ?? []) as any[]).forEach((p) =>
        patientNameMap.set(p.id, p.nama)
      );

      // Get staff names
      const staffIds = new Set<string>();
      ((assignments ?? []) as any[]).forEach((a) => {
        if (a.kakitangan_farmasi_perekod)
          staffIds.add(a.kakitangan_farmasi_perekod);
      });
      ((adjustments ?? []) as any[]).forEach((a) => {
        if (a.adjusted_by) staffIds.add(a.adjusted_by);
      });
      const { data: staff, error: stErr } = await supabase
        .from("profiles")
        .select("id, nama")
        .in("id", staffIds.size > 0 ? Array.from(staffIds) : [""]);
      if (stErr) throw stErr;
      const staffMap = new Map<string, string>();
      ((staff ?? []) as any[]).forEach((s) => staffMap.set(s.id, s.nama));

      // Build combined transactions
      const transactions: CombinedTransaction[] = [];

      // Add supplies
      const assignmentToPatient = new Map<string, string>();
      ((assignments ?? []) as any[]).forEach((a) => {
        assignmentToPatient.set(a.id, a.patient_id);
      });
      const assignmentToKakitangan = new Map<string, string>();
      ((assignments ?? []) as any[]).forEach((a) => {
        if (a.kakitangan_farmasi_perekod) {
          assignmentToKakitangan.set(a.id, a.kakitangan_farmasi_perekod);
        }
      });

      ((supplies ?? []) as any[]).forEach((s) => {
        if (!itemAssignmentIds.has(s.assignment_id)) return;
        const patientId = assignmentToPatient.get(s.assignment_id);
        transactions.push({
          id: `s-${s.id}`,
          tarikh: s.tarikh_dibekal,
          jenis: "bekalan",
          jenis_label: "Bekalan",
          kelompok: "—",
          perubahan: -(s.kuantiti || 0),
          perubahan_label: `-${s.kuantiti || 0}`,
          pesakit: patientId ? patientNameMap.get(patientId) ?? null : null,
          kakitangan: assignmentToKakitangan.has(s.assignment_id)
            ? staffMap.get(assignmentToKakitangan.get(s.assignment_id)!) ?? null
            : null,
          catatan: s.catatan_bekalan,
        });
      });

      // Add adjustments
      ((adjustments ?? []) as any[]).forEach((a) => {
        const batch = batchMap.get(a.batch_id);
        if (!batch || batch.item_id !== itemId) return;
        transactions.push({
          id: `a-${a.id}`,
          tarikh: a.created_at,
          jenis: "pelarasan",
          jenis_label:
            a.change > 0 ? "Penambahan Stok" : "Pelarasan Stok",
          kelompok: batch.nombor_kelompok,
          perubahan: a.change,
          perubahan_label: a.change > 0 ? `+${a.change}` : `${a.change}`,
          pesakit: null,
          kakitangan: a.adjusted_by ? staffMap.get(a.adjusted_by) ?? null : null,
          catatan: a.reason,
        });
      });

      // Sort by date desc
      transactions.sort(
        (a, b) =>
          new Date(b.tarikh).getTime() - new Date(a.tarikh).getTime()
      );

      return transactions;
    },
  });
}

// ============================================================================
// Lookup hooks
// ============================================================================
export function useItemForms() {
  return useQuery({
    queryKey: ["item_forms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_forms")
        .select("*")
        .eq("aktif", true)
        .order("nama", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ItemForm[];
    },
    staleTime: 60_000,
  });
}

export function useItemCategories() {
  return useQuery({
    queryKey: ["item_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_categories")
        .select("*")
        .eq("aktif", true)
        .order("nama", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ItemCategory[];
    },
    staleTime: 60_000,
  });
}
