export function formatMMK(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export const STREAM_COLORS = {
  ringtune: '#00d4c8',
  eauc: '#3b82f6',
  combo: '#8b5cf6',
  sznb: '#f59e0b',
  flow_subscription: '#10b981',
  youtube: '#ef4444',
  spotify: '#22c55e',
  tiktok: '#ec4899',
} as const;

export function formatStreamLabel(value: string): string {
  const labels: Record<string, string> = {
    youtube: 'YouTube',
    tiktok: 'TikTok',
    eauc: 'EAUC',
    mpt: 'MPT',
  };
  if (labels[value]) return labels[value];
  return value.replace(/_/g, ' ');
}

export type TimeRangeKey = '3M' | '6M' | '12M' | 'YTD' | 'ALL' | 'CUSTOM';

export function filterMonthsByRange<T extends { month: string }>(
  rows: T[],
  range: TimeRangeKey,
  customStart?: string,
  customEnd?: string
): T[] {
  if (!rows.length) return [];
  const sorted = [...rows].sort((a, b) => a.month.localeCompare(b.month));
  if (range === 'ALL') return sorted;
  if (range === 'CUSTOM') {
    if (!customStart || !customEnd) return sorted;
    return sorted.filter((r) => r.month >= customStart && r.month <= customEnd);
  }
  if (range === 'YTD') {
    const latest = new Date(sorted[sorted.length - 1].month);
    const start = `${latest.getFullYear()}-01-01`;
    return sorted.filter((r) => r.month >= start);
  }
  const months = Number(range.replace('M', ''));
  return sorted.slice(-months);
}

export function rollingAverage(values: number[], windowSize: number): Array<number | null> {
  return values.map((_, idx) => {
    if (idx + 1 < windowSize) return null;
    const window = values.slice(idx + 1 - windowSize, idx + 1);
    const sum = window.reduce((acc, value) => acc + value, 0);
    return sum / windowSize;
  });
}
