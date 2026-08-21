"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "cmdk";

interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Pilih...",
  searchPlaceholder = "Cari...",
  emptyText = "Tiada padanan.",
  className,
  disabled = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selectedLabel = options.find((opt) => opt.value === value)?.label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={placeholder}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-medium h-10",
            "rounded-xl border bg-[var(--card)]",
            "hover:shadow-md",
            "focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30 focus-visible:border-[var(--primary)]",
            "transition-all duration-200",
            className
          )}
          style={{
            borderColor: open
              ? "var(--primary)"
              : "var(--border-medium)",
            color: selectedLabel
              ? "var(--text-primary)"
              : "var(--text-secondary)",
            boxShadow: open
              ? "0 0 0 3px rgba(24,119,242,0.12)"
              : undefined,
          }}
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <ChevronsUpDown
            className={cn(
              "ml-2 h-4 w-4 shrink-0 transition-all duration-200",
              open
                ? "text-[var(--primary)] scale-110"
                : "text-[var(--text-muted)]"
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-1.5 rounded-xl overflow-hidden"
        style={{ width: "var(--radix-popover-trigger-width)" }}
        align="start"
      >
        <Command
          className="w-full min-w-0"
          style={{ width: "100%" }}
          filter={(value, search) => {
            if (value.toLowerCase().includes(search.toLowerCase())) return 1;
            return 0;
          }}
        >
          <div className="relative w-full [&_[cmdk-input-wrapper]]:w-full [&_[cmdk-input-wrapper]]:rounded-lg [&_[cmdk-input-wrapper]]:bg-[var(--bg-secondary)] [&_[cmdk-input-wrapper]]:border-0 [&_[cmdk-input-wrapper]]:h-10 [&_[cmdk-input-wrapper]]:pl-9 [&_[cmdk-input-wrapper]]:pr-3 [&_[cmdk-input-wrapper]]:shadow-none [&_[cmdk-input-wrapper]]:focus-within:ring-1 [&_[cmdk-input-wrapper]]:focus-within:ring-[var(--primary)]/20 [&_[cmdk-input]]:text-sm [&_[cmdk-input]]:font-medium [&_[cmdk-input]]:placeholder:text-[var(--text-muted)]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)] pointer-events-none" />
            <CommandInput
              placeholder={searchPlaceholder}
              className="h-10 w-full"
            />
          </div>
          <CommandSeparator className="my-1" />
          <CommandList className="max-h-72 overflow-y-auto scrollbar-thin">
            <CommandEmpty className="flex flex-col items-center justify-center py-8 gap-1.5 text-sm text-[var(--text-muted)]">
              {emptyText}
            </CommandEmpty>
            <CommandGroup className="py-1">
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => {
                    onValueChange(opt.value === value ? "" : opt.value);
                    setOpen(false);
                  }}
                  className="relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2.5 text-sm outline-none transition-all duration-150 hover:bg-[var(--bg-accent-blue)] data-[selected=true]:bg-[var(--bg-accent-blue)] data-[selected=true]:shadow-sm"
                  style={{
                    color:
                      value === opt.value
                        ? "var(--primary)"
                        : "var(--text-primary)",
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0 transition-opacity duration-150",
                      value === opt.value
                        ? "opacity-100 text-[var(--primary)]"
                        : "opacity-0"
                    )}
                  />
                  <span className="truncate">{opt.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
