'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { assertSaved } from '@/lib/db/verify-write';

/*
 * resetPortalData() was removed on purpose.
 *
 * It deleted from the legacy per-stream tables (mpt, revenue_summary, ...),
 * which migration 017 froze by dropping their write policies. Every delete was
 * therefore silently blocked by RLS, yet the button reported "All portal data
 * cleared" and wrote a DELETE 'system_reset' row to audit_log - an audit record
 * of a reset that never happened. Real data lives in revenue_entries and was
 * never touched.
 *
 * It is deliberately NOT repointed at revenue_entries: a one-click wipe of all
 * financial history does not belong in a finance portal's personal settings.
 * If a genuine reset is ever needed, do it as a reviewed, backed-up SQL script.
 */

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

  // Profile row first and verified: it is what the app and audit log show.
  // Updating auth metadata first meant a failed profile write left the two
  // disagreeing while the person was told their name had been saved.
  const { data: savedProfile, error: profileError } = await supabase
    .from('user_profiles')
    .upsert(
      { id: user.id, full_name: fullName, display_name: username, username, email: user.email ?? '' },
      { onConflict: 'id' }
    )
    .select('full_name, username')
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);
  assertSaved(savedProfile, { full_name: fullName, username }, 'Your name and username');

  const { error: authError } = await supabase.auth.updateUser({
    data: { full_name: fullName, username },
  });
  if (authError) throw new Error(authError.message);

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

  const displayCurrency = payload.displayCurrency ?? 'MMK';
  const { data: saved, error } = await supabase
    .from('user_profiles')
    .update({
      display_currency: displayCurrency,
      currency_overrides: payload.currencyOverrides ?? {},
    })
    .eq('id', user.id)
    .select('display_currency')
    .maybeSingle();

  if (error) throw new Error(error.message);
  assertSaved(saved, { display_currency: displayCurrency }, 'Your currency preference');
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
