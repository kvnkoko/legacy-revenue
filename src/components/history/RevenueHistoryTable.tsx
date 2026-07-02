'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';

type Row = { month: string; total: number } & Record<string, number | string>;
export type HistoryStream = { slug: string; name: string; color?: string };

export function RevenueHistoryTable({
  rows,
  streams,
  missingMonths,
}: {
  rows: Row[];
  streams: HistoryStream[];
  missingMonths: string[];
}) {
  const { formatCurrency } = useCurrency();
  const [sortKey, setSortKey] = useState<string>('month');
  const [asc, setAsc] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 24;

  const withMom = useMemo(() => {
    const sortedByMonth = [...rows].sort((a, b) => a.month.localeCompare(b.month));
    return sortedByMonth.map((row, idx): Row & { mom: number; momPct: number } => {
      const prev = idx > 0 ? Number(sortedByMonth[idx - 1].total) : 0;
      const mom = idx > 0 ? Number(row.total) - prev : 0;
      const momPct = prev ? (mom / prev) * 100 : 0;
      return { ...row, mom, momPct };
    });
  }, [rows]);

  const sorted = useMemo(() => {
    const out = [...withMom];
    out.sort((a, b) => {
      if (sortKey === 'month') return asc ? a.month.localeCompare(b.month) : b.month.localeCompare(a.month);
      const av = Number((a as Record<string, unknown>)[sortKey] ?? 0);
      const bv = Number((b as Record<string, unknown>)[sortKey] ?? 0);
      return asc ? av - bv : bv - av;
    });
    return out;
  }, [asc, sortKey, withMom]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);

  const headers: Array<{ key: string; label: string }> = [
    { key: 'month', label: 'Month' },
    ...streams.map((s) => ({ key: s.slug, label: s.name })),
    { key: 'total', label: 'Total' },
    { key: 'mom', label: 'MoM Change' },
    { key: 'momPct', label: 'MoM %' },
  ];

  return (
    <section className="rounded-xl border border-border bg-card p-3 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-body font-semibold text-primary">All-Time Monthly History</h2>
        <Link href="/import#export" className="rounded-md border border-border px-3 py-1 text-caption text-primary hover:bg-elevated">
          Export
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1200px] text-body">
          <thead>
            <tr className="border-b border-border">
              {headers.map((h) => (
                <th key={h.key} className="sticky top-0 bg-card p-2 text-left text-secondary">
                  <button
                    type="button"
                    onClick={() => {
                      if (sortKey === h.key) setAsc((v) => !v);
                      else {
                        setSortKey(h.key);
                        setAsc(false);
                      }
                    }}
                    className="hover:text-primary"
                  >
                    {h.label}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={row.month} className="border-b border-border last:border-0">
                <td className="sticky left-0 bg-card p-2 text-primary">{new Date(row.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</td>
                {streams.map((s) => (
                  <td key={s.slug} className="p-2 text-primary">{formatCurrency(Number(row[s.slug] ?? 0))}</td>
                ))}
                <td className="p-2 font-medium text-teal">{formatCurrency(Number(row.total))}</td>
                <td className={`p-2 ${Math.abs(row.mom) < 1 ? 'text-secondary' : row.mom > 0 ? 'text-teal' : 'text-red-400'}`}>{formatCurrency(row.mom)}</td>
                <td className={`p-2 ${Math.abs(row.momPct) < 1 ? 'text-secondary' : row.momPct > 0 ? 'text-teal' : 'text-red-400'}`}>{`${row.momPct >= 0 ? '+' : ''}${row.momPct.toFixed(1)}%`}</td>
              </tr>
            ))}
            {missingMonths.map((month) => (
              <tr key={`missing-${month}`} className="border-b border-border bg-red-500/5">
                <td className="sticky left-0 bg-red-500/5 p-2 text-red-300">
                  {new Date(month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </td>
                <td className="p-2" colSpan={streams.length + 3}>
                  <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
                    <span className="text-red-300">Missing month</span>
                    <Link
                      href={`/entry?month=${month}`}
                      className="rounded-md border border-red-400/70 bg-red-500/10 px-3 py-1.5 text-body font-medium text-red-100 hover:bg-red-500/20 w-full text-center sm:w-auto"
                    >
                      Fill Gap
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-border px-2 py-1 text-caption text-primary disabled:opacity-40">Prev</button>
        <span className="text-caption text-secondary">{page} / {totalPages}</span>
        <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border border-border px-2 py-1 text-caption text-primary disabled:opacity-40">Next</button>
      </div>
    </section>
  );
}
