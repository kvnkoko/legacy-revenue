'use client';

import { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Brush,
  Line,
} from 'recharts';
import { filterMonthsByRange, rollingAverage, type TimeRangeKey } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { TimeRangeSelector } from '@/components/charts/TimeRangeSelector';
import { useCurrency } from '@/contexts/CurrencyContext';

type Row = { month: string; total?: number } & Record<string, unknown>;
export type TrendStream = { slug: string; name: string; color: string };

export function RevenueTrendChart({ data, streams }: { data: Row[]; streams: TrendStream[] }) {
  const { formatCurrency } = useCurrency();
  const [range, setRange] = useState<TimeRangeKey>('12M');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showRolling, setShowRolling] = useState(true);

  const filtered = useMemo(
    () => filterMonthsByRange(data, range, customStart ? `${customStart}-01` : undefined, customEnd ? `${customEnd}-01` : undefined),
    [customEnd, customStart, data, range]
  );

  const totals = filtered.map((d) => Number(d.total ?? 0));
  const rolling3 = rollingAverage(totals, 3);
  const chartData = filtered.map((d, idx) => ({
    ...d,
    monthLabel: d.month ? format(parseISO(d.month), filtered.length > 24 ? "MMM ''yy" : 'MMM yyyy') : '',
    rolling3: rolling3[idx],
  }));

  if (!chartData.length) {
    return (
      <div className="h-64 flex items-center justify-center text-secondary">
        No data yet. Add monthly data or import Excel.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TimeRangeSelector value={range} onChange={setRange} />
        <label className="text-caption text-secondary">
          <input type="checkbox" checked={showRolling} onChange={(e) => setShowRolling(e.target.checked)} className="mr-2" />
          3M rolling average
        </label>
      </div>
      {range === 'CUSTOM' && (
        <div className="flex gap-2">
          <input type="month" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="rounded border border-border bg-elevated px-2 py-1 text-caption text-primary" />
          <input type="month" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="rounded border border-border bg-elevated px-2 py-1 text-caption text-primary" />
        </div>
      )}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" />
            <XAxis dataKey="monthLabel" stroke="#8892a4" fontSize={12} tickLine={false} />
            <YAxis stroke="#8892a4" fontSize={12} tickLine={false} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#161b24', border: '1px solid #1e2535', borderRadius: 8 }}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.monthLabel}
              formatter={(value: number) => [formatCurrency(value), '']}
              labelStyle={{ color: '#f0f4ff' }}
              itemStyle={{ color: '#f0f4ff' }}
            />
            {streams.map(({ slug, name, color }) => (
              <Area
                key={slug}
                type="monotone"
                dataKey={slug}
                name={name}
                stackId="1"
                stroke={color}
                fill={color}
                fillOpacity={0.7}
              />
            ))}
            {showRolling && <Line type="monotone" dataKey="rolling3" stroke="#ffffff" strokeDasharray="4 4" dot={false} name="3M average" />}
            {chartData.length > 18 && <Brush dataKey="monthLabel" height={18} stroke="#d4af37" travellerWidth={8} />}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
