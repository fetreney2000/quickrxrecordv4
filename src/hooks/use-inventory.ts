/**
 * Hooks untuk Pengurusan Inventori.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { getTodayStrKL, getNowISOKL } from "@/lib/utils";
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
        if (!error) return;
        if (!error.message?.includes("Could not find the function")) throw error;

        // Fallback: DB belum dinaik taraf ke migrasi 018
        const { data: batch, error: batchError } = await supabase
          .from("item_batches")
          .select("item_id, kuantiti, dilupuskan")
          .eq("id", data.batchId)
          .single();
        if (batchError) throw batchError;
        if (batch.dilupuskan) throw new Error("Kelompok telah dilupuskan.");
        const { error: updateError } = await supabase
          .from("item_batches")
          .update({ kuantiti: 0, dilupuskan: true, dilupuskan_at: getNowISOKL() })
          .eq("id", data.batchId)
          .eq("dilupuskan", false);
        if (updateError) throw updateError;
        const { error: adjustmentError } = await supabase.from("batch_adjustments").insert({
          batch_id: data.batchId,
          previous_kuantiti: batch.kuantiti,
          new_kuantiti: 0,
          change: -batch.kuantiti,
          reason: data.reason,
          adjusted_by: profile?.id ?? null,
        });
        if (adjustmentError) throw adjustmentError;
        return;
      }
      const { error: rpcErr } = await supabase.rpc("record_batch_adjustment", {
        p_batch_id: data.batchId,
        p_new_kuantiti: data.newKuantiti,
        p_reason: data.reason ?? null,
        p_adjusted_by: profile?.id ?? null,
      });
      if (!rpcErr) return;
      if (!rpcErr.message?.includes("Could not find the function")) throw rpcErr;

      // Fallback: DB belum dinaik taraf ke migrasi 018
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
  const needsClientSort = sort?.key === "stock" || sort?.key === "remaining";
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

      // stok dan baki kuota bukan lajur dalam jadual items (nilai terhitung),
      // jadi isihan dilakukan di sisi klien selepas memuatkan semua padanan.
      if (needsClientSort) {
        const { data, error, count } = await query;
        if (error) throw error;

        const formIds = [...new Set((data ?? []).map((item: any) => item.id_bentuk).filter(Boolean))];
        const formMap = new Map<string, string>();
        if (formIds.length > 0) {
          const { data: forms, error: formsError } = await supabase
            .from("item_forms")
            .select("id, nama")
            .in("id", formIds);
          if (formsError) throw formsError;
          (forms ?? []).forEach((form) => formMap.set(form.id, form.nama));
        }

        const rows = (data ?? []).map((item: any) => ({ ...item, bentuk: formMap.get(item.id_bentuk) ?? null }));
        rows.sort((a: any, b: any) => {
          const av = sort.key === "stock" ? computeStock(a) : computeRemaining(a);
          const bv = sort.key === "stock" ? computeStock(b) : computeRemaining(b);
          const cmp = compareNullable(av, bv);
          return sort.dir === "asc" ? cmp : -cmp;
        });

        const from = page * pageSize;
        return {
          items: rows.slice(from, from + pageSize),
          total: count ?? 0,
          totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
        };
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

      const formIds = [...new Set((data ?? []).map((item: any) => item.id_bentuk).filter(Boolean))];
      const formMap = new Map<string, string>();
      if (formIds.length > 0) {
        const { data: forms, error: formsError } = await supabase
          .from("item_forms")
          .select("id, nama")
          .in("id", formIds);
        if (formsError) throw formsError;
        (forms ?? []).forEach((form) => formMap.set(form.id, form.nama));
      }

      return {
        items: (data ?? []).map((item: any) => ({ ...item, bentuk: formMap.get(item.id_bentuk) ?? null })),
        total: count ?? 0,
        totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
      };
    },
    staleTime: 30_000,
  });
}

function computeStock(item: { item_batches?: { kuantiti: number }[] }): number {
  return (item.item_batches ?? []).reduce((sum, b) => sum + (b.kuantiti || 0), 0);
}

function computeRemaining(item: { kuota?: number | null; patient_item_assignments?: { id: string }[] }): number | null {
  if (item.kuota == null) return null;
  return Math.max(0, item.kuota - (item.patient_item_assignments?.length ?? 0));
}

function compareNullable(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
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
      if (data.kod_item !== undefined) {
        const kodItem = data.kod_item.trim();
        if (!kodItem) throw new Error("Kod item diperlukan.");
        const { data: duplicate, error: duplicateError } = await supabase
          .from("items")
          .select("id")
          .ilike("kod_item", kodItem)
          .neq("id", id!)
          .maybeSingle();
        if (duplicateError) throw duplicateError;
        if (duplicate) throw new Error("Kod item sudah digunakan. Sila gunakan kod yang unik.");
        data = { ...data, kod_item: kodItem };
      }
      const { error } = await supabase
        .from("items")
        .update(data)
        .eq("id", id!);
      if (error) {
        if (error.code === "23505") throw new Error("Kod item sudah digunakan. Sila gunakan kod yang unik.");
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item", id] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
onError: (error: Error) => {
      toast.error(error.message || "Gagal mengemaskini item.");
    },
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error } = await supabase.rpc("delete_item", {
        p_item_id: itemId,
        p_deleted_by: profile?.id ?? null,
      });
      if (!error) return data as "deleted" | "deactivated";
      if (!error.message?.includes("Could not find the function")) throw error;

      // Fallback: DB belum dinaik taraf ke migrasi 019.
      // Keputusan mesti sama dengan RPC: v_used mengira SEMUA tugasan (sejarah
      // dikekalkan). Hanya apabila tiada tugasan langsung kita hard-delete;
      // sebaliknya soft-delete.
      const { data: hasHistory, error: aErr } = await supabase
        .from("patient_item_assignments")
        .select("id")
        .eq("item_id", itemId)
        .limit(1);
      if (aErr) throw aErr;

      if ((hasHistory?.length ?? 0) > 0) {
        // Soft-delete path: sembunyikan item, tamatkan tugasan aktif, lupuskan stok
        const today = getTodayStrKL();
        const sebab = "Item dinyahaktifkan / dikeluarkan dari inventori";

        const { error: hideErr } = await supabase
          .from("items")
          .update({ aktif: false })
          .eq("id", itemId);
        if (hideErr) throw hideErr;

        const { error: endErr } = await supabase
          .from("patient_item_assignments")
          .update({
            aktif: false,
            tarikh_tamat_guna: today,
            sebab_tamat: sebab,
            ditamatkan_oleh: profile?.id ?? null,
          })
          .eq("item_id", itemId)
          .eq("aktif", true);
        if (endErr) throw endErr;

        // Lupuskan setiap kelompok yang belum dilupuskan; guna semula
        // process_batch_disposal apabila ada (018+).
        const { data: batches, error: bErr } = await supabase
          .from("item_batches")
          .select("id")
          .eq("item_id", itemId)
          .eq("dilupuskan", false);
        if (bErr) throw bErr;
        for (const b of batches ?? []) {
          const { error: disposeErr } = await supabase.rpc("process_batch_disposal", {
            p_batch_id: b.id,
            p_adjusted_by: profile?.id ?? null,
            p_reason: sebab,
          });
          if (
            disposeErr &&
            !disposeErr.message?.includes("Could not find the function")
          )
            throw disposeErr;
        }
        return "deactivated" as const;
      }

      // Hard-delete path: tiada tugasan -> padam item (FK cascade bawa
      // item_batches, inventory_transactions, dll.)
      const { error: delErr } = await supabase.from("items").delete().eq("id", itemId);
      if (delErr) throw delErr;
      return "deleted" as const;
    },
    onSuccess: (status, itemId) => {
      toast.success(
        status === "deleted"
          ? "Item telah dipadam secara kekal."
          : "Item ditetapkan sebagai tidak aktif. Tugasan pesakit aktif ditamatkan dan stok dilupuskan. Sejarah disimpan."
      );
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["items-with-stats"] });
      queryClient.invalidateQueries({ queryKey: ["item-patients", itemId] });
      queryClient.removeQueries({ queryKey: ["item", itemId] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Gagal memadam item.");
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
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async (batchData: {
      nombor_kelompok: string;
      tarikh_luput: string;
      kuantiti: number;
    }) => {
      const { error: addErr } = await supabase.rpc("record_batch_addition", {
        p_item_id: itemId!,
        p_nombor_kelompok: batchData.nombor_kelompok,
        p_tarikh_luput: batchData.tarikh_luput,
        p_kuantiti: batchData.kuantiti,
        p_added_by: profile?.id ?? null,
      });
      if (!addErr) return;
      if (!addErr.message?.includes("Could not find the function")) throw addErr;

      // Fallback: DB belum dinaik taraf ke migrasi 018
      const { data: existing, error: findError } = await supabase
        .from("item_batches")
        .select("id, item_id, kuantiti, dilupuskan")
        .eq("item_id", itemId!)
        .ilike("nombor_kelompok", batchData.nombor_kelompok)
        .maybeSingle();
      if (findError) throw findError;
      if (existing?.dilupuskan) throw new Error("Kelompok ini telah dilupuskan dan tidak boleh digunakan semula.");

      let batchId = existing?.id;
      if (existing) {
        const { error } = await supabase.from("item_batches")
          .update({ kuantiti: existing.kuantiti + batchData.kuantiti, tarikh_luput: batchData.tarikh_luput })
          .eq("id", existing.id).eq("dilupuskan", false);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase.from("item_batches")
          .insert({ item_id: itemId!, ...batchData }).select("id").single();
        if (error) throw error;
        batchId = inserted.id;
      }
      const { data: addition, error: staffError } = await supabase
        .from("batch_additions")
        .insert({
          batch_id: batchId,
          quantity: batchData.kuantiti,
          added_by: profile?.id ?? null,
        })
        .select("id")
        .single();
      if (staffError) throw staffError;
      const additionId = addition.id;
      const { error: transactionError } = await supabase.from("inventory_transactions").insert({
        item_id: itemId!,
        batch_id: batchId,
        jenis: "masuk",
        kuantiti: batchData.kuantiti,
        rujukan_id: additionId,
        rujukan_type: "batch_addition",
        catatan: existing ? "Tambah stok ke kelompok sedia ada" : "Kelompok baharu",
      });
      if (transactionError) throw transactionError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batches", itemId] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-history", itemId] });
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

export function computeLastActivity(
  lastSupplyTarikh: string | null,
  lastDeclinationTarikh: string | null
): string | null {
  if (!lastSupplyTarikh && !lastDeclinationTarikh) return null;
  if (!lastSupplyTarikh) return lastDeclinationTarikh;
  if (!lastDeclinationTarikh) return lastSupplyTarikh;
  return new Date(lastSupplyTarikh).getTime() > new Date(lastDeclinationTarikh).getTime()
    ? lastSupplyTarikh
    : lastDeclinationTarikh;
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

      // "Ubat Tidak Perlu Dibekalkan" (supply_declinations) — dianggap aktiviti terbaru
      const allDeclinations = assignmentIds.length > 0
        ? await batchInQuery(
            assignmentIds,
            async (batchIds) => {
              const { data, error } = await supabase
                .from("supply_declinations")
                .select("assignment_id, tarikh")
                .in("assignment_id", batchIds)
                .order("tarikh", { ascending: false });
              if (error) throw error;
              return (data ?? []) as any[];
            }
          )
        : [];

      const lastDeclinationMap = new Map<string, string>();
      allDeclinations.forEach((d: any) => {
        if (!lastDeclinationMap.has(d.assignment_id)) {
          lastDeclinationMap.set(d.assignment_id, d.tarikh);
        }
      });

      return assignments.map((a: any) => ({
        id: a.id,
        patient_id: a.patient_id,
        dos: a.dos,
        tarikh_mula_guna: a.tarikh_mula_guna,
        patient: a.patient,
        last_supply: lastSupplyMap.get(a.id) ?? null,
        last_declination: lastDeclinationMap.get(a.id) ?? null,
        last_activity: computeLastActivity(lastSupplyMap.get(a.id)?.tarikh ?? null, lastDeclinationMap.get(a.id) ?? null),
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
      // 1. Baca jurnal tunggal (inventory_transactions) utk item ini
      const { data: ledgerRows, error: ledgerError } = await supabase
        .from("inventory_transactions")
        .select(`
          id,
          created_at,
          batch_id,
          jenis,
          kuantiti,
          baki,
          rujukan_id,
          rujukan_type,
          catatan,
          batch:item_batches!batch_id(nombor_kelompok)
        `)
        .eq("item_id", itemId)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (ledgerError) throw ledgerError;
      const rows = (ledgerRows ?? []) as any[];

      // 2. Kumpulkan id rujukan mengikut jenis utk lookup terperinci (batched)
      const supplyIds = rows
        .filter((r) => r.rujukan_type === "supply" && r.rujukan_id)
        .map((r) => r.rujukan_id);
      const additionIds = rows
        .filter((r) => r.rujukan_type === "batch_addition" && r.rujukan_id)
        .map((r) => r.rujukan_id);
      const adjustmentIds = rows
        .filter((r) => r.rujukan_type === "adjustment" && r.rujukan_id)
        .map((r) => r.rujukan_id);

      // 2a. supply → pesakit + kakitangan_pembekal
      const supplyDetailMap = new Map<string, { pesakit: string | null; kakitangan: string | null; catatan: string | null }>();
      if (supplyIds.length > 0) {
        const supplies = await batchInQuery<any>(supplyIds, async (batchIds) => {
          const { data, error } = await supabase
            .from("supply_records")
            .select(`
              id,
              catatan_bekalan,
              kakitangan_pembekal,
              assignment:patient_item_assignments!assignment_id(
                patient:patients!patient_id(nama)
              ),
              staff:profiles!kakitangan_pembekal(nama)
            `)
            .in("id", batchIds);
          if (error) throw error;
          return (data ?? []) as any[];
        });
        supplies.forEach((s: any) => {
          supplyDetailMap.set(s.id, {
            pesakit: s.assignment?.patient?.nama ?? null,
            kakitangan: s.staff?.nama ?? null,
            catatan: s.catatan_bekalan ?? null,
          });
        });
      }

      // 2b. batch_addition → kakitangan (batch_additions → profiles)
      const additionStaffMap = new Map<string, string>();
      if (additionIds.length > 0) {
        const additions = await batchInQuery<any>(additionIds, async (batchIds) => {
          const { data, error } = await supabase
            .from("batch_additions")
            .select("id, added_by")
            .in("id", batchIds);
          if (error) throw error;
          return (data ?? []) as any[];
        });
        const flagIds = [...new Set((additions ?? []).map((a: any) => a.added_by).filter(Boolean))];
        const staffMap = new Map<string, string>();
        if (flagIds.length > 0) {
          const { data: staff, error: staffError } = await supabase
            .from("profiles")
            .select("id, nama")
            .in("id", flagIds);
          if (staffError) throw staffError;
          (staff ?? []).forEach((person: any) => staffMap.set(person.id, person.nama));
        }
        (additions ?? []).forEach((a: any) => {
          if (a.added_by) additionStaffMap.set(a.id, staffMap.get(a.added_by) ?? "");
        });
      }

      // 2c. adjustment & batch_disposal → kakitangan + catatan (batch_adjustments → profiles)
      const adjustmentDetailMap = new Map<string, { kakitangan: string | null; catatan: string | null }>();
      if (adjustmentIds.length > 0) {
        const adjustments = await batchInQuery<any>(adjustmentIds, async (batchIds) => {
          const { data, error } = await supabase
            .from("batch_adjustments")
            .select("id, reason, adjusted_by, change")
            .in("id", batchIds);
          if (error) throw error;
          return (data ?? []) as any[];
        });
        const flagIds = [...new Set((adjustments ?? []).map((a: any) => a.adjusted_by).filter(Boolean))];
        const staffMap = new Map<string, string>();
        if (flagIds.length > 0) {
          const { data: staff, error: staffError } = await supabase
            .from("profiles")
            .select("id, nama")
            .in("id", flagIds);
          if (staffError) throw staffError;
          (staff ?? []).forEach((person: any) => staffMap.set(person.id, person.nama));
        }
        (adjustments ?? []).forEach((a: any) => {
          adjustmentDetailMap.set(a.id, {
            kakitangan: a.adjusted_by ? staffMap.get(a.adjusted_by) ?? null : null,
            catatan: a.reason ?? null,
          });
        });
      }

      // 3. Bina baris CombinedTransaction dari jurnal
      const combined: CombinedTransaction[] = [];

      (rows as any[]).forEach((tx) => {
        const rujukanType = tx.rujukan_type;
        let jenis: CombinedTransaction["jenis"] = "pelarasan";
        let jenis_label = "Pelarasan";
        let perubahan: number;
        let catatan: string | null = tx.catatan ?? null;
        let kakitangan: string | null = null;
        let pesakit: string | null = null;

        if (rujukanType === "supply") {
          jenis = "bekalan";
          jenis_label = "Bekalan";
          perubahan = -tx.kuantiti;
          const detail = supplyDetailMap.get(tx.rujukan_id);
          catatan = detail?.catatan ?? tx.catatan ?? null;
          kakitangan = detail?.kakitangan ?? null;
          pesakit = detail?.pesakit ?? null;
        } else if (rujukanType === "batch_addition") {
          jenis = "pelarasan";
          jenis_label = "Penambahan";
          perubahan = tx.kuantiti;
          kakitangan = additionStaffMap.get(tx.rujukan_id) ?? null;
        } else if (rujukanType === "batch_disposal") {
          jenis = "pelarasan";
          jenis_label = "Pelupusan";
          perubahan = -tx.kuantiti;
          const detail = adjustmentDetailMap.get(tx.rujukan_id);
          kakitangan = detail?.kakitangan ?? null;
          catatan = detail?.catatan ?? tx.catatan ?? null;
        } else {
          // adjustment (pelarasan naik/turun)
          jenis = "pelarasan";
          jenis_label = tx.jenis === "masuk" ? "Penambahan" : "Pelupusan";
          perubahan = tx.jenis === "masuk" ? tx.kuantiti : -tx.kuantiti;
          const detail = adjustmentDetailMap.get(tx.rujukan_id);
          kakitangan = detail?.kakitangan ?? null;
          catatan = detail?.catatan ?? tx.catatan ?? null;
        }

        combined.push({
          id: tx.id,
          tarikh: tx.created_at,
          jenis,
          jenis_label,
          kelompok: tx.batch?.nombor_kelompok ?? null,
          perubahan,
          perubahan_label: `${perubahan > 0 ? "+" : ""}${perubahan}`,
          catatan,
          kakitangan,
          pesakit,
          baki: tx.baki != null ? (tx.baki as number) : null,
        });
      });

      // Susun mengikut tarikh menurun
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
  /** Baki stok item selepas pergerakan. NULL utk baris sebelum 2026-08-11. */
  baki: number | null;
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
