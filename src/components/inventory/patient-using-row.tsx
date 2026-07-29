/**
 * PatientUsingRow — Baris pesakit yang menggunakan item (dengan penapis defaulter).
 */
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { formatDate, formatMyKad, getKLDate } from "@/lib/utils";

export interface PatientUsingData {
  id: string;
  patient_id: string;
  dos: string | null;
  tarikh_mula_guna: string;
  patient: {
    id: string;
    nama: string;
    nombor_kad_pengenalan: string | null;
    nombor_pendaftaran_hospital: string | null;
  } | null;
  last_supply: {
    tarikh: string;
    qty: number;
  } | null;
}

interface PatientUsingRowProps {
  data: PatientUsingData;
  index: number;
  itemName?: string;
  itemId?: string;
}

function monthsAgo(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return null;
  const now = getKLDate();
  const months =
    (now.getFullYear() - d.getFullYear()) * 12 +
    (now.getMonth() - d.getMonth());
  if (months < 0) return 0;
  return months;
}

function getStatus(data: PatientUsingData): {
  label: string;
  bg: string;
  fg: string;
  border: string;
  isDefaulter: boolean;
} {
  const m = monthsAgo(data.last_supply?.tarikh);
  if (m === null || m >= 3) {
    const label = m === null ? "Tiada Bekalan" : `Tercicir ${m} bln`;
    return {
      label,
      bg: "rgba(228,30,63,0.10)",
      fg: "#e41e3f",
      border: "rgba(228,30,63,0.25)",
      isDefaulter: true,
    };
  }
  return {
    label: "Aktif",
    bg: "rgba(22,163,74,0.10)",
    fg: "#16a34a",
    border: "rgba(22,163,74,0.25)",
    isDefaulter: false,
  };
}

export function PatientUsingRow({ data, index, itemName, itemId }: PatientUsingRowProps) {
  const navigate = useNavigate();
  const patient = data.patient;
  const status = getStatus(data);

  const handleClick = () => {
    if (patient) {
      const params = new URLSearchParams();
      if (itemName && itemId) {
        params.set("from", "item");
        params.set("item", itemName);
        params.set("itemId", itemId);
      }
      const qs = params.toString();
      navigate(`/pesakit/${patient.id}${qs ? `?${qs}` : ""}`);
    }
  };

  return (
    <>
      {/* Desktop row */}
      <div
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        className="hidden sm:grid px-4 py-2.5 items-center cursor-pointer transition-colors"
        style={{
          gridTemplateColumns: "2.5fr 1.8fr 1.2fr 1.5fr 1.2fr",
          gap: 12,
          borderBottom: "1px solid var(--border-light)",
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLElement).style.background =
            "rgba(124,58,237,0.03)")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLElement).style.background = "transparent")
        }
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
            }}
          >
            {patient?.nama?.[0]?.toUpperCase() || "?"}
          </div>
          <span className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {patient?.nama || "—"}
          </span>
        </div>
        <span className="text-[13px] truncate font-mono" style={{ color: "var(--text-secondary)" }}>
          {patient?.nombor_kad_pengenalan ? formatMyKad(patient.nombor_kad_pengenalan) : "—"}
        </span>
        <span className="text-[13px] font-semibold truncate" style={{ color: "#7c3aed" }}>
          {data.dos || <em style={{ color: "var(--text-muted)" }}>-</em>}
        </span>
        <span className="text-[13px]" style={{ color: "var(--text-primary)" }}>
          {data.last_supply ? (
            <span className="flex flex-col">
              <span>{formatDate(data.last_supply.tarikh)}</span>
              <span className="text-2xs" style={{ color: "var(--text-muted)" }}>{data.last_supply.qty} unit</span>
            </span>
          ) : (
            <em style={{ color: "var(--text-muted)" }}>-</em>
          )}
        </span>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold"
            style={{ background: status.bg, color: status.fg, border: `1px solid ${status.border}` }}>
            {status.label}
          </span>
          <ArrowRight className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
        </div>
      </div>

      {/* Mobile row */}
      <div
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        className="sm:hidden flex items-start gap-3 px-4 py-3 border-b border-[#f0f2f5] cursor-pointer"
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLElement).style.background = "rgba(124,58,237,0.03)")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLElement).style.background = "transparent")
        }
      >
        <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}>
          {patient?.nama?.[0]?.toUpperCase() || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium truncate" style={{ color: "var(--text-primary)" }}>{patient?.nama || "—"}</p>
          <div className="flex items-center gap-2 text-[12px] mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>
            {patient?.nombor_kad_pengenalan && <span className="font-mono">{formatMyKad(patient.nombor_kad_pengenalan)}</span>}
            {data.dos && <><span>·</span><span style={{ color: "#7c3aed" }} className="font-semibold">{data.dos}</span></>}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xs" style={{ color: "var(--text-muted)" }}>
              {data.last_supply ? `Terakhir: ${formatDate(data.last_supply.tarikh)}` : "Tiada bekalan"}
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-2xs font-semibold"
              style={{ background: status.bg, color: status.fg, border: `1px solid ${status.border}` }}>
              {status.label}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}