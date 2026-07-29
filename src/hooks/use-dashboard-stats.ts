/**
 * Hook untuk mengambil statistik dashboard.
 * Empat kueri selari (Promise.all) + 1 kueri berjujukan untuk stok.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getStartOfTodayKL } from "@/lib/utils";

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
      const startOfToday = getStartOfTodayKL();
      const in30Days = new Date(startOfToday);
      in30Days.setDate(in30Days.getDate() + 30);
      in30Days.setHours(23, 59, 59, 999);

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
            .gte("tarikh_dibekal", startOfToday.toISOString()),
          supabase
            .from("item_batches")
            .select("id", { count: "exact", head: true })
            .gt("kuantiti", 0)
            .lte("tarikh_luput", in30Days.toISOString().split("T")[0]),
        ]);

      // Kueri kelima (berjujukan): item dengan kelompok untuk kiraan stok
      const { data: itemsWithBatches, error: stockError } = await supabase
        .from("items")
        .select("id, kuota, item_batches(kuantiti)")
        .eq("aktif", true);

      if (stockError) throw stockError;

      let totalStock = 0;
      let lowStockCount = 0;
      for (const item of itemsWithBatches ?? []) {
        const batches = (item as any).item_batches as { kuantiti: number }[] | null;
        const itemStock = (batches ?? []).reduce(
          (sum, b) => sum + (b.kuantiti || 0),
          0
        );
        totalStock += itemStock;
        const quota = (item as any).kuota as number | null;
        if (quota && itemStock < quota) lowStockCount++;
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
  const expiry = new Date(tarikhLuput);
  expiry.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysLeft = Math.floor(
    (expiry.getTime() - today.getTime()) / msPerDay
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
            kekuatan
          )
        `
        )
        .gt("kuantiti", 0)
        .order("tarikh_luput", { ascending: true })
        .limit(50);

      if (error) throw error;
      // Cast to unknown first to avoid type conflict from Supabase's array/object union
      return (data ?? []) as unknown as ExpiryBatch[];
    },
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
}
