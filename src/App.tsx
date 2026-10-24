import { useEffect } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Link,
  useRouteError,
} from "react-router-dom";
import { QueryProvider } from "@/lib/query-provider";
import { hydrateAuth, useAuthStore } from "@/lib/auth-store";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/permissions";
import { Toaster } from "sonner";
import { ErrorBoundary } from "@/components/error-boundary";

// Pages
import LoginPage from "@/pages/LoginPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import DashboardPage from "@/pages/DashboardPage";
import PatientListPage from "@/pages/PatientListPage";
import PatientDetailPage from "@/pages/PatientDetailPage";
import QuickDispensePage from "@/pages/QuickDispensePage";
import StockListPage from "@/pages/StockListPage";
import StockDetailPage from "@/pages/StockDetailPage";
import ReportPage from "@/pages/ReportPage";
import ManagementPage from "@/pages/ManagementPage";
import ProfilePage from "@/pages/ProfilePage";
import CopyrightPage from "@/pages/CopyrightPage";
import type { PermissionAction } from "@/types";

/** UI ralat peringkat route — ganti skrin putih dengan pemulihan. */
function RouteError() {
  const error = useRouteError() as { message?: string } | null;
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-xl font-bold">Halaman gagal dimuatkan</h1>
        <p className="text-sm text-muted-foreground">
          {error?.message || "Ralat tidak dijangka. Sila cuba semula."}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="min-h-11 px-4 rounded-xl text-sm font-semibold text-white"
            style={{ background: "#1877f2" }}
          >
            Muat Semula
          </button>
          <Link
            to="/"
            className="min-h-11 inline-flex items-center px-4 rounded-xl text-sm font-semibold border"
          >
            Papan Pemuka
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Halaman 404 — ganti redirect senyap ke "/" (audit: topeng pepijat). */
function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-xl font-bold">Halaman tidak dijumpai (404)</h1>
        <p className="text-sm text-muted-foreground">
          Pautan yang anda ikuti mungkin salah atau telah dialihkan.
        </p>
        <Link
          to="/"
          className="min-h-11 inline-flex items-center px-4 rounded-xl text-sm font-semibold text-white"
          style={{ background: "#1877f2" }}
        >
          Kembali ke Papan Pemuka
        </Link>
      </div>
    </div>
  );
}

/** Auth-required wrapper. Redirects to /login if no profile. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { profile, loading, initialized } = useAuth();

  if (!initialized || loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--background)" }}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

/** Role-required wrapper. Shows nothing if user lacks the required permission. */
function RequirePermission({
  permission,
  children,
}: {
  permission: PermissionAction;
  children: React.ReactNode;
}) {
  const { role } = useAuth();
  if (!hasPermission(role, permission)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

/** Already-authenticated users skip /login. */
function RedirectIfAuth({ children }: { children: React.ReactNode }) {
  const { profile, loading, initialized } = useAuth();
  if (!initialized || loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#0a0e27" }}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/30 border-t-white" />
      </div>
    );
  }
  if (profile) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

const router = createBrowserRouter([
  // Public routes
  {
    path: "/login",
    element: (
      <RedirectIfAuth>
        <LoginPage />
      </RedirectIfAuth>
    ),
  },
  {
    path: "/lupa-kata-laluan",
    element: (
      <RedirectIfAuth>
        <ForgotPasswordPage />
      </RedirectIfAuth>
    ),
  },
  // Protected dashboard routes
  {
    path: "/",
    errorElement: <RouteError />,
    element: (
      <RequireAuth>
        <DashboardLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "pesakit", element: <PatientListPage /> },
      { path: "pesakit/:id", element: <PatientDetailPage /> },
      {
        path: "pantas",
        element: (
          <RequirePermission permission="manage_supply">
            <QuickDispensePage />
          </RequirePermission>
        ),
      },
      {
        path: "stok",
        element: (
          <RequirePermission permission="view_items">
            <StockListPage />
          </RequirePermission>
        ),
      },
      {
        path: "stok/:id",
        element: (
          <RequirePermission permission="view_items">
            <StockDetailPage />
          </RequirePermission>
        ),
      },
      {
        path: "laporan",
        element: (
          <RequirePermission permission="view_reports">
            <ReportPage />
          </RequirePermission>
        ),
      },
      {
        path: "pengurusan",
        element: (
          <RequirePermission permission="manage_users">
            <ManagementPage />
          </RequirePermission>
        ),
      },
      { path: "profil", element: <ProfilePage /> },
      { path: "hakcipta", element: <CopyrightPage /> },
    ],
  },
  // Catch-all — 404 eksplisit (bukan redirect senyap)
  { path: "*", element: <NotFoundPage /> },
]);

function App() {
  // Hydrate auth on mount
  useEffect(() => {
    hydrateAuth();
  }, []);

  // LOW-4: semakan hayat sesi berkala — jika kata laluan ditukar di tempat
  // lain / akaun dinyahaktifkan, refreshProfile kini membersihkan sesi mati
  // (cth. kembali ke tab selepas semalaman) dan RequireAuth menghantar ke
  // log masuk dengan mesej yang jelas, bukan ralat RLS misteri.
  useEffect(() => {
    const check = () => {
      if (useAuthStore.getState().profile) {
        void useAuthStore.getState().refreshProfile();
      }
    };
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    const timer = setInterval(check, 5 * 60 * 1000);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(timer);
    };
  }, []);

  return (
    <QueryProvider>
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
      {/* Global Toaster */}
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
    </QueryProvider>
  );
}

export default App;
