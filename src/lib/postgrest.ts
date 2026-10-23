/**
 * Helper PostgREST selamat.
 *
 * 1. escapeLikeTerm() — membersihkan input carian sebelum dimasukkan ke
 *    penapis `.or("...ilike.%term%...")`. Tanpa ini aksara `% _ , ( )`
 *    memecahkan query atau meluaskan padanan (audit: PostgREST injection).
 * 2. sanitizeExportValue() — meneutralkan formula CSV/Excel (`= + - @`)
 *    untuk eksport Excel/PDF (audit: CSV formula injection).
 */

/** Bersihkan istilah carian untuk penapis ilike: buang wildcard/pemisah, had 100 aksara. */
export function escapeLikeTerm(term: string): string {
  return term
    .replace(/[\\%_,()"]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

/** Bina corak ilike `%term%` yang selamat (term telah dibersihkan). */
export function likePattern(term: string): string {
  return `%${escapeLikeTerm(term)}%`;
}

/**
 * Lepaskan wildcard untuk padanan TEPAT `.ilike(col, value)` — tanpa ini
 * aksara `%` / `_` dalam input pengguna bertindak sebagai wildcard.
 */
export function escapeIlikeExact(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_").slice(0, 200);
}

/**
 * Neutralkan formula spreadsheet: nilai yang bermula dengan = + - @ (atau
 * tab/CR) diawali dengan apostrof supaya Excel/PDF tidak melaksanakannya.
 */
export function sanitizeExportValue(val: unknown): unknown {
  if (typeof val !== "string") return val ?? "-";
  const s = val;
  if (/^[=+\-@\t\r]/.test(s)) return `'${s}`;
  return s === "" ? "-" : s;
}
