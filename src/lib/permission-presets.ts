import type { PermissionMap } from '@/lib/authz/types';

export const STAFF_DEFAULT_PERMISSIONS: PermissionMap = {
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
  can_view_mpt_detail: true,
  can_view_sznb: true,
  can_view_international: true,
  can_view_telecom: true,
  can_view_flow: true,
};

export const ADMIN_PERMISSIONS: PermissionMap = {
  can_enter_data: true,
  can_edit_data: true,
  can_delete_data: true,
  can_import_excel: true,
  can_export_data: true,
  can_view_analytics: true,
  can_view_streams: true,
  can_view_audit_log: true,
  can_manage_users: true,
  can_manage_settings: true,
  can_view_mpt_detail: true,
  can_view_sznb: true,
  can_view_international: true,
  can_view_telecom: true,
  can_view_flow: true,
};

export const PERMISSION_PRESETS = {
  READ_ONLY: {
    label: 'Read Only',
    description: 'Can view all financial data and analytics. Cannot enter, edit, or manage anything.',
    permissions: {
      ...STAFF_DEFAULT_PERMISSIONS,
    },
  },
  DATA_ENTRY_STAFF: {
    label: 'Data Entry Staff',
    description: 'Can view all data and enter new monthly figures. Cannot edit past data or manage users.',
    permissions: {
      ...STAFF_DEFAULT_PERMISSIONS,
      can_enter_data: true,
      can_import_excel: true,
    },
  },
  SENIOR_STAFF: {
    label: 'Senior Staff',
    description: 'Can enter and edit data, export, and view audit log. Cannot manage users.',
    permissions: {
      ...STAFF_DEFAULT_PERMISSIONS,
      can_enter_data: true,
      can_edit_data: true,
      can_import_excel: true,
      can_view_audit_log: true,
    },
  },
  FULL_ACCESS_STAFF: {
    label: 'Full Access Staff',
    description: 'Full data access including delete and settings. Cannot manage other users.',
    permissions: {
      ...STAFF_DEFAULT_PERMISSIONS,
      can_enter_data: true,
      can_edit_data: true,
      can_delete_data: true,
      can_import_excel: true,
      can_view_audit_log: true,
      can_manage_settings: true,
    },
  },
} as const;

export type PermissionPresetKey = keyof typeof PERMISSION_PRESETS;
