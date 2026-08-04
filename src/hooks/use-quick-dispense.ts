/**
 * Hooks untuk Dispen Pantas.
 */
import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { getTodayStrKL } from "@/lib/utils";
import type { Patient, Item, ItemBatch, SupplyDuration } from "@/types";

// ============================================================================
// Patient search
// ============================================================================
export function usePatientSearch(query: string) {
  const [debounced, setDebounced] = useState(query);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebounced(query), 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  return useQuery({
    queryKey: ["quick-dispense-search", debounced],
    enabled: debounced.trim().length >= 2,
    queryFn: async () => {
      const like = `%${debounced.trim()}%`;
      const { data, error } = await supabase
        .from("patients")
        .select("id, nama, nombor_kad_pengenalan, nombor_pendaftaran_hospital, nombor_telefon")
        .eq("aktif", true)
        .is("merged_into", null)
        .or(
          `nama.ilike.${like},nombor_kad_pengenalan.ilike.${like},nombor_pendaftaran_hospital.ilike.${like}`
        )
        .order("nama", { ascending: true })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Patient[];
    },
    staleTime: 30_000,
  });
}

// ============================================================================
// Patient assignments
// ============================================================================
export interface AssignedItem {
  assignment_id: string;
  item_id: string;
  dos: string | null;
  item: {
    id: string;
    kod_item: string;
    nama_item: string;
    kekuatan: string | null;
    id_bentuk: string | null;
    bentuk?: string | null;
  } | null;
}

export function usePatientAssignments(patientId: string | null) {
  return useQuery({
    queryKey: ["patient-assignments", patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_item_assignments")
        .select(
          "id, item_id, dos, item:items(id, kod_item, nama_item, kekuatan, id_bentuk)"
        )
        .eq("patient_id", patientId!)
        .eq("aktif", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const formIds = [...new Set((data ?? []).map((d: any) => d.item?.id_bentuk).filter(Boolean))];
      const formMap = new Map<string, string>();
      if (formIds.length > 0) {
        const { data: forms, error: formsError } = await supabase.from("item_forms").select("id, nama").in("id", formIds);
        if (formsError) throw formsError;
        (forms ?? []).forEach((form) => formMap.set(form.id, form.nama));
      }
      return (data ?? []).map((d: any) => ({
        assignment_id: d.id,
        item_id: d.item_id,
        dos: d.dos,
        item: (() => {
          const item = Array.isArray(d.item) ? d.item[0] ?? null : d.item;
          return item ? { ...item, bentuk: formMap.get(item.id_bentuk) ?? null } : null;
        })(),
      })) as AssignedItem[];
    },
  });
}

// ============================================================================
// Frequent items
// ============================================================================
export function useFrequentItems(assignedItemIds: Set<string>) {
  return useQuery({
    queryKey: ["frequent-items"],
    queryFn: async () => {
      // Get last 500 supply records
      const { data: supplies, error: sErr } = await supabase
        .from("supply_records")
        .select("assignment_id, patient_item_assignments!inner(item_id)")
        .order("tarikh_dibekal", { ascending: false })
        .limit(500);
      if (sErr) throw sErr;

      const counts = new Map<string, number>();
      ((supplies ?? []) as any[]).forEach((s) => {
        const ia = Array.isArray(s.patient_item_assignments)
          ? s.patient_item_assignments[0]
          : s.patient_item_assignments;
        if (ia?.item_id) {
          counts.set(ia.item_id, (counts.get(ia.item_id) ?? 0) + 1);
        }
      });

      // Sort by frequency
      const top = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id]) => id);

      // Get full item data, filter to assigned
      const { data: items, error: iErr } = await supabase
        .from("items")
        .select("*")
        .eq("aktif", true)
        .in("id", top.length > 0 ? top : [""]);
      if (iErr) throw iErr;

      const formIds = [...new Set((items ?? []).map((item: any) => item.id_bentuk).filter(Boolean))];
      const formMap = new Map<string, string>();
      if (formIds.length > 0) {
        const { data: forms, error: formsError } = await supabase.from("item_forms").select("id, nama").in("id", formIds);
        if (formsError) throw formsError;
        (forms ?? []).forEach((form) => formMap.set(form.id, form.nama));
      }

      return ((items as Item[]) ?? []).filter((i) => assignedItemIds.has(i.id)).map((item: any) => ({
        ...item,
        bentuk: formMap.get(item.id_bentuk ?? "") ?? null,
      }));
    },
    staleTime: 60_000,
  });
}

// ============================================================================
// Available batches (FEFO)
// ============================================================================
export function useQuickDispenseBatches(itemId: string | null) {
  return useQuery({
    queryKey: ["pantas-batches", itemId],
    enabled: !!itemId,
    queryFn: async () => {
      const today = getTodayStrKL();
      const { data, error } = await supabase
        .from("item_batches")
        .select("*")
        .eq("item_id", itemId!)
        .eq("dilupuskan", false)
        .gt("kuantiti", 0)
        .gte("tarikh_luput", today)
        .order("tarikh_luput", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ItemBatch[];
    },
  });
}

// ============================================================================
// Supply durations
// ============================================================================
export function useSupplyDurationsList() {
  return useQuery({
    queryKey: ["supply_durations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supply_durations")
        .select("*")
        .order("nama", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SupplyDuration[];
    },
    staleTime: 60_000,
  });
}

// ============================================================================
// Supply mutation
// ============================================================================
export function useQuickSupply(patientId: string | null) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      assignmentId: string;
      itemId: string;
      dos: string;
      kuantiti: number;
      tempoh: string;
      batchId: string;
      catatan: string;
    }) => {
      // 1. Try Edge Function
      try {
        const res = await fetch("/api/supply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignment_id: data.assignmentId,
            dos: data.dos,
            kuantiti: data.kuantiti,
            tempoh_dibekal: data.tempoh,
            batch_id: data.batchId,
            kakitangan_pembekal: profile?.id,
            catatan_bekalan: data.catatan,
          }),
        });
        if (res.ok) return await res.json();
        if (res.status !== 404) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || "Gagal bekal.");
        }
      } catch {
        // Network error — fallback
      }

      // 2. Fallback: direct supabase
      const { data: batch, error: bErr } = await supabase
        .from("item_batches")
        .select("kuantiti, dilupuskan")
        .eq("id", data.batchId)
        .single();
      if (bErr) throw bErr;
      if (batch?.dilupuskan) throw new Error("Kelompok ini telah dilupuskan.");
      if (!batch || batch.kuantiti < data.kuantiti) {
        throw new Error("Stok tidak mencukupi.");
      }
      await supabase
        .from("item_batches")
        .update({ kuantiti: batch.kuantiti - data.kuantiti })
        .eq("id", data.batchId);

      const { data: supply, error: sErr2 } = await supabase
        .from("supply_records")
        .insert({
          assignment_id: data.assignmentId,
          dos: data.dos,
          tempoh_dibekal: data.tempoh,
          kuantiti: data.kuantiti,
          batch_id: data.batchId,
          kakitangan_pembekal: profile?.id!,
          catatan_bekalan: data.catatan || null,
        })
        .select("id")
        .single();
      if (sErr2) throw sErr2;

      if (supply) {
        await supabase.from("inventory_transactions").insert({
          item_id: data.itemId,
          batch_id: data.batchId,
          jenis: "keluar",
          kuantiti: data.kuantiti,
          rujukan_id: supply.id,
          rujukan_type: "supply",
          catatan: data.catatan || null,
        });
      }
      return { success: true, id: supply?.id };
    },
    onSuccess: () => {
      toast.success("Bekalan direkodkan.");
      if (patientId) {
        queryClient.invalidateQueries({
          queryKey: ["patient-assignments", patientId],
        });
      }
      queryClient.invalidateQueries({ queryKey: ["frequent-items"] });
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      queryClient.invalidateQueries({ queryKey: ["pantas-batches"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Gagal membekalkan ubat.");
    },
  });
}

// ============================================================================
// Items-active (for register dialog)
// ============================================================================
export interface ItemWithStats extends Item {
  patient_count?: number;
  baki_kuota?: number;
  kuota_penuh?: boolean;
}

export function useItemsActive() {
  return useQuery({
    queryKey: ["items-active"],
    queryFn: async () => {
      // Get all active items (explicitly include quota)
      const { data: items, error: iErr } = await supabase
        .from("items")
        .select("*")
        .eq("aktif", true)
        .order("nama_item", { ascending: true });
      if (iErr) throw iErr;

      const formIds = [...new Set((items ?? []).map((item: any) => item.id_bentuk).filter(Boolean))];
      const formMap = new Map<string, string>();
      if (formIds.length > 0) {
        const { data: forms, error: formsError } = await supabase.from("item_forms").select("id, nama").in("id", formIds);
        if (formsError) throw formsError;
        (forms ?? []).forEach((form) => formMap.set(form.id, form.nama));
      }

      // Get assignment counts via RPC, fallback to direct query
      const { data: counts, error: cErr } = await supabase.rpc(
        "count_active_assignments"
      );
      const countMap = new Map<string, number>();
      if (!cErr && counts) {
        ((counts as any[]) ?? []).forEach((c) =>
          countMap.set(c.item_id, Number(c.active_count))
        );
      } else {
        // Fallback: count active assignments directly
        const { data: rows } = await supabase
          .from("patient_item_assignments")
          .select("item_id")
          .eq("aktif", true);
        ((rows as any[]) ?? []).forEach((r) => {
          countMap.set(r.item_id, (countMap.get(r.item_id) ?? 0) + 1);
        });
      }

      return ((items as Item[]) ?? []).map((item) => {
        const active = countMap.get(item.id) ?? 0;
        const kuota = item.kuota;
        const hasQuota = kuota != null && kuota > 0;
        const baki = hasQuota ? Math.max(0, kuota - active) : null;
        const penuh = hasQuota ? active >= kuota : false;
        return {
          ...item,
          bentuk: formMap.get(item.id_bentuk ?? "") ?? null,
          patient_count: active,
          baki_kuota: baki,
          kuota_penuh: penuh,
        } as ItemWithStats;
      });
    },
    staleTime: 60_000,
  });
}

// ============================================================================
// Add new assignment (inline in dialog)
// ============================================================================
export function useAddAssignmentInline(patientId: string | null) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      itemId: string;
      dos: string;
      catatan?: string;
    }) => {
      const today = getTodayStrKL();
      // 1. Insert assignment
      const { data: assignment, error: assignErr } = await supabase
        .from("patient_item_assignments")
        .insert({
          patient_id: patientId!,
          item_id: data.itemId,
          dos: data.dos,
          catatan_penggunaan: data.catatan || null,
          tarikh_mula_guna: today,
          aktif: true,
          dimulakan_oleh: profile?.id ?? null,
          kakitangan_farmasi_perekod: profile?.id ?? null,
        })
        .select("id")
        .single();
      if (assignErr) throw assignErr;

      // 2. Insert initial dose history
      if (assignment) {
        await supabase.from("dose_history").insert({
          assignment_id: assignment.id,
          tarikh: today,
          dos: data.dos,
          aktif: true,
          catatan: "Bekalan kali pertama (Dispen Pantas)",
          dikemaskini_oleh: profile?.id ?? null,
        });
      }
      return assignment;
    },
    onSuccess: () => {
      if (patientId) {
        queryClient.invalidateQueries({
          queryKey: ["patient-assignments", patientId],
        });
      }
      queryClient.invalidateQueries({ queryKey: ["frequent-items"] });
      queryClient.invalidateQueries({ queryKey: ["items-active"] });
      queryClient.invalidateQueries({ queryKey: ["latest-dose-history-dos"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Gagal mendaftarkan item.");
    },
  });
}
