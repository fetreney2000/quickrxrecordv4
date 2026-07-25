import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Zap,
  Stethoscope,
  Pill,
  FileText,
  UserCog,
  User,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { PermissionAction } from "@/types";

interface NavItemConfig {
  label: string;
  href: string;
  icon: LucideIcon;
  color: string;
  permission?: PermissionAction;
}

const MOBILE_NAV_ITEMS: NavItemConfig[] = [
  { label: "Utama", href: "/", icon: LayoutDashboard, color: "#3b82f6" },
  {
    label: "Pantas",
    href: "/pantas",
    icon: Zap,
    color: "#f0932b",
    permission: "manage_supply",
  },
  {
    label: "Pesakit",
    href: "/pesakit",
    icon: Stethoscope,
    color: "#10b981",
    permission: "view_patients",
  },
  {
    label: "Inventori",
    href: "/stok",
    icon: Pill,
    color: "#8b5cf6",
    permission: "view_items",
  },
  {
    label: "Laporan",
    href: "/laporan",
    icon: FileText,
    color: "#f43f5e",
    permission: "view_reports",
  },
  {
    label: "Pengurusan",
    href: "/pengurusan",
    icon: UserCog,
    color: "#06b6d4",
    permission: "manage_users",
  },
  { label: "Profil", href: "/profil", icon: User, color: "#22c55e" },
  { label: "Hak Cipta", href: "/hakcipta", icon: Shield, color: "#f59e0b" },
];

export function MobileNav() {
  const { role } = useAuth();
  const location = useLocation();

  const visibleItems = MOBILE_NAV_ITEMS.filter(
    (item) => !item.permission || hasPermission(role, item.permission)
  );

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname === href || location.pathname.startsWith(href + "/");
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex"
      style={{
        height: 60,
        background:
          "linear-gradient(180deg, rgba(12,16,42,0.98) 0%, rgba(10,14,35,1) 100%)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderTop: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.3)",
      }}
    >
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        // Convert hex to rgba for the active background tint
        const tintBg = `${item.color}20`;
        const tintShadow = `${item.color}30`;
        return (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === "/"}
            className="mobile-nav-item relative"
            style={{ minWidth: 0 }}
          >
            {/* Top active indicator bar */}
            {active && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full"
                style={{
                  width: 20,
                  height: 2,
                  background: item.color,
                  boxShadow: `0 0 8px ${item.color}`,
                }}
              />
            )}

            <div
              className={cn(
                "flex items-center justify-center rounded-[10px] transition-all duration-200"
              )}
              style={{
                width: 36,
                height: 36,
                background: active ? tintBg : "transparent",
                boxShadow: active
                  ? `0 4px 12px ${tintShadow}`
                  : "none",
              }}
            >
              <Icon
                className="w-[18px] h-[18px]"
                strokeWidth={active ? 2.2 : 1.8}
                style={{
                  color: active ? item.color : "rgba(255,255,255,0.5)",
                }}
              />
            </div>
          </NavLink>
        );
      })}
    </nav>
  );
}
