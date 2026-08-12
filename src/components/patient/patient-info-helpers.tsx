/**
 * Helper components untuk PatientDetailPage.
 * - InfoField: medan maklumat pesakit (label + nilai)
 * - StatCardMini: kad statistik kecil
 */
import type { LucideIcon } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface InfoFieldProps {
  icon: LucideIcon;
  label: string;
  value: string | null | undefined;
  block?: boolean;
}

export function InfoField({ icon: Icon, label, value, block }: InfoFieldProps) {
  const display =
    value && value.trim() ? (
      value
    ) : (
      <em style={{ color: "var(--text-muted)" }}>-</em>
    );

  return (
    <div
      className={
        block
          ? "flex items-start gap-3"
          : "grid grid-cols-[20px_1fr] items-center gap-3"
      }
    >
      <div
        className="w-5 h-5 flex items-center justify-center flex-shrink-0"
        style={block ? { marginTop: 2 } : undefined}
      >
        <Icon className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
      </div>
      <div className="min-w-0">
        <p
          className="text-2xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}
        >
          {label}
        </p>
        <p
          className="text-sm font-medium mt-0.5 break-words"
          style={{ color: "var(--text-primary)" }}
        >
          {display}
        </p>
      </div>
    </div>
  );
}

interface StatCardMiniProps {
  icon: LucideIcon;
  color: string;
  label: string;
  value: number | string | null;
  isText?: boolean;
}

export function StatCardMini({
  icon: Icon,
  color,
  label,
  value,
  isText,
}: StatCardMiniProps) {
  return (
    <div
      className="rounded-2xl p-3"
      style={{
        background: "var(--card)",
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}15`, color }}
        >
          <Icon className="w-5 h-5 sm:w-4 sm:h-4" strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="text-2xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-secondary)" }}
          >
            {label}
          </p>
          <p
            className={isText ? "text-sm font-semibold" : "text-lg font-extrabold"}
            style={{ color: "var(--text-primary)" }}
          >
            {isText && typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}/)
              ? formatDate(value)
              : value}
          </p>
        </div>
      </div>
    </div>
  );
}
