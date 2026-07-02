'use server';

import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/authz/server';
import { fetchStreamConfig } from '@/lib/streams/shared';
import {
  MPT_POSITIONAL_LAYOUT,
  isMptPositionalRow,
  normalizeKey,
  resolveSheetPlan,
  type SheetPlan,
} from '@/lib/streams/import-map';
import type { StreamConfig } from '@/lib/streams/types';

type ParsedSheet = { name: string; rows: Record<string, unknown>[] };

function toNum(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(String(v).replace(/,/g, ''));
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function normalizeMonth(raw: unknown): string | null {
  const finalize = (year: number, month: number): string | null => {
    if (!year || !month) return null;
    if (year < 2000 || year > 2100) return null;
    return `${year}-${String(month).padStart(2, '0')}-01`;
  };
  if (!raw) return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return finalize(raw.getFullYear(), raw.getMonth() + 1);
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (/^\d{4}-\d{2}/.test(trimmed)) return finalize(Number(trimmed.slice(0, 4)), Number(trimmed.slice(5, 7)));
    if (/^\d+$/.test(trimmed)) {
      const parsedCode = XLSX.SSF?.parse_date_code?.(Number(trimmed));
      if (parsedCode?.y && parsedCode?.m) return finalize(parsedCode.y, parsedCode.m);
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return finalize(parsed.getFullYear(), parsed.getMonth() + 1);
  }
  if (typeof raw === 'number') {
    const parsedCode = XLSX.SSF?.parse_date_code?.(raw);
    if (parsedCode?.y && parsedCode?.m) return finalize(parsedCode.y, parsedCode.m);
    const maybeEpoch = new Date(raw);
    if (!Number.isNaN(maybeEpoch.getTime())) return finalize(maybeEpoch.getFullYear(), maybeEpoch.getMonth() + 1);
  }
  return null;
}

/** Resolves one sheet row to { fieldId: amount } using the sheet plan. */
function resolveRowAmounts(
  plan: SheetPlan,
  config: StreamConfig,
  row: Record<string, unknown>
): Record<string, number> {
  const out: Record<string, number> = {};

  // Historical MPT layout: merged headers export as Legacy/__EMPTY/... columns.
  if (plan.mptPositional && isMptPositionalRow(row)) {
    const mptStream = config.streams.find((s) => s.slug === 'mpt');
    const bySlug = new Map(
      plan.writable
        .filter((w) => mptStream && w.field.streamId === mptStream.id)
        .map((w) => [w.field.slug, w.field.id])
    );
    for (const [rawKey, slug] of Object.entries(MPT_POSITIONAL_LAYOUT)) {
      const fieldId = bySlug.get(slug);
      if (fieldId && rawKey in row) out[fieldId] = toNum(row[rawKey]);
    }
    return out;
  }

  const byKey = new Map<string, string>();
  for (const w of plan.writable) {
    for (const key of w.keys) byKey.set(key, w.field.id);
  }
  for (const [k, v] of Object.entries(row)) {
    const key = normalizeKey(k);
    if (key === 'month') continue;
    const fieldId = byKey.get(key);
    if (fieldId) out[fieldId] = toNum(v);
  }
  return out;
}

export async function importExcelAction(parsed: ParsedSheet[], filename: string = 'import.xlsx') {
  const perms = await requirePermission('can_import_excel');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const admin = createAdminClient();
  const config = await fetchStreamConfig(admin);
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const warnings: string[] = [];

  // ---- Write pass: entry-stream fields only (base facts are authoritative) --
  for (const sheet of parsed) {
    const plan = resolveSheetPlan(config, sheet.name);
    if (!plan.writable.length) {
      if (!plan.verifyStreamSlug) warnings.push(`${sheet.name}: sheet not recognized, ignored`);
      continue;
    }

    // month → { fieldId: amount }
    const rowsByMonth = new Map<string, Record<string, number>>();
    for (const row of sheet.rows) {
      const monthStr = normalizeMonth(row.month ?? row.Month);
      if (!monthStr) {
        warnings.push(`${sheet.name}: skipped row with invalid month`);
        continue;
      }
      const amounts = resolveRowAmounts(plan, config, row);
      if (Object.keys(amounts).length) rowsByMonth.set(monthStr, amounts);
    }
    if (!rowsByMonth.size) continue;

    const months = Array.from(rowsByMonth.keys());
    const fieldIds = plan.writable.map((w) => w.field.id);
    const { data: existingRows, error: fetchError } = await admin
      .from('revenue_entries')
      .select('month, field_id, amount')
      .in('month', months)
      .in('field_id', fieldIds);
    if (fetchError) return { error: `${sheet.name}: ${fetchError.message}`, inserted, updated, skipped, warnings };
    const existing = new Map(
      (existingRows ?? []).map((r) => [`${r.month}|${r.field_id}`, Number(r.amount ?? 0)])
    );

    for (const [monthStr, amounts] of Array.from(rowsByMonth.entries())) {
      const changed = Object.entries(amounts).filter(([fieldId, amount]) => {
        const prev = existing.get(`${monthStr}|${fieldId}`);
        return prev === undefined || Math.abs(prev - amount) >= 0.0001;
      });
      if (!changed.length) {
        skipped++;
        continue;
      }
      const hadAny = Object.keys(amounts).some((fieldId) => existing.has(`${monthStr}|${fieldId}`));
      const { error: upsertError } = await admin.from('revenue_entries').upsert(
        changed.map(([fieldId, amount]) => ({
          month: monthStr,
          field_id: fieldId,
          amount,
          created_by: user.id,
        })),
        { onConflict: 'month,field_id' }
      );
      if (upsertError) return { error: `${sheet.name}: ${upsertError.message}`, inserted, updated, skipped, warnings };
      if (hadAny) updated++;
      else inserted++;
    }
  }

  // ---- Verify pass: derived sheets are checked against computed views -------
  for (const sheet of parsed) {
    const plan = resolveSheetPlan(config, sheet.name);
    if (!plan.verifyStreamSlug) continue;

    const monthsInSheet = new Map<string, Record<string, number>>();
    const writableKeys = new Set(plan.writable.flatMap((w) => w.keys));
    for (const row of sheet.rows) {
      const monthStr = normalizeMonth(row.month ?? row.Month);
      if (!monthStr) continue;
      const values: Record<string, number> = {};
      for (const [k, v] of Object.entries(row)) {
        const key = normalizeKey(k);
        if (key === 'month' || writableKeys.has(key)) continue;
        values[key] = toNum(v);
      }
      monthsInSheet.set(monthStr, values);
    }
    if (!monthsInSheet.size) continue;
    const months = Array.from(monthsInSheet.keys());

    if (plan.verifyStreamSlug === 'summary') {
      const { data: computedRows } = await admin
        .from('v_revenue_summary_compat')
        .select('*')
        .in('month', months);
      const computedByMonth = new Map((computedRows ?? []).map((r) => [String(r.month), r as Record<string, unknown>]));
      for (const [monthStr, values] of Array.from(monthsInSheet.entries())) {
        const computed = computedByMonth.get(monthStr);
        for (const [col, sheetVal] of Object.entries(values)) {
          const computedVal = toNum(computed?.[col]);
          if (computed && col in computed && Math.abs(computedVal - sheetVal) > 0.01) {
            warnings.push(
              `${sheet.name} ${monthStr} "${col}": sheet ${sheetVal.toLocaleString()} ≠ computed ${computedVal.toLocaleString()} — sheet value ignored; base sheets are authoritative`
            );
          }
        }
      }
    } else {
      const stream = config.streams.find((s) => s.slug === plan.verifyStreamSlug);
      if (!stream) continue;
      const { data: bucketRows } = await admin
        .from('v_derived_bucket_totals')
        .select('month, bucket_slug, amount')
        .eq('stream_id', stream.id)
        .in('month', months);
      const computed = new Map(
        (bucketRows ?? []).map((r) => [`${r.month}|${r.bucket_slug}`, Number(r.amount ?? 0)])
      );
      for (const [monthStr, values] of Array.from(monthsInSheet.entries())) {
        for (const [col, sheetVal] of Object.entries(values)) {
          if (col === 'total') {
            const total = (bucketRows ?? [])
              .filter((r) => String(r.month) === monthStr)
              .reduce((s, r) => s + Number(r.amount ?? 0), 0);
            if (Math.abs(total - sheetVal) > 0.01) {
              warnings.push(
                `${sheet.name} ${monthStr} "total": sheet ${sheetVal.toLocaleString()} ≠ computed ${total.toLocaleString()} — sheet value ignored; base sheets are authoritative`
              );
            }
            continue;
          }
          const key = `${monthStr}|${col}`;
          if (computed.has(key) && Math.abs(computed.get(key)! - sheetVal) > 0.01) {
            warnings.push(
              `${sheet.name} ${monthStr} "${col}": sheet ${sheetVal.toLocaleString()} ≠ computed ${computed.get(key)!.toLocaleString()} — sheet value ignored; base sheets are authoritative`
            );
          }
        }
      }
    }
  }

  await admin.from('audit_log').insert({
    user_id: user.id,
    user_name: perms.profile?.full_name ?? perms.profile?.display_name ?? user.email ?? 'Unknown',
    user_role: perms.role,
    user_email: user.email ?? null,
    action: 'IMPORT',
    table_name: 'import',
    row_id: filename,
    new_value: { inserted, updated, skipped, warnings: warnings.length, filename },
  });

  revalidatePath('/dashboard');
  revalidatePath('/streams');
  revalidatePath('/import');
  revalidatePath('/analytics');
  revalidatePath('/history');
  revalidatePath('/entry');
  return { error: null, inserted, updated, skipped, warnings };
}
