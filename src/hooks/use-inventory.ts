/**
 * Hooks untuk Pengurusan Inventori.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { getTodayStrKL, getNowISOKL } from "@/lib/utils";
import { escapeIlikeExact, escapeLikeTerm } from "@/lib/postgrest";
import type {
  Item,
  ItemBatch,
  ItemForm,
  ItemCategory,
  PatientItemAssignment,
  Patient,
  SupplyRecord,
} from "@/types";

const ITEM_COLUMNS =
  "id, kod_item, nama_item, nama_dagangan, kekuatan, id_kategori, id_bentuk, kuota, catatan, aktif, created_at, updated_at";
const BATCH_COLUMNS =
  "id, item_id, nombor_kelompok, tarikh_luput, kuantiti, dilupuskan, dilupuskan_at, created_at, updated_at";

// ============================================================================
// ITEMS
// ============================================================================
export const INVENTORY_PAGE_SIZE = 50;

export type SortDir = "asc" | "desc";
export interface SortState {
  key: string;
  dir: SortDir;
}

/**
 * LOW-5: baki jurnal untuk laluan fallback (pre-RPC). Mencerminkan
 * inventory_item_baki() di pelayan — jumlah SEMUA kelompok item (termasuk
 * lupus; kekal konsisten dengan baris yang ditulis RPC).
 */
async function fetchItemBaki(itemId: string): Promise<number> {
  const { data, error } = await supabase
    .from("item_batches")
    .select("kuantiti")
    .eq("item_id", itemId);
  if (error) throw error;
  return (data ?? []).reduce((sum, b: any) => sum + (b.kuantiti || 0), 0);
}

export function useUpdateBatchQuantity(itemId: string | undefined) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async (data: {
      batchId: string;
      newKuantiti: number;
      reason?: string;
      catatan?: string;
    }) => {
      // MEDIUM-4: jangan tulis jurnal tanpa pelaku.
      if (!profile?.id) {
        throw new Error("Sesi tamat tempoh. Sila log masuk semula.");
      }
      const actorId = profile.id;
      const catatan = data.catatan?.trim();
      if (data.reason === "Pelupusan Stok") {
        const { error } = await supabase.rpc("process_batch_disposal", {
          p_batch_id: data.batchId,
          p_adjusted_by: actorId,
          p_reason: data.reason,
          p_catatan: catatan || null,
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
        const { data: adjustment, error: adjustmentError } = await supabase
          .from("batch_adjustments")
          .insert({
            batch_id: data.batchId,
            previous_kuantiti: batch.kuantiti,
            new_kuantiti: 0,
            change: -batch.kuantiti,
            reason: data.reason,
            adjusted_by: actorId,
          })
          .select("id")
          .single();
        if (adjustmentError) throw adjustmentError;
        // LOW-5: jurnal pelupusan tiada dalam fallback lama — tulis dengan baki.
        const { error: txError } = await supabase.from("inventory_transactions").insert({
          item_id: batch.item_id,
          batch_id: data.batchId,
          jenis: "keluar",
          kuantiti: batch.kuantiti,
          rujukan_id: adjustment.id,
          rujukan_type: "batch_disposal",
          catatan: data.reason ?? null,
          baki: await fetchItemBaki(batch.item_id),
        });
        if (txError) throw txError;
        return;
      }
      const { error: rpcErr } = await supabase.rpc("record_batch_adjustment", {
        p_batch_id: data.batchId,
        p_new_kuantiti: data.newKuantiti,
        p_reason: data.reason ?? null,
        p_adjusted_by: actorId,
        p_catatan: catatan || null,
      });
      if (!rpcErr) return;
      if (!rpcErr.message?.includes("Could not find the function")) throw rpcErr;

      // Fallback: DB belum dinaik taraf ke migrasi 018
      const { data: existing, error: getErr } = await supabase
        .from("item_batches")
        .select("item_id, kuantiti, dilupuskan")
        .eq("id", data.batchId)
        .single();
      if (getErr) throw getErr;
      if (!existing) throw new Error("Kelompok tidak dijumpai.");
      if (existing.dilupuskan) throw new Error("Kelompok ini telah dilupuskan dan tidak boleh diubah.");

      const { error: updErr } = await supabase
        .from("item_batches")
        .update({ kuantiti: data.newKuantiti, updated_at: getNowISOKL() })
        .eq("id", data.batchId)
        .eq("dilupuskan", false);
      if (updErr) throw updErr;

      const change = data.newKuantiti - existing.kuantiti;
      if (change === 0) throw new Error("Tiada perubahan pada kuantiti.");
      const { data: adjustment, error: adjustmentError } = await supabase
        .from("batch_adjustments")
        .insert({
          batch_id: data.batchId,
          previous_kuantiti: existing.kuantiti,
          new_kuantiti: data.newKuantiti,
          change,
          reason: data.reason,
          adjusted_by: actorId,
        })
        .select("id")
        .single();
      if (adjustmentError) throw adjustmentError;
      // LOW-5: jurnal pelarasan tiada dalam fallback lama — tulis dengan baki.
      const { error: txError } = await supabase.from("inventory_transactions").insert({
        item_id: existing.item_id,
        batch_id: data.batchId,
        jenis: change >= 0 ? "masuk" : "keluar",
        kuantiti: Math.abs(change),
        rujukan_id: adjustment.id,
        rujukan_type: "adjustment",
        catatan: data.reason ?? null,
        baki: await fetchItemBaki(existing.item_id),
      });
      if (txError) throw txError;
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
      // RPC-first path: server handles stock/quota computation and sorting
      const sortKey = sort?.key ?? "nama_item";
      const sortDir = sort?.dir ?? "asc";
      const offset = page * pageSize;
      // MEDIUM-1 (audit carian): lepaskan wildcard LIKE (selari dengan
      // use-patients) — tanpa ini "%" memadankan hampir semua item.
      const { data: rpcData, error: rpcErr } = await supabase.rpc(
        "get_inventory_list",
        {
          p_search: escapeIlikeExact(search.trim()),
          p_sort_key: sortKey,
          p_sort_dir: sortDir,
          p_offset: offset,
          p_limit: pageSize,
        }
      );
      if (!rpcErr) {
        const totalCount =
          rpcData && rpcData.length > 0
            ? Number(rpcData[0]._total_count)
            : 0;
        return {
          items: (rpcData ?? []).map((r: any) => ({
            id: r.id,
            kod_item: r.kod_item,
            nama_item: r.nama_item,
            nama_dagangan: r.nama_dagangan,
            kekuatan: r.kekuatan,
            kuota: r.kuota,
            id_bentuk: r.id_bentuk,
            bentuk: r.bentuk,
            item_batches: [{ kuantiti: Number(r.total_stock) }],
            // MEDIUM-1: stok boleh dibekal (bukan lupus + belum luput).
            // Pra-042: lajur tiada → anggap semua boleh dibekal.
            dispensable_stock: Number(
              r.dispensable_stock ?? r.total_stock ?? 0
            ),
            patient_item_assignments: Array.from(
              { length: Number(r.bilangan_pesakit) },
              (_, i) => ({ id: String(i) })
            ),
            item_forms: null,
          })),
          total: totalCount,
          totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
        };
      }
      // Prioritize RPC. Only fall back to legacy when the function truly
      // isn't deployed (42883 / does not exist). Genuine RPC errors throw.
      if (rpcErr.code !== "42883" && !rpcErr.message?.includes("does not exist")) {
        throw rpcErr;
      }
      // Fallback: RPC not yet deployed — legacy client-side queries
      // (lajur eksplisit — elak SELECT *).
      let query = supabase
        .from("items")
        .select(
          `${ITEM_COLUMNS}, item_batches(kuantiti, tarikh_luput, dilupuskan), patient_item_assignments(id)`,
          { count: "exact" }
        )
        .eq("aktif", true);

      // Search — istilah dibersihkan (PostgREST injection); termasuk
      // kekuatan (selari dengan get_inventory_list 054).
      if (search.trim()) {
        const term = escapeLikeTerm(search.trim());
        query = query.or(
          `kod_item.ilike.%${term}%,nama_item.ilike.%${term}%,nama_dagangan.ilike.%${term}%,kekuatan.ilike.%${term}%`
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

        const rows = (data ?? []).map((item: any) => ({
          ...item,
          bentuk: formMap.get(item.id_bentuk) ?? null,
          dispensable_stock: computeDispensable(item),
        }));
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
        items: (data ?? []).map((item: any) => ({
          ...item,
          bentuk: formMap.get(item.id_bentuk) ?? null,
          dispensable_stock: computeDispensable(item),
        })),
        total: count ?? 0,
        totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
      };
    },
    staleTime: 0,
  });
}

function computeStock(item: { item_batches?: { kuantiti: number; dilupuskan?: boolean }[] }): number {
  // Selari dengan total_stock pelayan: kelompok dilupuskan tidak dikira.
  // (Laluan RPC membekalkan jumlah yang telah ditapis — medan tiada = dikira.)
  return (item.item_batches ?? []).reduce(
    (sum, b) => sum + (!b.dilupuskan ? b.kuantiti || 0 : 0),
    0
  );
}

/**
 * MEDIUM-1: stok boleh dibekal — bukan lupus DAN belum luput.
 * Perbandingan string YYYY-MM-DD adalah sah secara leksikografi.
 */
function computeDispensable(
  item: {
    item_batches?: { kuantiti: number; tarikh_luput?: string; dilupuskan?: boolean }[];
  },
  today = getTodayStrKL()
): number {
  return (item.item_batches ?? []).reduce(
    (sum, b) =>
      sum +
      (!b.dilupuskan && (!b.tarikh_luput || b.tarikh_luput >= today)
        ? b.kuantiti || 0
        : 0),
    0
  );
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
        .select(ITEM_COLUMNS)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

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

      return { ...data, item_categories: itemCategories, item_forms: itemForms };
    },
    staleTime: 0,
  });
}

export function useItemForms() {
  return useQuery({
    // Kunci dikongsi dengan use-patient-detail: satu cache untuk lookup sama.
    queryKey: ["item_forms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_forms")
        .select("id, nama")
        .order("nama");
      if (error) throw error;
      return (data ?? []) as ItemForm[];
    },
    staleTime: 0,
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
    staleTime: 0,
  });
}

export function useAddItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (itemData: Partial<Item>) => {
      // MEDIUM-2: kuota mesti integer 0–999999 (pertahanan di titik cekik —
      // dialog mengesahkan dahulu, pelayan 053 menguatkuasakan muktamad).
      if (itemData.kuota !== undefined && itemData.kuota !== null) {
        const q = Number(itemData.kuota);
        if (!Number.isInteger(q) || q < 0 || q > 999999) {
          throw new Error("Kuota mestilah nombor bulat 0–999999.");
        }
      }
      // MEDIUM-1 (audit pendaftaran item): semak pendua SEBELUM tulis —
      // laluan suntingan (useUpdateItem) sudah berbuat demikian; ciptaan
      // tidak harus bergantung semata-mata pada ralat DB mentah. Semakan
      // tidak peka huruf (selari carian) + perbandingan tepat.
      const kodItem = (itemData.kod_item ?? "").trim();
      if (!kodItem) throw new Error("Kod item diperlukan.");
      const { data: duplicate, error: duplicateError } = await supabase
        .from("items")
        .select("id")
        .ilike("kod_item", escapeIlikeExact(kodItem))
        .maybeSingle();
      if (duplicateError) throw duplicateError;
      if (duplicate) {
        throw new Error(
          `Kod item "${kodItem.toUpperCase()}" sudah digunakan. Sila gunakan kod yang unik.`
        );
      }
      const { data, error } = await supabase
        .from("items")
        .insert({ ...itemData, kod_item: kodItem.toUpperCase() })
        .select(ITEM_COLUMNS)
        .single();
      if (error) {
        // Perlumbaan selit (dua pendaftaran serentak) — kekangan unik DB
        // kekal sebagai penguatkuasa terakhir; terjemahkan mesejnya.
        if ((error as { code?: string }).code === "23505") {
          throw new Error(
            `Kod item "${kodItem.toUpperCase()}" sudah digunakan. Sila gunakan kod yang unik.`
          );
        }
        throw error;
      }
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
      // MEDIUM-2: kuota negatif/salah bentuk ditolak di sini (jalan edit).
      if (data.kuota !== undefined && data.kuota !== null) {
        const q = Number(data.kuota);
        if (!Number.isInteger(q) || q < 0 || q > 999999) {
          throw new Error("Kuota mestilah nombor bulat 0–999999.");
        }
      }
      if (data.kod_item !== undefined) {
        const kodItem = data.kod_item.trim();
        if (!kodItem) throw new Error("Kod item diperlukan.");
        const { data: duplicate, error: duplicateError } = await supabase
          .from("items")
          .select("id")
          .ilike("kod_item", escapeIlikeExact(kodItem))
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
      // MEDIUM-4: jangan tulis jurnal tanpa pelaku.
      if (!profile?.id) {
        throw new Error("Sesi tamat tempoh. Sila log masuk semula.");
      }
      const actorId = profile.id;
      const { data, error } = await supabase.rpc("delete_item", {
        p_item_id: itemId,
        p_deleted_by: actorId,
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
            ditamatkan_oleh: actorId,
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
            p_adjusted_by: actorId,
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
        .select(BATCH_COLUMNS)
        .eq("item_id", itemId!)
        .order("tarikh_luput", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ItemBatch[];
    },
    staleTime: 0,
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
      // MEDIUM-1: semakan klien (pelayan 042 menguatkuasakan perkara sama).
      // String YYYY-MM-DD boleh dibandingkan secara leksikografi.
      if (batchData.tarikh_luput < getTodayStrKL()) {
        throw new Error("Tarikh luput telah berlalu — kelompok luput tidak boleh diterima masuk.");
      }
      // MEDIUM-4: jangan tulis jurnal tanpa pelaku.
      if (!profile?.id) {
        throw new Error("Sesi tamat tempoh. Sila log masuk semula.");
      }
      const actorId = profile.id;
      const { error: addErr } = await supabase.rpc("record_batch_addition", {
        p_item_id: itemId!,
        p_nombor_kelompok: batchData.nombor_kelompok,
        p_tarikh_luput: batchData.tarikh_luput,
        p_kuantiti: batchData.kuantiti,
        p_added_by: actorId,
      });
      if (!addErr) return;
      if (!addErr.message?.includes("Could not find the function")) throw addErr;

      // Fallback: DB belum dinaik taraf ke migrasi 018
      const { data: existing, error: findError } = await supabase
        .from("item_batches")
        .select("id, item_id, kuantiti, dilupuskan")
        .eq("item_id", itemId!)
        .ilike("nombor_kelompok", escapeIlikeExact(batchData.nombor_kelompok))
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
        // Jaring keselamatan 23505 (tiada indeks unik — ulangan adalah sah;
        // dikekalkan jika kekangan ditambah pada masa hadapan).
        if (error) {
          if ((error as { code?: string }).code === "23505") {
            throw new Error(
              "Kelompok ini baru sahaja didaftarkan (kemungkinan oleh pengguna lain). Sila cuba semula — stok akan ditambah ke kelompok tersebut."
            );
          }
          throw error;
        }
        batchId = inserted.id;
      }
      const { data: addition, error: staffError } = await supabase
        .from("batch_additions")
        .insert({
          batch_id: batchId,
          kuantiti: batchData.kuantiti,
          added_by: actorId,
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
        // LOW-5: baki tiada dalam fallback lama — kira seperti RPC.
        baki: await fetchItemBaki(itemId!),
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
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async (data: {
      batchId: string;
      nombor_kelompok: string;
      tarikh_luput: string;
      reason: string;
    }) => {
      if (!profile?.id) {
        throw new Error("Sesi tamat tempoh. Sila log masuk semula.");
      }
      // MEDIUM-3: laluan beraudit (044) dahulu — kemas kini identiti mesti
      // meninggalkan jejak dengan sebab.
      const { error: rpcErr } = await supabase.rpc("record_batch_update", {
        p_batch_id: data.batchId,
        p_nombor_kelompok: data.nombor_kelompok,
        p_tarikh_luput: data.tarikh_luput,
        p_reason: data.reason,
        p_updated_by: profile.id,
      });
      if (!rpcErr) return;
      if (
        rpcErr.code !== "42883" &&
        !rpcErr.message?.includes("does not exist") &&
        !rpcErr.message?.includes("Could not find the function")
      )
        throw rpcErr;

      // Fallback: DB belum dinaik taraf ke migrasi 044 — tulis terus +
      // jurnal manual (semakan yang sama seperti RPC).
      const { data: batch, error: getErr } = await supabase
        .from("item_batches")
        .select("id, item_id, nombor_kelompok, tarikh_luput, kuantiti, dilupuskan")
        .eq("id", data.batchId)
        .maybeSingle();
      if (getErr) throw getErr;
      if (!batch) throw new Error("Kelompok tidak dijumpai.");
      if (batch.dilupuskan) {
        throw new Error("Kelompok ini telah dilupuskan dan tidak boleh diubah.");
      }
      const newName = data.nombor_kelompok.trim().toUpperCase();
      if (!newName) throw new Error("Nombor kelompok diperlukan.");
      if (data.tarikh_luput < getTodayStrKL()) {
        throw new Error("Tarikh luput telah berlalu.");
      }
      if (
        batch.nombor_kelompok === newName &&
        batch.tarikh_luput === data.tarikh_luput
      ) {
        throw new Error("Tiada perubahan pada maklumat kelompok.");
      }
      const { data: clash } = await supabase
        .from("item_batches")
        .select("id")
        .eq("item_id", batch.item_id)
        .ilike("nombor_kelompok", escapeIlikeExact(newName))
        .neq("id", data.batchId)
        .limit(1)
        .maybeSingle();
      if (clash) {
        throw new Error(
          `Nombor kelompok ${newName} sudah wujud — tambah stok ke kelompok tersebut dan bukannya menamakan semula.`
        );
      }
      const { error: updErr } = await supabase
        .from("item_batches")
        .update({
          nombor_kelompok: newName,
          tarikh_luput: data.tarikh_luput,
          updated_at: getNowISOKL(),
        })
        .eq("id", data.batchId)
        .eq("dilupuskan", false);
      if (updErr) {
        if ((updErr as { code?: string }).code === "23505") {
          throw new Error(
            `Nombor kelompok ${newName} sudah wujud — tambah stok ke kelompok tersebut dan bukannya menamakan semula.`
          );
        }
        throw updErr;
      }
      const { error: journalErr } = await supabase
        .from("batch_adjustments")
        .insert({
          batch_id: data.batchId,
          previous_kuantiti: batch.kuantiti,
          new_kuantiti: batch.kuantiti,
          change: 0,
          reason: data.reason,
          adjusted_by: profile.id,
          catatan: `Maklumat kelompok: nombor ${batch.nombor_kelompok} → ${newName}; luput ${batch.tarikh_luput} → ${data.tarikh_luput}`,
        });
      if (journalErr) throw journalErr;
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
      const { data: rpcData, error: rpcErr } = await supabase.rpc(
        "get_item_patients_with_activity",
        { p_item_id: itemId! }
      );
      if (!rpcErr) {
        return (rpcData ?? []).map((r: any) => ({
          id: r.id,
          patient_id: r.patient_id,
          dos: r.dos,
          tarikh_mula_guna: r.tarikh_mula_guna,
          patient: { id: r.patient_id, nama: r.patient_nama,
            nombor_kad_pengenalan: r.patient_no_kp,
            nombor_pendaftaran_hospital: r.patient_no_hospital },
          last_supply: r.last_supply_tarikh
            ? { tarikh: r.last_supply_tarikh, qty: r.last_supply_kuantiti } : null,
          last_declination: r.last_declination_tarikh,
          last_activity: r.last_activity,
        }));
      }
      if (!rpcErr.message?.includes("Could not find the function")) throw rpcErr;

      // Fallback: RPC belum deployed — legacy multi-query path
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

      const assignmentIds = assignments.map((a: any) => a.id);
      const allSupplies = await batchInQuery(
        assignmentIds,
        async (batchIds) => {
          const { data, error } = await supabase
            .from("supply_records")
            .select("assignment_id, tarikh_dibekal, kuantiti")
            .in("assignment_id", batchIds)
            .is("voided_at", null)
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
    staleTime: 0,
  });
}

// ============================================================================
// TRANSACTION HISTORY
// ============================================================================
export const TX_PAGE_SIZE = 50;

function buildAdjustmentNote(
  reason: string | null,
  catatan: string | null,
  fallback: string | null
): string | null {
  const note = catatan?.trim();
  if (reason && note && note !== reason) return `${reason} — ${note}`;
  if (reason) return reason;
  return fallback ?? null;
}

export function useItemTransactionHistory(itemId: string | undefined) {
  return useQuery({
    queryKey: ["transaction-history", itemId],
    enabled: !!itemId,
    queryFn: async () => {
      const { data: rpcData, error: rpcErr } = await supabase.rpc(
        "get_item_transaction_history",
        { p_item_id: itemId! }
      );
      if (!rpcErr) {
        return (rpcData ?? []).map((r: any) => ({
          id: r.id,
          tarikh: r.tarikh,
          jenis: r.jenis,
          jenis_label: r.jenis_label,
          kelompok: r.kelompok,
          perubahan: r.perubahan,
          perubahan_label: `${r.perubahan > 0 ? "+" : ""}${r.perubahan}`,
          catatan: r.catatan,
          kakitangan: r.kakitangan,
          pesakit: r.pesakit,
          baki: r.baki != null ? (r.baki as number) : null,
        })) as CombinedTransaction[];
      }
      if (!rpcErr.message?.includes("Could not find the function")) throw rpcErr;

      // Fallback: RPC belum deployed — legacy multi-query path
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

      const supplyIds = rows
        .filter((r) => r.rujukan_type === "supply" && r.rujukan_id)
        .map((r) => r.rujukan_id);
      const additionIds = rows
        .filter((r) => r.rujukan_type === "batch_addition" && r.rujukan_id)
        .map((r) => r.rujukan_id);
      const adjustmentIds = rows
        .filter((r) =>
          (r.rujukan_type === "adjustment" || r.rujukan_type === "batch_disposal") &&
          r.rujukan_id
        )
        .map((r) => r.rujukan_id);

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

      const adjustmentDetailMap = new Map<string, { kakitangan: string | null; reason: string | null; catatan: string | null }>();
      if (adjustmentIds.length > 0) {
        const adjustments = await batchInQuery<any>(adjustmentIds, async (batchIds) => {
          const { data, error } = await supabase
            .from("batch_adjustments")
            .select("id, reason, adjusted_by, change, catatan")
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
            reason: a.reason ?? null,
            catatan: a.catatan ?? null,
          });
        });
      }

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
          catatan = buildAdjustmentNote(detail?.reason ?? null, detail?.catatan ?? null, tx.catatan);
        } else {
          // adjustment (pelarasan naik/turun)
          jenis = "pelarasan";
          jenis_label = tx.jenis === "masuk" ? "Penambahan" : "Pelupusan";
          perubahan = tx.jenis === "masuk" ? tx.kuantiti : -tx.kuantiti;
          const detail = adjustmentDetailMap.get(tx.rujukan_id);
          kakitangan = detail?.kakitangan ?? null;
          catatan = buildAdjustmentNote(detail?.reason ?? null, detail?.catatan ?? null, tx.catatan);
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

      combined.sort(
        (a, b) => new Date(b.tarikh).getTime() - new Date(a.tarikh).getTime()
      );

      return combined;
    },
    staleTime: 0,
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
    staleTime: 0,
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
    staleTime: 0,
  });
}
