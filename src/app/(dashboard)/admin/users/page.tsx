import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getServerPermissions } from '@/lib/authz/server';
import { AccessDenied } from '@/components/authz/AccessDenied';
import { AdminUsersPageClient } from '@/components/admin/users/AdminUsersPageClient';
import type { ManagedUser, UserActivityRow } from '@/components/admin/users/types';
import { normalizePermissions } from '@/lib/authz/utils';
import { getAppSettings } from '@/app/(dashboard)/admin/settings/actions';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const perms = await getServerPermissions();
  const profile = perms.profile;
  if (!profile) redirect('/login');
  if (!perms.isAdmin && !perms.can.manageUsers) {
    return (
      <div className="space-y-6">
        <h1 className="text-title font-bold text-primary tracking-tight">User Management</h1>
        <AccessDenied permissionName="can_manage_users" profile={profile} />
      </div>
    );
  }

  const supabase = await createClient();
  const { data: usersRaw } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false });
  const users: ManagedUser[] = (usersRaw ?? []).map((u) => ({
    ...(u as ManagedUser),
    permissions: normalizePermissions((u.role as 'admin' | 'staff') ?? 'staff', u.permissions),
  }));

  const { data: activityRaw } = await supabase
    .from('audit_log')
    .select('sqlid, user_id, row_id, user_role, action, table_name, created_at, new_value')
    .order('created_at', { ascending: false })
    .limit(250);
  const activity = (activityRaw ?? []) as UserActivityRow[];

  let defaultPermissions: Record<string, unknown> = {};
  try {
    const permSettings = await getAppSettings('permissions');
    defaultPermissions = permSettings ?? {};
  } catch {
    // Use empty; InviteUserDrawer falls back to READ_ONLY
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title font-bold text-primary tracking-tight">User Management</h1>
        <p className="text-body text-secondary mt-0.5">Manage team roles, permissions, and security controls</p>
      </div>
      <AdminUsersPageClient users={users} activity={activity} defaultPermissions={defaultPermissions} />
    </div>
  );
}
