import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

/**
 * DateInput — Pemilih tarikh gaya "Date of Birth" shadcn: pencetus ialah Button
 * (ikon kalendar kiri + tarikh dipaparkan dd/MM/yyyy) yang membuka Popover
 * berisi Calendar dengan caption dropdown bulan/tahun.
 *
 * Kontrak (`value`) bertype YYYY-MM-DD / `onChange(value: string)` (masih
 * YYYY-MM-DD), serasi dengan komponen lama untuk semua kedudukan penggunaan
 * sedia ada.
 *
 * Nota gaya: `className` digunakan pada div pembalut (kedudukan), manakala
 * `style` dan atribut lain (cth. `id`, `onKeyDown`) dipindahkan ke trigger
 * `Button`.
 */
export interface DateInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void; // selalu YYYY-MM-DD
  /** Placeholder paparan (lalai "Pilih tarikh"). */
  placeholder?: string;
}

const START_YEAR = 1900;
const END_YEAR = new Date().getFullYear() + 10;

const toDateFromISO = (v: string): Date | undefined => {
  if (!v) return undefined;
  const d = new Date(`${v}T12:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const isoFromDate = (d: Date | undefined): string => {
  if (!d) return "";
  return format(d, "yyyy-MM-dd");
};

export const DateInput = React.forwardRef<HTMLButtonElement, DateInputProps>(
  (
    {
      value,
      onChange,
      className,
      placeholder,
      min,
      max,
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false);
    const selected = toDateFromISO(value);
    const minDate = min ? toDateFromISO(String(min)) : undefined;
    const maxDate = max ? toDateFromISO(String(max)) : undefined;

    const handleSelect = (d: Date | undefined) => {
      onChange(isoFromDate(d));
      setOpen(false);
    };

    return (
      <div className={cn("relative", className)}>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              ref={ref}
              type="button"
              variant="outline"
              disabled={disabled}
              aria-required={required || undefined}
              className="w-full justify-start pr-8 font-normal gap-2 text-xs"
              {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
            >
              <CalendarIcon className="h-4 w-4" />
              {selected ? (
                format(selected, "dd/MM/yyyy")
              ) : (
                <span className="text-muted-foreground">
                  {placeholder ?? "Pilih tarikh"}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            {value && (
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {selected ? format(selected, "EEEE, dd MMM yyyy") : ""}
                </span>
                <button
                  type="button"
                  title="Kosongkan tarikh"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" /> Kosong
                </button>
              </div>
            )}
            <Calendar
              mode="single"
              selected={selected}
              onSelect={handleSelect}
              captionLayout="dropdown"
              fromYear={START_YEAR}
              toYear={END_YEAR}
              fromDate={minDate}
              toDate={maxDate}
              autoFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  }
);
DateInput.displayName = "DateInput";
