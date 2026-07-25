import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names with conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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

/** Title-case a name while keeping common acronyms uppercase. */
export function toTitleCase(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Title-case a name but preserve known acronyms (KP, HKL, etc.). */
export function toTitleCaseKeepAcronyms(input: string | null | undefined): string {
  if (!input) return "";
  const ACRONYMS = new Set([
    "KP",
    "HKL",
    "HOSP",
    "HOSPITAL",
    "NO",
    "NO.",
    "DR",
    "DR.",
    "PHARM",
    "PHARMACY",
  ]);
  return input
    .toLowerCase()
    .split(/\s+/)
    .map((w) => {
      const up = w.toUpperCase().replace(/[.,]/g, "");
      if (ACRONYMS.has(up)) {
        return w.toUpperCase();
      }
      return w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w;
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

/** Calculate age in years from a date of birth string. */
export function calculateAge(dob: string | Date | null | undefined): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/** Format age in years/months. */
export function formatAge(dob: string | Date | null | undefined): string {
  const age = calculateAge(dob);
  if (age === null) return "—";
  return `${age} tahun`;
}

/** Return a relative time string in Bahasa Melayu (e.g. "5 minit yang lalu"). */
export function timeAgo(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "—";
  const now = new Date();
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);
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
  const now = new Date();
  const kl = new Date(now.toLocaleString("en-US", { timeZone: KL_TIMEZONE }));
  kl.setHours(0, 0, 0, 0);
  return kl;
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
