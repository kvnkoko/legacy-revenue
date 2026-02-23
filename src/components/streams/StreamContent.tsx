'use client';

import { formatMMK, formatStreamLabel } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
type StreamTab = 'ringtune' | 'mpt' | 'eauc' | 'combo' | 'sznb' | 'flow_subscription' | 'youtube' | 'spotify' | 'tiktok';

type StreamData = {
  ringtune: unknown[];
  mpt: unknown[];
  eauc: unknown[];
  combo: unknown[];
  sznb: unknown[];
  flow_subscription: unknown[];
  youtube: unknown[];
  spotify: unknown[];
  tiktok: unknown[];
};

export function StreamContent({ tab, data }: { tab: StreamTab; data: StreamData }) {
  const rows = data[tab] as Record<string, unknown>[];

  if (!rows?.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-secondary">
        No data for this stream yet.
      </div>
    );
  }

  const keys = Object.keys(rows[0]).filter(
    (k) => !['id', 'created_at', 'updated_at', 'month'].includes(k)
  );

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-elevated">
              <th className="text-left py-3 px-4 font-semibold text-primary">Month</th>
              {keys.map((k) => (
                <th key={k} className="text-right py-3 px-4 font-semibold text-secondary capitalize">
                  {formatStreamLabel(k)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.id)} className="border-b border-border hover:bg-elevated/50">
                <td className="py-2.5 px-4 text-primary">
                  {row.month ? format(parseISO(String(row.month)), 'MMM yyyy') : '—'}
                </td>
                {keys.map((k) => {
                  const v = row[k];
                  const num = typeof v === 'number' ? v : Number(v);
                  const isTotal = k === 'total';
                  return (
                    <td
                      key={k}
                      className={`py-2.5 px-4 text-right ${isTotal ? 'font-medium text-teal' : 'text-secondary'}`}
                    >
                      {typeof v === 'number' || (typeof v === 'string' && !Number.isNaN(Number(v)))
                        ? formatMMK(num)
                        : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
