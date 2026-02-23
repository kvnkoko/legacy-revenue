'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/authz/server';

const RESET_TABLES = [
  'revenue_summary',
  'ringtune',
  'mpt',
  'atom',
  'eauc',
  'combo',
  'local',
  'sznb',
  'flow_subscription',
  'international',
  'youtube',
  'spotify',
  'tiktok',
] as const;

export async function resetPortalData() {
  await requirePermission('can_manage_settings');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Unauthorized');

  for (const table of RESET_TABLES) {
    const { error } = await supabase.from(table).delete().gte('sqlid', 0);
    if (error) throw new Error(`Failed to clear ${table}: ${error.message}`);
  }

  // Best-effort cleanup of uploaded import artifacts for this user.
  const importsBucket = supabase.storage.from('imports');
  const { data: files } = await importsBucket.list(user.id, { limit: 1000 });
  if (files && files.length > 0) {
    const paths = files.map((f) => `${user.id}/${f.name}`);
    await importsBucket.remove(paths);
  }

  await supabase.from('audit_log').insert({
    user_id: user.id,
    user_name: user.user_metadata?.full_name ?? user.email,
    user_role: 'admin',
    user_email: user.email ?? null,
    action: 'DELETE',
    table_name: 'system_reset',
    row_id: user.id,
    old_value: null,
    new_value: { message: 'Portal data reset from settings' },
  });

  revalidatePath('/dashboard');
  revalidatePath('/entry');
  revalidatePath('/streams');
  revalidatePath('/analytics');
  revalidatePath('/import');
  revalidatePath('/audit');
  revalidatePath('/settings');
}

export async function updateProfileInfo(payload: { fullName: string; username: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const fullName = payload.fullName.trim();
  const username = payload.username.trim().toLowerCase();
  if (!fullName) throw new Error('Name is required');
  if (!/^[a-z0-9_.-]{3,24}$/.test(username)) {
    throw new Error('Username must be 3-24 chars and use letters, numbers, _, -, or .');
  }

  const { data: usernameTaken } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('username', username)
    .neq('id', user.id)
    .maybeSingle();
  if (usernameTaken) throw new Error('Username is already taken');

  const { error: authError } = await supabase.auth.updateUser({
    data: { full_name: fullName, username },
  });
  if (authError) throw new Error(authError.message);

  const { error: profileError } = await supabase.from('user_profiles').upsert(
    { id: user.id, full_name: fullName, display_name: username, username, email: user.email ?? '' },
    { onConflict: 'id' }
  );
  if (profileError) throw new Error(profileError.message);

  revalidatePath('/settings');
  revalidatePath('/audit');
}

export async function updateCurrencyPreference(payload: {
  displayCurrency: string;
  currencyOverrides?: Record<string, number>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('user_profiles')
    .update({
      display_currency: payload.displayCurrency ?? 'MMK',
      currency_overrides: payload.currencyOverrides ?? {},
    })
    .eq('id', user.id);

  if (error) throw new Error(error.message);
  revalidatePath('/settings');
  revalidatePath('/dashboard');
  revalidatePath('/streams');
  revalidatePath('/analytics');
  revalidatePath('/entry');
  revalidatePath('/import');
  revalidatePath('/history');
  revalidatePath('/audit');
}

export async function updateMyPassword(payload: { newPassword: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const newPassword = payload.newPassword;
  if (!newPassword || newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}
