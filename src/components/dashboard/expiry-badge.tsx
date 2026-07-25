/**
 * ExpiryBadge — Lencana status untuk kelompok yang akan/sudah luput.
 *
 * 3 kategori:
 *  - critical: <30 hari (atau sudah luput) → merah
 *  - warning:  30-90 hari → oren
 *  - safe:     >90 hari → hijau
 */
import { cn } from "@/lib/utils";
import type { ExpiryStatus } from "@/hooks/use-dashboard-stats";

interface ExpiryBadgeProps {
  status: ExpiryStatus;
  className?: string;
  size?: "sm" | "md";
}

const CONFIG: Record<
  ExpiryStatus,
  { label: string; dot: string; text: string; bg: string; border: string }
> = {
  critical: {
    label: "Kritikal",
    dot: "#dc2626",
    text: "#dc2626",
    bg: "rgba(220,38,38,0.08)",
    border: "rgba(220,38,38,0.20)",
  },
  warning: {
    label: "Amaran",
    dot: "#ea580c",
    text: "#ea580c",
    bg: "rgba(234,88,12,0.08)",
    border: "rgba(234,88,12,0.20)",
  },
  safe: {
    label: "Selamat",
    dot: "#16a34a",
    text: "#16a34a",
    bg: "rgba(22,197,94,0.06)",
    border: "rgba(22,197,94,0.15)",
  },
};

export function ExpiryBadge({
  status,
  className,
  size = "md",
}: ExpiryBadgeProps) {
  const cfg = CONFIG[status];
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full",
        size === "sm" ? "px-1.5 py-0.5 text-2xs" : "px-2 py-0.5 text-2xs",
        className
      )}
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
      }}
    >
      <span
        className="rounded-full"
        style={{
          width: 6,
          height: 6,
          background: cfg.dot,
          boxShadow: `0 0 6px ${cfg.dot}`,
        }}
      />
      <span
        className="font-semibold uppercase tracking-wider"
        style={{ color: cfg.text }}
      >
        {cfg.label}
      </span>
    </div>
  );
}

/**
 * ExpirySummaryBadges — Tiga lencana ringkasan untuk
 * dashboard luput (Kritikal / Amaran / Selamat).
 */
interface ExpirySummaryBadgesProps {
  critical: number;
  warning: number;
  safe: number;
}

export function ExpirySummaryBadges({
  critical,
  warning,
  safe,
}: ExpirySummaryBadgesProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <SummaryBadge
        status="critical"
        label="Kritikal (<30 hari)"
        count={critical}
      />
      <SummaryBadge
        status="warning"
        label="Amaran (30-90 hari)"
        count={warning}
      />
      <SummaryBadge
        status="safe"
        label="Selamat (>90 hari)"
        count={safe}
      />
    </div>
  );
}

function SummaryBadge({
  status,
  label,
  count,
}: {
  status: ExpiryStatus;
  label: string;
  count: number;
}) {
  const cfg = CONFIG[status];
  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl"
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
      }}
    >
      <span
        className="rounded-full flex-shrink-0"
        style={{
          width: 8,
          height: 8,
          background: cfg.dot,
          boxShadow: `0 0 8px ${cfg.dot}`,
        }}
      />
      <span
        className="text-2xs font-semibold uppercase tracking-wider"
        style={{ color: cfg.text }}
      >
        {label}
      </span>
      <span
        className="text-base font-extrabold"
        style={{ color: cfg.text, letterSpacing: "-0.02em" }}
      >
        {count.toLocaleString("ms-MY")}
      </span>
    </div>
  );
}
