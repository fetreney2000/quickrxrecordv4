import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  LayoutDashboard,
  Zap,
  Stethoscope,
  Pill,
  FileText,
  UserCog,
  Shield,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/permissions";
import { getInitials, cn } from "@/lib/utils";
import type { PermissionAction } from "@/types";

interface NavItemConfig {
  label: string;
  href: string;
  icon: LucideIcon;
  color: string;
  permission?: PermissionAction;
}

const NAV_ITEMS: NavItemConfig[] = [
  {
    label: "Papan Pemuka",
    href: "/",
    icon: LayoutDashboard,
    color: "#3b82f6",
  },
  {
    label: "Dispen Pantas",
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
  {
    label: "Hak Cipta",
    href: "/hakcipta",
    icon: Shield,
    color: "#f59e0b",
  },
];

export function Sidebar() {
  const { profile, role, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.permission || hasPermission(role, item.permission)
  );

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname === href || location.pathname.startsWith(href + "/");
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <>
      <style>{`
        @keyframes sidebarOrbFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(20px, -30px) scale(1.05); }
        }
        @keyframes sidebarOrbFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-15px, 20px) scale(1.03); }
        }
        @keyframes sidebarOrbFloat3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(25px, -10px) scale(1.04); }
        }
        @-webkit-keyframes sidebarOrbFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(20px, -30px) scale(1.05); }
        }
        @-webkit-keyframes sidebarOrbFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-15px, 20px) scale(1.03); }
        }
        @-webkit-keyframes sidebarOrbFloat3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(25px, -10px) scale(1.04); }
        }
        .sidebar-orb-1 { animation: sidebarOrbFloat1 20s ease-in-out infinite; -webkit-animation: sidebarOrbFloat1 20s ease-in-out infinite; }
        .sidebar-orb-2 { animation: sidebarOrbFloat2 25s ease-in-out infinite; -webkit-animation: sidebarOrbFloat2 25s ease-in-out infinite; }
        .sidebar-orb-3 { animation: sidebarOrbFloat3 18s ease-in-out infinite; -webkit-animation: sidebarOrbFloat3 18s ease-in-out infinite; }
      `}</style>
      <aside
        className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-64 z-50"
        style={{
          background:
            "linear-gradient(180deg, #0c1329 0%, #0a0e27 50%, #0d1117 100%)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "4px 0 24px rgba(0,0,0,0.2)",
        }}
      >
        {/* Orbs */}
        <div
          className="sidebar-orb-1 pointer-events-none absolute rounded-full"
          style={{
            width: 300,
            height: 300,
            top: -50,
            left: -100,
            background: "var(--bg-accent-blue)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="sidebar-orb-2 pointer-events-none absolute rounded-full"
          style={{
            width: 250,
            height: 250,
            bottom: 50,
            right: -80,
            background: "rgba(124,58,237,0.10)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="sidebar-orb-3 pointer-events-none absolute rounded-full"
          style={{
            width: 200,
            height: 200,
            bottom: 200,
            left: 20,
            background: "rgba(6,182,212,0.10)",
            filter: "blur(60px)",
          }}
        />

        {/* Logo section */}
        <div className="relative px-5 py-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #1877f2, #0d5bd4)",
                boxShadow: "0 4px 12px rgba(24,119,242,0.4)",
              }}
            >
              <Activity className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-white font-bold text-[15px] leading-tight">
                  QuickRxRecord
                </h1>
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                  style={{
                    background: "rgba(24,119,242,0.2)",
                    color: "#60a5fa",
                  }}
                >
                  v4
                </span>
              </div>
              <p className="text-[10px] text-white/45 leading-tight mt-0.5">
                Jabatan Farmasi Hospital Keningau
              </p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="relative flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href === "/"}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium relative transition-all duration-200",
                  active
                    ? "text-[#60a5fa]"
                    : "text-white/55 hover:text-white hover:bg-white/[0.06]"
                )}
                style={
                  active
                    ? {
                        background: "rgba(24,119,242,0.1)",
                        boxShadow: "0 0 0 1px rgba(24,119,242,0.3) inset",
                      }
                    : undefined
                }
              >
                {/* Active dot indicator */}
                {active && (
                  <span
                    className="absolute right-3 w-1.5 h-1.5 rounded-full"
                    style={{
                      background: "#1877f2",
                      boxShadow:
                        "0 0 8px rgba(24,119,242,0.8), 0 0 12px rgba(24,119,242,0.5)",
                    }}
                  />
                )}

                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
                  style={
                    active
                      ? {
                          background: item.color,
                          boxShadow: `0 4px 12px ${item.color}66`,
                        }
                      : { background: "rgba(255,255,255,0.05)" }
                  }
                >
                  <Icon
                    className="w-4 h-4"
                    strokeWidth={active ? 2.2 : 1.8}
                    style={{ color: active ? "white" : "rgba(255,255,255,0.7)" }}
                  />
                </div>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User profile section */}
        <div
          className="relative border-t border-white/5 p-3"
          style={{
            background:
              "linear-gradient(180deg, transparent, rgba(255,255,255,0.02))",
          }}
        >
          <button
            type="button"
            onClick={() => navigate("/profil")}
            className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.04] transition-colors"
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, #1877f2, #0d5bd4)",
              }}
            >
              {getInitials(profile?.nama)}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-white text-sm font-semibold truncate">
                {profile?.nama ?? "Pengguna"}
              </p>
              <p className="text-white/50 text-2xs truncate">
                {profile?.peranan ?? ""}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/70 text-sm transition-all hover:text-white"
            style={{}}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "rgba(228,30,63,0.15)";
              (e.currentTarget as HTMLElement).style.color = "#e41e3f";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)";
            }}
          >
            <LogOut className="w-4 h-4" />
            <span>Log Keluar</span>
          </button>
        </div>
      </aside>
    </>
  );
}
