'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePermission } from '@/lib/authz/server';
import { assertAdminRateLimit } from '@/lib/authz/rate-limit';
import { ADMIN_PERMISSIONS } from '@/lib/permission-presets';
import { normalizePermissions } from '@/lib/authz/utils';
import { assertSaved } from '@/lib/db/verify-write';
import type { PermissionMap, Role } from '@/lib/authz/types';

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
  const { error } = await supabase.from('audit_log').insert({
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
  if (error) {
    // The change itself already succeeded, so don't claim it failed — but an
    // unrecorded change must never pass silently in an audited system.
    console.error('[audit] user-management audit row not written', rowId, error.message);
    throw new Error(
      `The change WAS saved, but it could not be recorded in the Audit Log (${error.message}). ` +
        'Please tell your admin so the change can be noted manually.'
    );
  }
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
  const nextName = payload.full_name ?? before?.full_name ?? '';
  // .select() makes the database return the row it wrote. A write blocked by
  // row-level security returns no rows and no error, so an empty result here
  // is the definitive signal that nothing was saved — more reliable than
  // comparing optional text fields, where '' and NULL can differ harmlessly.
  const { data: after, error } = await supabase
    .from('user_profiles')
    .update({
      full_name: nextName,
      display_name: payload.display_name ?? null,
      job_title: payload.job_title ?? null,
      department: payload.department ?? null,
      notes: payload.notes ?? null,
    })
    .eq('id', payload.userId)
    .select('*')
    .maybeSingle();
  if (error) throw new Error(error.message);
  assertSaved(after, { full_name: nextName }, 'Profile details for this user');
  await logUserManagementAudit('user_management', payload.userId, 'UPDATE', before, after);
  revalidatePath('/admin/users');
}

export async function updateManagedUserRoleAndPermissions(payload: {
  userId: string;
  role: Exclude<Role, 'staff'>;
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

  // Role defaults merged with per-user overrides; the DB guard trigger
  // re-derives the effective map as the final authority.
  const nextPermissions = payload.role === 'admin' ? ADMIN_PERMISSIONS : normalizePermissions(payload.role, payload.permissions);
  // .select() returns the stored row, so this catches both a write blocked by
  // row-level security (no rows returned) and a trigger that rewrote the role
  // (value mismatch). Verified BEFORE claiming success or writing an audit
  // row, so a change that did not happen is never reported as one that did.
  const { data: after, error } = await supabase
    .from('user_profiles')
    .update({
      role: payload.role,
      permissions: nextPermissions,
    })
    .eq('id', payload.userId)
    .select('*')
    .maybeSingle();
  if (error) throw new Error(error.message);
  assertSaved(after, { role: payload.role }, 'Role change for this user');
  await logUserManagementAudit('user_management', payload.userId, 'UPDATE', before, after);
  revalidatePath('/admin/users');
  return { role: after?.role as Role, permissions: after?.permissions as PermissionMap };
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
  const { data: after, error } = await supabase
    .from('user_profiles')
    .update({ status: payload.status })
    .eq('id', payload.userId)
    .select('*')
    .maybeSingle();
  if (error) throw new Error(error.message);
  // Verified before the sign-out below, so we never force someone out of the
  // app on the strength of a suspension that was not actually recorded.
  assertSaved(after, { status: payload.status }, 'Status change for this user');

  if (payload.status === 'suspended') {
    const adminClient = createAdminClient();
    await adminClient.auth.admin.signOut(payload.userId);
  }
  await logUserManagementAudit('user_management', payload.userId, 'UPDATE', before, after);
  revalidatePath('/admin/users');
  return { status: after?.status as 'active' | 'suspended' | 'pending' };
}

export async function inviteManagedUser(payload: {
  fullName: string;
  email: string;
  jobTitle?: string;
  department?: string;
  role: Exclude<Role, 'staff'>;
  permissions?: PermissionMap;
  message?: string;
}) {
  await requirePermission('can_manage_users');
  const { user } = await getActor();
  await assertAdminRateLimit(user.id, 'invite');
  const trimmedEmail = payload.email.trim().toLowerCase();
  const adminClient = createAdminClient();

  // Use invited_emails table - user will sign up on /signup with this email
  const { data: savedInvite, error } = await adminClient.from('invited_emails').upsert(
    {
      email: trimmedEmail,
      full_name: payload.fullName,
      role: payload.role,
      permissions: normalizePermissions(payload.role, payload.permissions),
      job_title: payload.jobTitle ?? null,
      department: payload.department ?? null,
      invited_by: user.id,
      invited_at: new Date().toISOString(),
      used_at: null,
      notes: payload.message ?? null,
    },
    { onConflict: 'email' }
  ).select('email, role, used_at').maybeSingle();
  if (error) throw new Error(error.message);
  assertSaved(savedInvite, { email: trimmedEmail, role: payload.role, used_at: null }, `The invite for ${trimmedEmail}`);
  await logUserManagementAudit('user_management', trimmedEmail, 'IMPORT', null, {
    event: 'invite',
    email: trimmedEmail,
    role: payload.role,
  });
  revalidatePath('/admin/users');
}

/**
 * Refreshes a pending invite. This app invites people through invited_emails +
 * the /signup page, and never sends email itself. The previous version called
 * Supabase's inviteUserByEmail, a different system: it could create a login
 * account that the handle_new_user trigger turns into a pending VIEWER, which
 * then blocked the person's real signup with the role they were invited with,
 * while the admin was told "Invite resent".
 */
export async function resendManagedUserInvite(payload: { email: string }) {
  await requirePermission('can_manage_users');
  const { user } = await getActor();
  await assertAdminRateLimit(user.id, 'resend invite');
  const email = payload.email.trim().toLowerCase();
  const adminClient = createAdminClient();
  const { data: refreshed, error } = await adminClient
    .from('invited_emails')
    .update({ invited_at: new Date().toISOString(), invited_by: user.id })
    .eq('email', email)
    .is('used_at', null)
    .select('email')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!refreshed) {
    throw new Error(
      `There is no open invite for ${email}. If they have already signed up, they can simply sign in. Otherwise, invite them again.`
    );
  }
  await logUserManagementAudit('user_management', email, 'UPDATE', null, { event: 'invite_refreshed', email });
  revalidatePath('/admin/users');
  return { signupPath: '/signup', email };
}

/** Remove a pending invite (they can be re-invited later). */
export async function revokePendingInvite(payload: { inviteId: string }) {
  await requirePermission('can_manage_users');
  const { user } = await getActor();
  const adminClient = createAdminClient();
  const { data: removed, error } = await adminClient
    .from('invited_emails')
    .delete()
    .eq('id', payload.inviteId)
    .select('email, role')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!removed) throw new Error('That invite no longer exists, so nothing was revoked. Please reload the page.');
  await logUserManagementAudit('user_management', removed.email as string, 'DELETE', removed, {
    event: 'invite_revoked',
    by: user.id,
  });
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
  await getActor();
  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.signOut(payload.userId);
  if (error) throw new Error(error.message);
  await logUserManagementAudit('user_management', payload.userId, 'UPDATE', null, { event: 'sessions_invalidated' });
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
  // Confirm the account is really gone before recording a deletion.
  const { data: stillThere } = await adminClient.auth.admin.getUserById(payload.userId);
  if (stillThere?.user) {
    throw new Error('The account was not deleted. Nothing has been recorded as removed. Please try again.');
  }
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
  // Record THAT the password was set and by whom; never the password itself.
  await logUserManagementAudit('user_management', payload.userId, 'UPDATE', null, { event: 'password_set_by_admin' });
  revalidatePath('/admin/users');
}
