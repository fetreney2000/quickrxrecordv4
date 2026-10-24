/**
 * Hooks untuk Dispen Pantas.
 */
import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { runSupplyMulti } from "@/lib/supply";
import { useAuth } from "@/hooks/use-auth";
import { getTodayStrKL } from "@/lib/utils";
import { escapeLikeTerm } from "@/lib/postgrest";
import type { Patient, Item, ItemBatch, SupplyDuration } from "@/types";

const ITEM_COLUMNS =
  "id, kod_item, nama_item, nama_dagangan, kekuatan, id_kategori, id_bentuk, kuota, catatan, aktif, created_at, updated_at";
const BATCH_COLUMNS =
  "id, item_id, nombor_kelompok, tarikh_luput, kuantiti, dilupuskan, dilupuskan_at, created_at, updated_at";

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
      const like = `%${escapeLikeTerm(debounced.trim())}%`;
      const { data, error } = await supabase
        .from("patients")
        .select("id, nama, nombor_kad_pengenalan, nombor_pendaftaran_hospital, nombor_telefon")
        .eq("aktif", true)
        .is("merged_into", null)
        .or(
          `nama.ilike.${like},nombor_kad_pengenalan.ilike.${like},nombor_pendaftaran_hospital.ilike.${like},nombor_telefon.ilike.${like}`
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
      const { data: supplies, error: sErr } = await supabase
        .from("supply_records")
        .select("assignment_id, patient_item_assignments!inner(item_id)")
        .is("voided_at", null)
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

      const top = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id]) => id);

      const { data: items, error: iErr } = await supabase
        .from("items")
        .select(ITEM_COLUMNS)
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
        .select(BATCH_COLUMNS)
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
        .select("id, nama")
        .order("nama", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SupplyDuration[];
    },
    staleTime: 60_000,
  });
}

// ============================================================================
// Supply mutation (multi-batch FEFO)
// ============================================================================
export function useQuickSupplyMulti(patientId: string | null) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      assignmentId: string;
      itemId: string;
      dos: string;
      kuantiti: number;
      tempoh: string;
      catatan: string;
      allocations: Array<{ batchId: string; kuantiti: number }>;
    }) => runSupplyMulti(data, profile?.id ?? null),
    onSuccess: () => {
      toast.success("Bekalan direkodkan.");
      if (patientId) {
        queryClient.invalidateQueries({
          queryKey: ["patient-assignments", patientId],
        });
        // Cross-invalidate kunci yang digunakan oleh Butiran Pesakit
        // supaya sejarah bekalan tidak lapuk selepas dispan di Halaman Pantas.
        queryClient.invalidateQueries({ queryKey: ["assignments", patientId] });
      }
      queryClient.invalidateQueries({ queryKey: ["frequent-items"] });
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      queryClient.invalidateQueries({ queryKey: ["pantas-batches"] });
      queryClient.invalidateQueries({ queryKey: ["supply-history"] });
      queryClient.invalidateQueries({ queryKey: ["assignment-activity"] });
      queryClient.invalidateQueries({ queryKey: ["latest-supply-dates"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
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
      const { data: items, error: iErr } = await supabase
        .from("items")
        .select(ITEM_COLUMNS)
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
      const { data: newId, error: rpcErr } = await supabase.rpc("add_assignment_with_dose", {
        p_patient_id: patientId!,
        p_item_id: data.itemId,
        p_dos: data.dos,
        p_catatan_penggunaan: data.catatan || null,
        p_dimulakan_oleh: profile?.id ?? null,
        p_kakitangan_farmasi_perekod: profile?.id ?? null,
        p_dose_catatan: "Bekalan kali pertama (Dispen Pantas)",
        p_tarikh_dose: getTodayStrKL(),
      });
      if (!rpcErr) return { id: newId as string };
      if (!rpcErr.message?.includes("Could not find the function")) throw rpcErr;

      // Fallback: RPC belum deployed — manual 2-step insert.
      // Cerminkan pengawal pelayan 041/058 di sini (kuota, pesakit aktif /
      // belum digabungkan, item aktif); jika tidak, laluan fallback akan
      // mencipta senyap apa yang pelayan akan tolak.
      const { data: patientRow, error: patientErr } = await supabase
        .from("patients")
        .select("id, aktif, merged_into")
        .eq("id", patientId!)
        .maybeSingle();
      if (patientErr) throw patientErr;
      if (!patientRow) throw new Error("Pesakit tidak dijumpai.");
      if (!patientRow.aktif || patientRow.merged_into) {
        throw new Error("Pesakit tidak aktif — tugasan baharu tidak dibenarkan.");
      }

      const { data: itemRow, error: itemErr } = await supabase
        .from("items")
        .select("id, kuota, aktif")
        .eq("id", data.itemId)
        .maybeSingle();
      if (itemErr) throw itemErr;
      if (!itemRow) throw new Error("Item tidak dijumpai.");
      if (!itemRow.aktif) {
        throw new Error("Item tidak aktif — tugasan baharu tidak dibenarkan.");
      }
      if (itemRow.kuota != null && itemRow.kuota > 0) {
        const { count, error: countErr } = await supabase
          .from("patient_item_assignments")
          .select("id", { count: "exact", head: true })
          .eq("item_id", data.itemId)
          .eq("aktif", true);
        if (countErr) throw countErr;
        if ((count ?? 0) >= itemRow.kuota) {
          throw new Error(
            `Kuota item telah penuh (${count}/${itemRow.kuota}) — tamatkan tugasan sedia ada dahulu.`
          );
        }
      }

      const today = getTodayStrKL();
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

      if (assignment) {
        // Jangan telan ralat dose_history senyap — imbau tugasan supaya
        // tidak wujud tugasan tanpa rekod dos awal.
        const { error: doseErr } = await supabase.from("dose_history").insert({
          assignment_id: assignment.id,
          tarikh: today,
          dos: data.dos,
          aktif: true,
          catatan: "Bekalan kali pertama (Dispen Pantas)",
          dikemaskini_oleh: profile?.id ?? null,
        });
        if (doseErr) {
          const { error: delErr } = await supabase
            .from("patient_item_assignments")
            .delete()
            .eq("id", assignment.id);
          if (delErr) {
            console.error(
              "[useAddAssignmentInline] fallback: gagal imbau tugasan",
              assignment.id,
              delErr
            );
          }
          throw doseErr;
        }
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
