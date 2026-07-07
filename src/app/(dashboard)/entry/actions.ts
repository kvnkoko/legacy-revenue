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
 * Saves ONE stream's values for a month: { fieldId: amount } limited to that
 * stream's fields. Only cells whose value actually changed are written, so the
 * audit log stays clean (one row per real change).
 *
 * Permission semantics (mirrored by RLS, which remains the authority):
 *  - can_enter_data lets you ADD values to fields that have none for the month;
 *  - changing an already-saved value additionally requires can_edit_data.
 */
export async function saveStreamEntries({
  month,
  streamId,
  amounts,
}: {
  month: string;
  streamId: string;
  amounts: Record<string, number>;
}) {
  const perms = await requirePermission('can_enter_data');
  assertMonth(month);
  const supabase = await createClient();
  const config = await getStreamConfig();

  const stream = config.streams.find(
    (s) => s.id === streamId && s.kind === 'entry' && s.isActive
  );
  if (!stream) throw new Error('Unknown or inactive stream.');
  const streamFields = new Map(
    config.fields.filter((f) => f.isActive && f.streamId === stream.id).map((f) => [f.id, f])
  );
  for (const fieldId of Object.keys(amounts)) {
    if (!streamFields.has(fieldId)) {
      throw new Error(`Field does not belong to ${stream.name} or is archived.`);
    }
  }

  const fieldIds = Object.keys(amounts);
  if (!fieldIds.length) throw new Error('Nothing to save.');

  const { data: existingRows, error: existErr } = await supabase
    .from('revenue_entries')
    .select('field_id, amount')
    .eq('month', month)
    .in('field_id', fieldIds);
  if (existErr) throw new Error(existErr.message);
  const existing = new Map(
    (existingRows ?? []).map((r) => [String(r.field_id), Number(r.amount ?? 0)])
  );

  // Only write real changes.
  const changed = fieldIds
    .map((fieldId) => ({ fieldId, amount: round2(Number(amounts[fieldId])) }))
    .filter(({ fieldId, amount }) => {
      const prev = existing.get(fieldId);
      return prev === undefined || Math.abs(prev - amount) >= 0.005;
    });
  if (!changed.length) return { saved: 0, month, stream: stream.name, unchanged: true };

  const overwriting = changed.filter(({ fieldId }) => existing.has(fieldId));
  if (overwriting.length) {
    if (!perms.isAdmin && !perms.can.editData) {
      const names = overwriting
        .map(({ fieldId }) => streamFields.get(fieldId)?.label ?? fieldId)
        .slice(0, 4)
        .join(', ');
      throw new Error(
        `These values are already saved and locked for your role: ${names}. Adding new values is fine, but changing saved ones needs an Editor or Admin.`
      );
    }
    try {
      const settings = await getAppSettings('data-entry');
      if (settings?.duplicate_month_behavior === 'block') {
        throw new Error('Saved values for this month are locked by policy (duplicate entries blocked).');
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('locked by policy')) throw e;
      // Settings unavailable → default behavior.
    }
  }

  const { error } = await supabase.from('revenue_entries').upsert(
    changed.map(({ fieldId, amount }) => ({ month, field_id: fieldId, amount })),
    { onConflict: 'month,field_id' }
  );
  if (error) throw new Error(error.message);

  revalidateDataPaths();
  return { saved: changed.length, month, stream: stream.name, unchanged: false };
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
