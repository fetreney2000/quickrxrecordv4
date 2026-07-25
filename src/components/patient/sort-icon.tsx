/**
 * SortIcon — Ikon untuk pengepala jadual pesakit yang boleh diisih.
 * - Tidak aktif: ArrowUpDown (kelegapan 0.3)
 * - Aktif asc: ChevronUp (biru)
 * - Aktif desc: ChevronDown (biru)
 */
import { memo } from "react";
import { ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
import type { SortDir } from "@/hooks/use-patients";

interface SortIconProps {
  active: boolean;
  dir: SortDir;
}

export const SortIcon = memo(function SortIcon({ active, dir }: SortIconProps) {
  if (!active) {
    return (
      <ArrowUpDown
        className="w-3 h-3"
        style={{ opacity: 0.3 }}
      />
    );
  }
  if (dir === "asc") {
    return (
      <ChevronUp
        className="w-3 h-3"
        style={{ color: "#1877f2" }}
      />
    );
  }
  return (
    <ChevronDown
      className="w-3 h-3"
      style={{ color: "#1877f2" }}
    />
  );
});
