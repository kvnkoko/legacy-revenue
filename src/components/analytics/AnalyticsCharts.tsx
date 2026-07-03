'use client';

import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, Brush, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format, parseISO } from 'date-fns';
import { TimeRangeSelector } from '@/components/charts/TimeRangeSelector';
import { filterMonthsByRange, formatMMK, rollingAverage, type TimeRangeKey } from '@/lib/utils';

type Row = Record<string, unknown>;
type SummaryStream = { slug: string; name: string; color: string };

export function AnalyticsCharts({
  summary,
  streams,
  ringtune,
  mpt,
  atom,
}: {
  summary: Row[];
  streams: SummaryStream[];
  ringtune: Row[];
  mpt: Row[];
  atom: Row[];
}) {
  const [range, setRange] = useState<TimeRangeKey>('12M');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const filtered = useMemo(
    () =>
      filterMonthsByRange(summary as Array<{ month: string }>, range, customStart ? `${customStart}-01` : undefined, customEnd ? `${customEnd}-01` : undefined) as Row[],
    [customEnd, customStart, range, summary]
  );
  const chartData = useMemo(() => {
    const totals = filtered.map((d) => Number(d.total ?? 0));
    const rolling3 = rollingAverage(totals, 3);
    return filtered.map((d, idx) => ({
      ...d,
      monthLabel: d.month ? format(parseISO(String(d.month)), filtered.length > 24 ? "MMM ''yy" : 'MMM yy') : '',
      rolling3: rolling3[idx],
    }));
  }, [filtered]);

  const milestones = useMemo(() => {
    const totals = summary.map((r) => Number(r.total ?? 0));
    const allTimeTotal = totals.reduce((acc, v) => acc + v, 0);
    const avg = totals.length ? allTimeTotal / totals.length : 0;
    const best = summary.reduce<{ month: string | null; value: number }>(
      (acc, r) => (Number(r.total ?? 0) > acc.value ? { month: String(r.month), value: Number(r.total ?? 0) } : acc),
      { month: null, value: 0 }
    );
    const worst = summary.reduce<{ month: string | null; value: number }>(
      (acc, r) => (Number(r.total ?? 0) < acc.value ? { month: String(r.month), value: Number(r.total ?? 0) } : acc),
      { month: summary[0]?.month ? String(summary[0].month) : null, value: Number(summary[0]?.total ?? 0) }
    );
    return { allTimeTotal, avg, best, worst };
  }, [summary]);

  const share = useMemo(() => {
    if (!filtered.length) return [];
    const last = filtered[filtered.length - 1];
    const total = Number(last.total ?? 0) || 1;
    return streams
      .map((s) => ({ name: s.name, value: (Number(last[s.slug] ?? 0) / total) * 100, color: s.color }))
      .filter((s) => s.value > 0);
  }, [filtered, streams]);

  const telecom = useMemo(() => ringtune.map((r) => ({
    monthLabel: r.month ? format(parseISO(String(r.month)), 'MMM yy') : '',
    MPT: Number(r.mpt ?? 0),
    Atom: Number(r.atom ?? 0),
    Ooredoo: Number(r.ooredoo ?? 0),
  })), [ringtune]);

  const mptContribution = useMemo(() => mpt.map((row) => ({
    monthLabel: row.month ? format(parseISO(String(row.month)), 'MMM yy') : '',
    Ringtune: Number(row.legacy_ringtune ?? 0) + Number(row.etrade_ringtune ?? 0) + Number(row.fortune_ringtune ?? 0) + Number(row.unico_ringtune ?? 0),
    EAUC: Number(row.legacy_eauc ?? 0) + Number(row.etrade_eauc ?? 0) + Number(row.fortune_eauc ?? 0) + Number(row.unico_eauc ?? 0),
    Combo: Number(row.legacy_combo ?? 0) + Number(row.etrade_combo ?? 0) + Number(row.fortune_combo ?? 0) + Number(row.unico_combo ?? 0),
  })), [mpt]);

  const atomContribution = useMemo(() => atom.map((row) => ({
    monthLabel: row.month ? format(parseISO(String(row.month)), 'MMM yy') : '',
    Ringtune: Number(row.ringtune ?? 0),
    EAUC: Number(row.eauc ?? 0),
    Combo: Number(row.combo ?? 0),
  })), [atom]);

  const telecomVsDirect = useMemo(() => filtered.map((row) => ({
    monthLabel: row.month ? format(parseISO(String(row.month)), 'MMM yy') : '',
    Telecom: Number(row.ringtune ?? 0) + Number(row.eauc ?? 0) + Number(row.combo ?? 0),
    Direct: Number(row.total ?? 0) - (Number(row.ringtune ?? 0) + Number(row.eauc ?? 0) + Number(row.combo ?? 0)),
  })), [filtered]);

  const cumulative = useMemo(() => {
    const rows = [...summary].sort((a, b) => String(a.month).localeCompare(String(b.month)));
    let run = 0;
    const base: Array<{ monthLabel: string; cumulative: number; projected?: number }> = rows.map((r) => {
      run += Number(r.total ?? 0);
      return { monthLabel: format(parseISO(String(r.month)), "MMM ''yy"), cumulative: run };
    });
    const avgLast3 = rows.slice(-3).reduce((acc, r) => acc + Number(r.total ?? 0), 0) / Math.max(rows.slice(-3).length, 1);
    let projected = run;
    for (let i = 1; i <= 3; i += 1) {
      projected += avgLast3;
      base.push({ monthLabel: `+${i}M`, cumulative: projected, projected });
    }
    return base;
  }, [summary]);

  const yoy = useMemo(() => {
    const rows = [...summary].sort((a, b) => String(a.month).localeCompare(String(b.month)));
    if (rows.length < 13) return [];
    return rows.slice(-12).map((r) => {
      const d = new Date(String(r.month));
      const prev = new Date(d);
      prev.setFullYear(prev.getFullYear() - 1);
      const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-01`;
      const prevRow = rows.find((x) => String(x.month) === prevMonth);
      const current = Number(r.total ?? 0);
      const previous = Number(prevRow?.total ?? 0);
      const pct = previous ? ((current - previous) / previous) * 100 : 0;
      return { monthLabel: format(d, 'MMM'), current, previous, pct };
    });
  }, [summary]);

  const lifecycle = useMemo(() => {
    return streams.map(({ slug: key, name }) => {
      const values = summary.map((r) => Number(r[key] ?? 0));
      const first = values.findIndex((v) => v > 0);
      const last3 = values.slice(-3).reduce((a, b) => a + b, 0);
      const prev3 = values.slice(-6, -3).reduce((a, b) => a + b, 0);
      const trend = last3 > prev3 * 1.05 ? 'growing' : last3 < prev3 * 0.95 ? 'declining' : 'stable';
      return {
        key,
        name,
        firstMonth: first >= 0 ? String(summary[first]?.month ?? '—') : '—',
        monthsActive: values.filter((v) => v > 0).length,
        allTimeTotal: values.reduce((a, b) => a + b, 0),
        trend,
      };
    });
  }, [summary, streams]);

  const momComparison = useMemo(() => {
    if (summary.length < 2) return [];
    const last = summary[summary.length - 1];
    const prev = summary[summary.length - 2];
    return streams
      .map((s) => {
        const current = Number(last[s.slug] ?? 0);
        const previous = Number(prev[s.slug] ?? 0);
        const delta = current - previous;
        const pct = previous ? (delta / previous) * 100 : current > 0 ? 100 : 0;
        return { name: s.name, color: s.color, current, previous, delta, pct };
      })
      .filter((s) => s.current > 0 || s.previous > 0);
  }, [summary, streams]);

  const topMovers = useMemo(
    () => [...momComparison].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 3),
    [momComparison]
  );


  // How dependent are we on the biggest stream? 100 = perfectly even split.
  const concentration = useMemo(() => {
    const calc = (row: Row) => {
      const total = Number(row.total ?? 0);
      if (!total) return null;
      const shares = streams.map((s) => Number(row[s.slug] ?? 0) / total).filter((x) => x > 0);
      if (!shares.length) return null;
      const hhi = shares.reduce((a, x) => a + x * x, 0);
      const n = shares.length;
      const score = n > 1 ? Math.max(0, Math.min(100, ((1 - (hhi - 1 / n) / (1 - 1 / n)) * 100))) : 0;
      let top = streams[0];
      for (const st of streams) {
        if (Number(row[st.slug] ?? 0) > Number(row[top.slug] ?? 0)) top = st;
      }
      return { score, top, topShare: (Number(row[top.slug] ?? 0) / total) * 100 };
    };
    if (!summary.length) return null;
    const latest = calc(summary[summary.length - 1]);
    const prior = summary.length > 3 ? calc(summary[summary.length - 4]) : null;
    return latest ? { ...latest, scoreDelta: prior ? latest.score - prior.score : null } : null;
  }, [summary, streams]);

  // Which streams are heating up or cooling down (3M avg vs prior 3M).
  const momentum = useMemo(() => {
    const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    return streams
      .map((s) => {
        const vals = summary.map((r) => Number(r[s.slug] ?? 0));
        const a3 = avg(vals.slice(-3));
        const p3 = avg(vals.slice(-6, -3));
        const pct = p3 ? ((a3 - p3) / p3) * 100 : a3 > 0 ? 100 : 0;
        let up = 0;
        for (let i = vals.length - 1; i > 0; i -= 1) {
          if (vals[i] > vals[i - 1]) up += 1;
          else break;
        }
        let down = 0;
        for (let i = vals.length - 1; i > 0; i -= 1) {
          if (vals[i] < vals[i - 1]) down += 1;
          else break;
        }
        return { name: s.name, color: s.color, a3, p3, pct, up, down };
      })
      .filter((m) => m.a3 > 0 || m.p3 > 0)
      .sort((a, b) => b.pct - a.pct);
  }, [summary, streams]);

  const quarterly = useMemo(() => {
    const byQ = new Map<string, Record<string, number | string | null>>();
    for (const r of summary) {
      const d = new Date(String(r.month));
      const q = `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}`;
      if (!byQ.has(q)) {
        const base: Record<string, number | string | null> = { quarter: q, total: 0, months: 0 };
        for (const s of streams) base[s.slug] = 0;
        byQ.set(q, base);
      }
      const row = byQ.get(q)!;
      row.total = Number(row.total) + Number(r.total ?? 0);
      row.months = Number(row.months) + 1;
      for (const s of streams) row[s.slug] = Number(row[s.slug]) + Number(r[s.slug] ?? 0);
    }
    type QuarterRow = { quarter: string; total: number; months: number; qoq: number | null } & Record<string, number | string | null>;
    const rows = Array.from(byQ.values());
    return rows.map((r, i): QuarterRow => ({
      ...(r as QuarterRow),
      qoq: i > 0 && Number(rows[i - 1].total)
        ? ((Number(r.total) - Number(rows[i - 1].total)) / Number(rows[i - 1].total)) * 100
        : null,
    }));
  }, [summary, streams]);

  // Best/worst month per stream + latest-month outlier flags (>2 std dev).
  const recordsAnomalies = useMemo(() => {
    const records = streams
      .map((s) => {
        const vals = summary
          .map((r) => ({ month: String(r.month), v: Number(r[s.slug] ?? 0) }))
          .filter((x) => x.v > 0);
        if (!vals.length) return null;
        const best = vals.reduce((a, b) => (b.v > a.v ? b : a));
        const worst = vals.reduce((a, b) => (b.v < a.v ? b : a));
        return { name: s.name, color: s.color, best, worst };
      })
      .filter(Boolean) as Array<{ name: string; color: string; best: { month: string; v: number }; worst: { month: string; v: number } }>;

    const anomalies: Array<{ name: string; latest: number; mean: number; direction: 'above' | 'below' }> = [];
    for (const s of streams) {
      const vals = summary.map((r) => Number(r[s.slug] ?? 0));
      if (vals.length < 5) continue;
      const hist = vals.slice(0, -1).filter((v) => v > 0);
      if (hist.length < 4) continue;
      const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
      const sd = Math.sqrt(hist.reduce((a, b) => a + (b - mean) ** 2, 0) / hist.length);
      const latest = vals[vals.length - 1];
      if (sd > 0 && Math.abs(latest - mean) > 2 * sd) {
        anomalies.push({ name: s.name, latest, mean, direction: latest > mean ? 'above' : 'below' });
      }
    }
    return { records, anomalies };
  }, [summary, streams]);

  const seasonality = useMemo(() => {
    if (summary.length < 12) return [];
    const byMonth = new Map<number, number[]>();
    summary.forEach((r) => {
      const month = new Date(String(r.month)).getMonth() + 1;
      byMonth.set(month, [...(byMonth.get(month) ?? []), Number(r.total ?? 0)]);
    });
    return Array.from({ length: 12 }, (_, idx) => {
      const month = idx + 1;
      const values = byMonth.get(month) ?? [];
      const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      return { month, avg };
    });
  }, [summary]);

  if (!summary.length) {
    return <div className="rounded-xl border border-border bg-card p-12 text-center text-secondary">No data yet. Add or import data to see analytics.</div>;
  }

  const lastMonth = String(summary[summary.length - 1]?.month ?? '');
  const nextDue = (() => {
    if (!lastMonth) return '—';
    const d = new Date(lastMonth);
    d.setMonth(d.getMonth() + 1);
    return format(d, 'MMM yyyy');
  })();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TimeRangeSelector value={range} onChange={setRange} />
        {range === 'CUSTOM' && (
          <div className="flex gap-2">
            <input type="month" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="rounded border border-border bg-elevated px-2 py-1 text-caption text-primary" />
            <input type="month" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="rounded border border-border bg-elevated px-2 py-1 text-caption text-primary" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-5"><p className="text-secondary text-sm">Best Month Ever</p><p className="text-gold font-bold text-lg">{milestones.best.month ? format(parseISO(String(milestones.best.month)), 'MMM yyyy') : '—'}</p><p className="text-muted text-xs">{formatMMK(milestones.best.value)}</p></div>
        <div className="rounded-xl border border-border bg-card p-5"><p className="text-secondary text-sm">Worst Month</p><p className="text-primary font-bold text-lg">{milestones.worst.month ? format(parseISO(String(milestones.worst.month)), 'MMM yyyy') : '—'}</p><p className="text-muted text-xs">{formatMMK(milestones.worst.value)}</p></div>
        <div className="rounded-xl border border-border bg-card p-5"><p className="text-secondary text-sm">All-Time Total</p><p className="text-primary font-bold text-lg">{formatMMK(milestones.allTimeTotal)}</p></div>
        <div className="rounded-xl border border-border bg-card p-5"><p className="text-secondary text-sm">Average Monthly Revenue</p><p className="text-primary font-bold text-lg">{formatMMK(milestones.avg)}</p></div>
      </div>

      {momComparison.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-primary mb-1">Month-over-Month by Stream</h2>
          <p className="text-caption text-secondary mb-4">Latest recorded month vs the month before.</p>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {topMovers.map((m) => (
              <div key={m.name} className="rounded-lg border border-border bg-elevated p-3">
                <p className="text-caption text-secondary">Top mover</p>
                <p className="text-body font-semibold" style={{ color: m.color }}>{m.name}</p>
                <p className={`text-body font-bold ${m.pct >= 0 ? 'text-gold' : 'text-red-400'}`}>
                  {m.pct >= 0 ? '+' : ''}{m.pct.toFixed(1)}%
                </p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-body">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-2 text-left text-secondary">Stream</th>
                  <th className="p-2 text-right text-secondary">This Month</th>
                  <th className="p-2 text-right text-secondary">Last Month</th>
                  <th className="p-2 text-right text-secondary">Change</th>
                  <th className="p-2 text-right text-secondary">Change %</th>
                </tr>
              </thead>
              <tbody>
                {momComparison.map((m) => (
                  <tr key={m.name} className="border-b border-border last:border-0">
                    <td className="p-2 text-primary">
                      <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: m.color }} />
                      {m.name}
                    </td>
                    <td className="p-2 text-right text-primary">{formatMMK(m.current)}</td>
                    <td className="p-2 text-right text-secondary">{formatMMK(m.previous)}</td>
                    <td className={`p-2 text-right ${m.delta >= 0 ? 'text-gold' : 'text-red-400'}`}>{formatMMK(m.delta)}</td>
                    <td className={`p-2 text-right ${m.pct >= 0 ? 'text-gold' : 'text-red-400'}`}>{m.pct >= 0 ? '+' : ''}{m.pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-primary mb-1">Concentration &amp; Diversification</h2>
          <p className="text-caption text-secondary mb-4">How much you rely on your biggest stream (latest month).</p>
          {concentration ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <div className="rounded-lg border border-border bg-elevated p-4">
                  <p className="text-caption text-secondary">Biggest stream</p>
                  <p className="text-body font-semibold" style={{ color: concentration.top.color }}>{concentration.top.name}</p>
                  <p className="text-title font-bold text-primary">{concentration.topShare.toFixed(1)}%</p>
                  <p className="text-micro text-muted">of the latest month&apos;s revenue</p>
                </div>
                <div className="rounded-lg border border-border bg-elevated p-4">
                  <p className="text-caption text-secondary">Diversification score</p>
                  <p className={`text-title font-bold ${concentration.score >= 50 ? 'text-gold' : 'text-amber-400'}`}>
                    {concentration.score.toFixed(0)}<span className="text-caption text-muted"> / 100</span>
                  </p>
                  {concentration.scoreDelta != null && (
                    <p className={`text-micro ${concentration.scoreDelta >= 0 ? 'text-gold' : 'text-red-400'}`}>
                      {concentration.scoreDelta >= 0 ? '+' : ''}{concentration.scoreDelta.toFixed(1)} vs 3 months ago
                    </p>
                  )}
                </div>
              </div>
              <p className="text-caption text-secondary">
                {concentration.topShare > 60
                  ? `⚠ Over ${concentration.topShare.toFixed(0)}% of revenue comes from one stream — a dip in ${concentration.top.name} would hit the total hard.`
                  : `Revenue is reasonably spread out; no single stream dominates dangerously.`}
              </p>
            </div>
          ) : (
            <p className="text-secondary text-sm">Needs at least one month of data.</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-primary mb-1">Stream Momentum</h2>
          <p className="text-caption text-secondary mb-4">Last 3 months vs the 3 months before — who&apos;s heating up.</p>
          {momentum.length ? (
            <div className="space-y-2">
              {momentum.map((m) => (
                <div key={m.name} className="flex items-center gap-3 rounded-lg border border-border bg-elevated px-3 py-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: m.color }} />
                  <span className="min-w-24 text-body text-primary">{m.name}</span>
                  <span className={`text-body font-semibold ${m.pct >= 0 ? 'text-gold' : 'text-red-400'}`}>
                    {m.pct >= 0 ? '▲' : '▼'} {Math.abs(m.pct).toFixed(1)}%
                  </span>
                  <span className="ml-auto text-micro text-secondary">
                    {m.up >= 2 ? `${m.up} months growing` : m.down >= 2 ? `${m.down} months declining` : 'steady'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-secondary text-sm">Needs a few months of data.</p>
          )}
        </div>
      </div>

      {quarterly.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-primary mb-1">Quarterly View</h2>
          <p className="text-caption text-secondary mb-4">Totals by quarter, split by stream. Partial quarters are marked.</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={quarterly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" />
                <XAxis dataKey="quarter" stroke="#8892a4" fontSize={12} />
                <YAxis stroke="#8892a4" fontSize={12} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                <Tooltip formatter={(v: number) => formatMMK(v)} contentStyle={{ backgroundColor: '#161b24', border: '1px solid #1e2535', borderRadius: 8 }} />
                <Legend />
                {streams.map((st) => (
                  <Bar key={st.slug} dataKey={st.slug} name={st.name} stackId="q" fill={st.color} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {quarterly.map((q) => (
              <span key={String(q.quarter)} className="rounded-full border border-border px-2.5 py-1 text-micro text-secondary">
                {String(q.quarter)}{Number(q.months) < 3 ? ` (${q.months} mo)` : ''}:{' '}
                <span className="text-primary">{formatMMK(Number(q.total))}</span>
                {q.qoq != null && (
                  <span className={Number(q.qoq) >= 0 ? 'text-gold' : 'text-red-400'}>
                    {' '}{Number(q.qoq) >= 0 ? '+' : ''}{Number(q.qoq).toFixed(1)}%
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-primary mb-1">Records &amp; Anomalies</h2>
        <p className="text-caption text-secondary mb-4">Each stream&apos;s best and worst month, plus automatic flags when the latest month looks unusual.</p>
        {recordsAnomalies.anomalies.length > 0 && (
          <div className="mb-4 space-y-2">
            {recordsAnomalies.anomalies.map((a) => (
              <div key={a.name} className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-caption text-amber-200">
                ⚠ <span className="font-semibold">{a.name}</span> is unusually {a.direction === 'above' ? 'high' : 'low'} this month
                ({formatMMK(a.latest)} vs a typical {formatMMK(a.mean)}). Double-check the entry — or celebrate if it&apos;s real.
              </div>
            ))}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-body">
            <thead>
              <tr className="border-b border-border">
                <th className="p-2 text-left text-secondary">Stream</th>
                <th className="p-2 text-right text-secondary">Best Month</th>
                <th className="p-2 text-right text-secondary">Record High</th>
                <th className="p-2 text-right text-secondary">Worst Month</th>
                <th className="p-2 text-right text-secondary">Record Low</th>
              </tr>
            </thead>
            <tbody>
              {recordsAnomalies.records.map((r) => (
                <tr key={r.name} className="border-b border-border last:border-0">
                  <td className="p-2 text-primary">
                    <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />
                    {r.name}
                  </td>
                  <td className="p-2 text-right text-secondary">{format(parseISO(r.best.month), 'MMM yyyy')}</td>
                  <td className="p-2 text-right font-medium text-gold">{formatMMK(r.best.v)}</td>
                  <td className="p-2 text-right text-secondary">{format(parseISO(r.worst.month), 'MMM yyyy')}</td>
                  <td className="p-2 text-right text-primary">{formatMMK(r.worst.v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-primary mb-4">Monthly Revenue Trend</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" />
              <XAxis dataKey="monthLabel" stroke="#8892a4" fontSize={12} />
              <YAxis stroke="#8892a4" fontSize={12} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
              <Tooltip formatter={(v: number) => formatMMK(v)} contentStyle={{ backgroundColor: '#161b24', border: '1px solid #1e2535', borderRadius: 8 }} />
              <Area type="monotone" dataKey="total" stroke="#d4af37" fill="#d4af37" fillOpacity={0.25} />
              <Line type="monotone" dataKey="rolling3" stroke="#fff" strokeDasharray="4 4" dot={false} />
              {chartData.length > 18 && <Brush dataKey="monthLabel" height={16} stroke="#d4af37" travellerWidth={8} />}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-caption text-muted">Trend line improves accuracy with more months of data.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-primary mb-4">Cumulative Revenue Growth</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cumulative}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" />
              <XAxis dataKey="monthLabel" stroke="#8892a4" fontSize={12} />
              <YAxis stroke="#8892a4" fontSize={12} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
              <Tooltip formatter={(v: number) => formatMMK(v)} contentStyle={{ backgroundColor: '#161b24', border: '1px solid #1e2535', borderRadius: 8 }} />
              <Line type="monotone" dataKey="cumulative" stroke="#d4af37" dot={false} />
              <Line type="monotone" dataKey="projected" stroke="#fff" strokeDasharray="4 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-primary mb-4">Telecom Revenue (MPT + Atom + Ooredoo)</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="h-64"><p className="mb-2 text-caption text-secondary">Ringtune Source Split</p><ResponsiveContainer width="100%" height="100%"><BarChart data={telecom}><CartesianGrid strokeDasharray="3 3" stroke="#1e2535" /><XAxis dataKey="monthLabel" stroke="#8892a4" fontSize={12} /><YAxis stroke="#8892a4" fontSize={12} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} /><Tooltip formatter={(v: number) => formatMMK(v)} contentStyle={{ backgroundColor: '#161b24', border: '1px solid #1e2535', borderRadius: 8 }} /><Bar dataKey="MPT" stackId="a" fill="#d4af37" /><Bar dataKey="Atom" stackId="a" fill="#3b82f6" /><Bar dataKey="Ooredoo" stackId="a" fill="#8b5cf6" /></BarChart></ResponsiveContainer></div>
          <div className="h-64"><p className="mb-2 text-caption text-secondary">Telecom vs Direct Split</p><ResponsiveContainer width="100%" height="100%"><BarChart data={telecomVsDirect}><CartesianGrid strokeDasharray="3 3" stroke="#1e2535" /><XAxis dataKey="monthLabel" stroke="#8892a4" fontSize={12} /><YAxis stroke="#8892a4" fontSize={12} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} /><Tooltip formatter={(v: number) => formatMMK(v)} contentStyle={{ backgroundColor: '#161b24', border: '1px solid #1e2535', borderRadius: 8 }} /><Bar dataKey="Telecom" stackId="a" fill="#d4af37" /><Bar dataKey="Direct" stackId="a" fill="#3b82f6" /></BarChart></ResponsiveContainer></div>
        </div>
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="h-64"><p className="mb-2 text-caption text-secondary">MPT Contribution</p><ResponsiveContainer width="100%" height="100%"><BarChart data={mptContribution}><CartesianGrid strokeDasharray="3 3" stroke="#1e2535" /><XAxis dataKey="monthLabel" stroke="#8892a4" fontSize={12} /><YAxis stroke="#8892a4" fontSize={12} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} /><Tooltip formatter={(v: number) => formatMMK(v)} contentStyle={{ backgroundColor: '#161b24', border: '1px solid #1e2535', borderRadius: 8 }} /><Bar dataKey="Ringtune" stackId="a" fill="#d4af37" /><Bar dataKey="EAUC" stackId="a" fill="#3b82f6" /><Bar dataKey="Combo" stackId="a" fill="#8b5cf6" /></BarChart></ResponsiveContainer></div>
          <div className="h-64"><p className="mb-2 text-caption text-secondary">Atom Contribution</p><ResponsiveContainer width="100%" height="100%"><BarChart data={atomContribution}><CartesianGrid strokeDasharray="3 3" stroke="#1e2535" /><XAxis dataKey="monthLabel" stroke="#8892a4" fontSize={12} /><YAxis stroke="#8892a4" fontSize={12} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} /><Tooltip formatter={(v: number) => formatMMK(v)} contentStyle={{ backgroundColor: '#161b24', border: '1px solid #1e2535', borderRadius: 8 }} /><Bar dataKey="Ringtune" stackId="a" fill="#d4af37" /><Bar dataKey="EAUC" stackId="a" fill="#3b82f6" /><Bar dataKey="Combo" stackId="a" fill="#8b5cf6" /></BarChart></ResponsiveContainer></div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-primary mb-4">Year-over-Year Comparison</h2>
        {yoy.length === 0 ? (
          <p className="text-secondary text-sm">YoY comparison will appear once we have data from the same months next year.</p>
        ) : (
          <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={yoy}><CartesianGrid strokeDasharray="3 3" stroke="#1e2535" /><XAxis dataKey="monthLabel" stroke="#8892a4" fontSize={12} /><YAxis stroke="#8892a4" fontSize={12} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} /><Tooltip formatter={(v: number) => formatMMK(v)} contentStyle={{ backgroundColor: '#161b24', border: '1px solid #1e2535', borderRadius: 8 }} /><Legend /><Bar dataKey="current" name="Current Year" fill="#d4af37" /><Bar dataKey="previous" name="Previous Year" fill="#3b82f6" /></BarChart></ResponsiveContainer></div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-primary mb-4">Stream Lifecycle Tracking</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-body">
            <thead><tr className="border-b border-border"><th className="p-2 text-left text-secondary">Stream</th><th className="p-2 text-left text-secondary">First Month</th><th className="p-2 text-left text-secondary">Months Active</th><th className="p-2 text-left text-secondary">All-Time Total</th><th className="p-2 text-left text-secondary">Trend</th></tr></thead>
            <tbody>
              {lifecycle.map((row) => (
                <tr key={row.key} className="border-b border-border last:border-0">
                  <td className="p-2 text-primary">{row.name}</td>
                  <td className="p-2 text-secondary">{row.firstMonth === '—' ? '—' : format(parseISO(row.firstMonth), 'MMM yyyy')}</td>
                  <td className="p-2 text-primary">{row.monthsActive}</td>
                  <td className="p-2 text-primary">{formatMMK(row.allTimeTotal)}</td>
                  <td className={`p-2 ${row.trend === 'growing' ? 'text-gold' : row.trend === 'declining' ? 'text-red-400' : 'text-secondary'}`}>{row.trend}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-primary mb-4">Seasonality patterns become clearer with more data</h2>
        {seasonality.length === 0 ? <p className="text-secondary text-sm">Seasonality heatmap appears after 12+ months of data.</p> : (
          <div className="grid grid-cols-6 gap-2">
            {seasonality.map((s) => {
              const intensity = milestones.best.value ? Math.min(s.avg / milestones.best.value, 1) : 0;
              return <div key={s.month} className="rounded border border-border p-2" style={{ background: `rgba(0,212,200,${0.1 + intensity * 0.6})` }}><p className="text-caption text-secondary">{format(new Date(2025, s.month - 1, 1), 'MMM')}</p><p className="text-micro text-primary">{formatMMK(s.avg)}</p></div>;
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-primary mb-4">Stream share (current period)</h2>
        {share.length ? (
          <div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={share} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" nameKey="name">{share.map((s) => <Cell key={s.name} fill={s.color} />)}</Pie><Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} contentStyle={{ backgroundColor: '#161b24', border: '1px solid #1e2535', borderRadius: 8 }} /><Legend /></PieChart></ResponsiveContainer></div>
        ) : <p className="text-secondary text-sm">No stream breakdown for latest month.</p>}
      </div>

      <p className="text-caption text-muted">Last updated: {lastMonth ? format(parseISO(lastMonth), 'MMM yyyy') : '—'}. Next entry due: {nextDue}.</p>
    </div>
  );
}
