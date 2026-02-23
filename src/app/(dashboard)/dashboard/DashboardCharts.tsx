'use client';

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
} from 'recharts';
import { formatMMK, formatStreamLabel } from '@/lib/utils';
import type { RevenueSummaryRow } from '@/lib/db/revenue';
import { STREAM_COLORS } from '@/lib/utils';

const STREAM_KEYS = [
  'ringtune',
  'eauc',
  'combo',
  'sznb',
  'flow_subscription',
  'youtube',
  'spotify',
  'tiktok',
] as const;

export function DashboardCharts({
  summary,
  type = 'area',
}: {
  summary: RevenueSummaryRow[];
  type?: 'area' | 'donut';
}) {
  const chartData = summary.map((r) => ({
    month: new Date(r.month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    fullMonth: r.month,
    ...STREAM_KEYS.reduce((acc, k) => ({ ...acc, [k]: Number((r as Record<string, unknown>)[k] ?? 0) }), {}),
    total: Number(r.total ?? 0),
  }));

  const current = summary[summary.length - 1];
  const donutData = current
    ? STREAM_KEYS.map((k) => ({
        name: formatStreamLabel(k),
        value: Number((current as Record<string, unknown>)[k] ?? 0),
        color: STREAM_COLORS[k] ?? '#4a5568',
      })).filter((d) => d.value > 0)
    : [];

  if (type === 'donut') {
    return (
      <div className="h-64">
        {donutData.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-[#4a5568]">No data for current month</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
              >
                {donutData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatMMK(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    );
  }

  return (
    <div className="h-72">
      {chartData.length === 0 ? (
        <p className="flex h-full items-center justify-center text-sm text-[#4a5568]">No revenue data yet</p>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              {STREAM_KEYS.map((k) => (
                <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={STREAM_COLORS[k]} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={STREAM_COLORS[k]} stopOpacity={0.05} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" />
            <XAxis dataKey="month" stroke="#8892a4" fontSize={12} />
            <YAxis stroke="#8892a4" fontSize={12} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
            <Tooltip
              formatter={(v: number) => formatMMK(v)}
              contentStyle={{ background: '#161b24', border: '1px solid #1e2535', borderRadius: 8 }}
              labelStyle={{ color: '#f0f4ff' }}
            />
            {STREAM_KEYS.map((k) => (
              <Area
                key={k}
                type="monotone"
                dataKey={k}
                stackId="1"
                stroke={STREAM_COLORS[k]}
                fill={`url(#grad-${k})`}
                name={formatStreamLabel(k)}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
