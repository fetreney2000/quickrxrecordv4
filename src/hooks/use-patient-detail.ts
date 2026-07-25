/**
 * Hook untuk data pesakit + tugasan + bekalan.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import type {
  Patient,
  PatientItemAssignment,
  ItemBatch,
  SupplyRecord,
  DoseHistory,
  SupplyDuration,
  Item,
} from "@/types";

// ============================================================================
// 1. Single patient
// ============================================================================
export function usePatient(id: string | undefined) {
  return useQuery({
    queryKey: ["patient", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as Patient | null;
    },
  });
}

// ============================================================================
// 2. Patient assignments with item + profiles
// ============================================================================
export interface AssignmentWithItem extends PatientItemAssignment {
  item: Pick<Item, "id" | "kod_item" | "nama_item" | "nama_dagangan" | "kekuatan"> | null;
}

export function usePatientAssignments(id: string | undefined) {
  return useQuery({
    queryKey: ["assignments", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_item_assignments")
        .select(
          `
          *,
          item:items (
            id,
            kod_item,
            nama_item,
            nama_dagangan,
            kekuatan
          )
        `
        )
        .eq("patient_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AssignmentWithItem[];
    },
  });
}

// ============================================================================
// 3. Dose history for an assignment
// ============================================================================
export function useDoseHistory(assignmentId: string | null) {
  return useQuery({
    queryKey: ["dose-history", assignmentId],
    enabled: !!assignmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dose_history")
        .select("*")
        .eq("assignment_id", assignmentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DoseHistory[];
    },
  });
}

// ============================================================================
// 4. Supply history for an assignment
// ============================================================================
export function useSupplyHistory(assignmentId: string | null) {
  return useQuery({
    queryKey: ["supply-history", assignmentId],
    enabled: !!assignmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supply_records")
        .select("*")
        .eq("assignment_id", assignmentId!)
        .order("tarikh_dibekal", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SupplyRecord[];
    },
  });
}

// ============================================================================
// 5. Available batches (FEFO) for an item
// ============================================================================
export function useAvailableBatches(itemId: string | null) {
  return useQuery({
    queryKey: ["batches", itemId],
    enabled: !!itemId,
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("item_batches")
        .select("*")
        .eq("item_id", itemId!)
        .gt("kuantiti", 0)
        .gte("tarikh_luput", today)
        .order("tarikh_luput", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ItemBatch[];
    },
  });
}

// ============================================================================
// 6. Supply durations
// ============================================================================
export function useSupplyDurations() {
  return useQuery({
    queryKey: ["supply_durations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supply_durations")
        .select("*")
        .eq("aktif", true)
        .order("nilai_hari", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SupplyDuration[];
    },
  });
}

// ============================================================================
// 7. Items with active assignment counts
// ============================================================================
export function useItemsWithStats() {
  return useQuery({
    queryKey: ["items-with-stats"],
    queryFn: async () => {
      const { data: counts, error: countErr } = await supabase.rpc(
        "count_active_assignments"
      );
      if (countErr) {
        // eslint-disable-next-line no-console
        console.warn("RPC count_active_assignments failed", countErr);
      }
      const countMap = new Map<string, number>();
      ((counts as any[]) ?? []).forEach((c) =>
        countMap.set(c.item_id, Number(c.active_count))
      );

      const { data: items, error } = await supabase
        .from("items")
        .select("*")
        .eq("aktif", true)
        .order("nama_item", { ascending: true });
      if (error) throw error;
      return ((items as Item[]) ?? []).map((item) => ({
        ...item,
        active_assignments: countMap.get(item.id) ?? 0,
      }));
    },
  });
}

// ============================================================================
// MUTATIONS
// ============================================================================

export function useUpdatePatient(patientId: string | undefined) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: Partial<Patient>) => {
      const { error } = await supabase
        .from("patients")
        .update({
          ...data,
          dikemaskini_oleh: profile?.id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", patientId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Maklumat pesakit dikemaskini.");
      queryClient.invalidateQueries({ queryKey: ["patient", patientId] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Gagal mengemaskini pesakit.");
    },
  });
}

export function useDeactivatePatient(patientId: string | undefined) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("patients")
        .update({
          aktif: false,
          dikemaskini_oleh: profile?.id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", patientId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pesakit dinyahaktifkan.");
      queryClient.invalidateQueries({ queryKey: ["patient", patientId] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      navigate("/pesakit");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Gagal menyahaktifkan pesakit.");
    },
  });
}

export function useAddAssignment(patientId: string | undefined) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      item_id: string;
      dos: string;
      catatan: string;
    }) => {
      const today = new Date().toISOString().split("T")[0];
      // 1. Insert assignment
      const { data: assignment, error: assignError } = await supabase
        .from("patient_item_assignments")
        .insert({
          patient_id: patientId!,
          item_id: data.item_id,
          dos: data.dos,
          catatan_penggunaan: data.catatan || null,
          tarikh_mula_guna: today,
          aktif: true,
          dimulakan_oleh: profile?.id ?? null,
        })
        .select("id")
        .single();
      if (assignError) throw assignError;

      // 2. Insert initial dose history
      if (assignment && data.dos) {
        await supabase.from("dose_history").insert({
          assignment_id: assignment.id,
          tarikh: today,
          dos: data.dos,
          aktif: true,
          catatan: "Bekalan kali pertama",
          dikemaskini_oleh: profile?.id ?? null,
        });
      }
      return assignment;
    },
    onSuccess: () => {
      toast.success("Item berjaya ditambah.");
      queryClient.invalidateQueries({ queryKey: ["assignments", patientId] });
      queryClient.invalidateQueries({ queryKey: ["items-with-stats"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Gagal menambah item.");
    },
  });
}

export function useStopAssignment(patientId: string | undefined) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({
      assignmentId,
      sebab,
    }: {
      assignmentId: string;
      sebab: string;
    }) => {
      const today = new Date().toISOString().split("T")[0];
      const { error } = await supabase
        .from("patient_item_assignments")
        .update({
          aktif: false,
          tarikh_tamat_guna: today,
          sebab_tamat: sebab,
          ditamatkan_oleh: profile?.id ?? null,
        })
        .eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item ditamatkan.");
      queryClient.invalidateQueries({ queryKey: ["assignments", patientId] });
      queryClient.invalidateQueries({ queryKey: ["items-with-stats"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Gagal menamatkan item.");
    },
  });
}

export function useUpdateDose(patientId: string | undefined) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({
      assignmentId,
      dos,
      catatan,
    }: {
      assignmentId: string;
      dos: string;
      catatan: string;
    }) => {
      const today = new Date().toISOString().split("T")[0];
      // 1. Update assignment
      const { error: updateError } = await supabase
        .from("patient_item_assignments")
        .update({ dos })
        .eq("id", assignmentId);
      if (updateError) throw updateError;
      // 2. Insert dose history
      const { error: historyError } = await supabase
        .from("dose_history")
        .insert({
          assignment_id: assignmentId,
          tarikh: today,
          dos,
          aktif: true,
          catatan: catatan || null,
          dikemaskini_oleh: profile?.id ?? null,
        });
      if (historyError) throw historyError;
    },
    onSuccess: (_data, vars) => {
      toast.success("Dos dikemaskini.");
      queryClient.invalidateQueries({ queryKey: ["assignments", patientId] });
      queryClient.invalidateQueries({ queryKey: ["dose-history", vars.assignmentId] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Gagal mengemaskini dos.");
    },
  });
}

export function useSupplyMedication(patientId: string | undefined) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      assignmentId: string;
      dos: string;
      kuantiti: number;
      tempoh: string;
      batchId: string;
      catatan: string;
      itemId: string;
    }) => {
      // 1. Cuba panggil API endpoint (Supabase Edge Function)
      // 2. Fallback ke Supabase client langsung
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
        if (res.ok) {
          return await res.json();
        }
        // If 404 or other, fallback to direct
        if (res.status !== 404) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || "Gagal bekal ubat.");
        }
      } catch {
        // Network error — fallback
      }

      // Fallback: direct Supabase call
      // 1. Decrement batch
      const { data: batch, error: bErr } = await supabase
        .from("item_batches")
        .select("kuantiti")
        .eq("id", data.batchId)
        .single();
      if (bErr) throw bErr;
      if (!batch || batch.kuantiti < data.kuantiti) {
        throw new Error("Stok tidak mencukupi.");
      }
      const { error: updErr } = await supabase
        .from("item_batches")
        .update({ kuantiti: batch.kuantiti - data.kuantiti })
        .eq("id", data.batchId);
      if (updErr) throw updErr;

      // 2. Insert supply record
      const { data: supply, error: sErr } = await supabase
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
      if (sErr) throw sErr;

      // 3. Insert inventory transaction
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
    onSuccess: (_data, vars) => {
      toast.success("Ubat berjaya dibekalkan.");
      queryClient.invalidateQueries({ queryKey: ["assignments", patientId] });
      queryClient.invalidateQueries({ queryKey: ["supply-history", vars.assignmentId] });
      queryClient.invalidateQueries({ queryKey: ["batches", vars.itemId] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Gagal membekalkan ubat.");
    },
  });
}

export function useDeleteSupplyRecord(patientId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      supplyId,
      assignmentId,
    }: {
      supplyId: string;
      assignmentId: string;
    }) => {
      const { error } = await supabase
        .from("supply_records")
        .delete()
        .eq("id", supplyId);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      toast.success("Rekod bekalan dipadam.");
      queryClient.invalidateQueries({ queryKey: ["assignments", patientId] });
      queryClient.invalidateQueries({ queryKey: ["supply-history", vars.assignmentId] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Gagal memadam rekod bekalan.");
    },
  });
}

export function useUpdateSupplyRecord(patientId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      supplyId,
      dos,
      kuantiti,
      tempoh,
      catatan,
      assignmentId,
    }: {
      supplyId: string;
      dos: string;
      kuantiti: number;
      tempoh: string;
      catatan: string;
      assignmentId: string;
    }) => {
      const { error } = await supabase
        .from("supply_records")
        .update({
          dos,
          kuantiti,
          tempoh_dibekal: tempoh,
          catatan_bekalan: catatan || null,
        })
        .eq("id", supplyId);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      toast.success("Rekod bekalan dikemaskini.");
      queryClient.invalidateQueries({ queryKey: ["assignments", patientId] });
      queryClient.invalidateQueries({ queryKey: ["supply-history", vars.assignmentId] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Gagal mengemaskini rekod bekalan.");
    },
  });
}
