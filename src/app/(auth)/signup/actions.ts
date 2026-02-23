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
  const role = (invite.role as 'admin' | 'staff') ?? 'staff';
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
  const { error: profileErr } = await admin.from('user_profiles').upsert(
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
  );

  if (profileErr) {
    // User created but profile failed - they can still sign in; profile trigger might create a basic one
    // Log but don't fail
  }

  // 5. Mark invite as used
  await admin.from('invited_emails').update({ used_at: new Date().toISOString() }).eq('id', invite.id);

  return { error: null };
}
