'use client';

import { usePermissions } from '@/hooks/usePermissions';
import { AccessDenied } from '@/components/authz/AccessDenied';
import type { PermissionKey } from '@/lib/authz/types';

const MAP: Record<PermissionKey, keyof ReturnType<typeof usePermissions>['can']> = {
  can_enter_data: 'enterData',
  can_edit_data: 'editData',
  can_delete_data: 'deleteData',
  can_import_excel: 'importExcel',
  can_export_data: 'exportData',
  can_view_analytics: 'viewAnalytics',
  can_view_streams: 'viewStreams',
  can_view_audit_log: 'viewAuditLog',
  can_manage_users: 'manageUsers',
  can_manage_settings: 'manageSettings',
  can_view_mpt_detail: 'viewMptDetail',
  can_view_sznb: 'viewSznb',
  can_view_international: 'viewInternational',
  can_view_telecom: 'viewTelecom',
  can_view_flow: 'viewFlow',
};

export function PermissionGate({
  permission,
  children,
  fallback,
}: {
  permission: PermissionKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const perms = usePermissions();
  if (perms.loading) return null;
  const allowed = perms.isAdmin || perms.can[MAP[permission]];
  if (!allowed) {
    return (
      <>
        {fallback ?? <AccessDenied permissionName={`${permission}`} profile={perms.profile} />}
      </>
    );
  }
  return <>{children}</>;
}
