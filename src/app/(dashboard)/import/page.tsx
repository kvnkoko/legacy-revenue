'use client';

import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/client';
import { importExcelAction } from './actions';
import { formatMMK } from '@/lib/utils';
import { toast } from 'sonner';
import { UploadSimpleIcon } from '@phosphor-icons/react';
import { usePermissions } from '@/hooks/usePermissions';
import { AccessDenied } from '@/components/authz/AccessDenied';

type ParsedSheet = { name: string; rows: Record<string, unknown>[] };
type ValidationItem = { level: 'ok' | 'warn' | 'critical'; message: string };
type ImportResult = {
  inserted: number;
  updated: number;
  skipped: number;
  warnings: string[];
};

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

const EXPORT_SHEETS = ['Revenue', 'Ringtune', 'MPT', 'Atom', 'EAUC', 'Combo', 'Local', 'SZNB', 'Flow Subscription', 'International', 'YouTube', 'Spotify', 'Tiktok'];

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
      const serial = Number(trimmed);
      const parsedCode = XLSX.SSF.parse_date_code(serial);
      if (parsedCode?.y && parsedCode?.m) {
        return finalize(parsedCode.y, parsedCode.m);
      }
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return finalize(parsed.getFullYear(), parsed.getMonth() + 1);
  }
  if (typeof raw === 'number') {
    const parsedCode = XLSX.SSF.parse_date_code(raw);
    if (parsedCode?.y && parsedCode?.m) {
      return finalize(parsedCode.y, parsedCode.m);
    }
    const maybeEpoch = new Date(raw);
    if (!Number.isNaN(maybeEpoch.getTime())) return finalize(maybeEpoch.getFullYear(), maybeEpoch.getMonth() + 1);
  }
  return null;
}

function toNum(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') return parseFloat(raw.replace(/,/g, '')) || 0;
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

function normalizeRowKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  Object.entries(row).forEach(([k, v]) => {
    out[normalizeKey(k)] = v;
  });
  return out;
}

function getByAliases(row: Record<string, unknown>, aliases: string[]): number {
  for (const alias of aliases) {
    const key = normalizeKey(alias);
    if (key in row) return toNum(row[key]);
  }
  return 0;
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

export default function ImportPage() {
  const perms = usePermissions();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedSheet[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [validation, setValidation] = useState<ValidationItem[]>([]);
  const [exportRange, setExportRange] = useState<'all' | 'year' | 'custom'>('all');
  const [exportYear, setExportYear] = useState(String(new Date().getFullYear()));
  const [exportStart, setExportStart] = useState('');
  const [exportEnd, setExportEnd] = useState('');

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

  const areRowsEquivalent = (incoming: Record<string, unknown>, existing: Record<string, unknown> | undefined): boolean => {
    if (!existing) return false;
    return Object.entries(incoming).every(([key, value]) => {
      if (key === 'month') return String(value) === String(existing[key] ?? '');
      return Math.abs(toNum(value) - toNum(existing[key])) < 0.0001;
    });
  };

  function computeRelationshipValidation(sheets: ParsedSheet[]): ValidationItem[] {
    const mptSheet = sheets.find((s) => s.name === 'MPT');
    const atomSheet = sheets.find((s) => s.name === 'Atom');
    const ringtuneSheet = sheets.find((s) => s.name === 'Ringtune');
    const eaucSheet = sheets.find((s) => s.name === 'EAUC');
    const comboSheet = sheets.find((s) => s.name === 'Combo');
    if (!mptSheet || !atomSheet) return [];

    const byMonth = new Map<string, Record<string, number>>();
    mptSheet.rows.forEach((rawRow) => {
      const row = normalizeRowKeys(rawRow);
      const month = normalizeMonth(rawRow.Month ?? rawRow.month ?? row.month);
      if (!month) return;
      const hasLegacyColumns =
        'legacy_ringtune' in row ||
        ('Legacy' in rawRow && '__EMPTY' in rawRow && '__EMPTY_1' in rawRow);
      if (!hasLegacyColumns) return;
      const legacyParsed = 'legacy_ringtune' in row ? row : { ...row, ...parseLegacyMptRow(rawRow) };
      byMonth.set(month, {
        mptRingtune:
          getByAliases(legacyParsed, ['legacy_ringtune', 'legacy ringtune']) +
          getByAliases(legacyParsed, ['etrade_ringtune', 'etrade ringtune']) +
          getByAliases(legacyParsed, ['fortune_ringtune', 'fortune ringtune']) +
          getByAliases(legacyParsed, ['unico_ringtune', 'unico ringtune']),
        mptEauc:
          getByAliases(legacyParsed, ['legacy_eauc', 'legacy eauc']) +
          getByAliases(legacyParsed, ['etrade_eauc', 'etrade eauc']) +
          getByAliases(legacyParsed, ['fortune_eauc', 'fortune eauc']) +
          getByAliases(legacyParsed, ['unico_eauc', 'unico eauc']),
        mptCombo:
          getByAliases(legacyParsed, ['legacy_combo', 'legacy combo']) +
          getByAliases(legacyParsed, ['etrade_combo', 'etrade combo']) +
          getByAliases(legacyParsed, ['fortune_combo', 'fortune combo']) +
          getByAliases(legacyParsed, ['unico_combo', 'unico combo']),
      });
    });

    const atomByMonth = new Map<string, { ringtune: number; eauc: number; combo: number }>();
    atomSheet.rows.forEach((rawRow) => {
      const row = normalizeRowKeys(rawRow);
      const month = normalizeMonth(row.month);
      if (!month) return;
      atomByMonth.set(month, {
        ringtune: getByAliases(row, ['ringtune']),
        eauc: getByAliases(row, ['eauc']),
        combo: getByAliases(row, ['combo']),
      });
    });

    const checks: ValidationItem[] = [];
    const checkDiff = (label: string, expected: number, actual: number) => {
      const denominator = Math.max(Math.abs(expected), 1);
      const pct = Math.abs(actual - expected) / denominator;
      if (pct > 0.01) checks.push({ level: 'critical', message: `${label} mismatch: Excel ${actual.toLocaleString()} vs expected ${expected.toLocaleString()}` });
      else if (pct > 0) checks.push({ level: 'warn', message: `${label} mismatch: Excel ${actual.toLocaleString()} vs expected ${expected.toLocaleString()} (rounding)` });
      else checks.push({ level: 'ok', message: `${label} matches source totals` });
    };

    const ringByMonth = new Map<string, number>();
    ringtuneSheet?.rows.forEach((rawRow) => {
      const row = normalizeRowKeys(rawRow);
      const month = normalizeMonth(row.month);
      if (!month) return;
      ringByMonth.set(month, getByAliases(row, ['mpt']));
    });
    const eaucByMonth = new Map<string, number>();
    eaucSheet?.rows.forEach((rawRow) => {
      const row = normalizeRowKeys(rawRow);
      const month = normalizeMonth(row.month);
      if (!month) return;
      eaucByMonth.set(month, getByAliases(row, ['atom']));
    });
    const comboByMonth = new Map<string, number>();
    comboSheet?.rows.forEach((rawRow) => {
      const row = normalizeRowKeys(rawRow);
      const month = normalizeMonth(row.month);
      if (!month) return;
      comboByMonth.set(month, getByAliases(row, ['mpt']));
    });

    for (const [month, val] of Array.from(byMonth.entries())) {
      if (ringByMonth.has(month)) checkDiff(`Ringtune.MPT (${month})`, val.mptRingtune, ringByMonth.get(month) ?? 0);
      if (comboByMonth.has(month)) checkDiff(`Combo.MPT (${month})`, val.mptCombo, comboByMonth.get(month) ?? 0);
      const atomVal = atomByMonth.get(month);
      if (atomVal && eaucByMonth.has(month)) checkDiff(`EAUC.Atom (${month})`, atomVal.eauc, eaucByMonth.get(month) ?? 0);
    }

    return checks;
  }

  const parseFile = useCallback((f: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      if (!data || (typeof data !== 'string' && !(data instanceof ArrayBuffer))) return;
      const wb = XLSX.read(data, {
        type: data instanceof ArrayBuffer ? 'array' : 'binary',
      });
      const sheets: ParsedSheet[] = [];
      wb.SheetNames.forEach((name) => {
        const ws = wb.Sheets[name];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: 0 });
        sheets.push({ name, rows });
      });
      setPreview(sheets);
      setValidation(computeRelationshipValidation(sheets));
      setResult(null);
    };
    if (f.name.endsWith('.xlsx')) reader.readAsArrayBuffer(f);
    else reader.readAsBinaryString(f);
  }, []);

  async function handleImport() {
    if (!file || preview.length === 0) {
      toast.error('Parse a file first');
      return;
    }
    setUploading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Not signed in');
      setUploading(false);
      return;
    }
    const hasCritical = validation.some((v) => v.level === 'critical');
    if (hasCritical) {
      toast.error('Import blocked due to critical relationship mismatches (>1%).');
      setUploading(false);
      return;
    }
    try {
      const res = await importExcelAction(preview, file.name);
      if (res.error) {
        toast.error(res.error);
        setUploading(false);
        return;
      }
      const { inserted = 0, updated = 0, skipped = 0, warnings = [] } = res;
      setResult({ inserted, updated, skipped, warnings });
      toast.success(`Import complete: ${inserted} inserted, ${updated} updated, ${skipped} unchanged skipped`);

      try {
        const bucket = supabase.storage.from('imports');
        await bucket.upload(`${user.id}/${Date.now()}-${file.name}`, file, { upsert: true });
      } catch {
        // Storage upload is best-effort; import already succeeded
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleExport() {
    const supabase = createClient();
    const workbook = XLSX.utils.book_new();
    const monthFilter = (month: string) => {
      if (exportRange === 'all') return true;
      if (exportRange === 'year') return month.startsWith(`${exportYear}-`);
      if (exportRange === 'custom') {
        if (!exportStart || !exportEnd) return true;
        return month >= `${exportStart}-01` && month <= `${exportEnd}-01`;
      }
      return true;
    };

    for (const sheetName of EXPORT_SHEETS) {
      const table = SHEET_TABLE_MAP[sheetName];
      if (!table) continue;
      const { data } = await supabase.from(table).select('*').order('month', { ascending: true });
      const rows = (data ?? []).filter((r) => monthFilter(String(r.month)));
      const cleaned = rows.map((r) => {
        const out: Record<string, unknown> = {};
        Object.entries(r).forEach(([k, v]) => {
          if (['sqlid', 'created_at', 'updated_at'].includes(k)) return;
          out[k] = v;
        });
        return out;
      });
      const ws = XLSX.utils.json_to_sheet(cleaned);
      XLSX.utils.book_append_sheet(workbook, ws, sheetName);
    }
    XLSX.writeFile(workbook, `legacy-revenue-export-${Date.now()}.xlsx`);
  }

  if (!perms.loading && !perms.isAdmin && !perms.can.importExcel) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-title font-bold text-primary tracking-tight">Import Excel</h1>
          <p className="text-body text-secondary mt-0.5">Upload .xlsx or .xls to bulk import revenue data</p>
        </div>
        <AccessDenied permissionName="can_import_excel" profile={perms.profile} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-title font-bold text-primary tracking-tight">Import Excel</h1>
        <p className="text-body text-secondary mt-0.5">Upload .xlsx or .xls to bulk import revenue data</p>
      </div>
      <div
        className="rounded-xl border-2 border-dashed border-border bg-card p-8 text-center transition-colors hover:border-teal/50"
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add('border-teal');
        }}
        onDragLeave={(e) => {
          e.currentTarget.classList.remove('border-teal');
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove('border-teal');
          const f = e.dataTransfer.files[0];
          if (f?.name.endsWith('.xlsx') || f?.name.endsWith('.xls')) {
            setFile(f);
            parseFile(f);
          } else toast.error('Use .xlsx or .xls');
        }}
      >
        <input
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          id="excel-upload"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setFile(f);
              parseFile(f);
            }
          }}
        />
        <label
          htmlFor="excel-upload"
          className="flex flex-col items-center gap-2 cursor-pointer text-secondary hover:text-teal transition-colors"
        >
          <UploadSimpleIcon weight="duotone" size={40} />
          Drop .xlsx here or click to browse
        </label>
        {file && <p className="mt-2 text-body text-primary font-medium">{file.name}</p>}
      </div>

      {preview.length > 0 && (
        <>
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-body font-semibold text-primary">Preview</h2>
            {validation.length > 0 && (
              <div className="mb-4 rounded-lg border border-border bg-elevated p-3">
                <p className="mb-2 text-body text-primary">Relationship Validation Summary</p>
                <ul className="space-y-1 text-caption">
                  {validation.slice(0, 12).map((item, idx) => (
                    <li key={idx} className={item.level === 'critical' ? 'text-red-400' : item.level === 'warn' ? 'text-amber-500' : 'text-teal'}>
                      {item.level === 'critical' ? '⚠' : item.level === 'warn' ? '⚠' : '✓'} {item.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="space-y-4">
              {preview.slice(0, 5).map((s) => (
                <div key={s.name}>
                  <p className="text-body text-teal font-medium">
                    {s.name} → {SHEET_TABLE_MAP[s.name] ?? '(no mapping)'}
                  </p>
                  <div className="mt-2 overflow-x-auto">
                    <table className="min-w-full text-left text-caption">
                      <thead>
                        <tr className="border-b border-border">
                          {Object.keys(s.rows[0] ?? {}).map((k) => (
                            <th key={k} className="p-2 font-medium text-secondary">
                              {k}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {s.rows.slice(0, 5).map((row, i) => (
                          <tr key={i} className="border-b border-border">
                            {Object.entries(row).map(([k, v], j) => (
                              <td key={j} className="p-2 text-primary">
                                {k.toLowerCase() === 'month'
                                  ? (normalizeMonth(v) ?? String(v))
                                  : typeof v === 'number'
                                    ? formatMMK(v)
                                    : String(v)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={handleImport}
            disabled={uploading}
            className="rounded-lg bg-teal px-4 py-2.5 font-medium text-background text-body hover:opacity-90 disabled:opacity-50 transition"
          >
            {uploading ? 'Importing…' : 'Import'}
          </button>
        </>
      )}

      {result && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-body font-semibold text-primary">Result</h3>
          <p className="text-body text-teal mt-1">Rows inserted: {result.inserted}</p>
          <p className="text-body text-teal">Rows updated: {result.updated}</p>
          <p className="text-body text-secondary">Rows unchanged (skipped): {result.skipped}</p>
          {result.warnings.length > 0 && (
            <ul className="mt-2 text-body text-amber-500">
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(perms.isAdmin || perms.can.exportData) && (
      <section id="export" className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-body font-semibold text-primary">Export to Excel (Legacy Format)</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <select value={exportRange} onChange={(e) => setExportRange(e.target.value as 'all' | 'year' | 'custom')} className="rounded border border-border bg-elevated px-2 py-1 text-caption text-primary">
            <option value="all">All months</option>
            <option value="year">Specific year</option>
            <option value="custom">Custom range</option>
          </select>
          {exportRange === 'year' && (
            <input value={exportYear} onChange={(e) => setExportYear(e.target.value)} className="rounded border border-border bg-elevated px-2 py-1 text-caption text-primary" />
          )}
          {exportRange === 'custom' && (
            <>
              <input type="month" value={exportStart} onChange={(e) => setExportStart(e.target.value)} className="rounded border border-border bg-elevated px-2 py-1 text-caption text-primary" />
              <input type="month" value={exportEnd} onChange={(e) => setExportEnd(e.target.value)} className="rounded border border-border bg-elevated px-2 py-1 text-caption text-primary" />
            </>
          )}
          <button type="button" onClick={handleExport} className="rounded-lg bg-teal px-4 py-2 text-body font-medium text-background">
            Export to Excel (Legacy Format)
          </button>
        </div>
      </section>
      )}
    </div>
  );
}
