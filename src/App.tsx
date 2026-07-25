import { useEffect } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
import { QueryProvider } from "@/lib/query-provider";
import { hydrateAuth } from "@/lib/auth-store";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/permissions";
import { Toaster } from "sonner";

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

/** Auth-required wrapper. Redirects to /login if no profile. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { profile, loading, initialized } = useAuth();

  if (!initialized || loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#f0f2f5" }}
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
  // Catch-all
  { path: "*", element: <Navigate to="/" replace /> },
]);

function App() {
  // Hydrate auth on mount
  useEffect(() => {
    hydrateAuth();
  }, []);

  return (
    <QueryProvider>
      <RouterProvider router={router} />
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
