import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names with conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format an item consistently as name, strength, and dosage form. */
export function formatItemDisplay(
  item: {
    nama_item?: string | null;
    kekuatan?: string | null;
    bentuk?: string | null;
    item_forms?: { nama?: string | null } | null;
  } | null | undefined,
  bentuk?: string | null
): string {
  if (!item) return "Item Tidak Dikenali";
  return [item.nama_item, item.kekuatan, bentuk ?? item.bentuk ?? item.item_forms?.nama]
    .filter(Boolean)
    .join(" ");
}

/** Asia/Kuala_Lumpur timezone identifier used everywhere. */
export const KL_TIMEZONE = "Asia/Kuala_Lumpur";

/** Common KL locale used for date/time formatting. */
export const KL_LOCALE = "ms-MY";

/**
 * Get the current Date in Asia/Kuala_Lumpur.
 * Useful for display and for triggering re-renders when the day changes.
 */
export function getKLDate(): Date {
  const now = new Date();
  // Get the date string in KL timezone, then re-parse to get a Date that
  // reflects KL wall clock time when used with toLocaleString.
  const klString = now.toLocaleString("en-US", { timeZone: KL_TIMEZONE });
  return new Date(klString);
}

/** Format a date for display using the Asia/Kuala_Lumpur timezone. */
export function formatDate(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }
): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(KL_LOCALE, { ...options, timeZone: KL_TIMEZONE });
}

/** Format a date+time using the Asia/Kuala_Lumpur timezone. */
export function formatDateTime(
  value: string | Date | null | undefined
): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(KL_LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: KL_TIMEZONE,
  });
}

/** Format a time using the Asia/Kuala_Lumpur timezone. */
export function formatTime(
  value: string | Date | null | undefined
): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(KL_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: KL_TIMEZONE,
  });
}

/** Return YYYY-MM-DD in KL timezone (for <input type="date"> value). */
export function toDateInputValue(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "";
  // Use KL timezone to avoid off-by-one issues.
  const kl = new Date(
    d.toLocaleString("en-US", { timeZone: KL_TIMEZONE })
  );
  const yyyy = kl.getFullYear();
  const mm = String(kl.getMonth() + 1).padStart(2, "0");
  const dd = String(kl.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Convert a YYYY-MM-DD string to ISO at midnight KL time. */
export function fromDateInputValue(value: string): string {
  if (!value) return "";
  // Treat the value as midnight in KL time.
  // KL is UTC+8 (no DST).
  const [yyyy, mm, dd] = value.split("-").map((s) => parseInt(s, 10));
  if (!yyyy || !mm || !dd) return "";
  const iso = new Date(Date.UTC(yyyy, mm - 1, dd, -8, 0, 0));
  return iso.toISOString();
}

/** Add calendar days to a YYYY-MM-DD value without using the browser timezone. */
export function addDaysToDateInput(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Return the UTC instant representing midnight for a Kuala Lumpur date. */
export function getKLDayStartISO(dateInput?: string): string {
  return fromDateInputValue(dateInput || getTodayStrKL());
}

/** Return the UTC instant at the start of the next Kuala Lumpur calendar day. */
export function getKLDayEndISO(dateInput?: string): string {
  return getKLDayStartISO(addDaysToDateInput(dateInput || getTodayStrKL(), 1));
}

/** Return the number of Kuala Lumpur calendar days since a date. */
export function calendarDaysSinceKL(value: string | Date | null | undefined): number | null {
  const date = toDateInputValue(value);
  if (!date) return null;
  const diffMs = new Date(getKLDayStartISO()).getTime() - new Date(getKLDayStartISO(date)).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/** Format a supply date using the application's Malay relative-age labels. */
export function formatSupplyAge(value: string | Date | null | undefined): string | null {
  const days = calendarDaysSinceKL(value);
  if (days === null) return null;
  if (days === 0) return "Hari Ini";
  if (days < 7) return `${days} Hari Lalu`;
  return `${Math.floor(days / 7)} Minggu Lalu`;
}

/** Singkatan nama Melayu/Malaysia yang dikekalkan dalam HURUF BESAR (A/L, A/P, S/O, dll.). */
const MALAY_NAME_ABBREVIATIONS = new Set([
  "A/L", "A/P", "S/O", "D/O", "B/O", "B/W",
  "AK", "DG", "DK", "AG", "AWG", "AWGKU", "PG",
]);

/** Title-case a name while keeping common acronyms uppercase. */
export function toTitleCase(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .toLowerCase()
    .split(/\s+/)
    .map((w) => {
      if (!w) return w;
      const up = w.toUpperCase().replace(/[.,]$/, "");
      if (MALAY_NAME_ABBREVIATIONS.has(up)) {
        return w.toUpperCase();
      }
      return w[0].toUpperCase() + w.slice(1);
    })
    .join(" ");
}

/**
 * Istilah perubatan/farmasi yang tidak boleh ditukar kepada title case.
 * Kekunci ialah bentuk UPPERCASE (padanan tak sensitif huruf); nilai ialah ejaan
 * piawai yang dikekalkan. Sumber: drugs.com/article/prescription-abbreviations.html
 * dan resourcepharm.com/pre-reg-pharmacist/pharmacy-abbreviations.html.
 */
const PHARMACY_ABBREVIATIONS: Record<string, string> = {
  // Unit ukuran (huruf kecil mengikut konvensyen; mL, mEq, dL, dll.)
  G: "g", MG: "mg", KG: "kg", MCG: "mcg", ML: "mL", DL: "dL",
  MM: "mm", CM: "cm", CC: "cc", MEQ: "mEq", MMOL: "mmol", NMOL: "nmol",
  MOL: "mol", HR: "hr", MIN: "min", GTT: "gtt", GTTS: "gtts", GR: "gr",
  OZ: "oz", TSP: "tsp", TBSP: "tbsp", IU: "IU", U: "U",
  // Bentuk dos, laluan pentadbiran & modifikasi pelepasan
  IR: "IR", ER: "ER", MR: "MR", XR: "XR", XL: "XL", XT: "XT", SR: "SR",
  CR: "CR", DR: "DR", LA: "LA", SA: "SA", PR: "PR", EC: "EC", FC: "FC",
  SC: "SC", IM: "IM", IV: "IV", IVP: "IVP", IVIG: "IVIG", PO: "PO",
  PV: "PV", SL: "SL", OD: "OD", OS: "OS", OU: "OU", AD: "AD", AS: "AS",
  AU: "AU", IN: "IN", NAS: "NAS", NGT: "NGT", NPO: "NPO", SQ: "SQ",
  OC: "OC", IUD: "IUD", NEB: "NEB", MDI: "MDI", DPI: "DPI", PCA: "PCA",
  PICC: "PICC", PEG: "PEG", BSA: "BSA", CD: "CD", NRT: "NRT", WSP: "WSP",
  YSP: "YSP", IJ: "IJ", NG: "NG", IA: "IA",
  // Kekerapan & arahan preskripsi
  BID: "BID", TID: "TID", QID: "QID", QD: "QD", QDS: "QDS", TDS: "TDS",
  QHS: "QHS", QOD: "QOD", HS: "HS", PRN: "PRN", STAT: "STAT", RX: "Rx",
  // Ubat & kelas ubat
  APAP: "APAP", ASA: "ASA", NSAID: "NSAID", SNRI: "SNRI", SSRI: "SSRI",
  ACEI: "ACEI", ARB: "ARB", OTC: "OTC", NDC: "NDC", HCTZ: "HCTZ",
  TSH: "TSH", INR: "INR", PT: "PT", PTT: "PTT", APTT: "aPTT", MMR: "MMR",
  MMRV: "MMRV", DTP: "DTP", DTAP: "DTaP", BCG: "BCG", HPV: "HPV",
  HEPB: "HepB", HEPA: "HepA", HIB: "Hib", IPV: "IPV", OPV: "OPV",
  PCV: "PCV", TD: "Td", TDAP: "Tdap", PHARMD: "PharmD",
  // Keadaan perubatan & istilah klinikal
  CAD: "CAD", DM: "DM", DVT: "DVT", GERD: "GERD", GI: "GI", GU: "GU",
  HTN: "HTN", PE: "PE", RA: "RA", UTI: "UTI", MD: "MD", MI: "MI",
  AF: "AF", COPD: "COPD", CHF: "CHF", CVA: "CVA", TB: "TB", HIV: "HIV",
  AIDS: "AIDS", CKD: "CKD", AKI: "AKI", IHD: "IHD", CCF: "CCF",
  SLE: "SLE", MS: "MS", BP: "BP", BMI: "BMI", CNS: "CNS", ENT: "ENT",
  EENT: "EENT", FDA: "FDA", HCP: "HCP", NS: "NS", NKA: "NKA",
  NKDA: "NKDA", DOB: "DOB", DAW: "DAW", HBP: "HBP",
  // Ujian makmal & prosedur
  CBC: "CBC", WBC: "WBC", RBC: "RBC", HB: "Hb", HCT: "HCT", FBS: "FBS",
  HDL: "HDL", LDL: "LDL", ESR: "ESR", CRP: "CRP", LFT: "LFT",
  RFT: "RFT", GFR: "GFR", BUN: "BUN", SCR: "SCr", AST: "AST", ALT: "ALT",
  ALP: "ALP", GGT: "GGT", ECG: "ECG", EKG: "EKG", EEG: "EEG", MRI: "MRI",
  CT: "CT", PFT: "PFT", CXR: "CXR", WNL: "WNL",
  // Unsur / mineral
  K: "K", FE: "Fe", CA: "Ca", NA: "Na", CL: "Cl", ZN: "Zn",
  // Istilah sedia ada yang dikekalkan
  KP: "KP", HKL: "HKL", HOSP: "HOSP", HOSPITAL: "HOSPITAL", NO: "NO",
  PHARM: "PHARM", PHARMACY: "PHARMACY",
};

function preservePharmacyAbbreviation(word: string): string {
  const match = word.match(/^([^A-Za-z]*)([A-Za-z]+)([^A-Za-z]*)$/);
  if (!match) return "";
  const canonical = PHARMACY_ABBREVIATIONS[match[2].toUpperCase()];
  if (!canonical) return "";
  return match[1] + canonical + match[3];
}

/** Title-case a name but preserve known medical/pharmacy abbreviations (MMR, IR, EC, mL, dll.). */
export function toTitleCaseKeepAcronyms(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .toLowerCase()
    .split(/\s+/)
    .map((w) => {
      if (!w) return w;
      const preserved = preservePharmacyAbbreviation(w);
      if (preserved) return preserved;
      return w[0].toUpperCase() + w.slice(1);
    })
    .join(" ");
}

/** Format a Malaysian IC number (MyKad) as XXXXXX-XX-XXXX. */
export function formatMyKad(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "").slice(0, 12);
  if (digits.length <= 6) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
}

/** Format a Malaysian phone number into a readable form. */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  // Strip leading 60 (country code) or 0
  let local = digits;
  if (local.startsWith("60")) local = "0" + local.slice(2);
  // Apply dashes every 3-4 digits for readability
  if (local.length <= 3) return local;
  if (local.length <= 7)
    return `${local.slice(0, 3)}-${local.slice(3)}`;
  return `${local.slice(0, 3)}-${local.slice(3, 7)}-${local.slice(7, 11)}`;
}

/** Strip a MyKad back to digits only. */
export function digitsOnly(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/\D/g, "");
}

/** Extract date of birth from MyKad number (first 6 digits = YYMMDD). */
export function myKadToDob(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "").slice(0, 6);
  if (digits.length < 6) return null;
  const yy = parseInt(digits.slice(0, 2), 10);
  const mm = parseInt(digits.slice(2, 4), 10);
  const dd = parseInt(digits.slice(4, 6), 10);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  // MyKad century rule: if year prefix >= 0, it's 20xx; otherwise 19xx
  const year = yy < 30 ? 2000 + yy : 1900 + yy;
  return `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/** Calculate age in years from a date of birth string. */
export function calculateAge(dob: string | Date | null | undefined): number | null {
  if (!dob) return null;
  const birthParts = getKLDateParts(dob);
  const todayParts = getKLDateParts(getTodayStrKL());
  if (!birthParts || !todayParts) return null;
  let age = todayParts.year - birthParts.year;
  const m = todayParts.month - birthParts.month;
  if (m < 0 || (m === 0 && todayParts.day < birthParts.day)) {
    age--;
  }
  return age;
}

/** Format age in year, month, day format. */
export function formatAge(dob: string | Date | null | undefined): string {
  if (!dob) return "—";
  const birthParts = getKLDateParts(dob);
  const todayParts = getKLDateParts(getTodayStrKL());
  if (!birthParts || !todayParts) return "—";
  let years = todayParts.year - birthParts.year;
  let months = todayParts.month - birthParts.month;
  let days = todayParts.day - birthParts.day;
  if (days < 0) {
    months--;
    days += new Date(Date.UTC(todayParts.year, todayParts.month - 1, 0)).getUTCDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }
  return `${years} Tahun, ${months} Bulan, ${days} Hari`;
}

function getKLDateParts(value: string | Date): { year: number; month: number; day: number } | null {
  const input = typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)
    ? value.slice(0, 10)
    : toDateInputValue(value);
  const [year, month, day] = input.split("-").map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

/** Return a relative time string in Bahasa Melayu (e.g. "5 minit yang lalu"). */
export function timeAgo(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "—";
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "Baru sahaja";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minit yang lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam yang lalu`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} hari yang lalu`;
  return formatDate(d);
}

/** Debounce a function call by `delay` milliseconds. */
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Get the initials of a name (up to 2 characters). */
export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Generate a uuid v4 (browser crypto). */
export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Format a number with thousand separators (Bahasa locale). */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return value.toLocaleString("ms-MY");
}

/** Format a currency value (RM) with thousand separators. */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return `RM ${value.toLocaleString("ms-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Get the start of today in KL timezone as ISO. */
export function getStartOfTodayKL(): Date {
  return new Date(getKLDayStartISO());
}

/** Get today's date as YYYY-MM-DD string in KL timezone. */
export function getTodayStrKL(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/** Get the current instant as ISO; database timestamps are displayed in KL time. */
export function getNowISOKL(): string {
  return new Date().toISOString();
}

/** Truncate text to a max length with ellipsis. */
export function truncate(text: string, max: number): string {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

/** Sleep for a given number of milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Safe JSON parse with a fallback. */
export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
