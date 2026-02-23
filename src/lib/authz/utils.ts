import { ADMIN_PERMISSIONS, STAFF_DEFAULT_PERMISSIONS } from '@/lib/permission-presets';
import type { PermissionMap, Role, UserPermissions, UserProfile } from '@/lib/authz/types';

export function normalizePermissions(role: Role, value: unknown): PermissionMap {
  const base = role === 'admin' ? ADMIN_PERMISSIONS : STAFF_DEFAULT_PERMISSIONS;
  const obj = typeof value === 'object' && value ? (value as Partial<PermissionMap>) : {};
  const merged: PermissionMap = { ...base };
  for (const key of Object.keys(merged) as Array<keyof PermissionMap>) {
    if (typeof obj[key] === 'boolean') merged[key] = obj[key] as boolean;
  }
  return role === 'admin' ? { ...ADMIN_PERMISSIONS } : merged;
}

export function profileToUserPermissions(profile: UserProfile | null, loading = false): UserPermissions {
  const role: Role = profile?.role ?? 'staff';
  const p = normalizePermissions(role, profile?.permissions);
  return {
    role,
    isAdmin: role === 'admin',
    isStaff: role === 'staff',
    profile,
    loading,
    can: {
      enterData: p.can_enter_data,
      editData: p.can_edit_data,
      deleteData: p.can_delete_data,
      importExcel: p.can_import_excel,
      exportData: p.can_export_data,
      viewAnalytics: p.can_view_analytics,
      viewStreams: p.can_view_streams,
      viewAuditLog: p.can_view_audit_log,
      manageUsers: p.can_manage_users,
      manageSettings: p.can_manage_settings,
      viewMptDetail: p.can_view_mpt_detail,
      viewSznb: p.can_view_sznb,
      viewInternational: p.can_view_international,
      viewTelecom: p.can_view_telecom,
      viewFlow: p.can_view_flow,
    },
  };
}
