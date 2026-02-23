'use client';

import { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import { formatMMK, formatStreamLabel, STREAM_COLORS } from '@/lib/utils';
import type { RevenueSummaryRow } from '@/lib/db/revenue';

const STREAM_KEYS = ['ringtune', 'eauc', 'combo', 'sznb', 'flow_subscription', 'youtube', 'spotify', 'tiktok'] as const;

export function AnalyticsDashboard({ summary }: { summary: RevenueSummaryRow[] }) {
  const [exporting, setExporting] = useState(false);

  const chartData = useMemo(
    () =>
      summary.map((r) => ({
        month: new Date(r.month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        fullMonth: r.month,
        ...STREAM_KEYS.reduce((acc, k) => ({ ...acc, [k]: Number((r as Record<string, unknown>)[k] ?? 0) }), {}),
        total: Number(r.total ?? 0),
      })),
    [summary]
  );

  const ytd = useMemo(() => summary.reduce((a, r) => a + Number(r.total ?? 0), 0), [summary]);
  const avg = summary.length ? ytd / summary.length : 0;
  const best = useMemo(() => {
    if (!chartData.length) return { month: '—', value: 0 };
    const b = chartData.reduce((acc, d) => (d.total > acc.value ? { month: d.month, value: d.total } : acc), {
      month: '',
      value: 0,
    });
    return b;
  }, [chartData]);
  const variance = useMemo(() => {
    if (summary.length < 2) return 0;
    const mean = avg;
    const sq = summary.reduce((a, r) => a + (Number(r.total ?? 0) - mean) ** 2, 0);
    return Math.sqrt(sq / summary.length);
  }, [summary, avg]);
  const lastTotal = chartData.length ? chartData[chartData.length - 1].total : 0;
  const prevTotal = chartData.length > 1 ? chartData[chartData.length - 2].total : 0;
  const projected = prevTotal && lastTotal ? lastTotal + (lastTotal - prevTotal) : lastTotal;

  const pieData = useMemo(() => {
    const totals = STREAM_KEYS.reduce((acc, k) => {
      acc[k] = summary.reduce((a, r) => a + Number((r as Record<string, unknown>)[k] ?? 0), 0);
      return acc;
    }, {} as Record<string, number>);
    const sum = Object.values(totals).reduce((a, b) => a + b, 0);
    if (!sum) return [];
    return STREAM_KEYS.map((k) => ({
      name: formatStreamLabel(k),
      value: totals[k] ?? 0,
      color: STREAM_COLORS[k] ?? '#4a5568',
    })).filter((d) => d.value > 0);
  }, [summary]);

  const exportCsv = () => {
    setExporting(true);
    const headers = ['month', ...STREAM_KEYS, 'total'];
    const rows = summary.map((r) =>
      [r.month, ...STREAM_KEYS.map((k) => (r as Record<string, unknown>)[k]), r.total].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `legacy-revenue-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KPICard label="Best month" value={formatMMK(best.value)} sub={best.month} />
        <KPICard label="Avg monthly" value={formatMMK(avg)} />
        <KPICard label="Volatility (σ)" value={formatMMK(variance)} />
        <KPICard label="Projected next" value={formatMMK(projected)} />
        <KPICard label="YTD" value={formatMMK(ytd)} />
        <div className="flex items-center">
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting}
            className="rounded-lg border border-[#2a3347] px-3 py-2 text-sm text-[#f0f4ff] hover:bg-[#161b24] disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[#1e2535] bg-[#0f1117] p-4">
          <h2 className="mb-4 font-semibold text-[#f0f4ff]">12-month trend</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData.slice(-12)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" />
                <XAxis dataKey="month" stroke="#8892a4" fontSize={12} />
                <YAxis stroke="#8892a4" fontSize={12} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                <Tooltip formatter={(v: number) => formatMMK(v)} contentStyle={{ background: '#161b24', border: '1px solid #1e2535', borderRadius: 8 }} />
                {STREAM_KEYS.map((k) => (
                  <Area
                    key={k}
                    type="monotone"
                    dataKey={k}
                    stackId="1"
                    stroke={STREAM_COLORS[k]}
                    fill={`${STREAM_COLORS[k]}33`}
                    name={formatStreamLabel(k)}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-[#1e2535] bg-[#0f1117] p-4">
          <h2 className="mb-4 font-semibold text-[#f0f4ff]">Stream share (YTD)</h2>
          <div className="h-72">
            {pieData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-[#4a5568]">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [formatMMK(v), '']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#1e2535] bg-[#0f1117] p-4">
        <h2 className="mb-4 font-semibold text-[#f0f4ff]">International: YouTube vs Spotify vs TikTok</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" />
              <XAxis dataKey="month" stroke="#8892a4" fontSize={12} />
              <YAxis stroke="#8892a4" fontSize={12} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
              <Tooltip formatter={(v: number) => formatMMK(v)} contentStyle={{ background: '#161b24', border: '1px solid #1e2535', borderRadius: 8 }} />
              <Legend />
              <Bar dataKey="youtube" name="YouTube" fill="#ef4444" />
              <Bar dataKey="spotify" name="Spotify" fill="#22c55e" />
              <Bar dataKey="tiktok" name="TikTok" fill="#ec4899" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function KPICard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-[#1e2535] bg-[#0f1117] p-4">
      <p className="text-xs text-[#8892a4]">{label}</p>
      <p className="mt-1 text-lg font-bold text-[#f0f4ff]">{value}</p>
      {sub && <p className="text-xs text-[#4a5568]">{sub}</p>}
    </div>
  );
}
