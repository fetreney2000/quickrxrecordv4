import { useAuthStore } from "@/lib/auth-store";
import { hasPermission } from "@/lib/permissions";
import type { PermissionAction } from "@/types";

/**
 * Convenience hook wrapping the auth store.
 * Returns the profile, loading state, and helpers.
 */
export function useAuth() {
  const profile = useAuthStore((s) => s.profile);
  const loading = useAuthStore((s) => s.loading);
  const initialized = useAuthStore((s) => s.initialized);
  const signIn = useAuthStore((s) => s.signIn);
  const signOut = useAuthStore((s) => s.signOut);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);

  return {
    profile,
    role: profile?.peranan ?? null,
    loading,
    initialized,
    isAuthenticated: !!profile,
    signIn,
    signOut,
    refreshProfile,
    can: (action: PermissionAction) => hasPermission(profile?.peranan, action),
  };
}
