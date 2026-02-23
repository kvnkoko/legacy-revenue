'use client';

import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, Brush, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format, parseISO } from 'date-fns';
import { TimeRangeSelector } from '@/components/charts/TimeRangeSelector';
import { filterMonthsByRange, formatMMK, rollingAverage, STREAM_COLORS, type TimeRangeKey } from '@/lib/utils';

type Row = Record<string, unknown>;

export function AnalyticsCharts({
  summary,
  ringtune,
  mpt,
  atom,
}: {
  summary: Row[];
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
    return [
      { name: 'Ringtune', value: (Number(last.ringtune ?? 0) / total) * 100, color: STREAM_COLORS.ringtune },
      { name: 'EAUC', value: (Number(last.eauc ?? 0) / total) * 100, color: STREAM_COLORS.eauc },
      { name: 'Combo', value: (Number(last.combo ?? 0) / total) * 100, color: STREAM_COLORS.combo },
      { name: 'SZNB', value: (Number(last.sznb ?? 0) / total) * 100, color: STREAM_COLORS.sznb },
      { name: 'Flow', value: (Number(last.flow_subscription ?? 0) / total) * 100, color: STREAM_COLORS.flow_subscription },
      { name: 'YouTube', value: (Number(last.youtube ?? 0) / total) * 100, color: STREAM_COLORS.youtube },
      { name: 'Spotify', value: (Number(last.spotify ?? 0) / total) * 100, color: STREAM_COLORS.spotify },
      { name: 'TikTok', value: (Number(last.tiktok ?? 0) / total) * 100, color: STREAM_COLORS.tiktok },
    ].filter((s) => s.value > 0);
  }, [filtered]);

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
    Direct: Number(row.sznb ?? 0) + Number(row.flow_subscription ?? 0) + Number(row.youtube ?? 0) + Number(row.spotify ?? 0) + Number(row.tiktok ?? 0),
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
    const streams = ['ringtune', 'eauc', 'combo', 'sznb', 'flow_subscription', 'youtube', 'spotify', 'tiktok'] as const;
    return streams.map((key) => {
      const values = summary.map((r) => Number(r[key] ?? 0));
      const first = values.findIndex((v) => v > 0);
      const last3 = values.slice(-3).reduce((a, b) => a + b, 0);
      const prev3 = values.slice(-6, -3).reduce((a, b) => a + b, 0);
      const trend = last3 > prev3 * 1.05 ? 'growing' : last3 < prev3 * 0.95 ? 'declining' : 'stable';
      return {
        key,
        firstMonth: first >= 0 ? String(summary[first]?.month ?? '—') : '—',
        monthsActive: values.filter((v) => v > 0).length,
        allTimeTotal: values.reduce((a, b) => a + b, 0),
        trend,
      };
    });
  }, [summary]);

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
        <div className="rounded-xl border border-border bg-card p-5"><p className="text-secondary text-sm">Best Month Ever</p><p className="text-teal font-bold text-lg">{milestones.best.month ? format(parseISO(String(milestones.best.month)), 'MMM yyyy') : '—'}</p><p className="text-muted text-xs">{formatMMK(milestones.best.value)}</p></div>
        <div className="rounded-xl border border-border bg-card p-5"><p className="text-secondary text-sm">Worst Month</p><p className="text-primary font-bold text-lg">{milestones.worst.month ? format(parseISO(String(milestones.worst.month)), 'MMM yyyy') : '—'}</p><p className="text-muted text-xs">{formatMMK(milestones.worst.value)}</p></div>
        <div className="rounded-xl border border-border bg-card p-5"><p className="text-secondary text-sm">All-Time Total</p><p className="text-primary font-bold text-lg">{formatMMK(milestones.allTimeTotal)}</p></div>
        <div className="rounded-xl border border-border bg-card p-5"><p className="text-secondary text-sm">Average Monthly Revenue</p><p className="text-primary font-bold text-lg">{formatMMK(milestones.avg)}</p></div>
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
              <Area type="monotone" dataKey="total" stroke="#00d4c8" fill="#00d4c8" fillOpacity={0.25} />
              <Line type="monotone" dataKey="rolling3" stroke="#fff" strokeDasharray="4 4" dot={false} />
              {chartData.length > 18 && <Brush dataKey="monthLabel" height={16} stroke="#00d4c8" travellerWidth={8} />}
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
              <Line type="monotone" dataKey="cumulative" stroke="#00d4c8" dot={false} />
              <Line type="monotone" dataKey="projected" stroke="#fff" strokeDasharray="4 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-primary mb-4">Telecom Revenue (MPT + Atom + Ooredoo)</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="h-64"><p className="mb-2 text-caption text-secondary">Ringtune Source Split</p><ResponsiveContainer width="100%" height="100%"><BarChart data={telecom}><CartesianGrid strokeDasharray="3 3" stroke="#1e2535" /><XAxis dataKey="monthLabel" stroke="#8892a4" fontSize={12} /><YAxis stroke="#8892a4" fontSize={12} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} /><Tooltip formatter={(v: number) => formatMMK(v)} contentStyle={{ backgroundColor: '#161b24', border: '1px solid #1e2535', borderRadius: 8 }} /><Bar dataKey="MPT" stackId="a" fill="#00d4c8" /><Bar dataKey="Atom" stackId="a" fill="#3b82f6" /><Bar dataKey="Ooredoo" stackId="a" fill="#8b5cf6" /></BarChart></ResponsiveContainer></div>
          <div className="h-64"><p className="mb-2 text-caption text-secondary">Telecom vs Direct Split</p><ResponsiveContainer width="100%" height="100%"><BarChart data={telecomVsDirect}><CartesianGrid strokeDasharray="3 3" stroke="#1e2535" /><XAxis dataKey="monthLabel" stroke="#8892a4" fontSize={12} /><YAxis stroke="#8892a4" fontSize={12} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} /><Tooltip formatter={(v: number) => formatMMK(v)} contentStyle={{ backgroundColor: '#161b24', border: '1px solid #1e2535', borderRadius: 8 }} /><Bar dataKey="Telecom" stackId="a" fill="#00d4c8" /><Bar dataKey="Direct" stackId="a" fill="#3b82f6" /></BarChart></ResponsiveContainer></div>
        </div>
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="h-64"><p className="mb-2 text-caption text-secondary">MPT Contribution</p><ResponsiveContainer width="100%" height="100%"><BarChart data={mptContribution}><CartesianGrid strokeDasharray="3 3" stroke="#1e2535" /><XAxis dataKey="monthLabel" stroke="#8892a4" fontSize={12} /><YAxis stroke="#8892a4" fontSize={12} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} /><Tooltip formatter={(v: number) => formatMMK(v)} contentStyle={{ backgroundColor: '#161b24', border: '1px solid #1e2535', borderRadius: 8 }} /><Bar dataKey="Ringtune" stackId="a" fill="#00d4c8" /><Bar dataKey="EAUC" stackId="a" fill="#3b82f6" /><Bar dataKey="Combo" stackId="a" fill="#8b5cf6" /></BarChart></ResponsiveContainer></div>
          <div className="h-64"><p className="mb-2 text-caption text-secondary">Atom Contribution</p><ResponsiveContainer width="100%" height="100%"><BarChart data={atomContribution}><CartesianGrid strokeDasharray="3 3" stroke="#1e2535" /><XAxis dataKey="monthLabel" stroke="#8892a4" fontSize={12} /><YAxis stroke="#8892a4" fontSize={12} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} /><Tooltip formatter={(v: number) => formatMMK(v)} contentStyle={{ backgroundColor: '#161b24', border: '1px solid #1e2535', borderRadius: 8 }} /><Bar dataKey="Ringtune" stackId="a" fill="#00d4c8" /><Bar dataKey="EAUC" stackId="a" fill="#3b82f6" /><Bar dataKey="Combo" stackId="a" fill="#8b5cf6" /></BarChart></ResponsiveContainer></div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-primary mb-4">Year-over-Year Comparison</h2>
        {yoy.length === 0 ? (
          <p className="text-secondary text-sm">YoY comparison will appear once we have data from the same months next year.</p>
        ) : (
          <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={yoy}><CartesianGrid strokeDasharray="3 3" stroke="#1e2535" /><XAxis dataKey="monthLabel" stroke="#8892a4" fontSize={12} /><YAxis stroke="#8892a4" fontSize={12} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} /><Tooltip formatter={(v: number) => formatMMK(v)} contentStyle={{ backgroundColor: '#161b24', border: '1px solid #1e2535', borderRadius: 8 }} /><Legend /><Bar dataKey="current" name="Current Year" fill="#00d4c8" /><Bar dataKey="previous" name="Previous Year" fill="#3b82f6" /></BarChart></ResponsiveContainer></div>
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
                  <td className="p-2 text-primary">{row.key}</td>
                  <td className="p-2 text-secondary">{row.firstMonth === '—' ? '—' : format(parseISO(row.firstMonth), 'MMM yyyy')}</td>
                  <td className="p-2 text-primary">{row.monthsActive}</td>
                  <td className="p-2 text-primary">{formatMMK(row.allTimeTotal)}</td>
                  <td className={`p-2 ${row.trend === 'growing' ? 'text-teal' : row.trend === 'declining' ? 'text-red-400' : 'text-secondary'}`}>{row.trend}</td>
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
