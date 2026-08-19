/**
 * Hook untuk mengambil statistik dashboard.
 * Empat kueri selari (Promise.all) + 1 kueri berjujukan untuk stok.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { addDaysToDateInput, getKLDayEndISO, getKLDayStartISO, getTodayStrKL, toDateInputValue } from "@/lib/utils";

interface DashboardStats {
  totalPatients: number;
  totalItems: number;
  supplyToday: number;
  expiringSoon: number;
  totalStock: number;
  lowStockCount: number;
}

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const today = getTodayStrKL();
      const startOfTodayISO = getKLDayStartISO(today);
      const startOfTomorrowISO = getKLDayEndISO(today);
      const in30Days = addDaysToDateInput(today, 30);

      // Empat kueri selari
      const [patientsRes, itemsRes, supplyRes, expiringRes] =
        await Promise.all([
          supabase
            .from("patients")
            .select("id", { count: "exact", head: true })
            .eq("aktif", true)
            .is("merged_into", null),
          supabase
            .from("items")
            .select("id", { count: "exact", head: true })
            .eq("aktif", true),
          supabase
            .from("supply_records")
            .select("id", { count: "exact", head: true })
            .is("voided_at", null)
            .gte("tarikh_dibekal", startOfTodayISO)
            .lt("tarikh_dibekal", startOfTomorrowISO),
          supabase
            .from("item_batches")
            .select("id", { count: "exact", head: true })
            .gt("kuantiti", 0)
            .gte("tarikh_luput", today)
            .lte("tarikh_luput", in30Days),
        ]);

      // Kueri kelima (berjujukan): item dengan kelompok untuk kiraan stok
      const { data: itemsWithBatches, error: stockError } = await supabase
        .from("items")
        .select("id, item_batches(kuantiti, dilupuskan)")
        .eq("aktif", true);

      if (stockError) throw stockError;

      const usageStart = addDaysToDateInput(today, -84);
      const usageEnd = addDaysToDateInput(today, 1);
      const { data: recentUsage, error: usageError } = await supabase
        .from("supply_records")
        .select("kuantiti, assignment:patient_item_assignments!inner(item_id)")
        .is("voided_at", null)
        .gte("tarikh_dibekal", getKLDayStartISO(usageStart))
        .lt("tarikh_dibekal", getKLDayStartISO(usageEnd));
      if (usageError) throw usageError;

      const usageByItem = new Map<string, number>();
      (recentUsage ?? []).forEach((record: any) => {
        const itemId = record.assignment?.item_id;
        if (itemId) usageByItem.set(itemId, (usageByItem.get(itemId) ?? 0) + (record.kuantiti || 0));
      });

      let totalStock = 0;
      let lowStockCount = 0;
      for (const item of itemsWithBatches ?? []) {
        const batches = (item as any).item_batches as { kuantiti: number; dilupuskan?: boolean }[] | null;
        const itemStock = (batches ?? []).reduce(
          (sum, b) => sum + (b.dilupuskan ? 0 : b.kuantiti || 0),
          0
        );
        totalStock += itemStock;
        const requiredFourWeeks = ((usageByItem.get((item as any).id) ?? 0) / 12) * 4;
        if (itemStock < requiredFourWeeks) lowStockCount++;
      }

      return {
        totalPatients: patientsRes.count ?? 0,
        totalItems: itemsRes.count ?? 0,
        supplyToday: supplyRes.count ?? 0,
        expiringSoon: expiringRes.count ?? 0,
        totalStock,
        lowStockCount,
      };
    },
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
}

export interface ExpiryBatchItem {
  id: string;
  kod_item: string;
  nama_item: string;
  kekuatan: string | null;
  id_bentuk?: string | null;
  bentuk?: string | null;
}

export interface ExpiryBatch {
  id: string;
  nombor_kelompok: string;
  tarikh_luput: string;
  kuantiti: number;
  /** Supabase boleh kembalikan object atau array bergantung kepada hubungan */
  items: ExpiryBatchItem | ExpiryBatchItem[] | null;
}

function normalizeItem(b: ExpiryBatch): ExpiryBatchItem | null {
  if (!b.items) return null;
  if (Array.isArray(b.items)) return b.items[0] ?? null;
  return b.items;
}

export function getExpiryItem(batch: ExpiryBatch): ExpiryBatchItem | null {
  return normalizeItem(batch);
}

export type ExpiryStatus = "critical" | "warning" | "safe";

export function getExpiryStatus(
  tarikhLuput: string,
  today: Date = new Date()
): { status: ExpiryStatus; daysLeft: number } {
  const daysLeft = Math.floor(
    (new Date(getKLDayStartISO(tarikhLuput)).getTime() -
      new Date(getKLDayStartISO(toDateInputValue(today))).getTime()) /
      (24 * 60 * 60 * 1000)
  );

  if (daysLeft < 30) return { status: "critical", daysLeft };
  if (daysLeft <= 90) return { status: "warning", daysLeft };
  return { status: "safe", daysLeft };
}

export function useExpiryDashboard(enabled = true) {
  return useQuery<ExpiryBatch[]>({
    queryKey: ["expiry-dashboard"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_batches")
        .select(
          `
          id,
          nombor_kelompok,
          tarikh_luput,
          kuantiti,
          items (
            id,
            kod_item,
            nama_item,
             kekuatan,
             id_bentuk
          )
        `
        )
        .gt("kuantiti", 0)
        .order("tarikh_luput", { ascending: true })
        .limit(50);

      if (error) throw error;
      const formIds = [...new Set((data ?? []).map((batch: any) => {
        const item = Array.isArray(batch.items) ? batch.items[0] : batch.items;
        return item?.id_bentuk;
      }).filter(Boolean))];
      const formMap = new Map<string, string>();
      if (formIds.length > 0) {
        const { data: forms, error: formsError } = await supabase.from("item_forms").select("id, nama").in("id", formIds);
        if (formsError) throw formsError;
        (forms ?? []).forEach((form) => formMap.set(form.id, form.nama));
      }
      (data ?? []).forEach((batch: any) => {
        const item = Array.isArray(batch.items) ? batch.items[0] : batch.items;
        if (item) item.bentuk = formMap.get(item.id_bentuk) ?? null;
      });
      // Cast to unknown first to avoid type conflict from Supabase's array/object union
      return (data ?? []) as unknown as ExpiryBatch[];
    },
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
}
