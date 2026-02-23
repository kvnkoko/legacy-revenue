'use server';

import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/authz/server';

type ParsedSheet = { name: string; rows: Record<string, unknown>[] };

const SHEET_TABLE_MAP: Record<string, string> = {
  Revenue: 'revenue_summary',
  Ringtune: 'ringtune',
  MPT: 'mpt',
  Atom: 'atom',
  EAUC: 'eauc',
  Combo: 'combo',
  Local: 'local',
  SZNB: 'sznb',
  'Flow Subscription': 'flow_subscription',
  International: 'international',
  YouTube: 'youtube',
  Spotify: 'spotify',
  Tiktok: 'tiktok',
};

const IMPORT_ORDER = ['MPT', 'Atom', 'Ringtune', 'EAUC', 'Combo', 'SZNB', 'Flow Subscription', 'YouTube', 'Spotify', 'Tiktok', 'Revenue'];

const TABLE_COLUMNS: Record<string, string[]> = {
  revenue_summary: ['month', 'ringtune', 'eauc', 'combo', 'sznb', 'flow_music_zone', 'flow_subscription', 'flow_data_pack', 'youtube', 'spotify', 'tiktok'],
  ringtune: ['month', 'mpt', 'atom', 'ooredoo'],
  mpt: ['month', 'legacy_ringtune', 'legacy_eauc', 'legacy_combo', 'etrade_ringtune', 'etrade_eauc', 'etrade_combo', 'fortune_ringtune', 'fortune_eauc', 'fortune_combo', 'unico_ringtune', 'unico_eauc', 'unico_combo'],
  atom: ['month', 'ringtune', 'eauc', 'combo'],
  eauc: ['month', 'mpt', 'atom'],
  combo: ['month', 'mpt', 'atom'],
  local: ['month', 'mpt', 'atom', 'ooredoo'],
  sznb: ['month', 'mpt', 'atom', 'kpay_mini_app', 'kpay_qr', 'kpay_ecommerce', 'wave_money', 'dinger'],
  flow_subscription: ['month', 'mpt', 'kpay'],
  international: ['month', 'solution_one', 'fuga', 'believe'],
  youtube: ['month', 'solution_one', 'fuga', 'believe'],
  spotify: ['month', 'fuga', 'believe'],
  tiktok: ['month', 'fuga', 'believe'],
};

function toNum(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(String(v).replace(/,/g, ''));
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function normalizeKey(key: string): string {
  return key.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function normalizeImportColumnKey(key: string): string {
  const normalized = normalizeKey(key);
  if (normalized === 'kpay_ecomence') return 'kpay_ecommerce';
  return normalized;
}

function normalizeMonth(raw: unknown): string | null {
  const finalize = (year: number, month: number): string | null => {
    if (!year || !month) return null;
    if (year < 2000 || year > 2100) return null;
    return `${year}-${String(month).padStart(2, '0')}-01`;
  };
  if (!raw) return null;
  if (raw instanceof Date && !Number.isNaN((raw as Date).getTime())) {
    return finalize((raw as Date).getFullYear(), (raw as Date).getMonth() + 1);
  }
  if (typeof raw === 'string') {
    const trimmed = String(raw).trim();
    if (/^\d{4}-\d{2}/.test(trimmed)) return finalize(Number(trimmed.slice(0, 4)), Number(trimmed.slice(5, 7)));
    if (/^\d+$/.test(trimmed)) {
      const serial = Number(trimmed);
      const parsedCode = XLSX.SSF?.parse_date_code?.(serial);
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

function parseLegacyMptRow(rawRow: Record<string, unknown>): Record<string, unknown> {
  return {
    legacy_ringtune: toNum(rawRow.Legacy),
    legacy_eauc: toNum(rawRow.__EMPTY),
    legacy_combo: toNum(rawRow.__EMPTY_1),
    etrade_ringtune: toNum(rawRow.Etrade),
    etrade_eauc: toNum(rawRow.__EMPTY_2),
    etrade_combo: toNum(rawRow.__EMPTY_3),
    fortune_ringtune: toNum(rawRow.Fortune),
    fortune_eauc: toNum(rawRow.__EMPTY_4),
    fortune_combo: toNum(rawRow.__EMPTY_5),
    unico_ringtune: toNum(rawRow.Unico),
    unico_eauc: toNum(rawRow.__EMPTY_6),
    unico_combo: toNum(rawRow.__EMPTY_7),
  };
}

function areRowsEquivalent(incoming: Record<string, unknown>, existing: Record<string, unknown> | undefined): boolean {
  if (!existing) return false;
  return Object.entries(incoming).every(([key, value]) => {
    if (key === 'month') return String(value) === String(existing[key] ?? '');
    return Math.abs(toNum(value) - toNum(existing[key])) < 0.0001;
  });
}

export async function importExcelAction(parsed: ParsedSheet[], filename: string = 'import.xlsx') {
  const perms = await requirePermission('can_import_excel');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const admin = createAdminClient();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const warnings: string[] = [];

  for (const sheetName of IMPORT_ORDER) {
    const sheet = parsed.find((s) => s.name === sheetName);
    if (!sheet) continue;
    const tableName = SHEET_TABLE_MAP[sheet.name];
    if (!tableName) continue;
    const allowedColumns = TABLE_COLUMNS[tableName] ?? ['month'];
    const normalizedRows = new Map<string, Record<string, unknown>>();

    for (const row of sheet.rows) {
      const monthStr = normalizeMonth(row.month ?? row.Month);
      if (!monthStr) {
        warnings.push(`${sheetName}: skipped row with invalid month`);
        continue;
      }
      const clean: Record<string, unknown> = { month: monthStr };
      if (tableName === 'mpt' && 'Legacy' in row && '__EMPTY' in row && '__EMPTY_1' in row) {
        Object.assign(clean, parseLegacyMptRow(row));
        normalizedRows.set(monthStr, clean);
        continue;
      }
      for (const [k, v] of Object.entries(row)) {
        const key = normalizeImportColumnKey(k);
        if (key === 'month') continue;
        if (!allowedColumns.includes(key)) continue;
        clean[key] = toNum(v);
      }
      normalizedRows.set(monthStr, clean);
    }

    const monthsToCheck = Array.from(normalizedRows.keys());
    if (!monthsToCheck.length) continue;

    const { data: existingRows, error: fetchError } = await admin
      .from(tableName)
      .select('*')
      .in('month', monthsToCheck);
    if (fetchError) return { error: `${tableName}: ${fetchError.message}`, inserted, updated, skipped, warnings };

    const existingByMonth = new Map<string, Record<string, unknown>>(
      (existingRows ?? []).map((r) => [String(r.month), r as Record<string, unknown>])
    );

    for (const [monthStr, clean] of Array.from(normalizedRows.entries())) {
      const existing = existingByMonth.get(monthStr);
      if (areRowsEquivalent(clean, existing)) {
        skipped++;
        continue;
      }
      const { error: upsertError } = await admin.from(tableName).upsert(clean, { onConflict: 'month' });
      if (upsertError) return { error: `${tableName}: ${upsertError.message}`, inserted, updated, skipped, warnings };
      if (existing) updated++;
      else inserted++;
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
    new_value: { inserted, updated, skipped, filename },
  });

  revalidatePath('/dashboard');
  revalidatePath('/streams');
  revalidatePath('/import');
  return { error: null, inserted, updated, skipped, warnings };
}
