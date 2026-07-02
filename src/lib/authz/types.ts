// 'staff' is a transitional alias accepted until migration 018 has run in
// production (it is treated as viewer defaults); new code should only assign
// admin / editor / data / viewer.
export type Role = 'admin' | 'editor' | 'data' | 'viewer' | 'staff';

export type PermissionKey =
  | 'can_enter_data'
  | 'can_edit_data'
  | 'can_delete_data'
  | 'can_import_excel'
  | 'can_export_data'
  | 'can_view_analytics'
  | 'can_view_streams'
  | 'can_view_audit_log'
  | 'can_manage_users'
  | 'can_manage_settings'
  | 'can_configure_streams'
  | 'can_view_mpt_detail'
  | 'can_view_sznb'
  | 'can_view_international'
  | 'can_view_telecom'
  | 'can_view_flow';

export type PermissionMap = Record<PermissionKey, boolean>;

export type UserProfile = {
  id: string;
  email: string;
  full_name: string;
  display_name: string | null;
  role: Role;
  permissions: PermissionMap;
  job_title: string | null;
  department: string | null;
  avatar_url: string | null;
  status: 'active' | 'suspended' | 'pending';
  last_seen_at: string | null;
  invited_by: string | null;
  invited_at: string | null;
  onboarded_at: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type UserPermissions = {
  role: Role;
  can: {
    enterData: boolean;
    editData: boolean;
    deleteData: boolean;
    importExcel: boolean;
    exportData: boolean;
    viewAnalytics: boolean;
    viewStreams: boolean;
    viewAuditLog: boolean;
    manageUsers: boolean;
    manageSettings: boolean;
    configureStreams: boolean;
    viewMptDetail: boolean;
    viewSznb: boolean;
    viewInternational: boolean;
    viewTelecom: boolean;
    viewFlow: boolean;
  };
  isAdmin: boolean;
  isStaff: boolean;
  profile: UserProfile | null;
  loading: boolean;
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  editor: 'Editor',
  data: 'Data',
  viewer: 'Viewer',
  staff: 'Staff',
};
