/**
 * Hooks untuk pengurusan pesakit.
 * - usePatients: senarai pesakit dengan carian, isihan, pagination
 * - useAddPatient: tambah pesakit baharu dengan auto-redirect
 * - useCheckDuplicate: semak pendua semasa menaip (debounced)
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useNavStore } from "@/lib/nav-store";
import { useAuth } from "@/hooks/use-auth";
import { getTodayStrKL } from "@/lib/utils";
import type { Patient } from "@/types";

export type SortDir = "asc" | "desc";

export interface SortState {
  key: string;
  dir: SortDir;
}

export const PATIENT_PAGE_SIZE = 100;
export const SEARCH_DEBOUNCE_MS = 400;
const DUPLICATE_DEBOUNCE_MS = 600;

export interface PatientListItem extends Patient {
  bilangan_item?: number;
  dinyahaktif_oleh_nama?: string;
}

export interface PatientsData {
  patients: PatientListItem[];
  total: number;
  totalPages: number;
}

export function usePatients({
  search,
  page,
  sort,
  pageSize = PATIENT_PAGE_SIZE,
  active = true,
}: {
  search: string;
  page: number;
  sort: SortState | null;
  pageSize?: number;
  active?: boolean;
}) {
  return useQuery<PatientsData>({
    queryKey: ["patients", search, page, sort, pageSize, active],
    queryFn: async () => {
      // RPC-first path: server handles counts, name resolution, and sorting
      const sortKey = sort?.key ?? "nama";
      const sortDir = sort?.dir ?? "asc";
      const offset = page * pageSize;
      const { data: rpcData, error: rpcErr } = await supabase.rpc(
        "get_patient_list",
        {
          p_search: search.trim(),
          p_active: active,
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
          patients: (rpcData ?? []).map((r: any) => ({
            id: r.id,
            nama: r.nama,
            nombor_kad_pengenalan: r.nombor_kad_pengenalan,
            nombor_pendaftaran_hospital: r.nombor_pendaftaran_hospital,
            dokumen_lain: r.dokumen_lain,
            nombor_telefon: r.nombor_telefon,
            alamat: r.alamat,
            catatan: r.catatan,
            aktif: r.aktif,
            merged_into: r.merged_into,
            tarikh_daftar: r.tarikh_daftar,
            catatan_nyahaktif: r.catatan_nyahaktif,
            tarikh_nyahaktif: r.tarikh_nyahaktif,
            dinyahaktif_oleh: r.dinyahaktif_oleh,
            created_at: r.created_at,
            updated_at: r.updated_at,
            bilangan_item: Number(r.bilangan_item || 0),
            dinyahaktif_oleh_nama: active
              ? undefined
              : (r.dinyahaktif_oleh_nama ?? undefined),
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
      let query = supabase
        .from("patients")
        .select("*", { count: "exact" })
        .eq("aktif", active)
        .is("merged_into", null);

      // Carian (nama, KP, hospital)
      const trimmed = search.trim();
      if (trimmed) {
        const like = `%${trimmed}%`;
        query = query.or(
          `nama.ilike.${like},nombor_kad_pengenalan.ilike.${like},nombor_pendaftaran_hospital.ilike.${like}`
        );
      }

      // Isihan
      const sortKeyFallback = sort?.key ?? "nama";
      const sortDirFallback = sort?.dir ?? "asc";
      query = query.order(sortKeyFallback, { ascending: sortDirFallback === "asc" });

      // Pagination
      const from = page * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      const patientIds = (data ?? []).map((p: any) => p.id);
      const countMap = new Map<string, number>();
      const profileMap = new Map<string, string>();

      if (patientIds.length > 0) {
        if (active) {
          // Fetch active assignment counts for active patients
          const { data: assignments } = await supabase
            .from("patient_item_assignments")
            .select("patient_id")
            .eq("aktif", true)
            .in("patient_id", patientIds);
          ((assignments ?? []) as any[]).forEach((a) => {
            countMap.set(a.patient_id, (countMap.get(a.patient_id) ?? 0) + 1);
          });
        } else {
          // Fetch deactivator profile names for deactivated patients
          const deactivatorIds = [...new Set(
            (data ?? [])
              .map((p: any) => p.dinyahaktif_oleh)
              .filter((id: string | null): id is string => !!id)
          )];
          if (deactivatorIds.length > 0) {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id, nama")
              .in("id", deactivatorIds);
            ((profiles ?? []) as any[]).forEach((prof) => {
              profileMap.set(prof.id, prof.nama);
            });
          }
        }
      }

      return {
        patients: ((data ?? []) as Patient[]).map((p) => ({
          ...p,
          bilangan_item: countMap.get(p.id) ?? 0,
          dinyahaktif_oleh_nama: active ? undefined : (profileMap.get((p as any).dinyahaktif_oleh) ?? undefined),
        })),
        total: count ?? 0,
        totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
      };
    },
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
  });
}

/** Borang data pesakit baharu (dengan semua medan pilihan kosong). */
export interface NewPatientForm {
  nama: string;
  nombor_kad_pengenalan: string;
  nombor_pendaftaran_hospital: string;
  dokumen_lain: string;
  nombor_telefon: string;
  alamat: string;
  catatan: string;
}

export const EMPTY_NEW_PATIENT: NewPatientForm = {
  nama: "",
  nombor_kad_pengenalan: "",
  nombor_pendaftaran_hospital: "",
  dokumen_lain: "",
  nombor_telefon: "",
  alamat: "",
  catatan: "",
};

/** Tambah pesakit baharu dengan auto-redirect ke halaman butiran. */
export function useAddPatient({
  onSuccess,
}: {
  onSuccess?: () => void;
} = {}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const setNavSource = useNavStore((s) => s.setNavSource);

  return useMutation({
    mutationFn: async (form: NewPatientForm) => {
      const { data, error } = await supabase
        .from("patients")
        .insert({
          nama: form.nama.trim(),
          nombor_kad_pengenalan: form.nombor_kad_pengenalan.trim() || null,
          nombor_pendaftaran_hospital:
            form.nombor_pendaftaran_hospital.trim() || null,
          dokumen_lain: form.dokumen_lain.trim() || null,
          nombor_telefon: form.nombor_telefon.trim() || null,
          alamat: form.alamat.trim() || null,
          catatan: form.catatan.trim() || null,
          aktif: true,
          tarikh_daftar: getTodayStrKL(),
        })
        .select("id")
        .single();

      if (error) throw error;
      if (!data) throw new Error("Tiada respons daripada pangkalan data.");
      return data as { id: string };
    },
    onSuccess: (data) => {
      toast.success("Pesakit berjaya ditambah.");
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      // Navigasi ke halaman butiran pesakit baharu
      setNavSource("list");
      navigate(`/pesakit/${data.id}`);
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(
        err?.message || "Gagal menambah pesakit. Sila cuba lagi."
      );
    },
  });
}

export type DuplicateMatchType = "kad_pengenalan" | "hospital";

export interface DuplicateMatch {
  type: DuplicateMatchType;
  patient: Patient;
}

/** Carian pendua masa nyata dengan debounce 600ms. */
export function useCheckDuplicate(form: NewPatientForm) {
  const [debouncedForm, setDebouncedForm] = useState(form);
  const [result, setResult] = useState<DuplicateMatch | null>(null);

  // Debounce form changes
  useEffect(() => {
    const t = setTimeout(() => setDebouncedForm(form), DUPLICATE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [form]);

  useEffect(() => {
    const kp = debouncedForm.nombor_kad_pengenalan.trim();
    const hosp = debouncedForm.nombor_pendaftaran_hospital.trim();

    if (!kp && !hosp) {
      setResult(null);
      return;
    }

    let cancelled = false;
    (async () => {
      const orParts: string[] = [];
      if (kp) orParts.push(`nombor_kad_pengenalan.eq.${kp}`);
      if (hosp) orParts.push(`nombor_pendaftaran_hospital.eq.${hosp}`);

      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .or(orParts.join(","))
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        // eslint-disable-next-line no-console
        console.warn("Duplicate check error:", error);
        return;
      }
      if (data) {
        const p = data as Patient;
        const type: DuplicateMatchType = p.nombor_kad_pengenalan === kp
          ? "kad_pengenalan"
          : "hospital";
        setResult({ type, patient: p });
      } else {
        setResult(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedForm.nombor_kad_pengenalan, debouncedForm.nombor_pendaftaran_hospital]);

  return result;
}
