import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

/**
 * DateInput — Pemilih tarikh (kalendar shadcn) dengan kontrak
 * `value` bertype YYYY-MM-DD / `onChange(value: string)` (masih YYYY-MM-DD),
 * serasi dengan komponen lama untuk semua kedudukan penggunaan sedia ada.
 */
export interface DateInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void; // selalu YYYY-MM-DD
  /** Placeholder paparan (lalai "Pilih tarikh"). */
  placeholder?: string;
}

const toDateFromISO = (v: string): Date | undefined => {
  if (!v) return undefined;
  const d = new Date(`${v}T12:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const isoFromDate = (d: Date | undefined): string => {
  if (!d) return "";
  return format(d, "yyyy-MM-dd");
};

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  (
    { value, onChange, className, placeholder, min, max, disabled, ...props },
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
            <Input
              ref={ref}
              readOnly
              disabled={disabled}
              value={selected ? format(selected, "dd/MM/yyyy") : ""}
              placeholder={placeholder ?? "Pilih tarikh"}
              className="cursor-pointer pr-8"
              onClick={() => setOpen(true)}
              {...props}
            />
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
              fromDate={minDate}
              toDate={maxDate}
              autoFocus
            />
          </PopoverContent>
        </Popover>
        <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    );
  }
);
DateInput.displayName = "DateInput";