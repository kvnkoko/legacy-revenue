'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';

type Row = {
  month: string;
  ringtune: number;
  eauc: number;
  combo: number;
  sznb: number;
  flow_subscription: number;
  youtube: number;
  spotify: number;
  tiktok: number;
  total: number;
};

type SortKey = keyof Row | 'mom' | 'momPct';

export function RevenueHistoryTable({
  rows,
  missingMonths,
}: {
  rows: Row[];
  missingMonths: string[];
}) {
  const { formatCurrency } = useCurrency();
  const [sortKey, setSortKey] = useState<SortKey>('month');
  const [asc, setAsc] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 24;

  const withMom = useMemo(() => {
    const sortedByMonth = [...rows].sort((a, b) => a.month.localeCompare(b.month));
    return sortedByMonth.map((row, idx) => {
      const prev = idx > 0 ? sortedByMonth[idx - 1].total : 0;
      const mom = idx > 0 ? row.total - prev : 0;
      const momPct = prev ? (mom / prev) * 100 : 0;
      return { ...row, mom, momPct };
    });
  }, [rows]);

  const sorted = useMemo(() => {
    const out = [...withMom];
    out.sort((a, b) => {
      const av = Number(a[sortKey as keyof typeof a] ?? 0);
      const bv = Number(b[sortKey as keyof typeof b] ?? 0);
      if (sortKey === 'month') return asc ? a.month.localeCompare(b.month) : b.month.localeCompare(a.month);
      return asc ? av - bv : bv - av;
    });
    return out;
  }, [asc, sortKey, withMom]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);

  const headers: Array<{ key: SortKey; label: string }> = [
    { key: 'month', label: 'Month' },
    { key: 'ringtune', label: 'Ringtune' },
    { key: 'eauc', label: 'EAUC' },
    { key: 'combo', label: 'Combo' },
    { key: 'sznb', label: 'SZNB' },
    { key: 'flow_subscription', label: 'Flow Sub' },
    { key: 'youtube', label: 'YouTube' },
    { key: 'spotify', label: 'Spotify' },
    { key: 'tiktok', label: 'TikTok' },
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
                <td className="p-2 text-primary">{formatCurrency(row.ringtune)}</td>
                <td className="p-2 text-primary">{formatCurrency(row.eauc)}</td>
                <td className="p-2 text-primary">{formatCurrency(row.combo)}</td>
                <td className="p-2 text-primary">{formatCurrency(row.sznb)}</td>
                <td className="p-2 text-primary">{formatCurrency(row.flow_subscription)}</td>
                <td className="p-2 text-primary">{formatCurrency(row.youtube)}</td>
                <td className="p-2 text-primary">{formatCurrency(row.spotify)}</td>
                <td className="p-2 text-primary">{formatCurrency(row.tiktok)}</td>
                <td className="p-2 font-medium text-teal">{formatCurrency(row.total)}</td>
                <td className={`p-2 ${Math.abs(row.mom) < 1 ? 'text-secondary' : row.mom > 0 ? 'text-teal' : 'text-red-400'}`}>{formatCurrency(row.mom)}</td>
                <td className={`p-2 ${Math.abs(row.momPct) < 1 ? 'text-secondary' : row.momPct > 0 ? 'text-teal' : 'text-red-400'}`}>{`${row.momPct >= 0 ? '+' : ''}${row.momPct.toFixed(1)}%`}</td>
              </tr>
            ))}
            {missingMonths.map((month) => (
              <tr key={`missing-${month}`} className="border-b border-border bg-red-500/5">
                <td className="sticky left-0 bg-red-500/5 p-2 text-red-300">
                  {new Date(month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </td>
                <td className="p-2" colSpan={11}>
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
