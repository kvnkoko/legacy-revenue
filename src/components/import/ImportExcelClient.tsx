'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { formatMMK } from '@/lib/utils';
import { importExcelAction } from '@/app/(dashboard)/import/actions';

type ParsedSheet = { name: string; rows: Record<string, unknown>[] };

export function ImportExcelClient() {
  const router = useRouter();
  const [drag, setDrag] = useState(false);
  const [parsed, setParsed] = useState<ParsedSheet[] | null>(null);
  const [result, setResult] = useState<{ inserted: number; updated: number; warnings: string[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Please upload an Excel file (.xlsx or .xls)');
      return;
    }
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
    const res = await importExcelAction(parsed);
    setLoading(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setResult(res);
    toast.success(`Imported: ${res.inserted} inserted, ${res.updated} updated`);
    setParsed(null);
    if (res.warnings?.length) res.warnings.forEach((w) => toast.warning(w));
    router.refresh();
  }, [parsed, router]);

  return (
    <div className="space-y-6">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`rounded-xl border-2 border-dashed p-5 sm:p-8 md:p-12 text-center transition ${
          drag ? 'border-teal bg-teal/5' : 'border-border bg-card'
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
        <label htmlFor="excel-upload" className="cursor-pointer rounded-lg bg-teal text-background px-4 py-2 font-medium inline-block hover:opacity-90">
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
                <p className="text-teal font-medium mb-2">{sheet.name}</p>
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
              className="w-full rounded-lg bg-teal text-background font-medium px-4 py-2 hover:opacity-90 disabled:opacity-50 sm:w-auto"
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
    </div>
  );
}
