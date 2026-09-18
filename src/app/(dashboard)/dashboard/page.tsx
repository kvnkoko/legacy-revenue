import { getStreamTotals, getSummaryMatrix } from '@/lib/streams/server';
import { FormattedCurrency } from '@/components/ui/FormattedCurrency';
import { RevenueTrendChart } from '@/components/dashboard/RevenueTrendChart';
import { StreamDonutChart } from '@/components/dashboard/StreamDonutChart';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { RevenueHistoryTable } from '@/components/history/RevenueHistoryTable';
import { RevenueArchitectureDiagram } from '@/components/dashboard/RevenueArchitectureDiagram';
import { ChartCard, StatTile } from '@/components/charts/chart-kit';
import { seriesColor } from '@/lib/series-palette';
import { Explain } from '@/components/charts/plain-language';
import { plainChange, sentenceCase } from '@/lib/plain-language';

export const dynamic = 'force-dynamic';

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function monthRange(start: string, end: string): string[] {
  const from = new Date(start);
  const to = new Date(end);
  const out: string[] = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    out.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

function monthName(month: string): string {
  return new Date(month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const loadAll = searchParams?.all === '1';
  const fromMonth = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 11);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  })();

  // Everything below is config-driven: streams created in Stream Management
  // appear in the KPIs, charts and history automatically.
  const [matrix, streamTotals] = await Promise.all([getSummaryMatrix(), getStreamTotals()]);
  const monthsAll = matrix.rows;
  const months = loadAll ? monthsAll : monthsAll.filter((r) => r.month >= fromMonth);

  const latestRecordedMonth = monthsAll.length ? monthsAll[monthsAll.length - 1] : null;
  const prevRecordedMonth = monthsAll.length > 1 ? monthsAll[monthsAll.length - 2] : null;
  const latestRecordedYear = latestRecordedMonth ? new Date(latestRecordedMonth.month).getFullYear() : null;

  const totalRevenue = Number(latestRecordedMonth?.total ?? 0);
  const momGrowth =
    prevRecordedMonth && Number(prevRecordedMonth.total)
      ? ((totalRevenue - Number(prevRecordedMonth.total)) / Number(prevRecordedMonth.total)) * 100
      : null;

  // Same calendar month one year earlier, when history reaches that far.
  const yoyGrowth = (() => {
    if (!latestRecordedMonth) return null;
    const d = new Date(latestRecordedMonth.month);
    d.setFullYear(d.getFullYear() - 1);
    const prior = monthsAll.find((r) => r.month === monthKey(d));
    if (!prior || !Number(prior.total)) return null;
    return ((totalRevenue - Number(prior.total)) / Number(prior.total)) * 100;
  })();

  const ytdTotal =
    latestRecordedYear == null
      ? 0
      : monthsAll
          .filter((r) => new Date(r.month).getFullYear() === latestRecordedYear)
          .reduce((s, r) => s + Number(r.total ?? 0), 0);

  const bestStream = latestRecordedMonth
    ? matrix.streams.reduce<{ name: string; color: string; value: number } | null>((best, s) => {
        const val = Number(latestRecordedMonth[s.slug] ?? 0);
        return !best || val > best.value ? { name: s.name, color: s.color, value: val } : best;
      }, null)
    : null;
  const bestStreamShare = bestStream && totalRevenue ? (bestStream.value / totalRevenue) * 100 : null;
  const bestStreamIndex = bestStream ? matrix.streams.findIndex((s) => s.name === bestStream.name) : -1;
  // Server-rendered, so resolve the dark step; the client charts pick per theme.
  const bestStreamColor = bestStreamIndex >= 0 ? seriesColor(bestStreamIndex, false) : undefined;

  /*
   * Is the newest recorded month probably still being filled in?
   *
   * A partly-entered month makes the headline change look catastrophic (a -62%
   * drop) when the real cause is that most streams have not been typed in yet.
   * That is a fast route to a wrong business decision, so compare how many
   * streams reported a figure with what is normal for recent months.
   */
  const reportingCount = (row: Record<string, unknown> | null) =>
    row ? matrix.streams.filter((s) => Number(row[s.slug] ?? 0) > 0).length : 0;
  const priorCounts = monthsAll.slice(-7, -1).map(reportingCount).filter((n) => n > 0).sort((a, b) => a - b);
  const typicalReporting = priorCounts.length ? priorCounts[Math.floor(priorCounts.length / 2)] : 0;
  const latestReporting = reportingCount(latestRecordedMonth);
  const looksIncomplete = typicalReporting > 0 && latestReporting < typicalReporting * 0.7;

  const expected = monthRange('2025-01-01', monthKey(new Date()));
  const existingSet = new Set(monthsAll.map((m) => m.month));
  const missingMonths = expected.filter((m) => !existingSet.has(m));

  const currentCalendarMonth = monthKey(new Date());
  const hasCurrentData = existingSet.has(currentCalendarMonth);

  const latestMonthKey = latestRecordedMonth?.month ?? '';
  const totalFor = (slug: string) => Number(streamTotals[slug]?.[latestMonthKey] ?? 0);
  const directCurrent = matrix.streams
    .filter((s) => !['ringtune', 'eauc', 'combo'].includes(s.slug))
    .reduce((sum, s) => sum + Number(latestRecordedMonth?.[s.slug] ?? 0), 0);

  const latestLabel = latestRecordedMonth ? monthName(latestRecordedMonth.month) : 'the latest month';
  const prevLabel = prevRecordedMonth ? monthName(prevRecordedMonth.month) : 'the month before';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title font-bold text-primary tracking-tight">Overview</h1>
        <p className="text-body text-secondary mt-0.5">
          A simple summary of how much money we are making.
        </p>
      </div>

      {!hasCurrentData && (
        <div className="rounded-xl border border-border bg-elevated p-3.5 text-body text-secondary">
          <span className="font-medium text-primary">{monthName(currentCalendarMonth)}</span> has not
          been filled in yet.{' '}
          <a href={`/entry?month=${currentCalendarMonth}`} className="font-medium text-gold underline">
            Add this month&apos;s figures
          </a>
        </div>
      )}

      {looksIncomplete && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-body font-semibold text-primary">
            Careful: {latestLabel} may not be finished yet
          </p>
          <p className="mt-1 text-caption leading-relaxed text-secondary">
            Only {latestReporting} of our {matrix.streams.length} streams have figures for{' '}
            {latestLabel}, but a normal month has about {typicalReporting}. So the numbers below will
            look lower than they really are, and the change from last month is probably not a real
            drop in business. Please finish entering {latestLabel} before using these figures in a
            report or a decision.
          </p>
          <a
            href={`/entry?month=${latestRecordedMonth?.month ?? currentCalendarMonth}`}
            className="mt-2 inline-block text-caption font-medium text-gold underline"
          >
            Finish entering {latestLabel}
          </a>
        </div>
      )}

      {/* ============ Headline numbers, in plain language ============ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          accent
          label="Money earned"
          magnitude={totalRevenue}
          value={<FormattedCurrency value={totalRevenue} />}
          sub={`in ${latestRecordedMonth ? latestLabel : 'no month yet'}${
            looksIncomplete ? ' · still being filled in' : ''
          }`}
        />
        <StatTile
          label="Compared with last month"
          value={momGrowth != null ? sentenceCase(plainChange(momGrowth)) : '—'}
          valueColor={
            looksIncomplete
              ? 'rgb(var(--color-secondary))'
              : momGrowth != null && momGrowth < -1
                ? 'rgb(var(--color-danger))'
                : undefined
          }
          sub={
            looksIncomplete
              ? 'not reliable until the month is complete'
              : `${latestLabel} against ${prevLabel}`
          }
        />
        <StatTile
          label={`Earned in ${latestRecordedYear ?? 'this year'} so far`}
          magnitude={ytdTotal}
          value={<FormattedCurrency value={ytdTotal} />}
          sub={`every month of ${latestRecordedYear ?? '—'} added together`}
        />
        <StatTile
          label="Biggest earner"
          value={bestStream?.name ?? '—'}
          dot={bestStreamColor}
          sub={
            bestStreamShare != null
              ? `${bestStreamShare.toFixed(0)}% of the money in ${latestLabel}`
              : 'no data yet'
          }
        />
      </div>

      <QuickActions />
      <div className="text-left sm:text-right">
        <a href={loadAll ? '/dashboard' : '/dashboard?all=1'} className="text-caption text-secondary underline">
          {loadAll ? 'Show only the last 12 months' : 'Show every month we have'}
        </a>
      </div>

      {/* ============ Charts ============ */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <ChartCard
          title="How much money do we make each month?"
          subtitle="Taller means we earned more that month. Each colour is one stream."
          className="lg:col-span-2"
        >
          <RevenueTrendChart data={months} streams={matrix.streams} />
          <Explain
            shows="The coloured bands stack up to the month's total, so you can see both the total and which streams made it up. Use the buttons above the chart to look at a shorter or longer period."
            means={
              momGrowth != null && !looksIncomplete
                ? `Compared with ${prevLabel}, the total ${plainChange(momGrowth)}${
                    yoyGrowth != null ? `, and against the same month last year it ${plainChange(yoyGrowth)}` : ''
                  }. Watch the direction over several months rather than reacting to one month on its own.`
                : looksIncomplete
                  ? `${latestLabel} is not finished, so the last part of this line will keep rising as figures are entered. Judge the trend from the completed months only.`
                  : undefined
            }
          />
        </ChartCard>

        <ChartCard
          title={`Where did the money come from in ${latestRecordedMonth ? latestLabel : 'the latest month'}?`}
          subtitle="Biggest earner first, with its share of the total"
        >
          <StreamDonutChart data={latestRecordedMonth} streams={matrix.streams} />
          <Explain
            shows="Each colour is one revenue stream. The percentage is that stream's share of everything we earned that month. Smaller streams are grouped together as “Other” so the colours stay easy to tell apart."
            means={
              bestStream && bestStreamShare != null
                ? bestStreamShare > 50
                  ? `${bestStream.name} alone brought ${bestStreamShare.toFixed(0)}% of the money. That is a lot to depend on one partner — worth growing a second stream.`
                  : `${bestStream.name} was our biggest earner with ${bestStreamShare.toFixed(0)}%. No single stream carries the whole business, which is healthier.`
                : undefined
            }
          />
        </ChartCard>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-body font-semibold text-primary">Who changed the numbers recently</h2>
        <p className="mt-0.5 mb-4 text-caption text-secondary">
          The newest edits and imports, so you can see whose figures you are looking at.
        </p>
        <RecentActivity />
      </div>

      <RevenueArchitectureDiagram
        values={{
          mpt: totalFor('mpt'),
          atom: totalFor('atom'),
          ooredoo: totalFor('ooredoo'),
          direct: directCurrent,
          ringtune: Number(latestRecordedMonth?.ringtune ?? 0),
          eauc: Number(latestRecordedMonth?.eauc ?? 0),
          combo: Number(latestRecordedMonth?.combo ?? 0),
          total: totalRevenue,
        }}
      />

      <RevenueHistoryTable rows={monthsAll} streams={matrix.streams} missingMonths={missingMonths} />
    </div>
  );
}
