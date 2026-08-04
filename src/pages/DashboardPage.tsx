/**
 * DashboardPage — Papan Pemuka (Command Center)
 */
import { useMemo } from "react";
import {
  Activity,
  Users,
  Package,
  TrendingUp,
  AlertTriangle,
  Calendar,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { StatCard } from "@/components/dashboard/stat-card";
import { ExpiryBadge, ExpirySummaryBadges } from "@/components/dashboard/expiry-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDashboardStats,
  useExpiryDashboard,
  getExpiryStatus,
  getExpiryItem,
  type ExpiryBatch,
  type ExpiryStatus,
} from "@/hooks/use-dashboard-stats";
import { formatDate, formatItemDisplay, toTitleCase } from "@/lib/utils";
import type { UserRole } from "@/types";

const ROLE_LABELS: Record<UserRole, string> = {
  Pentadbir: "Pentadbir",
  "Penjaga Stor": "Penjaga Stor",
  "Kakitangan Farmasi": "Kakitangan Farmasi",
  "Kakitangan Klinik": "Kakitangan Klinik",
};

const ROLE_LABEL_COLORS: Record<UserRole, { bg: string; text: string; border: string }> = {
  Pentadbir: { bg: "rgba(124,58,237,0.08)", text: "#7c3aed", border: "rgba(124,58,237,0.20)" },
  "Penjaga Stor": { bg: "rgba(5,150,105,0.08)", text: "#059669", border: "rgba(5,150,105,0.20)" },
  "Kakitangan Farmasi": { bg: "rgba(24,119,242,0.08)", text: "#1877f2", border: "rgba(24,119,242,0.20)" },
  "Kakitangan Klinik": { bg: "rgba(217,119,6,0.08)", text: "#d97706", border: "rgba(217,119,6,0.20)" },
};

interface DashboardStats { totalPatients: number; totalItems: number; supplyToday: number; expiringSoon: number; totalStock: number; lowStockCount: number; }

interface StatCardConfig {
  key: string; title: string; subtitle: string; icon: LucideIcon; gradient: [string, string];
  roles: UserRole[]; getValue: (stats: DashboardStats) => number; href?: string;
}

const ALL_CARDS: StatCardConfig[] = [
  { key: "patients", title: "Pesakit Aktif", subtitle: "Jumlah pesakit dalam sistem", icon: Users, gradient: ["#2563eb", "#3b82f6"], roles: ["Pentadbir", "Penjaga Stor", "Kakitangan Farmasi", "Kakitangan Klinik"], getValue: (s) => s.totalPatients, href: "/pesakit" },
  { key: "items", title: "Item Ubatan", subtitle: "Jumlah item dalam katalog", icon: Package, gradient: ["#059669", "#10b981"], roles: ["Pentadbir", "Penjaga Stor", "Kakitangan Farmasi"], getValue: (s) => s.totalItems, href: "/stok" },
  { key: "supply", title: "Bekalan Hari Ini", subtitle: "Pembekalan yang dilakukan hari ini", icon: TrendingUp, gradient: ["#7c3aed", "#8b5cf6"], roles: ["Pentadbir", "Penjaga Stor", "Kakitangan Farmasi", "Kakitangan Klinik"], getValue: (s) => s.supplyToday, href: "/laporan?tab=transactions&date=today" },
  { key: "expiry", title: "Akan Luput (30 Hari)", subtitle: "Kelompok yang akan tamat tempoh", icon: AlertTriangle, gradient: ["#ea580c", "#f97316"], roles: ["Pentadbir", "Penjaga Stor", "Kakitangan Farmasi", "Kakitangan Klinik"], getValue: (s) => s.expiringSoon, href: "/laporan?tab=expiry&days=30" },
  { key: "stock", title: "Jumlah Stok", subtitle: "Unit stok tersedia", icon: Package, gradient: ["#0891b2", "#06b6d4"], roles: ["Pentadbir", "Penjaga Stor", "Kakitangan Klinik"], getValue: (s) => s.totalStock, href: "/stok" },
  { key: "lowStock", title: "Stok Rendah", subtitle: "Item di bawah keperluan 4 minggu", icon: AlertTriangle, gradient: ["#dc2626", "#ef4444"], roles: ["Pentadbir", "Penjaga Stor", "Kakitangan Farmasi"], getValue: (s) => s.lowStockCount, href: "/laporan?tab=low-stock" },
];

const STATUS_BG: Record<ExpiryStatus, string> = { critical: "rgba(254,226,226,0.4)", warning: "rgba(254,215,170,0.3)", safe: "transparent" };
const STATUS_TEXT_COLOR: Record<ExpiryStatus, string> = { critical: "var(--destructive)", warning: "var(--warning)", safe: "var(--success)" };

function PulsingDot({ color = "#16a34a" }: { color?: string }) {
  return <span className="rounded-full" style={{ width: 6, height: 6, background: color, boxShadow: `0 0 8px ${color}` }} />;
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const peranan = (profile?.peranan ?? "") as UserRole;
  const isStoreOrAdmin = peranan === "Pentadbir" || peranan === "Penjaga Stor";
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: expiryBatches, isLoading: expiryLoading } = useExpiryDashboard(isStoreOrAdmin);

  const statCards = useMemo(() => {
    if (!stats) return [];
    return ALL_CARDS.filter((c) => c.roles.includes(peranan)).map((c, idx) => ({ ...c, delay: 0.1 + idx * 0.04 }));
  }, [stats, peranan]);

  const expiryStats = useMemo(() => {
    if (!expiryBatches) return { critical: 0, warning: 0, safe: 0 };
    let critical = 0, warning = 0, safe = 0;
    for (const b of expiryBatches) {
      const { status } = getExpiryStatus(b.tarikh_luput);
      if (status === "critical") critical++; else if (status === "warning") warning++; else safe++;
    }
    return { critical, warning, safe };
  }, [expiryBatches]);

  const roleColors = ROLE_LABEL_COLORS[peranan];
  const roleLabel = ROLE_LABELS[peranan] || peranan;

  return (
    <div className="relative space-y-5">
      <Breadcrumb />

      <div className="flex flex-col items-start md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-[14px] flex items-center justify-center text-white flex-shrink-0" style={{ background: "linear-gradient(135deg, #1877f2, #0d5bd4)", boxShadow: "0 4px 12px rgba(24,119,242,0.3)" }}>
            <Activity className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold leading-tight truncate" style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Selamat Datang, {toTitleCase(profile?.nama ?? "Pengguna")}</h1>
            <p className="text-[13px] font-medium mt-0.5" style={{ color: "var(--text-secondary)" }}>{roleLabel} — Papan Pemuka</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {peranan && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: roleColors.bg, border: `1px solid ${roleColors.border}` }}>
              <PulsingDot color={roleColors.text} />
              <span className="text-xs font-semibold" style={{ color: roleColors.text }}>{roleLabel}</span>
            </div>
          )}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: "rgba(22,197,94,0.08)", border: "1px solid rgba(22,197,94,0.20)" }}>
            <PulsingDot color="#16a34a" />
            <span className="text-xs font-semibold" style={{ color: "#16a34a" }}>Sistem Beroperasi</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-5">
        {statsLoading && !stats ? Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid rgba(0,0,0,0.06)" }}>
            <div className="flex items-center gap-3">
              <Skeleton className="w-9 h-9 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-12" />
              </div>
            </div>
          </div>
        )) : statCards.map((card) => (
          <StatCard key={card.key} title={card.title} subtitle={card.subtitle} icon={card.icon} gradient={card.gradient} value={stats ? card.getValue(stats as DashboardStats) : 0} delay={card.delay} href={card.href} />
        ))}
      </div>

      {isStoreOrAdmin && (
        <div>
          <Card><CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-[11px] flex items-center justify-center text-white flex-shrink-0" style={{ background: "linear-gradient(135deg, #ea580c, #dc2626)", boxShadow: "0 4px 12px rgba(234,88,12,0.25)" }}>
                <Calendar className="w-4 h-4" strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-bold leading-tight" style={{ color: "var(--text-primary)" }}>Papan Pemuka Luput</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Pantau kelompok ubat yang akan tamat tempoh</p>
              </div>
            </div>
            <div className="mb-4"><ExpirySummaryBadges critical={expiryStats.critical} warning={expiryStats.warning} safe={expiryStats.safe} /></div>
            <div className="overflow-x-auto rounded-[14px]" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
              <table className="w-full border-collapse" style={{ background: "var(--card)" }}>
                <thead>
                  <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-light)" }}>
                    <th className="text-left px-3 py-2.5 text-2xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Nama Item</th>
                    <th className="text-left px-3 py-2.5 text-2xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Kelompok</th>
                    <th className="text-left px-3 py-2.5 text-2xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Tarikh Luput</th>
                    <th className="text-center px-3 py-2.5 text-2xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Stok</th>
                    <th className="text-center px-3 py-2.5 text-2xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Hari</th>
                    <th className="text-left px-3 py-2.5 text-2xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {!expiryLoading && expiryBatches?.map((batch) => {
                    const { status, daysLeft } = getExpiryStatus(batch.tarikh_luput);
                    const item = getExpiryItem(batch);
                    return <ExpiryRow key={batch.id} batch={batch} item={item} status={status} daysLeft={daysLeft} />;
                  })}
                  {!expiryLoading && expiryBatches && expiryBatches.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-sm" style={{ color: "var(--text-secondary)" }}>Tiada kelompok ubat ditemui.</td></tr>
                  )}
                  {expiryLoading && Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={6} className="px-3 py-3"><Skeleton className="h-4 w-full" /></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent></Card>
        </div>
      )}

      {statsLoading && !stats && <div className="text-center py-4"><Skeleton className="h-4 w-48 mx-auto" /></div>}
    </div>
  );
}

interface ExpiryRowProps { batch: ExpiryBatch; item: ReturnType<typeof getExpiryItem>; status: ExpiryStatus; daysLeft: number; }

function ExpiryRow({ batch, item, status, daysLeft }: ExpiryRowProps) {
  return (
    <tr style={{ background: STATUS_BG[status], borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
      <td className="px-3 py-2.5 text-xs"><div className="font-semibold" style={{ color: "var(--text-primary)" }}>{formatItemDisplay(item) || "—"}</div>{item?.kod_item && <div className="text-2xs" style={{ color: "var(--text-secondary)" }}>{item.kod_item}</div>}</td>
      <td className="px-3 py-2.5 text-xs font-mono" style={{ color: "var(--text-primary)" }}>{batch.nombor_kelompok}</td>
      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--text-primary)" }}>{formatDate(batch.tarikh_luput)}</td>
      <td className="px-3 py-2.5 text-xs text-center font-semibold" style={{ color: "var(--text-primary)" }}>{batch.kuantiti.toLocaleString("ms-MY")}</td>
      <td className="px-3 py-2.5 text-xs text-center font-semibold" style={{ color: STATUS_TEXT_COLOR[status] }}>{daysLeft < 0 ? "Luput" : `${daysLeft} hari`}</td>
      <td className="px-3 py-2.5"><ExpiryBadge status={status} size="sm" /></td>
    </tr>
  );
}
