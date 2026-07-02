'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Brush } from 'recharts';
import { filterMonthsByRange, formatMMK, type TimeRangeKey } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { TimeRangeSelector } from '@/components/charts/TimeRangeSelector';
import type { StreamConfig, StreamDef, StreamMatrix } from '@/lib/streams/types';
import {
  fetchStreamConfig,
  fetchStreamMatrix,
  lineageLines,
  STREAM_FALLBACK_COLORS,
} from '@/lib/streams/shared';

export function StreamsView() {
  const [config, setConfig] = useState<StreamConfig | null>(null);
  const [active, setActive] = useState('ringtune');
  const [range, setRange] = useState<TimeRangeKey>('12M');
  const [loadAll, setLoadAll] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [matrix, setMatrix] = useState<StreamMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    fetchStreamConfig(supabase).then((cfg) => {
      if (cancelled) return;
      setConfig(cfg);
      // Default to the first tab if the current slug does not exist.
      if (!cfg.streams.some((s) => s.slug === active && s.kind !== 'summary')) {
        const first = cfg.streams.find((s) => s.kind !== 'summary');
        if (first) setActive(first.slug);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    setLoading(true);
    const fromMonth = (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 11);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    })();
    fetchStreamMatrix(supabase, config, active, loadAll ? {} : { fromMonth })
      .then((m) => {
        if (cancelled) return;
        setMatrix(m);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, loadAll, config]);

  const tabs = useMemo(
    () => (config?.streams ?? []).filter((s) => s.kind !== 'summary'),
    [config]
  );
  const activeStream: StreamDef | undefined = tabs.find((s) => s.slug === active);
  const columns = matrix?.columns ?? [];

  const filteredData = filterMonthsByRange(
    (matrix?.rows ?? []) as Array<{ month: string }>,
    range,
    customStart ? `${customStart}-01` : undefined,
    customEnd ? `${customEnd}-01` : undefined
  ) as Record<string, unknown>[];
  const chartData = filteredData.map((r) => ({
    month: new Date((r.month as string) || '').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    ...Object.fromEntries(columns.map((c) => [c.slug, Number((r[c.slug] as number) ?? 0)])),
  }));

  const lineage = useMemo(
    () => (config && activeStream ? lineageLines(config, activeStream) : []),
    [config, activeStream]
  );

  // Streams that feed this one (derived) or that this one feeds (entry).
  const relatedStreams = useMemo(() => {
    if (!config || !activeStream) return [];
    const fieldById = new Map(config.fields.map((f) => [f.id, f]));
    const ids = new Set<string>();
    if (activeStream.kind === 'derived') {
      for (const link of config.links.filter((l) => l.targetStreamId === activeStream.id)) {
        const field = fieldById.get(link.sourceFieldId);
        if (field) ids.add(field.streamId);
      }
    } else {
      for (const link of config.links) {
        const field = fieldById.get(link.sourceFieldId);
        if (field && field.streamId === activeStream.id) ids.add(link.targetStreamId);
      }
    }
    return config.streams.filter((s) => ids.has(s.id));
  }, [config, activeStream]);

  const stacked = columns.length > 3;

  if (!config) {
    return <div className="h-64 animate-pulse rounded-xl bg-elevated" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto border-b border-border pb-2.5">
        {tabs.map((tab) => (
          <button
            key={tab.slug}
            type="button"
            onClick={() => setActive(tab.slug)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-caption sm:text-body font-medium transition-colors',
              active === tab.slug ? 'bg-teal/10 text-teal' : 'text-secondary hover:bg-elevated hover:text-primary'
            )}
          >
            <span
              className={cn(
                'text-[11px] leading-none',
                tab.kind === 'entry' ? 'text-amber-400' : 'text-teal'
              )}
              aria-hidden
            >
              {tab.kind === 'entry' ? '✎' : '⟵'}
            </span>
            {tab.name}
          </button>
        ))}
      </div>
      <div className="rounded-lg border border-border bg-elevated p-3">
        <p className="mb-2 text-caption text-secondary">Data Lineage</p>
        <div className="flex flex-wrap gap-2">
          {lineage.map((line) => (
            <span key={line} className="rounded-full border border-border px-2 py-1 text-[11px] leading-none text-secondary">
              {line}
            </span>
          ))}
        </div>
        {relatedStreams.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-caption">
            <span className="text-secondary">
              {activeStream?.kind === 'derived' ? 'Computed from:' : 'Also counts toward:'}
            </span>
            {relatedStreams.map((s) => (
              <button key={s.slug} type="button" className="text-teal underline" onClick={() => setActive(s.slug)}>
                {s.name}
              </button>
            ))}
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
                      key={c.slug}
                      dataKey={c.slug}
                      name={c.label}
                      fill={STREAM_FALLBACK_COLORS[i % STREAM_FALLBACK_COLORS.length]}
                      stackId={stacked ? 'stack' : undefined}
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
                    <th key={c.slug} className="p-3 font-medium text-secondary">
                      {c.label}
                    </th>
                  ))}
                  <th className="p-3 font-medium text-secondary">Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="p-3 text-primary">
                      {new Date((row.month as string) || '').toLocaleDateString('en-US', {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    {columns.map((c) => (
                      <td key={c.slug} className="p-3 text-primary">
                        {formatMMK(row[c.slug] as number)}
                      </td>
                    ))}
                    <td className="p-3 font-medium text-teal">{formatMMK(row.total as number)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
