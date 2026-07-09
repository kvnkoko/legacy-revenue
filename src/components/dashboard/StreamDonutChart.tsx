'use client';

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useCurrency } from '@/contexts/CurrencyContext';
import { groupTopN } from '@/components/charts/chart-kit';

type Row = Record<string, unknown>;
type DonutStream = { slug: string; name: string; color: string };

export function StreamDonutChart({ data, streams }: { data: Row | null; streams: DonutStream[] }) {
  const { formatCurrency } = useCurrency();
  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center text-secondary">
        No data for current month.
      </div>
    );
  }

  // Top 6 streams by value + one neutral "Other" — readable instead of 14 slices
  // with near-identical colors and a cramped legend.
  const slices = groupTopN(streams, (s) => Number(data[s.slug] ?? 0), 6);
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  if (!slices.length) {
    return (
      <div className="flex h-64 items-center justify-center text-secondary">
        No stream data for this month.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie isAnimationActive={false}
              data={slices}
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={84}
              paddingAngle={2}
              cornerRadius={3}
              dataKey="value"
              nameKey="name"
              stroke="none"
            >
              {slices.map((s) => (
                <Cell key={s.slug} fill={s.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Center total — the headline the donut used to bury */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-micro uppercase tracking-wide text-secondary">Total</span>
          <span className="text-body font-bold text-primary">{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Ranked legend with share + value — the actual at-a-glance content */}
      <ul className="space-y-1.5">
        {slices.map((s) => (
          <li key={s.slug} className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="truncate text-caption text-primary">{s.name}</span>
            <span className="ml-auto shrink-0 tabular-nums text-caption font-semibold text-primary">
              {s.share.toFixed(1)}%
            </span>
            <span className="w-24 shrink-0 text-right tabular-nums text-micro text-secondary">
              {formatCurrency(s.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
