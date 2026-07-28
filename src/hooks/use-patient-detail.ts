/**
 * Hook untuk data pesakit + tugasan + bekalan + penggabungan.
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
  ItemForm,
  Profile,
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
// 2. Patient assignments with item + profiles×3
// ============================================================================
export interface AssignmentWithItem extends PatientItemAssignment {
  item: Pick<Item, "id" | "kod_item" | "nama_item" | "nama_dagangan" | "kekuatan" | "id_bentuk"> | null;
  dimulakan_oleh_profile: Pick<Profile, "id" | "nama"> | null;
  ditamatkan_oleh_profile: Pick<Profile, "id" | "nama"> | null;
  kakitangan_farmasi_perekod_profile: Pick<Profile, "id" | "nama"> | null;
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
            kekuatan,
            id_bentuk
          ),
          dimulakan_oleh_profile:profiles!patient_item_assignments_dimulakan_oleh_fkey (
            id,
            nama
          ),
          ditamatkan_oleh_profile:profiles!patient_item_assignments_ditamatkan_oleh_fkey (
            id,
            nama
          ),
          kakitangan_farmasi_perekod_profile:profiles!patient_item_assignments_kakitangan_farmasi_perekod_fkey (
            id,
            nama
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
// 2b. Item forms (lookup)
// ============================================================================
export function useItemForms() {
  return useQuery({
    queryKey: ["item_forms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_forms")
        .select("*")
        .order("nama", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ItemForm[];
    },
  });
}

// ============================================================================
// 3. Dose history for an assignment (with profile join)
// ============================================================================
export interface DoseHistoryWithProfile extends DoseHistory {
  dikemaskini_oleh_profile: Pick<Profile, "id" | "nama"> | null;
}

export function useDoseHistory(assignmentId: string | null) {
  return useQuery({
    queryKey: ["dose-history", assignmentId],
    enabled: !!assignmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dose_history")
        .select(
          `
          *,
          dikemaskini_oleh_profile:profiles!dose_history_dikemaskini_oleh_fkey (
            id,
            nama
          )
        `
        )
        .eq("assignment_id", assignmentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DoseHistoryWithProfile[];
    },
  });
}

// ============================================================================
// 4. Supply history for an assignment (with item_batches + profile joins)
// ============================================================================
export interface SupplyRecordWithJoins extends SupplyRecord {
  batch: Pick<ItemBatch, "id" | "nombor_kelompok" | "tarikh_luput"> | null;
  kakitangan_pembekal_profile: Pick<Profile, "id" | "nama"> | null;
}

export function useSupplyHistory(assignmentId: string | null) {
  return useQuery({
    queryKey: ["supply-history", assignmentId],
    enabled: !!assignmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supply_records")
        .select(
          `
          *,
          batch:item_batches (
            id,
            nombor_kelompok,
            tarikh_luput
          ),
          kakitangan_pembekal_profile:profiles!supply_records_kakitangan_pembekal_fkey (
            id,
            nama
          )
        `
        )
        .eq("assignment_id", assignmentId!)
        .order("tarikh_dibekal", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SupplyRecordWithJoins[];
    },
  });
}

// ============================================================================
// 4b. Latest supply date per assignment (for weeks-since badge)
// ============================================================================
export function useLatestSupplyDates(assignmentIds: string[]) {
  return useQuery({
    queryKey: ["latest-supply-dates", assignmentIds],
    enabled: assignmentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supply_records")
        .select("assignment_id, tarikh_dibekal")
        .in("assignment_id", assignmentIds)
        .order("tarikh_dibekal", { ascending: false });
      if (error) throw error;
      const map = new Map<string, string>();
      for (const row of data ?? []) {
        if (!map.has(row.assignment_id)) {
          map.set(row.assignment_id, row.tarikh_dibekal);
        }
      }
      return map;
    },
  });
}

export function weeksSince(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
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
        .order("nama", { ascending: true });
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
// 8. Search patients (for merge dialog)
// ============================================================================
export function useSearchPatients(query: string) {
  return useQuery({
    queryKey: ["search-patients", query],
    enabled: query.trim().length >= 2,
    queryFn: async () => {
      const term = query.trim();
      const { data, error } = await supabase
        .from("patients")
        .select("id, nama, nombor_kad_pengenalan, nombor_pendaftaran_hospital, aktif")
        .or(
          `nama.ilike.%${term}%,nombor_kad_pengenalan.ilike.%${term}%,nombor_pendaftaran_hospital.ilike.%${term}%`
        )
        .is("merged_into", null)
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Pick<Patient, "id" | "nama" | "nombor_kad_pengenalan" | "nombor_pendaftaran_hospital" | "aktif">[];
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
      queryClient.invalidateQueries({ queryKey: ["patient", patientId] });
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

// ============================================================================
// 9. Merge patients mutation
// ============================================================================
export function useMergePatients() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({
      primaryPatientId,
      duplicateIds,
    }: {
      primaryPatientId: string;
      duplicateIds: string[];
    }) => {
      const today = new Date().toISOString().split("T")[0];

      for (const dupId of duplicateIds) {
        // 1. Get duplicate assignments
        const { data: dupAssignments } = await supabase
          .from("patient_item_assignments")
          .select("id, item_id, dos, catatan_penggunaan, tarikh_mula_guna, aktif")
          .eq("patient_id", dupId);

        if (!dupAssignments?.length) continue;

        // 2. Get primary active assignments
        const { data: primaryAssignments } = await supabase
          .from("patient_item_assignments")
          .select("id, item_id, aktif")
          .eq("patient_id", primaryPatientId)
          .eq("aktif", true);

        const primaryActiveMap = new Map(
          (primaryAssignments ?? []).map((a) => [a.item_id, a.id])
        );

        for (const dupA of dupAssignments) {
          const primaryActiveId = primaryActiveMap.get(dupA.item_id);

          if (primaryActiveId) {
            // Duplicate has item that also exists in primary — transfer history
            // Transfer dose history
            await supabase
              .from("dose_history")
              .update({ assignment_id: primaryActiveId })
              .eq("assignment_id", dupA.id);

            // Transfer supply records
            await supabase
              .from("supply_records")
              .update({ assignment_id: primaryActiveId })
              .eq("assignment_id", dupA.id);

            // Terminate duplicate assignment
            await supabase
              .from("patient_item_assignments")
              .update({
                aktif: false,
                tarikh_tamat_guna: today,
                sebab_tamat: "Digabungkan ke pesakit lain",
                ditamatkan_oleh: profile?.id ?? null,
              })
              .eq("id", dupA.id);
          } else {
            // Unique item — transfer assignment to primary
            await supabase
              .from("patient_item_assignments")
              .update({ patient_id: primaryPatientId })
              .eq("id", dupA.id);
          }
        }

        // 3. Mark duplicate patient as merged and deactivate
        await supabase
          .from("patients")
          .update({
            merged_into: primaryPatientId,
            aktif: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", dupId);
      }
    },
    onSuccess: () => {
      toast.success("Pesakit berjaya digabungkan.");
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Gagal menggabungkan pesakit.");
    },
  });
}