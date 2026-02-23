import { createClient } from '@/lib/supabase/server';
import type { PermissionKey, UserProfile } from '@/lib/authz/types';
import { profileToUserPermissions } from '@/lib/authz/utils';
import { ADMIN_PERMISSIONS } from '@/lib/permission-presets';

export async function getServerProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  let data: Record<string, unknown> | null = null;
  const byId = await supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle();
  if (!byId.error) {
    data = (byId.data as Record<string, unknown> | null) ?? null;
  } else {
    const byLegacy = await supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle();
    data = (byLegacy.data as Record<string, unknown> | null) ?? null;
  }
  if (!data) {
    if (user.user_metadata?.role === 'admin' || user.email === 'admin@legacy.com') {
      return {
        id: user.id,
        email: user.email ?? '',
        full_name: (user.user_metadata?.full_name as string | undefined) ?? (user.email ?? ''),
        display_name: (user.user_metadata?.username as string | undefined) ?? null,
        role: 'admin',
        permissions: ADMIN_PERMISSIONS,
        job_title: null,
        department: null,
        avatar_url: null,
        status: 'active',
        last_seen_at: null,
        invited_by: null,
        invited_at: null,
        onboarded_at: null,
        notes: null,
        created_at: null,
        updated_at: null,
      };
    }
    return null;
  }
  return {
    id: (data.id as string | undefined) ?? (data.user_id as string | undefined) ?? user.id,
    email: (data.email as string | undefined) ?? user.email ?? '',
    full_name: (data.full_name as string | undefined) ?? user.email ?? '',
    display_name: (data.display_name as string | null | undefined) ?? (data.username as string | null | undefined) ?? null,
    role: (data.role as 'admin' | 'staff' | undefined) ?? ((user.user_metadata?.role as 'admin' | 'staff' | undefined) ?? 'staff'),
    permissions: (data.permissions as UserProfile['permissions'] | undefined) ?? ({} as UserProfile['permissions']),
    job_title: (data.job_title as string | null | undefined) ?? null,
    department: (data.department as string | null | undefined) ?? null,
    avatar_url: (data.avatar_url as string | null | undefined) ?? null,
    status: (data.status as 'active' | 'suspended' | 'pending' | undefined) ?? 'active',
    last_seen_at: (data.last_seen_at as string | null | undefined) ?? null,
    invited_by: (data.invited_by as string | null | undefined) ?? null,
    invited_at: (data.invited_at as string | null | undefined) ?? null,
    onboarded_at: (data.onboarded_at as string | null | undefined) ?? null,
    notes: (data.notes as string | null | undefined) ?? null,
    created_at: (data.created_at as string | null | undefined) ?? null,
    updated_at: (data.updated_at as string | null | undefined) ?? null,
  };
}

export async function getServerPermissions() {
  const profile = await getServerProfile();
  return profileToUserPermissions(profile, false);
}

export async function requirePermission(permission: PermissionKey) {
  const perms = await getServerPermissions();
  const mapping = {
    can_enter_data: perms.can.enterData,
    can_edit_data: perms.can.editData,
    can_delete_data: perms.can.deleteData,
    can_import_excel: perms.can.importExcel,
    can_export_data: perms.can.exportData,
    can_view_analytics: perms.can.viewAnalytics,
    can_view_streams: perms.can.viewStreams,
    can_view_audit_log: perms.can.viewAuditLog,
    can_manage_users: perms.can.manageUsers,
    can_manage_settings: perms.can.manageSettings,
    can_view_mpt_detail: perms.can.viewMptDetail,
    can_view_sznb: perms.can.viewSznb,
    can_view_international: perms.can.viewInternational,
    can_view_telecom: perms.can.viewTelecom,
    can_view_flow: perms.can.viewFlow,
  } as const;
  if (!perms.isAdmin && !mapping[permission]) {
    throw new Error(`Permission denied: ${permission}`);
  }
  return perms;
}
