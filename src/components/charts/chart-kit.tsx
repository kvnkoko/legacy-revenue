'use client';

import { useEffect, useState } from 'react';

/**
 * Shared chart primitives so every chart reads as one system:
 *  - theme-aware axis/grid/tooltip colors (light + dark, via the app's CSS vars)
 *  - a top-N + "Other" grouping so categorical charts never show more hues than
 *    a person (or a colorblind person) can tell apart — the #1 fix for the
 *    14-slice donut.
 */

/** Neutral gray used for the "Other" bucket — never a categorical hue. */
export const OTHER_COLOR = '#6b7280';

function readVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return fallback;
  // The app stores colors as raw "R G B" triplets for rgb(var(--x)); wrap them.
  return /^\d/.test(raw) ? `rgb(${raw})` : raw;
}

export type ChartTheme = {
  grid: string;
  axis: string;
  tooltip: { background: string; border: string; text: string };
};

/** Live chart colors that follow the light/dark toggle (watches data-theme). */
export function useChartTheme(): ChartTheme {
  const compute = (): ChartTheme => ({
    grid: readVar('--color-border', '#1e2535'),
    axis: readVar('--color-secondary', '#8892a4'),
    tooltip: {
      background: readVar('--tooltip-bg', '#161b24'),
      border: readVar('--tooltip-border', '#1e2535'),
      text: readVar('--tooltip-text', '#f0f4ff'),
    },
  });
  const [theme, setTheme] = useState<ChartTheme>(compute);
  useEffect(() => {
    setTheme(compute());
    const obs = new MutationObserver(() => setTheme(compute()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return theme;
}

/** Recharts tooltip contentStyle that respects the theme. */
export function tooltipStyle(theme: ChartTheme) {
  return {
    backgroundColor: theme.tooltip.background,
    border: `1px solid ${theme.tooltip.border}`,
    borderRadius: 10,
    color: theme.tooltip.text,
    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
  };
}

export type Sliceable = { slug: string; name: string; color: string };

/**
 * Ranks streams by a value and keeps the top `n`, folding the rest into a single
 * neutral "Other" slice. Returns slices with value + share, sorted desc.
 */
export function groupTopN<T extends Sliceable>(
  streams: T[],
  valueOf: (s: T) => number,
  n = 6
): Array<{ slug: string; name: string; color: string; value: number; share: number }> {
  const withValues = streams
    .map((s) => ({ slug: s.slug, name: s.name, color: s.color, value: Math.max(0, valueOf(s)) }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = withValues.reduce((sum, s) => sum + s.value, 0) || 1;
  if (withValues.length <= n + 1) {
    return withValues.map((s) => ({ ...s, share: (s.value / total) * 100 }));
  }
  const top = withValues.slice(0, n);
  const rest = withValues.slice(n);
  const otherValue = rest.reduce((sum, s) => sum + s.value, 0);
  return [
    ...top.map((s) => ({ ...s, share: (s.value / total) * 100 })),
    { slug: '__other__', name: `Other (${rest.length})`, color: OTHER_COLOR, value: otherValue, share: (otherValue / total) * 100 },
  ];
}

/**
 * Groups a month-by-stream matrix to the top `n` streams (ranked by total over
 * the visible rows) plus a neutral "Other" series, so stacked charts stay
 * readable no matter how many streams the team adds. Color follows the stream,
 * never its rank.
 */
export function groupSeriesTopN<T extends Sliceable>(
  rows: Array<Record<string, unknown>>,
  streams: T[],
  n = 6
): { series: Array<{ slug: string; name: string; color: string }>; rows: Array<Record<string, unknown>> } {
  const totals = streams.map((s) => ({
    stream: s,
    total: rows.reduce((sum, r) => sum + Number(r[s.slug] ?? 0), 0),
  }));
  const active = totals.filter((t) => t.total > 0).sort((a, b) => b.total - a.total);
  if (active.length <= n + 1) {
    return { series: active.map((t) => t.stream), rows };
  }
  const top = active.slice(0, n).map((t) => t.stream);
  const rest = active.slice(n).map((t) => t.stream);
  const outRows = rows.map((r) => ({
    ...r,
    __other__: rest.reduce((sum, s) => sum + Number(r[s.slug] ?? 0), 0),
  }));
  return {
    series: [...top, { slug: '__other__', name: `Other (${rest.length})`, color: OTHER_COLOR }],
    rows: outRows,
  };
}

/** Compact money for axis ticks and chart labels: 545,563,002 → "545.6M". */
export function formatCompact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(Math.round(v));
}

/** Consistent section card. */
export function ChartCard({
  title,
  subtitle,
  right,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-border bg-card p-5 sm:p-6 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-body font-semibold text-primary">{title}</h2>
          {subtitle && <p className="mt-0.5 text-caption text-secondary">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}
