/**
 * Hook untuk data pesakit + tugasan + bekalan + penggabungan.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { isRpcMissing, runSupplyMulti } from "@/lib/supply";
import { useAuth } from "@/hooks/use-auth";
import { digitsOnly, formatMyKad, formatPhone, getNowISOKL, getTodayStrKL } from "@/lib/utils";
import { escapeLikeTerm } from "@/lib/postgrest";
import { friendlyDbError } from "@/lib/db-errors";

const PATIENT_COLUMNS =
  "id, nama, nombor_kad_pengenalan, nombor_pendaftaran_hospital, dokumen_lain, nombor_telefon, alamat, catatan, aktif, merged_into, tarikh_daftar, catatan_nyahaktif, tarikh_nyahaktif, dinyahaktif_oleh, didaftar_oleh, created_at, updated_at";
const ASSIGNMENT_COLUMNS =
  "id, patient_id, item_id, dos, tarikh_mula_guna, dimulakan_oleh, tarikh_tamat_guna, ditamatkan_oleh, kakitangan_farmasi_perekod, aktif, sebab_tamat, catatan_penggunaan, created_at, updated_at";
const BATCH_COLUMNS =
  "id, item_id, nombor_kelompok, tarikh_luput, kuantiti, dilupuskan, dilupuskan_at, created_at, updated_at";
const ITEM_COLUMNS =
  "id, kod_item, nama_item, nama_dagangan, kekuatan, id_kategori, id_bentuk, kuota, catatan, aktif, created_at, updated_at";
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
  didaftar_oleh_profile: Pick<Profile, "id" | "nama"> | null;
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
          ${PATIENT_COLUMNS},
          dinyahaktif_oleh_profile:profiles!patients_dinyahaktif_oleh_fkey (
            id,
            nama
          ),
          didaftar_oleh_profile:profiles!patients_didaftar_oleh_fkey (
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
          ${ASSIGNMENT_COLUMNS},
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
    // #20: rujukan jarang berubah — elak refetch setiap mount.
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_forms")
        .select("id, nama")
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
  /** Didedahkan secara eksplisit supaya pengumpulan deterministik tidak bergantung pada `*`. */
  kumpulan_id?: string | null;
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
        kumpulanId: (s as SupplyRecordWithJoins).kumpulan_id ?? null,
        dos: s.dos,
        tempoh_dibekal: s.tempoh_dibekal,
        kuantiti: s.kuantiti,
        kakitangan_pembekal: s.kakitangan_pembekal,
        kakitangan_pembekal_profile: s.kakitangan_pembekal_profile,
        batch: s.batch ? { id: s.batch.id, nombor_kelompok: s.batch.nombor_kelompok } : null,
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
        .select("id, assignment_id, tarikh, sebab, tempoh, catatan, direkod_oleh, created_at")
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
// 4b. Latest activity date per assignment (for weeks-since badge)
// #6: lencana sebelum ini hanya mengambil supply_records — pesakit yang baru
// datang tetapi "Tak Perlu Bekal" kelihatan tertinggal. Kini ambil maksimum
// (bekalan sebenar ATAU penolakan) supaya lencana mencerminkan lawatan
// terakhir, bukan bekalan sebenar terakhir.
// ============================================================================
export function useLatestActivityDates(assignmentIds: string[]) {
  return useQuery({
    queryKey: ["latest-activity-dates", assignmentIds],
    enabled: assignmentIds.length > 0,
    staleTime: 0,
    queryFn: async () => {
      const [suppliesRes, declinationsRes] = await Promise.all([
        supabase
          .from("supply_records")
          .select("assignment_id, tarikh_dibekal")
          .in("assignment_id", assignmentIds)
          .is("voided_at", null)
          .order("tarikh_dibekal", { ascending: false }),
        supabase
          .from("supply_declinations")
          .select("assignment_id, tarikh")
          .in("assignment_id", assignmentIds)
          .order("tarikh", { ascending: false }),
      ]);
      if (suppliesRes.error) throw suppliesRes.error;
      if (declinationsRes.error) throw declinationsRes.error;
      const map = new Map<string, string>();
      const consider = (assignmentId: string, tarikh: string) => {
        const prev = map.get(assignmentId);
        if (!prev || new Date(tarikh).getTime() > new Date(prev).getTime()) {
          map.set(assignmentId, tarikh);
        }
      };
      for (const row of suppliesRes.data ?? []) {
        if (row.assignment_id && row.tarikh_dibekal) consider(row.assignment_id, row.tarikh_dibekal);
      }
      for (const row of declinationsRes.data ?? []) {
        if (row.assignment_id && (row as { tarikh?: string }).tarikh) {
          consider(row.assignment_id, (row as { tarikh: string }).tarikh);
        }
      }
      return map;
    },
  });
}

// Kekal untuk keserasian — kini hanya alias kepada aktiviti terakhir.
export function useLatestSupplyDates(assignmentIds: string[]) {
  return useLatestActivityDates(assignmentIds);
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
// 6. Supply durations
// ============================================================================
export function useSupplyDurations() {
  return useQuery({
    queryKey: ["supply_durations"],
    // #20: rujukan jarang berubah — elak refetch setiap mount.
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supply_durations")
        .select("id, nama")
        .order("nama", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SupplyDuration[];
    },
  });
}

// ============================================================================
// 7. Items with active assignment counts (penuh — dikekalkan untuk keserasian)
// ============================================================================
export function useItemsWithStats() {
  return useQuery({
    queryKey: ["items-with-stats"],
    staleTime: 0,
    queryFn: async () => {
      const { data: counts, error: countErr } = await supabase.rpc(
        "count_active_assignments"
      );
      // HIGH-2: gagal-tutup — jika kiraan tidak dapat disahkan, jangan
      // paparkan baki kuota palsu (0). Dialog menyekat item berkuota
      // selagi countsStale (pelayan kekal sebagai penguatkuasa muktamad).
      const countsStale = !!countErr;
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
        .select(ITEM_COLUMNS)
        .eq("aktif", true)
        .order("nama_item", { ascending: true });
      if (error) throw error;
      return {
        items: ((items as Item[]) ?? []).map((item) => ({
          ...item,
          active_assignments: countMap.get(item.id) ?? 0,
        })),
        countsStale,
      };
    },
  });
}

// ============================================================================
// 7b. Carian item pelayan untuk dialog tambah tugasan (#7)
// Sebelum ini dialog menerima keseluruhan katalog aktif dan menapis di klien —
// rosak pada skala (ribuan item dimuat setiap kali halaman butiran dibuka).
// Kini carian dibuat di pelayan dengan had 50 dan kiraan kuota yang tepat
// untuk item yang dipaparkan sahaja.
// ============================================================================
export function useItemSearchWithStats(query: string) {
  const term = query.trim();
  return useQuery({
    queryKey: ["items-search-with-stats", term],
    staleTime: 30 * 1000,
    queryFn: async () => {
      const escaped = escapeLikeTerm(term);
      let builder = supabase.from("items").select(ITEM_COLUMNS).eq("aktif", true);
      if (escaped) {
        builder = builder.or(
          `nama_item.ilike.%${escaped}%,kod_item.ilike.%${escaped}%,nama_dagangan.ilike.%${escaped}%,kekuatan.ilike.%${escaped}%`
        );
      }
      const { data: items, error } = await builder
        .order("nama_item", { ascending: true })
        .limit(50);
      if (error) throw error;

      const { data: counts, error: countErr } = await supabase.rpc(
        "count_active_assignments"
      );
      const countsStale = !!countErr;
      if (countErr) {
        // eslint-disable-next-line no-console
        console.warn("RPC count_active_assignments failed", countErr);
      }
      const countMap = new Map<string, number>();
      ((counts as any[]) ?? []).forEach((c) =>
        countMap.set(c.item_id, Number(c.active_count))
      );
      return {
        items: (((items as Item[]) ?? []).map((item) => ({
          ...item,
          active_assignments: countMap.get(item.id) ?? 0,
        })) as (Item & { active_assignments?: number })[]),
        countsStale,
        truncated: (items?.length ?? 0) >= 50,
      };
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
      const term = escapeLikeTerm(query.trim());
      const { data, error } = await supabase
        .from("patients")
        .select("id, nama, nombor_kad_pengenalan, nombor_pendaftaran_hospital, nombor_telefon, aktif")
        .or(
          `nama.ilike.%${term}%,nombor_kad_pengenalan.ilike.%${term}%,nombor_pendaftaran_hospital.ilike.%${term}%,nombor_telefon.ilike.%${term}%`
        )
        .is("merged_into", null)
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Pick<Patient, "id" | "nama" | "nombor_kad_pengenalan" | "nombor_pendaftaran_hospital" | "nombor_telefon" | "aktif">[];
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
      // MEDIUM-3: normalkan di titik cekik (cermin useAddPatient) supaya
      // suntingan tidak memasukkan semula varian format yang terlepas
      // daripada semakan pendua (tiada indeks unik DB — ulangan adalah sah).
      const norm: Partial<Patient> = { ...data };
      const rawKp = norm.nombor_kad_pengenalan;
      if (rawKp !== undefined) {
        const digits = digitsOnly(rawKp);
        if ((rawKp ?? "").trim() && digits.length !== 12) {
          throw new Error("No. KP mesti 12 digit.");
        }
        norm.nombor_kad_pengenalan = digits ? formatMyKad(digits) : null;
      }
      const rawHosp = norm.nombor_pendaftaran_hospital;
      if (rawHosp !== undefined) {
        norm.nombor_pendaftaran_hospital = (rawHosp ?? "").trim()
          ? (rawHosp ?? "").trim().toUpperCase()
          : null;
      }
      const rawPhone = norm.nombor_telefon;
      if (rawPhone !== undefined) {
        norm.nombor_telefon = (rawPhone ?? "").trim()
          ? formatPhone(rawPhone)
          : null;
      }
      const { error } = await supabase
        .from("patients")
        .update({
          ...norm,
          updated_at: getNowISOKL(),
        })
        .eq("id", patientId!);
      if (error) {
        // Jaring keselamatan: terjemah 23505 samar jika kekangan unik
        // ditambah pada masa hadapan.
        if ((error as { code?: string }).code === "23505") {
          throw new Error(
            "No. KP / No. Pendaftaran Hospital ini telah digunakan oleh rekod aktif lain."
          );
        }
        throw error;
      }
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
      // LOW-5: jangan tulis jejak audit tanpa pelaku. NULL sebelum ini
      // diselitkan secara senyap jika profil tiada (sesi tamat) — gagalkan
      // dengan jelas supaya rekod tidak kehilangan "dinyahaktif oleh".
      if (!profile?.id) {
        throw new Error("Sesi tamat tempoh. Sila log masuk semula.");
      }
      const { error } = await supabase
        .from("patients")
        .update({
          aktif: false,
          updated_at: getNowISOKL(),
          catatan_nyahaktif: catatan || null,
          tarikh_nyahaktif: getTodayStrKL(),
          dinyahaktif_oleh: profile.id,
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

      // Fallback: RPC belum deployed — manual 2-step insert.
      // HIGH-2: semakan kuota klien (pelayan 041 menguatkuasakan perkara sama).
      const { data: quotaItem } = await supabase
        .from("items")
        .select("kuota")
        .eq("id", data.item_id)
        .maybeSingle();
      const quota = quotaItem?.kuota ?? null;
      if (quota != null && quota > 0) {
        const { count: activeCount } = await supabase
          .from("patient_item_assignments")
          .select("id", { count: "exact", head: true })
          .eq("item_id", data.item_id)
          .eq("aktif", true);
        if ((activeCount ?? 0) >= quota) {
          throw new Error(
            `Kuota item telah penuh (${activeCount}/${quota}) — tamatkan tugasan sedia ada dahulu.`
          );
        }
      }
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
      if (assignError) {
        // #16: terjemah penolakan kuota pelayan (lumba yang melepasi semakan
        // pra-tulis) kepada mesej mesra, bukan ralat Postgres mentah.
        const msg = (assignError.message ?? "").toLowerCase();
        if (msg.includes("kuota") || msg.includes("quota")) {
          throw new Error(
            "Kuota item telah penuh — tamatkan tugasan sedia ada dahulu."
          );
        }
        throw assignError;
      }

      // #16: semakan lepas-tulis menutup lumba baca-dahulu-tulis-kemudian —
      // dua tambah serentak yang melepasi semakan pra-tulis akan dikesan di
      // sini; pemasukan sendiri diundur sebelum dose_history ditulis.
      if (quota != null && quota > 0 && assignment) {
        const { count: postCount } = await supabase
          .from("patient_item_assignments")
          .select("id", { count: "exact", head: true })
          .eq("item_id", data.item_id)
          .eq("aktif", true);
        if ((postCount ?? 0) > quota) {
          await supabase
            .from("patient_item_assignments")
            .delete()
            .eq("id", assignment.id);
          throw new Error(
            `Kuota item telah penuh (${quota}) — tamatkan tugasan sedia ada dahulu.`
          );
        }
      }

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
      // MEDIUM-3: jangan tulis jurnal tanpa pelaku; jangan tulis ganti
      // sejarah pemberhentian sedia ada.
      if (!profile?.id) {
        throw new Error("Sesi tamat tempoh. Sila log masuk semula.");
      }
      if (!sebab || !sebab.trim()) {
        throw new Error("Sebab penamatan diperlukan.");
      }
      const today = getTodayStrKL();
      const { data, error } = await supabase
        .from("patient_item_assignments")
        .update({
          aktif: false,
          tarikh_tamat_guna: today,
          sebab_tamat: sebab.trim(),
          ditamatkan_oleh: profile.id,
        })
        .eq("id", assignmentId)
        .eq("aktif", true)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        throw new Error("Tugasan telah ditamatkan atau tidak dijumpai.");
      }
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

      // LOW-4: fallback lama DIPADAM — ia menulis dos + sejarah secara terus
      // tanpa pengawal tugasan-mati 046 (boleh mencipta fakta dos pada rekod
      // yang ditamatkan). Gagalkan dengan jelas dan bukannya menulis senyap.
      if (
        rpcErr.code === "42883" ||
        rpcErr.message?.includes("Could not find the function") ||
        rpcErr.message?.includes("does not exist")
      ) {
        throw new Error(
          "Fungsi update_dose_with_history tiada di pangkalan data — kemas kini migrasi (029/039) diperlukan sebelum kemas kini dos."
        );
      }
      throw rpcErr;
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
    }) => runSupplyMulti(data, profile?.id ?? null),
    onSuccess: (_data, vars) => {
      toast.success("Ubat berjaya dibekalkan.");
      // #20: had kepada kunci yang terjejas di halaman ini. Kunci silang
      // (Dispen Pantas/papan pemuka/transaksi) dibuang — halaman tersebut
      // guna staleTime 0 dan refetch sendiri semasa mount.
      queryClient.invalidateQueries({ queryKey: ["assignments", patientId] });
      queryClient.invalidateQueries({ queryKey: ["supply-history", vars.assignmentId] });
      queryClient.invalidateQueries({ queryKey: ["assignment-activity", vars.assignmentId] });
      queryClient.invalidateQueries({ queryKey: ["latest-activity-dates"] });
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
      const { error: rpcError } = await supabase.rpc("reverse_supply", {
        p_supply_id: supplyId,
      });
      if (!rpcError) return;

      // MEDIUM-3 (audit bekalan): fallback lama DIPADAM — ia menanda void
      // TANPA memulangkan stok (kehilangan stok senyap). Gagalkan dengan
      // jelas supaya pangkalan data dikemas kini (migrasi 022/039).
      if (
        rpcError.code === "42883" ||
        rpcError.message?.includes("Could not find the function") ||
        rpcError.message?.includes("does not exist")
      ) {
        throw new Error(
          "Fungsi reverse_supply tiada di pangkalan data — kemas kini migrasi (022/039) diperlukan sebelum pembatalan."
        );
      }
      throw rpcError;
    },
    onSuccess: (_data, vars) => {
      toast.success("Rekod bekalan dibatalkan dan stok dikembalikan.");
      queryClient.invalidateQueries({ queryKey: ["assignments", patientId] });
      queryClient.invalidateQueries({ queryKey: ["supply-history", vars.assignmentId] });
      queryClient.invalidateQueries({ queryKey: ["assignment-activity", vars.assignmentId] });
      queryClient.invalidateQueries({ queryKey: ["latest-activity-dates"] });
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      queryClient.invalidateQueries({ queryKey: ["pantas-batches"] });
      queryClient.invalidateQueries({ queryKey: ["items-with-stats"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Gagal memadam rekod bekalan.");
    },
  });
}

/**
 * LOW-4: pembatalan pukal atomik — baris bekalan bergabung (multi-kelompok)
 * dibatalkan dalam SATU transaksi RPC dengan SATU toast ringkasan, bukan
 * N mutasi berasingan yang boleh berjaya separuh.
 */
export function useBulkDeleteSupplyRecords(patientId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      supplyIds,
      assignmentId,
    }: {
      supplyIds: string[];
      assignmentId: string;
    }) => {
      if (supplyIds.length === 0) throw new Error("Tiada rekod dipilih.");
      const { error } = await supabase.rpc("reverse_supplies", {
        p_supply_ids: supplyIds,
        p_catatan: "Pembatalan pukal rekod bergabung",
      });
      if (!error) return { count: supplyIds.length, assignmentId };
      if (!isRpcMissing(error)) throw error;

      // Fallback pra-047: batal satu demi satu (tidak atomik — laporkan
      // separa supaya pengguna menyemak bakinya).
      const failed: string[] = [];
      for (const sid of supplyIds) {
        const { error: e } = await supabase.rpc("reverse_supply", {
          p_supply_id: sid,
        });
        if (e) failed.push(sid);
      }
      if (failed.length > 0) {
        throw new Error(
          `Sebahagian gagal dibatalkan (${failed.length}/${supplyIds.length}) — semak sejarah bekalan sebelum cuba lagi.`
        );
      }
      return { count: supplyIds.length, assignmentId };
    },
    onSuccess: (data) => {
      toast.success(
        `${data.count} rekod bekalan dibatalkan dan stok dikembalikan.`
      );
      queryClient.invalidateQueries({ queryKey: ["assignments", patientId] });
      queryClient.invalidateQueries({ queryKey: ["supply-history", data.assignmentId] });
      queryClient.invalidateQueries({ queryKey: ["assignment-activity", data.assignmentId] });
      queryClient.invalidateQueries({ queryKey: ["latest-activity-dates"] });
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      queryClient.invalidateQueries({ queryKey: ["pantas-batches"] });
      queryClient.invalidateQueries({ queryKey: ["items-with-stats"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Gagal membatalkan rekod bekalan.");
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

      // MEDIUM-3 (audit bekalan): fallback lama DIPADAM — ia menulis kuantiti
      // baharu TANPA melaraskan stok/jurnal (penyelewengan stok senyap).
      // Gagalkan dengan jelas supaya pangkalan data dikemas kini (023/039).
      if (
        rpcError.code === "42883" ||
        rpcError.message?.includes("Could not find the function") ||
        rpcError.message?.includes("does not exist")
      ) {
        throw new Error(
          "Fungsi update_supply tiada di pangkalan data — kemas kini migrasi (023/039) diperlukan sebelum penyuntingan."
        );
      }
      throw rpcError;
    },
    onSuccess: (_data, vars) => {
      toast.success("Rekod bekalan dikemaskini.");
      queryClient.invalidateQueries({ queryKey: ["assignments", patientId] });
      queryClient.invalidateQueries({ queryKey: ["supply-history", vars.assignmentId] });
      queryClient.invalidateQueries({ queryKey: ["assignment-activity", vars.assignmentId] });
      queryClient.invalidateQueries({ queryKey: ["latest-activity-dates"] });
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
      // #6: lencana aktiviti mesti segar semula selepas penolakan direkod.
      queryClient.invalidateQueries({ queryKey: ["latest-activity-dates"] });
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
      // #6: lencana aktiviti mesti segar semula selepas penolakan dipadam.
      queryClient.invalidateQueries({ queryKey: ["latest-activity-dates"] });
    },
    onError: (err: any) => {
      // LOW-5: RLS 048 hanya membenarkan Pentadbir memadam — terjemahkan 42501.
      toast.error(friendlyDbError(err, "Gagal menghapuskan rekod."));
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
      // MEDIUM-1 (audit gabungan): jangan tulis jejak audit tanpa pelaku.
      // NULL sebelum ini diselitkan secara senyap jika profil tiada (sesi
      // tamat) — gagalkan dengan jelas, selari dengan useDeactivatePatient.
      if (!profile?.id) {
        throw new Error("Sesi tamat tempoh. Sila log masuk semula.");
      }
      const { error } = await supabase.rpc("merge_patients", {
        p_primary_id: primaryPatientId,
        p_secondary_ids: duplicateIds,
        p_merge_date: getTodayStrKL(),
        p_merged_by: profile.id,
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
