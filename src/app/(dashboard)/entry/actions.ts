'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/authz/server';
import { getStreamConfig } from '@/lib/streams/server';
import { getAppSettings } from '@/app/(dashboard)/admin/settings/actions';

function assertMonth(month: string) {
  if (!/^\d{4}-\d{2}-01$/.test(month)) {
    throw new Error('Invalid month format; expected YYYY-MM-01.');
  }
}

function round2(v: number): number {
  return Math.round((Number.isFinite(v) ? v : 0) * 100) / 100;
}

function revalidateDataPaths() {
  revalidatePath('/dashboard');
  revalidatePath('/streams');
  revalidatePath('/entry');
  revalidatePath('/analytics');
  revalidatePath('/history');
  revalidatePath('/import');
}

/**
 * Saves a full month of entries: { fieldId: amount } across all entry streams.
 * Writes go through the user's client so RLS remains the authority; every row
 * change is audited by the DB trigger with stream/field labels.
 */
export async function saveMonthEntries({
  month,
  amounts,
}: {
  month: string;
  amounts: Record<string, number>;
}) {
  const perms = await requirePermission('can_enter_data');
  assertMonth(month);
  const supabase = await createClient();
  const config = await getStreamConfig();

  const entryStreamIds = new Set(
    config.streams.filter((s) => s.kind === 'entry' && s.isActive).map((s) => s.id)
  );
  const validFieldIds = new Set(
    config.fields.filter((f) => f.isActive && entryStreamIds.has(f.streamId)).map((f) => f.id)
  );
  for (const fieldId of Object.keys(amounts)) {
    if (!validFieldIds.has(fieldId)) {
      throw new Error('Unknown or inactive field in submission.');
    }
  }

  const { data: existing, error: existErr } = await supabase
    .from('revenue_entries')
    .select('id')
    .eq('month', month)
    .limit(1);
  if (existErr) throw new Error(existErr.message);
  const monthExists = (existing ?? []).length > 0;

  if (monthExists && !perms.isAdmin && !perms.can.editData) {
    throw new Error('You can add new months, but editing existing months requires can_edit_data permission.');
  }
  if (monthExists) {
    try {
      const settings = await getAppSettings('data-entry');
      if (settings?.duplicate_month_behavior === 'block') {
        throw new Error('This month already has data and duplicate entries are blocked by policy.');
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('blocked by policy')) throw e;
      // Settings unavailable → fall through with default behavior.
    }
  }

  const rows = Object.entries(amounts).map(([fieldId, amount]) => ({
    month,
    field_id: fieldId,
    amount: round2(Number(amount)),
  }));
  if (!rows.length) throw new Error('Nothing to save.');

  const { error } = await supabase
    .from('revenue_entries')
    .upsert(rows, { onConflict: 'month,field_id' });
  if (error) throw new Error(error.message);

  revalidateDataPaths();
  return { saved: rows.length, month };
}

/** Edits a single cell (stream field × month). */
export async function updateEntry({
  month,
  fieldId,
  amount,
}: {
  month: string;
  fieldId: string;
  amount: number;
}) {
  await requirePermission('can_edit_data');
  assertMonth(month);
  const supabase = await createClient();
  const { error } = await supabase
    .from('revenue_entries')
    .upsert({ month, field_id: fieldId, amount: round2(Number(amount)) }, { onConflict: 'month,field_id' });
  if (error) throw new Error(error.message);
  revalidateDataPaths();
}

/** Deletes an entire month of entries (audited row-by-row by the DB trigger). */
export async function deleteMonth(month: string) {
  await requirePermission('can_delete_data');
  assertMonth(month);
  const supabase = await createClient();
  const { error, count } = await supabase
    .from('revenue_entries')
    .delete({ count: 'exact' })
    .eq('month', month);
  if (error) throw new Error(error.message);
  revalidateDataPaths();
  return { deleted: count ?? 0, month };
}
