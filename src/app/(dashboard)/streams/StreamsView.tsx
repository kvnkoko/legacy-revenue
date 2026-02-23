'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Brush } from 'recharts';
import { filterMonthsByRange, formatMMK, formatStreamLabel, type TimeRangeKey } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { TimeRangeSelector } from '@/components/charts/TimeRangeSelector';

const TABS = [
  { id: 'ringtune', label: 'Ringtune', lineage: 'derived' as const },
  { id: 'mpt', label: 'MPT', lineage: 'source' as const },
  { id: 'atom', label: 'Atom', lineage: 'source' as const },
  { id: 'eauc', label: 'EAUC', lineage: 'derived' as const },
  { id: 'combo', label: 'Combo', lineage: 'derived' as const },
  { id: 'sznb', label: 'SZNB', lineage: 'direct' as const },
  { id: 'flow_subscription', label: 'Flow Subscription', lineage: 'direct' as const },
  { id: 'youtube', label: 'YouTube', lineage: 'direct' as const },
  { id: 'spotify', label: 'Spotify', lineage: 'direct' as const },
  { id: 'tiktok', label: 'TikTok', lineage: 'direct' as const },
];

export function StreamsView() {
  const [active, setActive] = useState('ringtune');
  const [range, setRange] = useState<TimeRangeKey>('12M');
  const [loadAll, setLoadAll] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    setLoading(true);
    const table = active === 'flow_subscription' ? 'flow_subscription' : active;
    const fromMonth = (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 11);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    })();
    let query = supabase.from(table).select('*').order('month', { ascending: true });
    if (!loadAll) query = query.gte('month', fromMonth);
    query.then(({ data: d, error }) => {
        if (!error) setData(d ?? []);
        setLoading(false);
      });
  }, [active, loadAll, supabase]);

  const columns = data.length
    ? (Object.keys(data[0] as object).filter(
        (k) => !['sqlid', 'created_at', 'updated_at', 'month', 'Month'].includes(k) && k !== 'total'
      ) as string[])
    : [];
  const filteredData = filterMonthsByRange(
    data as Array<{ month: string }>,
    range,
    customStart ? `${customStart}-01` : undefined,
    customEnd ? `${customEnd}-01` : undefined
  ) as Record<string, unknown>[];
  const chartData = filteredData.map((r) => ({
    month: new Date((r.month as string) || '').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    ...Object.fromEntries(
      columns.map((c) => [c, Number((r[c] as number) ?? 0)])
    ),
  }));

  const barColors = ['#00d4c8', '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#22c55e', '#ec4899'];
  const lineageText =
    active === 'ringtune'
      ? ['[MPT Sheet] -> [Ringtune MPT] -> [Ringtune Total] -> [Revenue]', '[Atom Sheet] -> [Ringtune Atom] -> [Ringtune Total]', '[Direct Entry] -> [Ringtune Ooredoo]']
      : active === 'eauc'
        ? ['[MPT Sheet] -> [EAUC MPT] -> [EAUC Total] -> [Revenue]', '[Atom Sheet] -> [EAUC Atom] -> [EAUC Total]']
        : active === 'combo'
          ? ['[MPT Sheet] -> [Combo MPT] -> [Combo Total] -> [Revenue]', '[Atom Sheet] -> [Combo Atom] -> [Combo Total]']
          : active === 'mpt'
            ? ['[MPT Sheet] -> [Ringtune MPT]', '[MPT Sheet] -> [EAUC MPT]', '[MPT Sheet] -> [Combo MPT]']
            : [`[${active}] -> [Revenue]`];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto border-b border-border pb-2.5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-caption sm:text-body font-medium transition-colors',
              active === tab.id ? 'bg-teal/10 text-teal' : 'text-secondary hover:bg-elevated hover:text-primary'
            )}
          >
            <span
              className={cn(
                'text-[11px] leading-none',
                tab.lineage === 'source' && 'text-amber-400',
                tab.lineage === 'derived' && 'text-teal',
                tab.lineage === 'direct' && 'text-blue-300'
              )}
              aria-hidden
            >
              {tab.lineage === 'source' && '◈'}
              {tab.lineage === 'derived' && '⟵'}
              {tab.lineage === 'direct' && '✎'}
            </span>
            {tab.label}
          </button>
        ))}
      </div>
      <div className="rounded-lg border border-border bg-elevated p-3">
        <p className="mb-2 text-caption text-secondary">Data Lineage</p>
        <div className="flex flex-wrap gap-2">
          {lineageText.map((line) => (
            <span key={line} className="rounded-full border border-border px-2 py-1 text-[11px] leading-none text-secondary">
              {line}
            </span>
          ))}
        </div>
        {active === 'mpt' && (
          <div className="mt-3 flex gap-2 text-caption">
            <span className="text-secondary">MPT data populates:</span>
            <button type="button" className="text-teal underline" onClick={() => setActive('ringtune')}>Ringtune (MPT)</button>
            <button type="button" className="text-teal underline" onClick={() => setActive('eauc')}>EAUC (MPT)</button>
            <button type="button" className="text-teal underline" onClick={() => setActive('combo')}>Combo (MPT)</button>
          </div>
        )}
      </div>
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <TimeRangeSelector value={range} onChange={setRange} />
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {range === 'CUSTOM' && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input type="month" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-full rounded border border-border bg-elevated px-2 py-1 text-caption text-primary" />
              <input type="month" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-full rounded border border-border bg-elevated px-2 py-1 text-caption text-primary" />
            </div>
          )}
          <button type="button" onClick={() => setLoadAll((v) => !v)} className="rounded border border-border px-2 py-1 text-caption text-secondary sm:ml-auto">
            {loadAll ? 'Show 12M' : 'Load All'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl bg-elevated" />
      ) : (
        <>
          <div className="h-80 rounded-xl border border-border bg-card p-4">
            {chartData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-muted text-body">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" />
                  <XAxis dataKey="month" stroke="#8892a4" fontSize={12} />
                  <YAxis stroke="#8892a4" fontSize={12} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                  <Tooltip
                    formatter={(v: number) => formatMMK(v)}
                    contentStyle={{ background: '#161b24', border: '1px solid #1e2535', borderRadius: 8 }}
                  />
                  <Legend />
                  {columns.map((c, i) => (
                    <Bar
                      key={c}
                      dataKey={c}
                      name={formatStreamLabel(c)}
                      fill={barColors[i % barColors.length]}
                      stackId={active === 'sznb' || active === 'mpt' ? 'stack' : undefined}
                    />
                  ))}
                  {chartData.length > 18 && <Brush dataKey="month" height={16} stroke="#00d4c8" travellerWidth={8} />}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="min-w-[900px] w-full text-left text-body">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-3 font-medium text-secondary">Month</th>
                  {columns.map((c) => (
                    <th key={c} className="p-3 font-medium text-secondary">
                      {formatStreamLabel(c)}
                    </th>
                  ))}
                  {(active === 'ringtune' || active === 'eauc' || active === 'combo') && <th className="p-3 font-medium text-secondary">Source</th>}
                  <th className="p-3 font-medium text-secondary">Total</th>
                </tr>
              </thead>
              <tbody>
                {(filteredData as Record<string, unknown>[]).map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="p-3 text-primary">
                      {new Date((row.month as string) || '').toLocaleDateString('en-US', {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    {columns.map((c) => (
                      <td key={c} className="p-3 text-primary">
                        {formatMMK(row[c] as number)}
                      </td>
                    ))}
                    {(active === 'ringtune' || active === 'eauc' || active === 'combo') && (
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1 text-micro">
                          <button type="button" onClick={() => setActive('mpt')} className="rounded bg-amber-500/15 px-2 py-0.5 text-amber-500">
                            ← MPT Sheet
                          </button>
                          <button type="button" onClick={() => setActive('atom')} className="rounded bg-amber-500/15 px-2 py-0.5 text-amber-500">
                            ← Atom Sheet
                          </button>
                          {active === 'ringtune' && <span className="rounded bg-blue-500/15 px-2 py-0.5 text-blue-300">Direct Entry</span>}
                        </div>
                      </td>
                    )}
                    <td className="p-3 font-medium text-teal">{formatMMK(row.total as number)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {active === 'tiktok' && (
            <p className="text-body text-amber-500">
              Months with missing data are highlighted in amber in the table (if any).
            </p>
          )}
        </>
      )}
    </div>
  );
}
