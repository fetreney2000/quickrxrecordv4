import type { PermissionAction, UserRole } from "@/types";

export const PERMISSIONS: Record<UserRole, PermissionAction[]> = {
  Pentadbir: [
    "manage_users",
    "manage_items",
    "manage_patients",
    "manage_supply",
    "view_reports",
    "export_reports",
    "merge_patients",
    "manage_batches",
    "view_items",
    "view_patients",
    "manage_assignments",
  ],
  "Penjaga Stor": [
    "manage_items",
    "manage_patients",
    "manage_supply",
    "view_reports",
    "export_reports",
    "merge_patients",
    "manage_batches",
    "view_items",
    "view_patients",
    "manage_assignments",
  ],
  "Kakitangan Farmasi": [
    "manage_patients",
    "manage_supply",
    "view_reports",
    "export_reports",
    "view_items",
    "view_patients",
    "manage_assignments",
  ],
  "Kakitangan Klinik": ["view_items", "view_patients"],
};

/**
 * Check whether a user role has a specific permission.
 */
export function hasPermission(
  role: UserRole | null | undefined,
  action: PermissionAction
): boolean {
  if (!role) return false;
  const perms = PERMISSIONS[role];
  if (!perms) return false;
  return perms.includes(action);
}

/**
 * Check whether the role has any of the provided actions.
 */
export function hasAnyPermission(
  role: UserRole | null | undefined,
  actions: PermissionAction[]
): boolean {
  return actions.some((a) => hasPermission(role, a));
}
