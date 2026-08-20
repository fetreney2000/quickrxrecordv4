/**
 * Hook untuk data pesakit + tugasan + bekalan + penggabungan.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { getNowISOKL, getTodayStrKL } from "@/lib/utils";
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
  SupplyDeclination,
  SupplyActivityRow,
} from "@/types";

export type { SupplyActivityRow };

export type PatientWithDeactivatedBy = Patient & {
  dinyahaktif_oleh_profile: Pick<Profile, "id" | "nama"> | null;
};

// ============================================================================
// 1. Single patient
// ============================================================================
export function usePatient(id: string | undefined) {
  return useQuery({
    queryKey: ["patient", id],
    enabled: !!id,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select(`
          *,
          dinyahaktif_oleh_profile:profiles!patients_dinyahaktif_oleh_fkey (
            id,
            nama
          )
        `)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as PatientWithDeactivatedBy | null;
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
    staleTime: 0,
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
    staleTime: 0,
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
    staleTime: 0,
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
    staleTime: 0,
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
        .is("voided_at", null)
        .order("tarikh_dibekal", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SupplyRecordWithJoins[];
    },
  });
}

// ============================================================================
// 4a. "Ubat Tidak Perlu Dibekalkan" (supply_declinations)
// ============================================================================
export const SUPPLY_DECLINE_REASONS = [
  "Masih ada baki ubat di rumah",
  "Tahan ubat buat sementara",
  "Tidak perlu bekalan pada masa ini",
  "Lain-lain",
];

// Declination history (with recorded-by profile join)
export interface DeclinationWithProfile extends SupplyDeclination {
  direkod_oleh_profile: Pick<Profile, "id" | "nama"> | null;
}

export function useDeclinationHistory(assignmentId: string | null) {
  return useQuery({
    queryKey: ["declinations", assignmentId],
    enabled: !!assignmentId,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supply_declinations")
        .select(
          `
          *,
          direkod_oleh_profile:profiles!supply_declinations_direkod_oleh_fkey (
            id,
            nama
          )
        `
        )
        .eq("assignment_id", assignmentId!)
        .order("tarikh", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DeclinationWithProfile[];
    },
  });
}

// Unified "Sejarah Bekalan Ubat" = bekalan sebenar + "Ubat Tidak Perlu Dibekalkan",
// digabung dan diisih mengikut tarikh (terbaru dahulu).
export function useAssignmentActivity(assignmentId: string | null) {
  return useQuery({
    queryKey: ["assignment-activity", assignmentId],
    enabled: !!assignmentId,
    staleTime: 0,
    queryFn: async () => {
      const [suppliesQuery, declinationsQuery] = await Promise.all([
        supabase
          .from("supply_records")
          .select(
            `
            *,
            batch:item_batches (id, nombor_kelompok, tarikh_luput),
            kakitangan_pembekal_profile:profiles!supply_records_kakitangan_pembekal_fkey (id, nama)
          `
          )
          .eq("assignment_id", assignmentId!)
          .is("voided_at", null)
          .order("tarikh_dibekal", { ascending: false }),
        supabase
          .from("supply_declinations")
          .select(
            `
            *,
            direkod_oleh_profile:profiles!supply_declinations_direkod_oleh_fkey (id, nama)
          `
          )
          .eq("assignment_id", assignmentId!)
          .order("tarikh", { ascending: false }),
      ]);
      if (suppliesQuery.error) throw suppliesQuery.error;
      if (declinationsQuery.error) throw declinationsQuery.error;

      const supplies: SupplyRecordWithJoins[] = (suppliesQuery.data ?? []) as unknown as SupplyRecordWithJoins[];
      const declinations: DeclinationWithProfile[] = (declinationsQuery.data ?? []) as unknown as DeclinationWithProfile[];

      const supplyRows: SupplyActivityRow[] = supplies.map((s) => ({
        kind: "supply",
        id: s.id,
        tarikh: s.tarikh_dibekal,
        laba_tarikh: false,
        dos: s.dos,
        tempoh_dibekal: s.tempoh_dibekal,
        kuantiti: s.kuantiti,
        kakitangan_pembekal: s.kakitangan_pembekal,
        kakitangan_pembekal_profile: s.kakitangan_pembekal_profile,
        catatan: s.catatan_bekalan,
      }));

      const declinationRows: SupplyActivityRow[] = declinations.map((d) => ({
        kind: "declination",
        id: d.id,
        tarikh: d.tarikh,
        laba_tarikh: false,
        sebab: d.sebab,
        tempoh: d.tempoh,
        catatan: d.catatan,
        direkod_oleh_profile: d.direkod_oleh_profile,
      }));

      return [...supplyRows, ...declinationRows].sort(
        (a, b) => new Date(b.tarikh).getTime() - new Date(a.tarikh).getTime()
      ) as SupplyActivityRow[];
    },
  });
}

// Single latest declination for an assignment (for "Rujukan bekalan terakhir" notes)
export function useLastDeclination(assignmentId: string | null) {
  return useQuery({
    queryKey: ["last-declination", assignmentId],
    enabled: !!assignmentId,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supply_declinations")
        .select("*")
        .eq("assignment_id", assignmentId!)
        .order("tarikh", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as SupplyDeclination | null;
    },
  });
}

//= ===========================================================================
// 4b. Latest supply date per assignment (for weeks-since badge)
// ============================================================================
export function useLatestSupplyDates(assignmentIds: string[]) {
  return useQuery({
    queryKey: ["latest-supply-dates", assignmentIds],
    enabled: assignmentIds.length > 0,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supply_records")
        .select("assignment_id, tarikh_dibekal")
        .in("assignment_id", assignmentIds)
        .is("voided_at", null)
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

// ============================================================================
// 4c. Latest dos per assignment from dose_history (source of truth for current dose)
// ============================================================================
export function useLatestDoseHistoryDos(assignmentIds: string[]) {
  return useQuery({
    queryKey: ["latest-dose-history-dos", assignmentIds],
    enabled: assignmentIds.length > 0,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dose_history")
        .select("assignment_id, dos")
        .eq("aktif", true)
        .in("assignment_id", assignmentIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const map = new Map<string, string>();
      for (const row of (data ?? []) as any[]) {
        if (row.dos && !map.has(row.assignment_id)) {
          map.set(row.assignment_id, row.dos);
        }
      }
      return map;
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
    staleTime: 0,
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
// 6. Supply durations
// ============================================================================
export function useSupplyDurations() {
  return useQuery({
    queryKey: ["supply_durations"],
    staleTime: 0,
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
    staleTime: 0,
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
          updated_at: getNowISOKL(),
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
    mutationFn: async ({ catatan }: { catatan: string }) => {
      const { error } = await supabase
        .from("patients")
        .update({
          aktif: false,
          updated_at: getNowISOKL(),
          catatan_nyahaktif: catatan || null,
          tarikh_nyahaktif: getTodayStrKL(),
          dinyahaktif_oleh: profile?.id ?? null,
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
      const { data: newId, error: rpcErr } = await supabase.rpc("add_assignment_with_dose", {
        p_patient_id: patientId!,
        p_item_id: data.item_id,
        p_dos: data.dos,
        p_catatan_penggunaan: data.catatan || null,
        p_dimulakan_oleh: profile?.id ?? null,
        p_kakitangan_farmasi_perekod: profile?.id ?? null,
        p_dose_catatan: "Bekalan kali pertama",
        p_tarikh_dose: getNowISOKL(),
      });
      if (!rpcErr) return { id: newId as string };
      if (!rpcErr.message?.includes("Could not find the function")) throw rpcErr;

      // Fallback: RPC belum deployed — manual 2-step insert
      const today = getTodayStrKL();
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
          kakitangan_farmasi_perekod: profile?.id ?? null,
        })
        .select("id")
        .single();
      if (assignError) throw assignError;

      if (assignment && data.dos) {
        await supabase.from("dose_history").insert({
          assignment_id: assignment.id,
          tarikh: getNowISOKL(),
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
      queryClient.invalidateQueries({ queryKey: ["latest-dose-history-dos"] });
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
      const today = getTodayStrKL();
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
      const { error: rpcErr } = await supabase.rpc("update_dose_with_history", {
        p_assignment_id: assignmentId,
        p_dos: dos,
        p_catatan: catatan || null,
        p_dikemaskini_oleh: profile?.id ?? null,
      });
      if (!rpcErr) return;
      if (!rpcErr.message?.includes("Could not find the function")) throw rpcErr;

      // Fallback: RPC belum deployed — manual 2-step
      const { error: updateError } = await supabase
        .from("patient_item_assignments")
        .update({ dos })
        .eq("id", assignmentId);
      if (updateError) throw updateError;
      const { error: historyError } = await supabase
        .from("dose_history")
        .insert({
          assignment_id: assignmentId,
          tarikh: getNowISOKL(),
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
      queryClient.invalidateQueries({ queryKey: ["latest-dose-history-dos"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Gagal mengemaskini dos.");
    },
  });
}

export function useSupplyMedicationMulti(patientId: string | undefined) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      assignmentId: string;
      dos: string;
      kuantiti: number;
      tempoh: string;
      catatan: string;
      itemId: string;
      allocations: Array<{ batchId: string; kuantiti: number }>;
    }) => {
      // 1. Cuba RPC process_supply_multi (atomik + jurnal baki)
      const { data: rpcData, error: rpcError } = await supabase.rpc("process_supply_multi", {
        p_assignment_id: data.assignmentId,
        p_dos: data.dos,
        p_tempoh_dibekal: data.tempoh,
        p_allocations: JSON.stringify(data.allocations),
        p_kakitangan_pembekal: profile?.id ?? null,
        p_catatan_bekalan: data.catatan ?? null,
      });
      if (!rpcError) return { success: true, id: (rpcData as string) ?? null };

      // 2. Fallback: RPC belum deployed — loop per allocation memanggil process_supply
      let firstId: string | null = null;
      for (const alloc of data.allocations) {
        const { data: perBatchData, error: perBatchError } = await supabase.rpc("process_supply", {
          p_assignment_id: data.assignmentId,
          p_dos: data.dos,
          p_tempoh_dibekal: data.tempoh,
          p_kuantiti: alloc.kuantiti,
          p_batch_id: alloc.batchId,
          p_kakitangan_pembekal: profile?.id ?? null,
          p_catatan_bekalan: data.catatan ?? null,
        });
        if (perBatchError) throw perBatchError;
        if (!firstId && perBatchData) firstId = perBatchData as string;
      }
      if (firstId) return { success: true, id: firstId };

      // 3. Fallback: manual per allocation
      for (const alloc of data.allocations) {
        const { data: batch, error: bErr } = await supabase
          .from("item_batches")
          .select("kuantiti, dilupuskan")
          .eq("id", alloc.batchId)
          .single();
        if (bErr) throw bErr;
        if (batch?.dilupuskan) throw new Error("Kelompok ini telah dilupuskan.");
        if (!batch || batch.kuantiti < alloc.kuantiti) {
          throw new Error("Stok tidak mencukupi.");
        }
        const { error: updErr } = await supabase
          .from("item_batches")
          .update({ kuantiti: batch.kuantiti - alloc.kuantiti })
          .eq("id", alloc.batchId);
        if (updErr) throw updErr;

        const { data: supply, error: sErr } = await supabase
          .from("supply_records")
          .insert({
            assignment_id: data.assignmentId,
            dos: data.dos,
            tempoh_dibekal: data.tempoh,
            kuantiti: alloc.kuantiti,
            batch_id: alloc.batchId,
            kakitangan_pembekal: profile?.id!,
            catatan_bekalan: data.catatan || null,
          })
          .select("id")
          .single();
        if (sErr) throw sErr;

        if (supply) {
          await supabase.from("inventory_transactions").insert({
            item_id: data.itemId,
            batch_id: alloc.batchId,
            jenis: "keluar",
            kuantiti: alloc.kuantiti,
            rujukan_id: supply.id,
            rujukan_type: "supply",
            catatan: data.catatan || null,
          });
          if (!firstId) firstId = supply.id;
        }
      }
      return { success: true, id: firstId };
    },
    onSuccess: (_data, vars) => {
      toast.success("Ubat berjaya dibekalkan.");
      queryClient.invalidateQueries({ queryKey: ["assignments", patientId] });
      queryClient.invalidateQueries({ queryKey: ["supply-history", vars.assignmentId] });
      queryClient.invalidateQueries({ queryKey: ["assignment-activity", vars.assignmentId] });
      queryClient.invalidateQueries({ queryKey: ["latest-supply-dates"] });
      queryClient.invalidateQueries({ queryKey: ["batches", vars.itemId] });
      queryClient.invalidateQueries({ queryKey: ["transaction-history", vars.itemId] });
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
      const { error: rpcError } = await supabase.rpc("reverse_supply", {
        p_supply_id: supplyId,
      });
      if (!rpcError) return;

      // Fallback: mark as voided directly (RPC not deployed)
      const { error } = await supabase
        .from("supply_records")
        .update({ voided_at: new Date().toISOString() })
        .eq("id", supplyId);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      toast.success("Rekod bekalan dibatalkan dan stok dikembalikan.");
      queryClient.invalidateQueries({ queryKey: ["assignments", patientId] });
      queryClient.invalidateQueries({ queryKey: ["supply-history", vars.assignmentId] });
      queryClient.invalidateQueries({ queryKey: ["assignment-activity", vars.assignmentId] });
      queryClient.invalidateQueries({ queryKey: ["latest-supply-dates"] });
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      queryClient.invalidateQueries({ queryKey: ["pantas-batches"] });
      queryClient.invalidateQueries({ queryKey: ["items-with-stats"] });
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
      // 1. Cuba RPC update_supply (atomik + laraskan stok)
      const { error: rpcError } = await supabase.rpc("update_supply", {
        p_supply_id: supplyId,
        p_dos: dos,
        p_kuantiti: kuantiti,
        p_tempoh_dibekal: tempoh,
        p_catatan_bekalan: catatan || null,
      });
      if (!rpcError) return;

      // 2. Fallback: direct update (RPC not deployed) — tanpa larasan stok
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
      queryClient.invalidateQueries({ queryKey: ["assignment-activity", vars.assignmentId] });
      queryClient.invalidateQueries({ queryKey: ["latest-supply-dates"] });
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      queryClient.invalidateQueries({ queryKey: ["pantas-batches"] });
      queryClient.invalidateQueries({ queryKey: ["items-with-stats"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Gagal mengemaskini rekod bekalan.");
    },
  });
}

// ============================================================================
// 8b. "Ubat Tidak Perlu Dibekalkan" (supply declination) mutations
// ============================================================================
export function useDeclineSupply(patientId: string | undefined) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({
      assignmentId,
      sebab,
      tempoh,
      catatan,
    }: {
      assignmentId: string;
      sebab: string;
      tempoh?: string;
      catatan?: string;
    }) => {
      const { error } = await supabase.from("supply_declinations").insert({
        assignment_id: assignmentId,
        tarikh: getNowISOKL(),
        sebab,
        tempoh: tempoh || null,
        catatan: catatan || null,
        direkod_oleh: profile?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      toast.success("Rekod \u201cUbat Tidak Perlu Dibekalkan\u201d disimpan.");
      queryClient.invalidateQueries({ queryKey: ["item-patients"] });
      queryClient.invalidateQueries({ queryKey: ["assignments", patientId] });
      queryClient.invalidateQueries({ queryKey: ["assignment-activity", vars.assignmentId] });
      queryClient.invalidateQueries({ queryKey: ["declinations", vars.assignmentId] });
      queryClient.invalidateQueries({ queryKey: ["last-declination", vars.assignmentId] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Gagal merekod. Sila cuba lagi.");
    },
  });
}

export function useDeleteDeclination(patientId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ declinationId, assignmentId }: { declinationId: string; assignmentId: string }) => {
      const { error } = await supabase
        .from("supply_declinations")
        .delete()
        .eq("id", declinationId);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      toast.success("Rekod dihapuskan.");
      queryClient.invalidateQueries({ queryKey: ["item-patients"] });
      queryClient.invalidateQueries({ queryKey: ["assignments", patientId] });
      queryClient.invalidateQueries({ queryKey: ["assignment-activity", vars.assignmentId] });
      queryClient.invalidateQueries({ queryKey: ["declinations", vars.assignmentId] });
      queryClient.invalidateQueries({ queryKey: ["last-declination", vars.assignmentId] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Gagal menghapuskan rekod.");
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
      const { error } = await supabase.rpc("merge_patients", {
        p_primary_id: primaryPatientId,
        p_secondary_ids: duplicateIds,
        p_merge_date: getTodayStrKL(),
        p_merged_by: profile?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      toast.success("Pesakit berjaya digabungkan.");
      queryClient.invalidateQueries({ queryKey: ["patient", variables.primaryPatientId] });
      queryClient.invalidateQueries({ queryKey: ["assignments", variables.primaryPatientId] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["supply-history"] });
      queryClient.invalidateQueries({ queryKey: ["dose-history"] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["latest-dose-history-dos"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Gagal menggabungkan pesakit.");
    },
  });
}
