import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * DateInput — Input tarikh yang sentiasa memaparkan dan menerima format
 * dd/mm/yyyy tanpa mengira tetapan bahasa/rantau peranti pengguna.
 *
 * Nilai komponen (`value`/`onChange`) kekal dalam format YYYY-MM-DD supaya
 * serasi dengan pengguna sedia ada; hanya paparan dan input menjadi dd/mm/yyyy.
 */
export interface DateInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void; // selalu YYYY-MM-DD
}

/** Tukar YYYY-MM-DD kepada paparan dd/mm/yyyy. */
function formatToDisplay(value: string): string {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

/** Tukar teks dd/mm/yyyy kepada YYYY-MM-DD (hanya jika lengkap dan sah). */
function displayToValue(text: string): string {
  const parts = text.split("/");
  if (parts.length !== 3) return "";
  const [d, m, y] = parts;
  if (d.length !== 2 || m.length !== 2 || y.length !== 4) return "";
  const dd = parseInt(d, 10);
  const mm = parseInt(m, 10);
  const yy = parseInt(y, 10);
  if (mm < 1 || mm > 12) return "";
  if (dd < 1 || dd > 31) return "";
  if (yy < 1000 || yy > 9999) return "";
  return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/** Topeng input: hanya digit, auto-sisipkan "/" pada kedudukan 2 dan 4. */
function maskInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i === 2 || i === 4) out += "/";
    out += digits[i];
  }
  return out;
}

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ value, onChange, className, onFocus, onBlur, ...props }, ref) => {
    const [text, setText] = React.useState(() => formatToDisplay(value));
    const focused = React.useRef(false);

    React.useEffect(() => {
      if (!focused.current) setText(formatToDisplay(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const masked = maskInput(e.target.value);
      setText(masked);
      const next = displayToValue(masked);
      if (next !== value) onChange(next);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      focused.current = true;
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      focused.current = false;
      setText(formatToDisplay(value));
      onBlur?.(e);
    };

    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={props.placeholder ?? "dd/mm/yyyy"}
        value={text}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn("tabular-nums", className)}
        {...props}
      />
    );
  }
);
DateInput.displayName = "DateInput";