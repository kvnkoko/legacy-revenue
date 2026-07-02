import { ADMIN_PERMISSIONS, ROLE_DEFAULT_PERMISSIONS } from '@/lib/permission-presets';
import type { PermissionMap, Role, UserPermissions, UserProfile } from '@/lib/authz/types';

export function normalizePermissions(role: Role, value: unknown): PermissionMap {
  if (role === 'admin') return { ...ADMIN_PERMISSIONS };
  const base = ROLE_DEFAULT_PERMISSIONS[role] ?? ROLE_DEFAULT_PERMISSIONS.viewer;
  const obj = typeof value === 'object' && value ? (value as Partial<PermissionMap>) : {};
  const merged: PermissionMap = { ...base };
  for (const key of Object.keys(merged) as Array<keyof PermissionMap>) {
    if (typeof obj[key] === 'boolean') merged[key] = obj[key] as boolean;
  }
  return merged;
}

export function profileToUserPermissions(profile: UserProfile | null, loading = false): UserPermissions {
  const role: Role = profile?.role ?? 'viewer';
  const p = normalizePermissions(role, profile?.permissions);
  return {
    role,
    isAdmin: role === 'admin',
    isStaff: role !== 'admin',
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
      configureStreams: p.can_configure_streams,
      viewMptDetail: p.can_view_mpt_detail,
      viewSznb: p.can_view_sznb,
      viewInternational: p.can_view_international,
      viewTelecom: p.can_view_telecom,
      viewFlow: p.can_view_flow,
    },
  };
}
