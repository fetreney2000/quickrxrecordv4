/**
 * Mesej ralat pangkalan data yang mesra + selamat.
 *
 * - 42501 = dinafikan oleh RLS/policy (polisi 039). Terangkan tanpa
 *   membocorkan butiran dalaman.
 * - Kod lain: kembalikan mesej asal (sudah selamat — PostgREST tidak
 *   mendedahkan SQL).
 */
export function friendlyDbError(err: unknown, fallback: string): string {
  const e = err as { code?: string; message?: string } | null;
  if (e?.code === "42501" || /permission denied|not allowed|Tiada kebenaran/i.test(e?.message ?? "")) {
    return "Akses ditolak oleh polisi keselamatan. Sila log masuk semula atau hubungi pentadbir.";
  }
  if (e?.code === "23505" || /duplicate|already exists/i.test(e?.message ?? "")) {
    return "Rekod sudah wujud (pendua).";
  }
  if (e?.code === "23503") {
    return "Rekod berkaitan tidak dijumpai.";
  }
  return e?.message || fallback;
}
