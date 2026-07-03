'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { formatMMK } from '@/lib/utils';
import { importExcelAction } from '@/app/(dashboard)/import/actions';
import { createClient } from '@/lib/supabase/client';
import { fetchStreamConfig, fetchStreamMatrix } from '@/lib/streams/shared';
import { buildTemplateSpec } from '@/lib/streams/import-map';

type ParsedSheet = { name: string; rows: Record<string, unknown>[] };
type ExportRange = 'all' | 'year' | 'custom';

export function ImportExcelClient({ canExport = false }: { canExport?: boolean }) {
  const router = useRouter();
  const [drag, setDrag] = useState(false);
  const [parsed, setParsed] = useState<ParsedSheet[] | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ inserted: number; updated: number; warnings: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportRange, setExportRange] = useState<ExportRange>('all');
  const [exportYear, setExportYear] = useState(String(new Date().getFullYear()));
  const [exportStart, setExportStart] = useState('');
  const [exportEnd, setExportEnd] = useState('');

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Please upload an Excel file (.xlsx or .xls)');
      return;
    }
    setFilename(file.name);
    setRawFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) return;
        const wb = XLSX.read(data, { type: 'binary' });
        const sheets: ParsedSheet[] = wb.SheetNames.map((name) => {
          const ws = wb.Sheets[name];
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
          return { name, rows };
        });
        setParsed(sheets);
        setResult(null);
      } catch {
        toast.error('Failed to parse Excel file');
        setParsed(null);
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(true);
  }, []);
  const onDragLeave = useCallback(() => setDrag(false), []);

  const onImport = useCallback(async () => {
    if (!parsed?.length) return;
    setLoading(true);
    const res = await importExcelAction(parsed, filename || 'import.xlsx');
    setLoading(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setResult(res);
    toast.success(`Imported: ${res.inserted} inserted, ${res.updated} updated`);
    if (res.warnings?.length) res.warnings.forEach((w) => toast.warning(w));

    // Best-effort: keep the raw file for audit/reference; import already succeeded either way.
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && rawFile) {
        await supabase.storage.from('imports').upload(`${user.id}/${Date.now()}-${filename}`, rawFile, { upsert: true });
      }
    } catch {
      // Storage upload is best-effort; import already succeeded.
    }

    setParsed(null);
    router.refresh();
  }, [parsed, filename, rawFile, router]);

  const downloadTemplate = useCallback(async () => {
    try {
      const supabase = createClient();
      const config = await fetchStreamConfig(supabase);
      const spec = buildTemplateSpec(config);
      const wb = XLSX.utils.book_new();
      for (const { sheet, headers } of spec) {
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        XLSX.utils.book_append_sheet(wb, ws, sheet.slice(0, 31));
      }
      XLSX.writeFile(wb, `legacy-revenue-template-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      toast.error('Failed to build template from stream config');
    }
  }, []);

  // One sheet per entry stream, columns = current import keys (so the file
  // re-imports cleanly) — always reflects whatever streams/fields exist right
  // now, including ones added in Stream Management since the last export.
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const supabase = createClient();
      const config = await fetchStreamConfig(supabase);
      const entryStreams = config.streams.filter((s) => s.kind === 'entry' && s.isActive);
      const monthFilter = (month: string) => {
        if (exportRange === 'year') return month.startsWith(`${exportYear}-`);
        if (exportRange === 'custom') {
          if (!exportStart || !exportEnd) return true;
          return month >= `${exportStart}-01` && month <= `${exportEnd}-01`;
        }
        return true;
      };
      const wb = XLSX.utils.book_new();
      for (const stream of entryStreams) {
        const matrix = await fetchStreamMatrix(supabase, config, stream.slug);
        if (!matrix) continue;
        const rows = matrix.rows.filter((r) => monthFilter(String(r.month)));
        const aoa = [
          ['month', ...matrix.columns.map((c) => {
            const field = config.fields.find((f) => f.id === c.fieldId);
            return field?.attributes.import?.column_keys?.[0] ?? c.slug;
          })],
          ...rows.map((r) => [r.month, ...matrix.columns.map((c) => Number(r[c.slug] ?? 0))]),
        ];
        const sheetName = matrix.columns[0]
          ? config.fields.find((f) => f.id === matrix.columns[0].fieldId)?.attributes.import?.sheet ?? stream.name
          : stream.name;
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
      }
      XLSX.writeFile(wb, `legacy-revenue-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [exportRange, exportYear, exportStart, exportEnd]);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={downloadTemplate}
          className="rounded-lg border border-border px-3 py-1.5 text-caption text-secondary hover:bg-elevated"
        >
          Download template (matches current streams)
        </button>
      </div>
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`rounded-xl border-2 border-dashed p-5 sm:p-8 md:p-12 text-center transition ${
          drag ? 'border-gold bg-gold/5' : 'border-border bg-card'
        }`}
      >
        <p className="text-secondary mb-2">Drag and drop .xlsx here, or</p>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="hidden"
          id="excel-upload"
        />
        <label htmlFor="excel-upload" className="cursor-pointer rounded-lg bg-gold text-background px-4 py-2 font-medium inline-block hover:opacity-90">
          Choose file
        </label>
      </div>

      {parsed && parsed.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-primary mb-4">Preview</h2>
          <p className="text-secondary text-sm mb-4">
            Sheets: {parsed.map((s) => s.name).join(', ')}. Validate and import.
          </p>
          <div className="overflow-x-auto space-y-4 max-h-96 overflow-y-auto">
            {parsed.slice(0, 5).map((sheet) => (
              <div key={sheet.name}>
                <p className="text-gold font-medium mb-2">{sheet.name}</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      {sheet.rows[0] && Object.keys(sheet.rows[0]).map((k) => (
                        <th key={k} className="text-left py-1 px-2 text-muted">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-border">
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="py-1 px-2 text-secondary">
                            {typeof v === 'number' ? formatMMK(v) : String(v ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sheet.rows.length > 5 && <p className="text-muted text-xs mt-1">… and {sheet.rows.length - 5} more rows</p>}
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onImport}
              disabled={loading}
              className="w-full rounded-lg bg-gold text-background font-medium px-4 py-2 hover:opacity-90 disabled:opacity-50 sm:w-auto"
            >
              {loading ? 'Importing…' : 'Import'}
            </button>
            <button
              type="button"
              onClick={() => setParsed(null)}
              className="w-full rounded-lg border border-border px-4 py-2 text-secondary hover:bg-elevated sm:w-auto"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-primary mb-2">Import results</h2>
          <p className="text-secondary text-sm">Inserted: {result.inserted} | Updated: {result.updated}</p>
          {result.warnings?.length > 0 && (
            <ul className="mt-2 text-amber text-sm list-disc list-inside">
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {canExport && (
        <section id="export" className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-body font-semibold text-primary">Export to Excel</h2>
          <p className="mt-1 text-caption text-secondary">
            One sheet per revenue stream, matching whatever streams and fields are configured right now.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <select
              value={exportRange}
              onChange={(e) => setExportRange(e.target.value as ExportRange)}
              className="rounded border border-border bg-elevated px-2 py-1 text-caption text-primary"
            >
              <option value="all">All months</option>
              <option value="year">Specific year</option>
              <option value="custom">Custom range</option>
            </select>
            {exportRange === 'year' && (
              <input
                value={exportYear}
                onChange={(e) => setExportYear(e.target.value)}
                className="w-24 rounded border border-border bg-elevated px-2 py-1 text-caption text-primary"
              />
            )}
            {exportRange === 'custom' && (
              <>
                <input type="month" value={exportStart} onChange={(e) => setExportStart(e.target.value)} className="rounded border border-border bg-elevated px-2 py-1 text-caption text-primary" />
                <input type="month" value={exportEnd} onChange={(e) => setExportEnd(e.target.value)} className="rounded border border-border bg-elevated px-2 py-1 text-caption text-primary" />
              </>
            )}
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="rounded-lg bg-gold px-4 py-2 text-body font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              {exporting ? 'Exporting…' : 'Export to Excel'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
