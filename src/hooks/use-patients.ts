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
import type { Patient } from "@/types";

export type SortDir = "asc" | "desc";

export interface SortState {
  key: string;
  dir: SortDir;
}

export const PATIENT_PAGE_SIZE = 100;
export const SEARCH_DEBOUNCE_MS = 400;
const DUPLICATE_DEBOUNCE_MS = 600;

export interface PatientsData {
  patients: Patient[];
  total: number;
  totalPages: number;
}

export function usePatients({
  search,
  page,
  sort,
}: {
  search: string;
  page: number;
  sort: SortState | null;
}) {
  return useQuery<PatientsData>({
    queryKey: ["patients", search, page, sort],
    queryFn: async () => {
      let query = supabase
        .from("patients")
        .select("*", { count: "exact" })
        .eq("aktif", true)
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
      const sortKey = sort?.key ?? "nama";
      const sortDir = sort?.dir ?? "asc";
      query = query.order(sortKey, { ascending: sortDir === "asc" });

      // Pagination
      const from = page * PATIENT_PAGE_SIZE;
      const to = from + PATIENT_PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      // Fetch active assignment counts for these patients
      const patientIds = (data ?? []).map((p: any) => p.id);
      const countMap = new Map<string, number>();
      if (patientIds.length > 0) {
        const { data: assignments } = await supabase
          .from("patient_item_assignments")
          .select("patient_id")
          .eq("aktif", true)
          .in("patient_id", patientIds);
        ((assignments ?? []) as any[]).forEach((a) => {
          countMap.set(a.patient_id, (countMap.get(a.patient_id) ?? 0) + 1);
        });
      }

      return {
        patients: ((data ?? []) as Patient[]).map((p) => ({
          ...p,
          bilangan_item: countMap.get(p.id) ?? 0,
        })),
        total: count ?? 0,
        totalPages: Math.max(1, Math.ceil((count ?? 0) / PATIENT_PAGE_SIZE)),
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
          tarikh_daftar: new Date().toISOString().split("T")[0],
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
