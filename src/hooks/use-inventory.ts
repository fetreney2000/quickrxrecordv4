/**
 * Hooks untuk Pengurusan Inventori.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { getNowISOKL } from "@/lib/utils";
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

export function useUpdateBatchQuantity(itemId: string | undefined) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async (data: {
      batchId: string;
      newKuantiti: number;
      reason?: string;
    }) => {
      if (data.reason === "Pelupusan Stok") {
        const { error } = await supabase.rpc("process_batch_disposal", {
          p_batch_id: data.batchId,
          p_adjusted_by: profile?.id ?? null,
          p_reason: data.reason,
        });
        if (error) throw error;
        return;
      }
      const { data: existing, error: getErr } = await supabase
        .from("item_batches")
        .select("kuantiti, dilupuskan")
        .eq("id", data.batchId)
        .single();
      if (getErr) throw getErr;
      if (!existing) throw new Error("Kelompok tidak dijumpai.");
      if (existing.dilupuskan) throw new Error("Kelompok ini telah dilupuskan dan tidak boleh diubah.");

      const { error: updErr } = await supabase
        .from("item_batches")
        .update({ kuantiti: data.newKuantiti })
        .eq("id", data.batchId)
        .eq("dilupuskan", false);
      if (updErr) throw updErr;

      const change = data.newKuantiti - existing.kuantiti;
      const { error: adjustmentError } = await supabase.from("batch_adjustments").insert({
        batch_id: data.batchId,
        previous_kuantiti: existing.kuantiti,
        new_kuantiti: data.newKuantiti,
        change,
        reason: data.reason,
        adjusted_by: profile?.id ?? null,
      });
      if (adjustmentError) throw adjustmentError;
    },
    onSuccess: () => {
      toast.success("Kuantiti kelompok dikemaskini.");
      queryClient.invalidateQueries({ queryKey: ["batches", itemId] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-history", itemId] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Gagal mengemaskini kuantiti.");
    },
  });
}

export function useItems({
  search,
  page,
  sort,
  pageSize = INVENTORY_PAGE_SIZE,
}: {
  search: string;
  page: number;
  sort: SortState | null;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: ["items", search, page, sort, pageSize],
    queryFn: async () => {
      let query = supabase
        .from("items")
        .select(
          "*, item_batches(kuantiti), patient_item_assignments(id)",
          { count: "exact" }
        )
        .eq("aktif", true);

      // Search
      if (search.trim()) {
        const term = search.trim();
        query = query.or(
          `kod_item.ilike.%${term}%,nama_item.ilike.%${term}%,nama_dagangan.ilike.%${term}%`
        );
      }

      // Sort
      if (sort) {
        if (sort.key === "quota") {
          query = query.order("kuota", {
            ascending: sort.dir === "asc",
            nullsFirst: false,
          });
        } else {
          query = query.order(sort.key, {
            ascending: sort.dir === "asc",
          });
        }
      } else {
        query = query.order("nama_item", { ascending: true });
      }

      // Pagination
      const from = page * pageSize;
      query = query.range(from, from + pageSize - 1);

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        items: (data ?? []) as any[],
        total: count ?? 0,
        totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
      };
    },
    staleTime: 30_000,
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
        itemCategories = cat;
      }

      if (data?.id_bentuk) {
        const { data: form } = await supabase
          .from("item_forms")
          .select("id, nama")
          .eq("id", data.id_bentuk)
          .maybeSingle();
        itemForms = form;
      }

      return data
        ? { ...data, item_categories: itemCategories, item_forms: itemForms }
        : null;
    },
    staleTime: 60_000,
  });
}

export function useItemForms() {
  return useQuery({
    queryKey: ["item-forms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_forms")
        .select("id, nama")
        .order("nama");
      if (error) throw error;
      return (data ?? []) as ItemForm[];
    },
    staleTime: 300_000,
  });
}

export function useItemCategories() {
  return useQuery({
    queryKey: ["item-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_categories")
        .select("id, nama")
        .order("nama");
      if (error) throw error;
      return (data ?? []) as ItemCategory[];
    },
    staleTime: 300_000,
  });
}

export function useAddItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (itemData: Partial<Item>) => {
      const { data, error } = await supabase
        .from("items")
        .insert(itemData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });
}

export function useUpdateItem(id: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Item>) => {
      const { error } = await supabase
        .from("items")
        .update(data)
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item", id] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
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
    staleTime: 30_000,
  });
}

export function useAddBatch(itemId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (batchData: {
      nombor_kelompok: string;
      tarikh_luput: string;
      kuantiti: number;
    }) => {
      const { error } = await supabase.from("item_batches").insert({
        item_id: itemId!,
        ...batchData,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batches", itemId] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });
}

export function useBatchAdjust(itemId: string | undefined) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async (data: {
      batchId: string;
      newKuantiti: number;
      reason?: string;
    }) => {
      // Get existing batch
      const { data: existing, error: getErr } = await supabase
        .from("item_batches")
        .select("kuantiti")
        .eq("id", data.batchId)
        .single();
      if (getErr) throw getErr;
      if (!existing) throw new Error("Kelompok tidak dijumpai.");

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
      queryClient.invalidateQueries({ queryKey: ["transaction-history", itemId] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Gagal mengemaskini kuantiti.");
    },
  });
}

export function useUpdateBatch(itemId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      batchId: string;
      nombor_kelompok: string;
      tarikh_luput: string;
    }) => {
      const { error } = await supabase
        .from("item_batches")
        .update({
          nombor_kelompok: data.nombor_kelompok.toUpperCase(),
          tarikh_luput: data.tarikh_luput,
          updated_at: getNowISOKL(),
        })
        .eq("id", data.batchId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Maklumat kelompok dikemaskini.");
      queryClient.invalidateQueries({ queryKey: ["batches", itemId] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Gagal mengemaskini kelompok.");
    },
  });
}

// ============================================================================
// PATIENTS USING ITEM - Optimized with batched queries to avoid URL limits
// ============================================================================
export const PATIENT_PAGE_SIZE = 50;

/**
 * Batch a large array into smaller chunks to avoid Supabase URL length limits.
 */
async function batchInQuery<T>(
  ids: string[],
  batchFn: (batchIds: string[]) => Promise<T[]>
): Promise<T[]> {
  const BATCH_SIZE = 100;
  const results: T[] = [];
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const batchResults = await batchFn(batch);
    results.push(...batchResults);
  }
  return results;
}

export function useItemPatients(itemId: string | undefined) {
  return useQuery({
    queryKey: ["item-patients", itemId],
    enabled: !!itemId,
    queryFn: async () => {
      // Fetch assignments with patient data via joined query
      const { data: assignments, error: aErr } = await supabase
        .from("patient_item_assignments")
        .select(`
          id,
          patient_id,
          dos,
          tarikh_mula_guna,
          patient:patients!patient_id(id, nama, nombor_kad_pengenalan, nombor_pendaftaran_hospital)
        `)
        .eq("item_id", itemId!)
        .eq("aktif", true);
      if (aErr) throw aErr;
      if (!assignments || assignments.length === 0) return [];

      // Fetch ALL supply records for this item using batched queries.
      const assignmentIds = assignments.map((a: any) => a.id);
      const allSupplies = await batchInQuery(
        assignmentIds,
        async (batchIds) => {
          const { data, error } = await supabase
            .from("supply_records")
            .select("assignment_id, tarikh_dibekal, kuantiti")
            .in("assignment_id", batchIds)
            .order("tarikh_dibekal", { ascending: false });
          if (error) throw error;
          return (data ?? []) as any[];
        }
      );

      const lastSupplyMap = new Map<string, { tarikh: string; qty: number }>();
      allSupplies.forEach((s: any) => {
        if (!lastSupplyMap.has(s.assignment_id)) {
          lastSupplyMap.set(s.assignment_id, {
            tarikh: s.tarikh_dibekal,
            qty: s.kuantiti,
          });
        }
      });

      // Fallback: for any assignment still missing a supply, fetch individually
      const missingIds = assignments
        .filter((a: any) => !lastSupplyMap.has(a.id))
        .map((a: any) => a.id);
      
      if (missingIds.length > 0) {
        const fallbackSupplies = await batchInQuery(
          missingIds,
          async (batchIds) => {
            const { data, error } = await supabase
              .from("supply_records")
              .select("assignment_id, tarikh_dibekal, kuantiti")
              .in("assignment_id", batchIds)
              .order("tarikh_dibekal", { ascending: false });
            if (error) return [];
            return (data ?? []) as any[];
          }
        );
        fallbackSupplies.forEach((s: any) => {
          if (!lastSupplyMap.has(s.assignment_id)) {
            lastSupplyMap.set(s.assignment_id, {
              tarikh: s.tarikh_dibekal,
              qty: s.kuantiti,
            });
          }
        });
      }

      return assignments.map((a: any) => ({
        id: a.id,
        patient_id: a.patient_id,
        dos: a.dos,
        tarikh_mula_guna: a.tarikh_mula_guna,
        patient: a.patient,
        last_supply: lastSupplyMap.get(a.id) ?? null,
      }));
    },
    staleTime: 30_000,
  });
}

// ============================================================================
// TRANSACTION HISTORY
// ============================================================================
export const TX_PAGE_SIZE = 50;

export function useItemTransactionHistory(itemId: string | undefined) {
  return useQuery({
    queryKey: ["transaction-history", itemId],
    enabled: !!itemId,
    queryFn: async () => {
      // 1. Get assignment IDs for this item (both active and inactive)
      const { data: itemAssignments } = await supabase
        .from("patient_item_assignments")
        .select("id")
        .eq("item_id", itemId);
      const assignmentIds = (itemAssignments ?? []).map((a: any) => a.id);

      // 2. Fetch supply records for those assignments (batched to avoid URL limits)
      const supplyRecords = assignmentIds.length > 0
        ? await batchInQuery<any>(assignmentIds, async (batchIds) => {
            const { data, error } = await supabase
              .from("supply_records")
              .select(`
                id,
                tarikh_dibekal,
                dos,
                kuantiti,
                batch_id,
                catatan_bekalan,
                assignment:patient_item_assignments!assignment_id(
                  item_id,
                  patient:patients!patient_id(nama),
                  item:items!item_id(nama_item)
                ),
                batch:item_batches!batch_id(nombor_kelompok),
                staff:profiles!kakitangan_pembekal(nama)
              `)
              .in("assignment_id", batchIds)
              .order("tarikh_dibekal", { ascending: false })
              .limit(500);
            if (error) throw error;
            return data ?? [];
          })
        : [];

      // 3. Get batch IDs for this item
      const { data: itemBatches } = await supabase
        .from("item_batches")
        .select("id")
        .eq("item_id", itemId);
      const batchIds = (itemBatches ?? []).map((b: any) => b.id);

      // 4. Fetch batch adjustments for those batches (batched to avoid URL limits)
      const adjustments = batchIds.length > 0
        ? await batchInQuery<any>(batchIds, async (batchIdsChunk) => {
            const { data, error } = await supabase
              .from("batch_adjustments")
              .select(`
                id,
                created_at,
                previous_kuantiti,
                new_kuantiti,
                change,
                reason,
                batch:item_batches!batch_id(
                  nombor_kelompok,
                  item_id
                ),
                staff:profiles!adjusted_by(nama)
              `)
              .in("batch_id", batchIdsChunk)
              .order("created_at", { ascending: false })
              .limit(500);
            if (error) throw error;
            return data ?? [];
          })
        : [];

      const { data: inventoryTransactions, error: transactionError } = await supabase
        .from("inventory_transactions")
        .select("id, created_at, batch_id, jenis, kuantiti, catatan, batch:item_batches!batch_id(nombor_kelompok)")
        .eq("item_id", itemId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (transactionError) throw transactionError;

      // Combine both into CombinedTransaction array
      const combined: CombinedTransaction[] = [];

      ((supplyRecords ?? []) as any[]).forEach((sr) => {
        combined.push({
          id: sr.id,
          tarikh: sr.tarikh_dibekal,
          jenis: "bekalan",
          jenis_label: "Bekalan",
          kelompok: sr.batch?.nombor_kelompok ?? null,
          perubahan: -sr.kuantiti,
          perubahan_label: `-${sr.kuantiti}`,
          catatan: sr.catatan_bekalan ?? null,
          kakitangan: sr.staff?.nama ?? null,
          pesakit: sr.assignment?.patient?.nama ?? null,
        });
      });

      ((adjustments ?? []) as any[]).forEach((adj) => {
        const isUp = adj.change > 0;
        combined.push({
          id: `adj-${adj.id}`,
          tarikh: adj.created_at,
          jenis: "pelarasan",
          jenis_label: isUp ? "Penambahan" : "Pelupusan",
          kelompok: adj.batch?.nombor_kelompok ?? null,
          perubahan: adj.change,
          perubahan_label: isUp ? `+${adj.change}` : `${adj.change}`,
          catatan: adj.reason ?? null,
          kakitangan: adj.staff?.nama ?? null,
          pesakit: null,
        });
      });

      ((inventoryTransactions ?? []) as any[]).forEach((tx) => {
        combined.push({
          id: `inv-${tx.id}`,
          tarikh: tx.created_at,
          jenis: "pelarasan",
          jenis_label: tx.jenis === "masuk" ? "Penambahan" : "Pelupusan",
          kelompok: tx.batch?.nombor_kelompok ?? null,
          perubahan: tx.jenis === "masuk" ? tx.kuantiti : -tx.kuantiti,
          perubahan_label: tx.jenis === "masuk" ? `+${tx.kuantiti}` : `-${tx.kuantiti}`,
          catatan: tx.catatan ?? null,
          kakitangan: null,
          pesakit: null,
        });
      });

      // Sort by date descending
      combined.sort(
        (a, b) => new Date(b.tarikh).getTime() - new Date(a.tarikh).getTime()
      );

      return combined;
    },
    staleTime: 30_000,
  });
}

export interface CombinedTransaction {
  id: string;
  tarikh: string;
  jenis: "bekalan" | "pelarasan";
  jenis_label: string;
  kelompok: string | null;
  perubahan: number;
  perubahan_label: string;
  catatan: string | null;
  kakitangan: string | null;
  pesakit: string | null;
}

// ============================================================================
// PATIENTS & STAFF LISTS (for filter dropdowns)
// ============================================================================
export function usePatientsList() {
  return useQuery({
    queryKey: ["patients-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("id, nama")
        .eq("aktif", true)
        .is("merged_into", null)
        .order("nama");
      if (error) throw error;
      return (data ?? []) as { id: string; nama: string }[];
    },
    staleTime: 300_000,
  });
}

export function useStaffList() {
  return useQuery({
    queryKey: ["staff-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nama")
        .eq("aktif", true)
        .order("nama");
      if (error) throw error;
      return (data ?? []) as { id: string; nama: string }[];
    },
    staleTime: 300_000,
  });
}
