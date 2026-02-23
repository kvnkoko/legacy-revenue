'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useCurrency } from '@/contexts/CurrencyContext';
import { STREAM_COLORS } from '@/lib/utils';

const KEYS = [
  { key: 'ringtune', name: 'Ringtune', color: STREAM_COLORS.ringtune },
  { key: 'eauc', name: 'EAUC', color: STREAM_COLORS.eauc },
  { key: 'combo', name: 'Combo', color: STREAM_COLORS.combo },
  { key: 'sznb', name: 'SZNB', color: STREAM_COLORS.sznb },
  { key: 'flow_subscription', name: 'Flow Sub', color: STREAM_COLORS.flow_subscription },
  { key: 'youtube', name: 'YouTube', color: STREAM_COLORS.youtube },
  { key: 'spotify', name: 'Spotify', color: STREAM_COLORS.spotify },
  { key: 'tiktok', name: 'TikTok', color: STREAM_COLORS.tiktok },
] as const;

type Row = Record<string, unknown>;

export function StreamDonutChart({ data }: { data: Row | null }) {
  const { formatCurrency } = useCurrency();
  if (!data) {
    return (
      <div className="h-64 flex items-center justify-center text-secondary">
        No data for current month.
      </div>
    );
  }

  const pieData = KEYS.map(({ key, name, color }) => ({
    name,
    value: Number(data[key] ?? 0),
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
