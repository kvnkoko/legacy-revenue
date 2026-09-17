'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePermission } from '@/lib/authz/server';
import { assertSaved } from '@/lib/db/verify-write';

export async function getAppSettings(key: string) {
  const admin = createAdminClient();
  const { data } = await admin.from('app_settings').select('value').eq('key', key).maybeSingle();
  return (data?.value as Record<string, unknown>) ?? null;
}

export async function updateAppSettings(key: string, value: Record<string, unknown>) {
  await requirePermission('can_manage_settings');
  const admin = createAdminClient();
  const { data: saved, error } = await admin
    .from('app_settings')
    .upsert(
      {
        key,
        value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    )
    .select('value')
    .maybeSingle();
  if (error) throw new Error(error.message);
  assertSaved(saved, { value }, 'These settings');
  revalidatePath('/admin/settings');
  if (key === 'permissions') revalidatePath('/admin/users');
  if (key === 'session') revalidatePath('/audit');
  if (key === 'data-entry') revalidatePath('/entry');
}
