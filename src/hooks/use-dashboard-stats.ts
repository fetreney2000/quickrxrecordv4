/**
 * Hook untuk mengambil statistik dashboard via RPC.
 * useDashboardStats() -> get_dashboard_stats()
 * useExpiryDashboard() -> get_dashboard_expiry()
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getKLDayStartISO, toDateInputValue } from "@/lib/utils";

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
      const { data, error } = await supabase.rpc("get_dashboard_stats").single() as { data: any; error: any };
      if (error) throw error;
      return {
        totalPatients: Number(data.total_patients),
        totalItems: Number(data.total_items),
        supplyToday: Number(data.supply_today),
        expiringSoon: Number(data.expiring_soon),
        totalStock: Number(data.total_stock),
        lowStockCount: Number(data.low_stock_count),
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
      const { data, error } = await supabase.rpc("get_dashboard_expiry", { p_limit: 50 });
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        id: row.batch_id,
        nombor_kelompok: row.nombor_kelompok,
        tarikh_luput: row.tarikh_luput,
        kuantiti: row.kuantiti,
        items: {
          id: row.item_id,
          kod_item: row.kod_item,
          nama_item: row.nama_item,
          kekuatan: row.kekuatan,
          bentuk: row.bentuk,
        },
      })) as ExpiryBatch[];
    },
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
}
