'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePermission } from '@/lib/authz/server';
import { assertAdminRateLimit } from '@/lib/authz/rate-limit';
import { ADMIN_PERMISSIONS, STAFF_DEFAULT_PERMISSIONS } from '@/lib/permission-presets';
import type { PermissionMap } from '@/lib/authz/types';

type UserProfileUpdatePayload = {
  userId: string;
  full_name?: string;
  display_name?: string | null;
  job_title?: string | null;
  department?: string | null;
  notes?: string | null;
};

async function getActor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const { data: actorProfile } = await supabase
    .from('user_profiles')
    .select('full_name, role, email')
    .eq('id', user.id)
    .maybeSingle();
  return { supabase, user, actorProfile };
}

async function logUserManagementAudit(
  tableName: string,
  rowId: string,
  action: 'UPDATE' | 'DELETE' | 'IMPORT',
  oldValue: unknown,
  newValue: unknown
) {
  const { supabase, user, actorProfile } = await getActor();
  await supabase.from('audit_log').insert({
    user_id: user.id,
    user_name: (actorProfile?.full_name as string | undefined) ?? user.email ?? 'Unknown',
    user_role: (actorProfile?.role as string | undefined) ?? 'admin',
    user_email: (actorProfile?.email as string | undefined) ?? user.email ?? null,
    action,
    table_name: tableName,
    row_id: rowId,
    old_value: oldValue,
    new_value: newValue,
  });
}

export async function updateManagedUserProfile(payload: UserProfileUpdatePayload) {
  await requirePermission('can_manage_users');
  const { supabase, user } = await getActor();
  await assertAdminRateLimit(user.id, 'update profile');
  const { data: before } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', payload.userId)
    .maybeSingle();
  const { error } = await supabase
    .from('user_profiles')
    .update({
      full_name: payload.full_name ?? before?.full_name ?? '',
      display_name: payload.display_name ?? null,
      job_title: payload.job_title ?? null,
      department: payload.department ?? null,
      notes: payload.notes ?? null,
    })
    .eq('id', payload.userId);
  if (error) throw new Error(error.message);
  const { data: after } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', payload.userId)
    .maybeSingle();
  await logUserManagementAudit('user_management', payload.userId, 'UPDATE', before, after);
  revalidatePath('/admin/users');
}

export async function updateManagedUserRoleAndPermissions(payload: {
  userId: string;
  role: 'admin' | 'staff';
  permissions: PermissionMap;
}) {
  await requirePermission('can_manage_users');
  const { supabase, user } = await getActor();
  await assertAdminRateLimit(user.id, 'role/permissions update');
  const { data: before } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', payload.userId)
    .maybeSingle();

  const nextPermissions = payload.role === 'admin' ? ADMIN_PERMISSIONS : payload.permissions;
  const { error } = await supabase
    .from('user_profiles')
    .update({
      role: payload.role,
      permissions: nextPermissions,
    })
    .eq('id', payload.userId);
  if (error) throw new Error(error.message);

  const { data: after } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', payload.userId)
    .maybeSingle();
  await logUserManagementAudit('user_management', payload.userId, 'UPDATE', before, after);
  revalidatePath('/admin/users');
}

export async function updateManagedUserStatus(payload: {
  userId: string;
  status: 'active' | 'suspended' | 'pending';
}) {
  await requirePermission('can_manage_users');
  const { supabase, user } = await getActor();
  await assertAdminRateLimit(user.id, 'status update');
  const { data: before } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', payload.userId)
    .maybeSingle();
  const { error } = await supabase
    .from('user_profiles')
    .update({ status: payload.status })
    .eq('id', payload.userId);
  if (error) throw new Error(error.message);

  if (payload.status === 'suspended') {
    const adminClient = createAdminClient();
    await adminClient.auth.admin.signOut(payload.userId);
  }

  const { data: after } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', payload.userId)
    .maybeSingle();
  await logUserManagementAudit('user_management', payload.userId, 'UPDATE', before, after);
  revalidatePath('/admin/users');
}

export async function inviteManagedUser(payload: {
  fullName: string;
  email: string;
  jobTitle?: string;
  department?: string;
  role: 'admin' | 'staff';
  permissions?: PermissionMap;
  message?: string;
}) {
  await requirePermission('can_manage_users');
  const { user } = await getActor();
  await assertAdminRateLimit(user.id, 'invite');
  const trimmedEmail = payload.email.trim().toLowerCase();
  const adminClient = createAdminClient();

  // Use invited_emails table - user will sign up on /signup with this email
  const { error } = await adminClient.from('invited_emails').upsert(
    {
      email: trimmedEmail,
      full_name: payload.fullName,
      role: payload.role,
      permissions: payload.role === 'admin' ? ADMIN_PERMISSIONS : payload.permissions ?? STAFF_DEFAULT_PERMISSIONS,
      job_title: payload.jobTitle ?? null,
      department: payload.department ?? null,
      invited_by: user.id,
      invited_at: new Date().toISOString(),
      used_at: null,
      notes: payload.message ?? null,
    },
    { onConflict: 'email' }
  );
  if (error) throw new Error(error.message);
  await logUserManagementAudit('user_management', trimmedEmail, 'IMPORT', null, {
    event: 'invite',
    email: trimmedEmail,
    role: payload.role,
  });
  revalidatePath('/admin/users');
}

export async function resendManagedUserInvite(payload: { email: string }) {
  await requirePermission('can_manage_users');
  const { user } = await getActor();
  await assertAdminRateLimit(user.id, 'resend invite');
  const adminClient = createAdminClient();
  const invite = await adminClient.auth.admin.inviteUserByEmail(payload.email);
  if (invite.error) throw new Error(invite.error.message);
}

/** Remove a pending invite (they can be re-invited later). */
export async function revokePendingInvite(payload: { inviteId: string }) {
  await requirePermission('can_manage_users');
  const adminClient = createAdminClient();
  const { error } = await adminClient.from('invited_emails').delete().eq('id', payload.inviteId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/users');
}

export async function sendManagedUserPasswordReset(payload: { email: string }) {
  await requirePermission('can_manage_users');
  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.resetPasswordForEmail(payload.email);
  if (error) throw new Error(error.message);
}

export async function forceSignOutManagedUser(payload: { userId: string }) {
  await requirePermission('can_manage_users');
  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.signOut(payload.userId);
  if (error) throw new Error(error.message);
}

export async function deleteManagedUser(payload: { userId: string; fullNameConfirm: string }) {
  await requirePermission('can_manage_users');
  const { supabase, user } = await getActor();
  await assertAdminRateLimit(user.id, 'delete user');
  const { data: target } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', payload.userId)
    .maybeSingle();
  if (!target) throw new Error('User not found');
  if ((target.full_name as string) !== payload.fullNameConfirm) {
    throw new Error('Full name confirmation does not match');
  }
  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.deleteUser(payload.userId);
  if (error) throw new Error(error.message);
  await logUserManagementAudit('user_management', payload.userId, 'DELETE', target, null);
  revalidatePath('/admin/users');
}

export async function setUserPassword(payload: { userId: string; newPassword: string }) {
  await requirePermission('can_manage_users');
  const { user } = await getActor();
  await assertAdminRateLimit(user.id, 'set password');
  if (payload.newPassword.length < 6) throw new Error('Password must be at least 6 characters');
  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.updateUserById(payload.userId, {
    password: payload.newPassword,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/users');
}
