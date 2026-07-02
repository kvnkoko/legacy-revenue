'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useCurrency } from '@/contexts/CurrencyContext';

type Row = Record<string, unknown>;
type DonutStream = { slug: string; name: string; color: string };

export function StreamDonutChart({ data, streams }: { data: Row | null; streams: DonutStream[] }) {
  const { formatCurrency } = useCurrency();
  if (!data) {
    return (
      <div className="h-64 flex items-center justify-center text-secondary">
        No data for current month.
      </div>
    );
  }

  const pieData = streams.map(({ slug, name, color }) => ({
    name,
    value: Number(data[slug] ?? 0),
    color,
  })).filter((d) => d.value > 0);

  if (!pieData.length) {
    return (
      <div className="h-64 flex items-center justify-center text-secondary">
        No stream data for this month.
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {pieData.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--tooltip-bg)',
              border: '1px solid var(--tooltip-border)',
              borderRadius: 8,
              color: 'var(--tooltip-text)',
            }}
            labelStyle={{ color: 'var(--tooltip-text)' }}
            itemStyle={{ color: 'var(--tooltip-text)' }}
            formatter={(value: number) => formatCurrency(value)}
          />
          <Legend formatter={(name) => name} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
