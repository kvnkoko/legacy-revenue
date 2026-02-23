'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePermission } from '@/lib/authz/server';

export async function getAppSettings(key: string) {
  const admin = createAdminClient();
  const { data } = await admin.from('app_settings').select('value').eq('key', key).maybeSingle();
  return (data?.value as Record<string, unknown>) ?? null;
}

export async function updateAppSettings(key: string, value: Record<string, unknown>) {
  await requirePermission('can_manage_settings');
  const admin = createAdminClient();
  const { error } = await admin
    .from('app_settings')
    .upsert(
      {
        key,
        value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );
  if (error) throw new Error(error.message);
  revalidatePath('/admin/settings');
  if (key === 'permissions') revalidatePath('/admin/users');
  if (key === 'session') revalidatePath('/audit');
  if (key === 'data-entry') revalidatePath('/entry');
}
