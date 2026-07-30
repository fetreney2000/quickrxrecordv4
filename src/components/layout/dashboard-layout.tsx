import { type ReactNode, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { MobileNav } from "./mobile-nav";
import { Toaster } from "sonner";

export function DashboardLayout() {
  const { profile, loading, initialized } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Auth gate
  useEffect(() => {
    if (initialized && !loading && !profile) {
      navigate("/login", { replace: true });
    }
  }, [initialized, loading, profile, navigate]);

  // Show full-page spinner while initial auth state is being resolved
  if (!initialized || loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--background)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2
            className="h-10 w-10 text-primary animate-spin"
            strokeWidth={2.5}
          />
          <p className="text-sm text-muted-foreground">Memuatkan...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, render nothing while useEffect navigates away
  if (!profile) return null;

  return (
    <div className="min-h-screen bg-background">
      <style>{`
        @keyframes contentOrb1 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(30px, -20px); }
        }
        @keyframes contentOrb2 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-25px, 15px); }
        }
        @keyframes contentOrb3 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(20px, 25px); }
        }
        @-webkit-keyframes contentOrb1 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(30px, -20px); }
        }
        @-webkit-keyframes contentOrb2 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-25px, 15px); }
        }
        @-webkit-keyframes contentOrb3 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(20px, 25px); }
        }
        .content-orb-1 { animation: contentOrb1 20s ease-in-out infinite; -webkit-animation: contentOrb1 20s ease-in-out infinite; }
        .content-orb-2 { animation: contentOrb2 25s ease-in-out infinite; -webkit-animation: contentOrb2 25s ease-in-out infinite; }
        .content-orb-3 { animation: contentOrb3 18s ease-in-out infinite; -webkit-animation: contentOrb3 18s ease-in-out infinite; }
      `}</style>

      {/* Background orbs (fixed behind content) */}
      <div
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
        aria-hidden
      >
        <div
          className="content-orb-1 absolute rounded-full"
          style={{
            width: 400,
            height: 400,
            top: "5%",
            right: "10%",
            background: "rgba(24,119,242,0.04)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="content-orb-2 absolute rounded-full"
          style={{
            width: 350,
            height: 350,
            bottom: "10%",
            left: "15%",
            background: "rgba(124,58,237,0.03)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="content-orb-3 absolute rounded-full"
          style={{
            width: 300,
            height: 300,
            top: "40%",
            left: "50%",
            background: "rgba(6,182,212,0.03)",
            filter: "blur(60px)",
          }}
        />
      </div>

      <Sidebar />

      <div
        className="relative z-10 flex flex-col min-h-screen md:ml-64"
      >
        <Header />
        <main
          key={location.pathname}
          className="flex-1 px-3 sm:px-4 md:px-6 py-4 md:py-6 pb-20 md:pb-6 animate-fade-in"
        >
          <Outlet />
        </main>
      </div>

      <MobileNav />

      {/* Toaster for dashboard context */}
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          classNames: {
            toast: "rounded-2xl shadow-card",
          },
        }}
      />
    </div>
  );
}
