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
import {
  formatCompact,
  groupSeriesTopN,
  tooltipStyle,
  useChartTheme,
} from '@/components/charts/chart-kit';

type Row = { month: string; total?: number } & Record<string, unknown>;
export type TrendStream = { slug: string; name: string; color: string };

export function RevenueTrendChart({ data, streams }: { data: Row[]; streams: TrendStream[] }) {
  const { formatCurrency } = useCurrency();
  const theme = useChartTheme();
  const [range, setRange] = useState<TimeRangeKey>('12M');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showRolling, setShowRolling] = useState(true);

  const filtered = useMemo(
    () => filterMonthsByRange(data, range, customStart ? `${customStart}-01` : undefined, customEnd ? `${customEnd}-01` : undefined),
    [customEnd, customStart, data, range]
  );

  // Stack only the top streams + a neutral "Other" so the bands stay readable
  // no matter how many streams the team configures.
  const { series, rows } = useMemo(
    () => groupSeriesTopN(filtered as Array<Record<string, unknown>>, streams, 6),
    [filtered, streams]
  );

  const totals = filtered.map((d) => Number(d.total ?? 0));
  const rolling3 = rollingAverage(totals, 3);
  const chartData = rows.map((d, idx) => ({
    ...d,
    monthLabel: d.month ? format(parseISO(String(d.month)), filtered.length > 24 ? "MMM ''yy" : 'MMM yyyy') : '',
    rolling3: rolling3[idx],
  }));

  if (!chartData.length) {
    return (
      <div className="flex h-64 items-center justify-center text-secondary">
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
            <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
            <XAxis dataKey="monthLabel" stroke={theme.axis} fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke={theme.axis} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompact(v)} width={52} />
            <Tooltip
              contentStyle={tooltipStyle(theme)}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.monthLabel}
              formatter={(value: number, name: string) => [formatCurrency(value), name]}
              labelStyle={{ color: theme.tooltip.text, fontWeight: 600 }}
              itemStyle={{ color: theme.tooltip.text }}
            />
            {series.map(({ slug, name, color }) => (
              <Area isAnimationActive={false}
                key={slug}
                type="monotone"
                dataKey={slug}
                name={name}
                stackId="1"
                stroke={color}
                strokeWidth={1.5}
                fill={color}
                fillOpacity={0.55}
              />
            ))}
            {showRolling && (
              <Line isAnimationActive={false} type="monotone" dataKey="rolling3" stroke={theme.axis} strokeDasharray="5 4" strokeWidth={2} dot={false} name="3M average" />
            )}
            {chartData.length > 18 && <Brush dataKey="monthLabel" height={18} stroke="#d4af37" travellerWidth={8} fill="transparent" />}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {/* Compact legend, ranked like the stack */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {series.map((s) => (
          <span key={s.slug} className="inline-flex items-center gap-1.5 text-micro text-secondary">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
