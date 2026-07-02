import type { PermissionMap, Role } from '@/lib/authz/types';

// Role default permission maps — must mirror rbac_role_default_permissions()
// in supabase/migrations/018_roles.sql (the DB is the authority via RLS).

export const VIEWER_PERMISSIONS: PermissionMap = {
  can_enter_data: false,
  can_edit_data: false,
  can_delete_data: false,
  can_import_excel: false,
  can_export_data: true,
  can_view_analytics: true,
  can_view_streams: true,
  can_view_audit_log: false,
  can_manage_users: false,
  can_manage_settings: false,
  can_configure_streams: false,
  can_view_mpt_detail: true,
  can_view_sznb: true,
  can_view_international: true,
  can_view_telecom: true,
  can_view_flow: true,
};

export const DATA_PERMISSIONS: PermissionMap = {
  ...VIEWER_PERMISSIONS,
  can_enter_data: true,
  can_import_excel: true,
};

export const EDITOR_PERMISSIONS: PermissionMap = {
  ...DATA_PERMISSIONS,
  can_edit_data: true,
  can_delete_data: true,
  can_view_audit_log: true,
  can_configure_streams: true,
};

export const ADMIN_PERMISSIONS: PermissionMap = {
  ...EDITOR_PERMISSIONS,
  can_manage_users: true,
  can_manage_settings: true,
};

/** Transitional: pre-018 'staff' rows behave as viewers. */
export const STAFF_DEFAULT_PERMISSIONS: PermissionMap = VIEWER_PERMISSIONS;

export const ROLE_DEFAULT_PERMISSIONS: Record<Role, PermissionMap> = {
  admin: ADMIN_PERMISSIONS,
  editor: EDITOR_PERMISSIONS,
  data: DATA_PERMISSIONS,
  viewer: VIEWER_PERMISSIONS,
  staff: VIEWER_PERMISSIONS,
};

export const ROLE_DESCRIPTIONS: Record<Exclude<Role, 'staff'>, string> = {
  admin: 'Everything, including user management and organization settings.',
  editor: 'Configures revenue streams and fields; enters, edits, deletes and imports data; sees the audit log.',
  data: 'Enters new monthly figures and imports Excel. Cannot edit past months or change stream configuration.',
  viewer: 'Read-only access to dashboards, streams and analytics, with export.',
};

export type PermissionPresetKey = Exclude<Role, 'staff'>;
