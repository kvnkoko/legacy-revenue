'use client';

import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, Brush, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format, parseISO } from 'date-fns';
import { TimeRangeSelector } from '@/components/charts/TimeRangeSelector';
import { filterMonthsByRange, formatMMK, rollingAverage, type TimeRangeKey } from '@/lib/utils';
import {
  ChartCard,
  formatCompact,
  groupSeriesTopN,
  groupTopN,
  StatTile,
  tooltipStyle,
  useChartTheme,
} from '@/components/charts/chart-kit';
import { seriesColor, withSeriesColors } from '@/lib/series-palette';
import { completeRows, incompleteTail, type MonthRow } from '@/lib/data-completeness';
import { Explain } from '@/components/charts/plain-language';
import { plainChange, plainMoney } from '@/lib/plain-language';

type Row = Record<string, unknown>;
type SummaryStream = { slug: string; name: string; color: string };

export function AnalyticsCharts({
  summary,
  streams: rawStreams,
  ringtune,
  mpt,
  atom,
}: {
  summary: Row[];
  streams: SummaryStream[];
  ringtune: Row[];
  mpt: Row[];
  atom: Row[];
}) {
  const theme = useChartTheme();
  // One repaint with the validated palette; colour follows the stream's stable
  // position, never its rank, so filtering never recolours the survivors.
  const streams = useMemo(() => withSeriesColors(rawStreams, theme.light), [rawStreams, theme.light]);

  /*
   * Every statistic below is built from COMPLETE months only.
   *
   * Distributor reports arrive late, so the newest recorded months are usually
   * part-filled. Left in, they quietly corrupted the figures: the part-filled
   * month became "our lowest month ever", the biggest-change card compared a
   * full month against a half-empty one, and the anomaly checker raised a
   * "please check this" alert for data that was simply not entered yet.
   *
   * The month-by-month chart still shows everything, with a note, because
   * seeing the unfinished tail is useful — it just must not drive the numbers.
   */
  const settled = useMemo(
    () => completeRows(summary as MonthRow[], rawStreams) as Row[],
    [summary, rawStreams]
  );
  const stillFilling = useMemo(
    () => incompleteTail(summary as MonthRow[], rawStreams),
    [summary, rawStreams]
  );
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

  /*
   * The months the date filter selects, complete ones only.
   *
   * Cards that summarise a span of time all read from this one list, so they
   * can never disagree with each other, and each card prints the range.
   * Cards about all-time history (records, lifecycle, seasonality) say so.
   */
  const periodRows = useMemo(() => {
    const keep = new Set(settled.map((r) => String(r.month)));
    return filtered.filter((r) => keep.has(String(r.month)));
  }, [filtered, settled]);

  const periodLabel = useMemo(() => {
    if (!periodRows.length) return 'no complete months';
    const first = String(periodRows[0].month);
    const last = String(periodRows[periodRows.length - 1].month);
    const fmt = (m: string) => format(parseISO(m), 'MMM yyyy');
    return first === last ? fmt(first) : `${fmt(first)} – ${fmt(last)}`;
  }, [periodRows]);

  const milestones = useMemo(() => {
    const totals = periodRows.map((r) => Number(r.total ?? 0));
    const allTimeTotal = totals.reduce((acc, v) => acc + v, 0);
    const avg = totals.length ? allTimeTotal / totals.length : 0;
    const best = periodRows.reduce<{ month: string | null; value: number }>(
      (acc, r) => (Number(r.total ?? 0) > acc.value ? { month: String(r.month), value: Number(r.total ?? 0) } : acc),
      { month: null, value: 0 }
    );
    const worst = periodRows.reduce<{ month: string | null; value: number }>(
      (acc, r) => (Number(r.total ?? 0) < acc.value ? { month: String(r.month), value: Number(r.total ?? 0) } : acc),
      { month: periodRows[0]?.month ? String(periodRows[0].month) : null, value: Number(periodRows[0]?.total ?? 0) }
    );
    return { allTimeTotal, avg, best, worst };
  }, [periodRows]);

  const periodAvg = useMemo(() => {
    const totals = filtered.map((r) => Number(r.total ?? 0));
    return totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
  }, [filtered]);

  // Composition over the SELECTED PERIOD (not a pie): ranked bars, top 8 + Other.
  const composition = useMemo(() => {
    const slices = groupTopN(
      streams,
      (s) => periodRows.reduce((sum, r) => sum + Number(r[s.slug] ?? 0), 0),
      8
    );
    const max = slices.length ? slices[0].value : 1;
    return slices.map((s) => ({ ...s, widthPct: (s.value / max) * 100 }));
  }, [periodRows, streams]);

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

  const cumulative = useMemo(() => {
    const rows = [...settled].sort((a, b) => String(a.month).localeCompare(String(b.month)));
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
  }, [settled]);

  const yoy = useMemo(() => {
    const rows = [...settled].sort((a, b) => String(a.month).localeCompare(String(b.month)));
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
  }, [settled]);

  const lifecycle = useMemo(() => {
    return streams.map(({ slug: key, name }) => {
      const values = settled.map((r) => Number(r[key] ?? 0));
      const first = values.findIndex((v) => v > 0);
      const last3 = values.slice(-3).reduce((a, b) => a + b, 0);
      const prev3 = values.slice(-6, -3).reduce((a, b) => a + b, 0);
      const trend = last3 > prev3 * 1.05 ? 'growing' : last3 < prev3 * 0.95 ? 'declining' : 'stable';
      return {
        key,
        name,
        firstMonth: first >= 0 ? String(settled[first]?.month ?? '—') : '—',
        monthsActive: values.filter((v) => v > 0).length,
        allTimeTotal: values.reduce((a, b) => a + b, 0),
        trend,
      };
    });
  }, [settled, streams]);

  const momComparison = useMemo(() => {
    if (periodRows.length < 2) return [];
    const last = periodRows[periodRows.length - 1];
    const prev = periodRows[periodRows.length - 2];
    return streams
      .map((s) => {
        const current = Number(last[s.slug] ?? 0);
        const previous = Number(prev[s.slug] ?? 0);
        const delta = current - previous;
        const pct = previous ? (delta / previous) * 100 : current > 0 ? 100 : 0;
        return { name: s.name, color: s.color, current, previous, delta, pct };
      })
      .filter((s) => s.current > 0 || s.previous > 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [periodRows, streams]);

  // The two months that card actually compares, named so nobody has to guess.
  const momMonths = useMemo(() => {
    if (periodRows.length < 2) return 'needs two complete months';
    const fmt = (r: Row) => format(parseISO(String(r.month)), 'MMM yyyy');
    return `${fmt(periodRows[periodRows.length - 2])} to ${fmt(periodRows[periodRows.length - 1])}`;
  }, [periodRows]);

  const topMovers = useMemo(
    () => [...momComparison].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 3),
    [momComparison]
  );

  // How dependent are we on the biggest stream? 100 = perfectly even split.
  const concentration = useMemo(() => {
    const calc = (row: Row) => {
      const total = Number(row.total ?? 0);
      if (!total) return null;
      const shares = streams.map((s) => Number(row[s.slug] ?? 0) / total).filter((x) => x > 0);
      if (!shares.length) return null;
      const hhi = shares.reduce((a, x) => a + x * x, 0);
      const n = shares.length;
      const score = n > 1 ? Math.max(0, Math.min(100, ((1 - (hhi - 1 / n) / (1 - 1 / n)) * 100))) : 0;
      let top = streams[0];
      for (const st of streams) {
        if (Number(row[st.slug] ?? 0) > Number(row[top.slug] ?? 0)) top = st;
      }
      return { score, top, topShare: (Number(row[top.slug] ?? 0) / total) * 100 };
    };
    if (!periodRows.length) return null;
    /*
     * Collapse the period into one row so this card and the ranked bars are
     * computed from exactly the same money.
     *
     * The denominator is the SUM OF THE STREAM COLUMNS, not the summary
     * "total" column. Those two are not the same number here, and dividing by
     * different totals is what made the same stream read 36.6% on the bars and
     * 31% on this card. Using the figure the bars use keeps both cards honest
     * against each other and keeps the shares adding up to 100%.
     */
    const perStream = streams.map((st) => ({
      stream: st,
      value: periodRows.reduce((sum, r) => sum + Number(r[st.slug] ?? 0), 0),
    }));
    const streamSum = perStream.reduce((sum, x) => sum + x.value, 0);
    if (!streamSum) return null;
    const periodTotal: Row = {
      total: streamSum,
      ...Object.fromEntries(perStream.map((x) => [x.stream.slug, x.value])),
    };
    const monthlyAverage = streamSum / periodRows.length;
    const current = calc(periodTotal);
    return current ? { ...current, monthlyAverage, months: periodRows.length } : null;
  }, [periodRows, streams]);

  // Which streams are heating up or cooling down (3M avg vs prior 3M).
  const momentum = useMemo(() => {
    const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    return streams
      .map((s) => {
        const vals = periodRows.map((r) => Number(r[s.slug] ?? 0));
        const a3 = avg(vals.slice(-3));
        const p3 = avg(vals.slice(-6, -3));
        const pct = p3 ? ((a3 - p3) / p3) * 100 : a3 > 0 ? 100 : 0;
        let up = 0;
        for (let i = vals.length - 1; i > 0; i -= 1) {
          if (vals[i] > vals[i - 1]) up += 1;
          else break;
        }
        let down = 0;
        for (let i = vals.length - 1; i > 0; i -= 1) {
          if (vals[i] < vals[i - 1]) down += 1;
          else break;
        }
        return { name: s.name, color: s.color, a3, p3, pct, up, down };
      })
      .filter((m) => m.a3 > 0 || m.p3 > 0)
      .sort((a, b) => b.pct - a.pct);
  }, [periodRows, streams]);

  const quarterly = useMemo(() => {
    const byQ = new Map<string, Record<string, number | string | null>>();
    for (const r of periodRows) {
      const d = new Date(String(r.month));
      const q = `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}`;
      if (!byQ.has(q)) {
        const base: Record<string, number | string | null> = { quarter: q, total: 0, months: 0 };
        for (const s of streams) base[s.slug] = 0;
        byQ.set(q, base);
      }
      const row = byQ.get(q)!;
      row.total = Number(row.total) + Number(r.total ?? 0);
      row.months = Number(row.months) + 1;
      for (const s of streams) row[s.slug] = Number(row[s.slug]) + Number(r[s.slug] ?? 0);
    }
    type QuarterRow = { quarter: string; total: number; months: number; qoq: number | null } & Record<string, number | string | null>;
    const rows = Array.from(byQ.values());
    return rows.map((r, i): QuarterRow => ({
      ...(r as QuarterRow),
      qoq: i > 0 && Number(rows[i - 1].total)
        ? ((Number(r.total) - Number(rows[i - 1].total)) / Number(rows[i - 1].total)) * 100
        : null,
    }));
  }, [periodRows, streams]);

  const quarterlyGrouped = useMemo(
    () => groupSeriesTopN(quarterly as Array<Record<string, unknown>>, streams, 6),
    [quarterly, streams]
  );

  // Best/worst month per stream + latest-month outlier flags (>2 std dev).
  const recordsAnomalies = useMemo(() => {
    const records = streams
      .map((s) => {
        const vals = settled
          .map((r) => ({ month: String(r.month), v: Number(r[s.slug] ?? 0) }))
          .filter((x) => x.v > 0);
        if (!vals.length) return null;
        const best = vals.reduce((a, b) => (b.v > a.v ? b : a));
        const worst = vals.reduce((a, b) => (b.v < a.v ? b : a));
        return { name: s.name, color: s.color, best, worst };
      })
      .filter(Boolean) as Array<{ name: string; color: string; best: { month: string; v: number }; worst: { month: string; v: number } }>;

    const anomalies: Array<{ name: string; latest: number; mean: number; direction: 'above' | 'below' }> = [];
    for (const s of streams) {
      const vals = settled.map((r) => Number(r[s.slug] ?? 0));
      if (vals.length < 5) continue;
      const hist = vals.slice(0, -1).filter((v) => v > 0);
      if (hist.length < 4) continue;
      const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
      const sd = Math.sqrt(hist.reduce((a, b) => a + (b - mean) ** 2, 0) / hist.length);
      const latest = vals[vals.length - 1];
      if (sd > 0 && Math.abs(latest - mean) > 2 * sd) {
        anomalies.push({ name: s.name, latest, mean, direction: latest > mean ? 'above' : 'below' });
      }
    }
    return { records, anomalies };
  }, [settled, streams]);

  const seasonality = useMemo(() => {
    if (settled.length < 12) return [];
    const byMonth = new Map<number, number[]>();
    settled.forEach((r) => {
      const month = new Date(String(r.month)).getMonth() + 1;
      byMonth.set(month, [...(byMonth.get(month) ?? []), Number(r.total ?? 0)]);
    });
    return Array.from({ length: 12 }, (_, idx) => {
      const month = idx + 1;
      const values = byMonth.get(month) ?? [];
      const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      return { month, avg };
    });
  }, [settled]);

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

  /*
   * Values used by the plain-English explanations under each chart, all taken
   * from the newest COMPLETE month. Using the newest RECORDED month described a
   * part-filled month as though it were finished, and the "compared with the
   * month before" line was the same unreliable comparison we removed from the
   * Overview page: the month before is usually still filling in too.
   */
  const latestSettled = settled.length ? settled[settled.length - 1] : null;
  const latestTotal = Number(latestSettled?.total ?? 0);
  const settledAvg = settled.length
    ? settled.reduce((a, r) => a + Number(r.total ?? 0), 0) / settled.length
    : 0;
  const latestVsAvgPct = settledAvg ? ((latestTotal - settledAvg) / settledAvg) * 100 : 0;
  const lastMonthLabel = latestSettled?.month
    ? format(parseISO(String(latestSettled.month)), 'MMMM yyyy')
    : 'the latest complete month';
  // Same month a year earlier: a like-for-like comparison that survives late
  // distributor reporting, unlike comparing with the month before.
  const sameMonthLastYear = (() => {
    if (!latestSettled?.month) return null;
    const d = new Date(String(latestSettled.month));
    d.setFullYear(d.getFullYear() - 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const row = settled.find((r) => String(r.month) === key);
    const prior = Number(row?.total ?? 0);
    return prior > 0 ? ((latestTotal - prior) / prior) * 100 : null;
  })();
  // Money we can expect over the next 3 months if recent complete months repeat.
  const next3Expected = (() => {
    const last3 = settled.slice(-3).map((r) => Number(r.total ?? 0));
    if (!last3.length) return 0;
    return (last3.reduce((a, b) => a + b, 0) / last3.length) * 3;
  })();
  const growing = momentum.filter((m) => m.pct >= 2);
  const shrinking = momentum.filter((m) => m.pct <= -2);
  const bestSeason = seasonality.length
    ? seasonality.reduce((a, b) => (b.avg > a.avg ? b : a))
    : null;
  const weakestSeason = seasonality.length
    ? seasonality.filter((s) => s.avg > 0).reduce((a, b) => (b.avg < a.avg ? b : a), seasonality.find((s) => s.avg > 0) ?? seasonality[0])
    : null;
  const monthName = (m: number) => format(new Date(2024, m - 1, 1), 'MMMM');

  const axisProps = { stroke: theme.axis, fontSize: 12, tickLine: false, axisLine: false } as const;
  const tt = {
    contentStyle: tooltipStyle(theme),
    labelStyle: { color: theme.tooltip.text, fontWeight: 600 },
    itemStyle: { color: theme.tooltip.text },
  } as const;

  return (
    <div className="space-y-10">
      {stillFilling.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-body font-semibold text-primary">
            {stillFilling.map((m) => format(parseISO(m.month), 'MMMM yyyy')).join(' and ')}{' '}
            {stillFilling.length === 1 ? 'is' : 'are'} still being filled in
          </p>
          <p className="mt-1 text-caption leading-relaxed text-secondary">
            Distributor reports arrive late. These months are left out of every figure here. They
            still appear on the month-by-month chart so you can see them.
          </p>
        </div>
      )}

      {/*
        One date filter, kept on screen while you scroll. Repeating a control on
        every card would mean more than one answer to "which months am I looking
        at"; this way the filter is always beside whatever card you are reading.
      */}
      <div className="sticky top-0 z-20 -mx-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur sm:-mx-4 sm:px-4 md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <TimeRangeSelector value={range} onChange={setRange} />
          {range === 'CUSTOM' && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-micro uppercase tracking-[0.08em] text-secondary">From</span>
                <input type="month" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="rounded-lg border border-border bg-elevated px-2.5 py-1.5 text-caption text-primary" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-micro uppercase tracking-[0.08em] text-secondary">To</span>
                <input type="month" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="rounded-lg border border-border bg-elevated px-2.5 py-1.5 text-caption text-primary" />
              </label>
            </div>
          )}
          <p className="ml-auto text-caption text-secondary">
            Showing <span className="font-semibold text-primary">{periodLabel}</span>
            <span className="text-muted"> · {periodRows.length} complete {periodRows.length === 1 ? 'month' : 'months'}</span>
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile accent label="Best month" magnitude={milestones.best.value} value={formatMMK(milestones.best.value)} sub={milestones.best.month ? format(parseISO(String(milestones.best.month)), 'MMMM yyyy') : '—'} />
          <StatTile label="Normal month" magnitude={milestones.avg} value={formatMMK(Math.round(milestones.avg))} sub={`average across ${periodLabel}`} />
          <StatTile label="Total earned" magnitude={milestones.allTimeTotal} value={formatMMK(milestones.allTimeTotal)} sub={periodLabel} />
          <StatTile label="Lowest month" magnitude={milestones.worst.value} value={formatMMK(milestones.worst.value)} sub={milestones.worst.month ? format(parseISO(String(milestones.worst.month)), 'MMMM yyyy') : '—'} />
        </div>
      </div>

      {/* ============ Section: The big picture ============ */}
      <div className="space-y-5">
        <SectionHeader title="How much are we earning?" subtitle={`Month by month · ${periodLabel}`} />
        <ChartCard title="How much money do we make each month?" subtitle="Taller gold = more money">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="goldFade" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(var(--color-gold))" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="rgb(var(--color-gold))" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
                <XAxis dataKey="monthLabel" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={(v) => formatCompact(v)} width={52} />
                <Tooltip {...tt} formatter={(v: number, name: string) => [formatMMK(v), name === 'rolling3' ? '3M average' : 'Total']} />
                <ReferenceLine y={periodAvg} stroke={theme.axis} strokeDasharray="2 6" strokeOpacity={0.7} />
                <Area isAnimationActive={false} type="monotone" dataKey="total" name="total" stroke="rgb(var(--color-gold))" strokeWidth={2.5} fill="url(#goldFade)" />
                <Line isAnimationActive={false} type="monotone" dataKey="rolling3" stroke={theme.axis} strokeDasharray="5 4" strokeWidth={2} dot={false} />
                {chartData.length > 18 && <Brush dataKey="monthLabel" height={16} stroke="rgb(var(--color-gold))" travellerWidth={8} fill="transparent" />}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <Explain
            shows="Gold shape: each month's total. Dashed line: 3-month average, which hides one-off jumps. Flat line: the average for this period."
            means={`${lastMonthLabel} (newest complete month): ${plainMoney(latestTotal)} MMK. ${
              Math.abs(Math.round(latestVsAvgPct)) < 2
                ? 'About the same as'
                : `${Math.abs(Math.round(latestVsAvgPct))}% ${latestVsAvgPct > 0 ? 'above' : 'below'}`
            } a normal month. ${
              sameMonthLastYear != null
                ? `Against the same month last year it ${plainChange(sameMonthLastYear)}.`
                : 'No comparison with last year yet.'
            }`}
          />
        </ChartCard>
        <ChartCard title="How much have we earned in total?" subtitle="Every month added up · all time">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cumulative} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
                <XAxis dataKey="monthLabel" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={(v) => formatCompact(v)} width={52} />
                <Tooltip {...tt} formatter={(v: number) => formatMMK(v)} />
                <Line isAnimationActive={false} type="monotone" dataKey="cumulative" stroke="rgb(var(--color-gold))" strokeWidth={2.5} dot={false} />
                <Line isAnimationActive={false} type="monotone" dataKey="projected" stroke={theme.axis} strokeDasharray="5 4" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <Explain
            shows="Every month added together, so it only rises. Steeper means we are earning faster. The dashed end is a guess for the next 3 months."
            means={`If the next 3 months match the last 3, expect about ${plainMoney(next3Expected)} MMK more. An estimate for planning, not a promise.`}
          />
        </ChartCard>
      </div>

      {/* ============ Section: Where the money comes from ============ */}
      <div className="space-y-5">
        <SectionHeader
          title="Where does our money come from?"
          subtitle={`Both cards below cover ${periodLabel} — ${periodRows.length} ${periodRows.length === 1 ? 'month' : 'months'} with complete figures`}
        />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          <ChartCard title="Which streams bring us the most money?" subtitle={`Longest bar earns the most · ${periodLabel}`} className="lg:col-span-3">
            <ul className="space-y-3">
              {composition.map((s) => (
                <li key={s.slug}>
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="flex items-center gap-2 text-caption text-primary">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                      {s.name}
                    </span>
                    <span className="tabular-nums text-caption text-secondary">
                      <span className="font-semibold text-primary">{s.share.toFixed(1)}%</span>
                      {' · '}{formatCompact(s.value)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-elevated">
                    <div className="h-full rounded-full" style={{ width: `${s.widthPct}%`, background: s.color }} />
                  </div>
                </li>
              ))}
            </ul>
            <Explain
              shows={`One bar per stream. The percentage is its share of all money in ${periodLabel}.`}
              means={
                composition.length
                  ? `${composition[0].name} leads with ${composition[0].share.toFixed(1)}%. The top ${Math.min(3, composition.length)} bring ${composition
                      .slice(0, 3)
                      .reduce((a, b) => a + b.share, 0)
                      .toFixed(0)}% between them. Put new deals where the money already is.`
                  : undefined
              }
            />
          </ChartCard>
          <ChartCard title="Are we depending too much on one stream?" subtitle={`A safer business earns from many streams · ${periodLabel}`} className="lg:col-span-2">
            {concentration ? (
              <div className="space-y-5">
                <div>
                  <p className="text-caption text-secondary">Biggest earner in {periodLabel}</p>
                  <p className="mt-0.5 text-title font-bold" style={{ color: concentration.top.color }}>
                    {concentration.top.name}
                  </p>
                  <p className="text-body text-primary">
                    <span className="text-display font-bold tabular-nums">{concentration.topShare.toFixed(1)}%</span>
                    <span className="text-caption text-secondary"> of the money in this period</span>
                  </p>
                </div>
                <div>
                  <div className="flex items-baseline justify-between">
                    <p className="text-caption text-secondary">How spread out our money is</p>
                    <p className="tabular-nums text-body font-bold text-primary">
                      {concentration.score.toFixed(0)}<span className="text-micro text-muted">/100</span>
                    </p>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-elevated">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${concentration.score}%` }} />
                  </div>
                  <p className="mt-2 text-caption text-secondary">
                    A higher number means our money comes from many streams, which
                    is safer. A lower number means most of it comes from just one.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-caption text-secondary">We need at least one month of data to show this.</p>
            )}
            {concentration && (
              <Explain
                shows={`${concentration.top.name} paid ${concentration.topShare.toFixed(1)}% of all money in ${periodLabel}. Same figure as the top bar on the left.`}
                means={
                  concentration.topShare > 60
                    ? `Risky. Losing ${concentration.top.name} would cost about ${plainMoney((concentration.topShare / 100) * concentration.monthlyAverage)} MMK a month. Grow a second stream.`
                    : `Fairly healthy. No one stream can sink the business. Losing ${concentration.top.name} would still cost about ${plainMoney((concentration.topShare / 100) * concentration.monthlyAverage)} MMK a month.`
                }
              />
            )}
          </ChartCard>
        </div>
      </div>

      {/* ============ Section: What's moving ============ */}
      <div className="space-y-5">
        <SectionHeader title="What is going up and what is going down?" subtitle={`Within ${periodLabel}`} />
        {topMovers.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {topMovers.map((m, i) => (
              <div key={m.name} className={`rounded-2xl border p-4 ${i === 0 ? 'border-gold/40 bg-gold/5' : 'border-border bg-card'}`}>
                <p className="text-micro uppercase tracking-wide text-secondary">
                  {i === 0 ? 'Biggest change' : 'Also changed a lot'}
                </p>
                <p className="mt-1 flex items-center gap-2 text-body font-semibold text-primary">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
                  {m.name}
                </p>
                <p className={`mt-1 text-title font-bold tabular-nums ${m.pct >= 0 ? 'text-gold' : 'text-red-400'}`}>
                  {m.pct >= 0 ? '▲' : '▼'} {Math.abs(m.pct).toFixed(1)}%
                </p>
                <p className="text-micro text-secondary">{formatCompact(m.previous)} → {formatCompact(m.current)}</p>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <ChartCard title="Which streams changed most?" subtitle={`${momMonths} · biggest change first`}>
            <ul className="space-y-2">
              {momComparison.map((m) => (
                <li key={m.name} className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: m.color }} />
                  <span className="w-32 truncate text-caption text-primary">{m.name}</span>
                  <span className="ml-auto tabular-nums text-caption text-secondary">{formatCompact(m.current)}</span>
                  <span className={`w-20 shrink-0 text-right tabular-nums text-caption font-semibold ${m.pct >= 0 ? 'text-gold' : 'text-red-400'}`}>
                    {m.pct >= 0 ? '+' : ''}{m.pct.toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
            <Explain
              shows={`Compares ${momMonths}, stream by stream. One month can jump for normal reasons. Treat a big change as a question, not an answer.`}
              means={
                momComparison.length
                  ? `${momComparison[0].name} moved most: ${plainChange(momComparison[0].pct)}, ${plainMoney(momComparison[0].previous)} to ${plainMoney(momComparison[0].current)} MMK. Ask whoever manages it whether this continues.`
                  : undefined
              }
            />
          </ChartCard>
          <ChartCard title="Which streams are growing or shrinking?" subtitle="Last 3 months vs the 3 before">
            <ul className="space-y-2">
              {momentum.map((m) => (
                <li key={m.name} className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: m.color }} />
                  <span className="w-32 truncate text-caption text-primary">{m.name}</span>
                  <span className={`tabular-nums text-caption font-semibold ${m.pct >= 0 ? 'text-gold' : 'text-red-400'}`}>
                    {m.pct >= 0 ? '▲' : '▼'} {Math.abs(m.pct).toFixed(1)}%
                  </span>
                  <span className="ml-auto text-micro text-secondary">
                    {m.up >= 2 ? `up ${m.up} months in a row` : m.down >= 2 ? `down ${m.down} months in a row` : 'not much change'}
                  </span>
                </li>
              ))}
            </ul>
            <Explain
              shows="Three months instead of one, so a lucky or unlucky month does not mislead. This is the more reliable direction."
              means={`${growing.length} growing, ${shrinking.length} shrinking.${
                shrinking.length
                  ? ` ${shrinking[shrinking.length - 1].name} is falling fastest. Look at it first — three months of decline rarely fixes itself.`
                  : ' Nothing is falling.'
              }`}
            />
          </ChartCard>
        </div>
        {recordsAnomalies.anomalies.length > 0 && (
          <div className="space-y-2">
            {recordsAnomalies.anomalies.map((a) => (
              <div key={a.name} className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-caption text-amber-200">
                <span className="font-semibold">Please check: {a.name}</span> is much{' '}
                {a.direction === 'above' ? 'higher' : 'lower'} than normal this month.
                It is {formatMMK(a.latest)}, but a normal month is about {formatMMK(a.mean)}.
                Please open Data Entry and check the number was typed correctly. If the
                number is correct, there is no problem.
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============ Section: Rhythm ============ */}
      <div className="space-y-5">
        <SectionHeader title="Which times of year are good for us?" subtitle="For planning releases, budgets and staff" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {quarterly.length > 1 && (
            <ChartCard title="How much do we earn each quarter?" subtitle={`3 months per bar · ${periodLabel}`}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={quarterlyGrouped.rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
                    <XAxis dataKey="quarter" {...axisProps} />
                    <YAxis {...axisProps} tickFormatter={(v) => formatCompact(v)} width={52} />
                    <Tooltip {...tt} formatter={(v: number) => formatMMK(v)} />
                    {quarterlyGrouped.series.map((st) => (
                      <Bar isAnimationActive={false} key={st.slug} dataKey={st.slug} name={st.name} stackId="q" fill={st.color} radius={[0, 0, 0, 0]} maxBarSize={56} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {quarterly.map((q) => (
                  <span key={String(q.quarter)} className="rounded-full border border-border px-2.5 py-1 text-micro text-secondary">
                    {String(q.quarter)}{Number(q.months) < 3 ? ` (${q.months} mo)` : ''}:{' '}
                    <span className="text-primary">{formatCompact(Number(q.total))}</span>
                    {q.qoq != null && (
                      <span className={Number(q.qoq) >= 0 ? 'text-gold' : 'text-red-400'}>
                        {' '}{Number(q.qoq) >= 0 ? '+' : ''}{Number(q.qoq).toFixed(1)}%
                      </span>
                    )}
                  </span>
                ))}
              </div>
              <Explain
                shows={`A quarter is 3 months. Each label shows the total and the change on the quarter before. "(1 mo)" or "(2 mo)" means the quarter is not finished.`}
                means={(() => {
                  const done = quarterly.filter((q) => Number(q.months) === 3);
                  const last = done[done.length - 1];
                  if (!last || last.qoq == null) return undefined;
                  return `Last full quarter (${String(last.quarter)}): ${plainMoney(Number(last.total))} MMK, ${plainChange(Number(last.qoq))} on the quarter before. Quarters are the steadiest unit for budgeting.`;
                })()}
              />
            </ChartCard>
          )}
          <ChartCard title="Are we doing better than last year?" subtitle="Gold = this year · grey = a year earlier · all time">
            {yoy.length === 0 ? (
              <p className="text-caption text-secondary">
                This chart will appear once we have two years of data for the same months.
              </p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yoy} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
                    <XAxis dataKey="monthLabel" {...axisProps} />
                    <YAxis {...axisProps} tickFormatter={(v) => formatCompact(v)} width={52} />
                    <Tooltip {...tt} formatter={(v: number) => formatMMK(v)} />
                    <Legend />
                    <Bar isAnimationActive={false} dataKey="previous" name="Previous year" fill={theme.grid} maxBarSize={22} radius={[3, 3, 0, 0]} />
                    <Bar isAnimationActive={false} dataKey="current" name="Current year" fill="rgb(var(--color-gold))" maxBarSize={22} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {yoy.length > 0 && (
              <Explain
                shows="Grey: that month a year ago. Gold: this year. Taller gold means we improved."
                means={(() => {
                  const valid = yoy.filter((y) => y.previous > 0);
                  if (!valid.length) return undefined;
                  const better = valid.filter((y) => y.current > y.previous).length;
                  const totalNow = valid.reduce((a, b) => a + b.current, 0);
                  const totalPrev = valid.reduce((a, b) => a + b.previous, 0);
                  const pct = totalPrev ? ((totalNow - totalPrev) / totalPrev) * 100 : 0;
                  return `Ahead of last year in ${better} of ${valid.length} months. Overall ${plainChange(pct)}. The fairest measure of real growth.`;
                })()}
              />
            )}
          </ChartCard>
        </div>
        {seasonality.length > 0 && (
          <ChartCard title="Which months of the year are strong?" subtitle="Darker gold = stronger · all time">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-12">
              {seasonality.map((s) => {
                const intensity = milestones.best.value ? Math.min(s.avg / milestones.best.value, 1) : 0;
                return (
                  <div key={s.month} className="rounded-lg border border-border p-2 text-center" style={{ background: `rgba(212,175,55,${0.06 + intensity * 0.5})` }}>
                    <p className="text-caption font-medium text-primary">{format(new Date(2025, s.month - 1, 1), 'MMM')}</p>
                    <p className="tabular-nums text-micro text-secondary">{s.avg ? formatCompact(s.avg) : '—'}</p>
                  </div>
                );
              })}
            </div>
            <Explain
              shows="Every January together, every February together, and so on. Shows whether some months are always better."
              means={
                bestSeason && weakestSeason && bestSeason.avg > 0
                  ? `Strongest: ${monthName(bestSeason.month)} (about ${plainMoney(bestSeason.avg)} MMK). Weakest: ${monthName(weakestSeason.month)} (about ${plainMoney(weakestSeason.avg)} MMK). Release just before ${monthName(bestSeason.month)}. Keep cash for ${monthName(weakestSeason.month)}.`
                  : undefined
              }
            />
          </ChartCard>
        )}
      </div>

      {/* ============ Section: Records & stream health ============ */}
      <div className="space-y-5">
        <SectionHeader title="Best and worst months for each stream" subtitle="All time, not the selected months" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <ChartCard title="Most and least each stream has earned" subtitle="Highest and lowest month on record">
            <div className="overflow-x-auto">
              <table className="w-full text-caption">
                <thead>
                  <tr className="border-b border-border text-secondary">
                    <th className="py-2 pr-2 text-left font-medium">Stream</th>
                    <th className="px-2 py-2 text-right font-medium">Best month ever</th>
                    <th className="px-2 py-2 text-right font-medium">Lowest month</th>
                  </tr>
                </thead>
                <tbody>
                  {recordsAnomalies.records.map((r) => (
                    <tr key={r.name} className="border-b border-border last:border-0">
                      <td className="py-2 pr-2 text-primary">
                        <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />
                        {r.name}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <span className="tabular-nums font-medium text-gold">{formatCompact(r.best.v)}</span>
                        <span className="block text-micro text-muted">{format(parseISO(r.best.month), 'MMM yyyy')}</span>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <span className="tabular-nums text-primary">{formatCompact(r.worst.v)}</span>
                        <span className="block text-micro text-muted">{format(parseISO(r.worst.month), 'MMM yyyy')}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Explain
              shows="Best month: what a stream can reach. Lowest month: what a bad month looks like."
              means="Setting a target? Compare it with that stream's best month. Far above it is probably too high."
            />
          </ChartCard>
          <ChartCard title="How long has each stream been earning?" subtitle="Start date, total earned, direction now">
            <div className="overflow-x-auto">
              <table className="w-full text-caption">
                <thead>
                  <tr className="border-b border-border text-secondary">
                    <th className="py-2 pr-2 text-left font-medium">Stream</th>
                    <th className="px-2 py-2 text-left font-medium">Earning since</th>
                    <th className="px-2 py-2 text-right font-medium">Earned in total</th>
                    <th className="px-2 py-2 text-right font-medium">Direction now</th>
                  </tr>
                </thead>
                <tbody>
                  {lifecycle.map((row) => (
                    <tr key={row.key} className="border-b border-border last:border-0">
                      <td className="py-2 pr-2 text-primary">{row.name}</td>
                      <td className="px-2 py-2 text-secondary">
                        {row.firstMonth === '—' ? '—' : format(parseISO(row.firstMonth), 'MMM yyyy')}
                        <span className="block text-micro text-muted">{row.monthsActive} months</span>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-primary">{formatCompact(row.allTimeTotal)}</td>
                      <td className="px-2 py-2 text-right">
                        <span className={`rounded-full px-2 py-0.5 text-micro font-semibold uppercase ${
                          row.trend === 'growing' ? 'bg-gold/15 text-gold' : row.trend === 'declining' ? 'bg-red-500/15 text-red-400' : 'bg-elevated text-secondary'
                        }`}>
                          {row.trend === 'growing' ? 'going up' : row.trend === 'declining' ? 'going down' : 'steady'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Explain
              shows={`"Earning since": first month with money. "Direction now": last 3 months vs the 3 before.`}
              means={(() => {
                const dead = lifecycle.filter((l) => l.trend === 'declining');
                if (!dead.length) return 'No stream is going down right now.';
                return `Going down: ${dead.map((d) => d.name).join(', ')}. Usually a contract or promotion ended. Ask the partner before it falls further.`;
              })()}
            />
          </ChartCard>
        </div>
      </div>

      {/* ============ Section: Telecom detail ============ */}
      <div className="space-y-5">
        <SectionHeader
          title="Mobile operator details (MPT, Atom, Ooredoo)"
          subtitle="Only needed if you manage the telecom partners. Everyone else can skip this part."
        />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <ChartCard title="Which mobile operator pays us the most for Ringtune?" subtitle="Each colour is one operator, added together each month">
            <MiniStack data={telecom} keys={[['MPT', seriesColor(0, theme.light)], ['Atom', seriesColor(1, theme.light)], ['Ooredoo', seriesColor(2, theme.light)]]} theme={theme} axisProps={axisProps} tt={tt} />
          </ChartCard>
          <ChartCard title="How much comes from mobile operators, and how much from everywhere else?" subtitle="Gold is money from mobile operators, blue is all our other streams">
            <MiniStack data={filtered.map((row) => ({
              monthLabel: row.month ? format(parseISO(String(row.month)), 'MMM yy') : '',
              Telecom: Number(row.ringtune ?? 0) + Number(row.eauc ?? 0) + Number(row.combo ?? 0),
              Direct: Number(row.total ?? 0) - (Number(row.ringtune ?? 0) + Number(row.eauc ?? 0) + Number(row.combo ?? 0)),
            }))} keys={[['Telecom', seriesColor(0, theme.light)], ['Direct', seriesColor(1, theme.light)]]} theme={theme} axisProps={axisProps} tt={tt} />
          </ChartCard>
          <ChartCard title="Inside MPT: which product earns the most?" subtitle="MPT's money split into Ringtune, EAUC and Combo">
            <MiniStack data={mptContribution} keys={[['Ringtune', seriesColor(0, theme.light)], ['EAUC', seriesColor(1, theme.light)], ['Combo', seriesColor(2, theme.light)]]} theme={theme} axisProps={axisProps} tt={tt} />
          </ChartCard>
          <ChartCard title="Inside Atom: which product earns the most?" subtitle="Atom's money split into Ringtune, EAUC and Combo">
            <MiniStack data={atomContribution} keys={[['Ringtune', seriesColor(0, theme.light)], ['EAUC', seriesColor(1, theme.light)], ['Combo', seriesColor(2, theme.light)]]} theme={theme} axisProps={axisProps} tt={tt} />
          </ChartCard>
        </div>
      </div>

      <p className="text-caption text-muted">
        The newest month with data is {lastMonth ? format(parseISO(lastMonth), 'MMMM yyyy') : '—'}. The next
        month to fill in is {nextDue}. All amounts are shown in your selected currency.
      </p>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-border pb-2">
      <h2 className="text-title font-bold tracking-tight text-primary">{title}</h2>
      <p className="text-caption text-secondary">{subtitle}</p>
    </div>
  );
}

function MiniStack({
  data,
  keys,
  theme,
  axisProps,
  tt,
}: {
  data: Array<Record<string, unknown>>;
  keys: Array<[string, string]>;
  theme: ReturnType<typeof useChartTheme>;
  axisProps: Record<string, unknown>;
  tt: Record<string, unknown>;
}) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
          <XAxis dataKey="monthLabel" {...axisProps} />
          <YAxis {...axisProps} tickFormatter={(v: number) => formatCompact(v)} width={52} />
          <Tooltip {...tt} formatter={(v: number) => formatMMK(v)} />
          <Legend />
          {keys.map(([name, color]) => (
            <Bar isAnimationActive={false} key={name} dataKey={name} stackId="a" fill={color} maxBarSize={28} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
