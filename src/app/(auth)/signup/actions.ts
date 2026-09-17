'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { ADMIN_PERMISSIONS } from '@/lib/permission-presets';
import type { PermissionMap } from '@/lib/authz/types';

export async function signUpIfInvited(payload: {
  email: string;
  password: string;
  fullName: string;
  username: string;
}) {
  const { email, password, fullName, username } = payload;
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedName = fullName.trim();
  const trimmedUsername = username.trim().toLowerCase();

  if (!trimmedEmail || !password || !trimmedName || !trimmedUsername) {
    return { error: 'All fields are required' };
  }
  if (!/^[a-z0-9_\\.\\-]{3,24}$/.test(trimmedUsername)) {
    return { error: 'Username must be 3-24 chars and use letters, numbers, _, -, or .' };
  }
  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters' };
  }

  const admin = createAdminClient();

  // 1. Check if email is invited
  const { data: invite, error: inviteErr } = await admin
    .from('invited_emails')
    .select('*')
    .eq('email', trimmedEmail)
    .is('used_at', null)
    .maybeSingle();

  if (inviteErr) {
    return { error: 'Unable to verify invite. Please try again.' };
  }
  if (!invite) {
    return { error: 'This email has not been invited. Please contact your admin to request access.' };
  }

  // 2. Check if user already exists in auth
  const { data: existingUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = existingUsers?.users?.find((u) => u.email?.toLowerCase() === trimmedEmail);
  if (existing) {
    return { error: 'You already have an account. Please sign in instead.' };
  }

  // 3. Create auth user
  const rawRole = (invite.role as string) ?? 'viewer';
  const role = rawRole === 'staff' ? 'viewer' : rawRole;
  const permissions = (invite.permissions as PermissionMap | null) ?? (role === 'admin' ? ADMIN_PERMISSIONS : {});

  const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
    email: trimmedEmail,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: trimmedName,
      username: trimmedUsername,
      role,
    },
  });

  if (createErr) {
    return { error: createErr.message };
  }
  if (!newUser.user) {
    return { error: 'Account creation failed. Please try again.' };
  }

  // 4. Create user_profiles
  const { data: savedProfile, error: profileErr } = await admin.from('user_profiles').upsert(
    {
      id: newUser.user.id,
      email: trimmedEmail,
      full_name: trimmedName,
      display_name: trimmedUsername,
      role,
      permissions: role === 'admin' ? ADMIN_PERMISSIONS : permissions,
      status: 'active',
      job_title: invite.job_title ?? null,
      department: invite.department ?? null,
      invited_by: invite.invited_by ?? null,
      invited_at: invite.invited_at ?? null,
      onboarded_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  ).select('role, status').maybeSingle();

  // Previously a failure here was ignored. The auth trigger has already made a
  // pending *viewer* row, so the person would silently get the wrong role and
  // no access, while the invite was consumed. Undo the account instead, so the
  // invite stays valid and they can simply try again.
  if (profileErr || !savedProfile || savedProfile.role !== role || savedProfile.status !== 'active') {
    await admin.auth.admin.deleteUser(newUser.user.id);
    return {
      error:
        'Your account could not be set up with the access you were invited with, so it was not created. ' +
        'Your invitation is still valid - please try again, or ask your admin for help.',
    };
  }

  // 5. Mark invite as used (verified, so an invite cannot be reused by accident)
  const { data: usedInvite, error: markUsedErr } = await admin
    .from('invited_emails')
    .update({ used_at: new Date().toISOString() })
    .eq('id', invite.id)
    .select('id')
    .maybeSingle();
  if (markUsedErr || !usedInvite) {
    console.error('[signup] account created but invite not marked used', invite.id, markUsedErr?.message);
  }

  return { error: null };
}
