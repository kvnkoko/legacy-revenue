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
import { plainChange } from '@/lib/plain-language';
import { PeriodPicker } from '@/components/dashboard/PeriodPicker';
import {
  completeRows,
  incompleteTail,
  latestCompleteMonth as findLatestComplete,
} from '@/lib/data-completeness';

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

  /*
   * Which months can the headline figures use?
   *
   * Distributor reports arrive late, so the newest recorded month is usually
   * part-filled. Figures built from it read as a collapse in revenue when
   * nothing has actually happened, which is why the month-over-month card was
   * removed entirely — it was wrong more often than it was right.
   *
   * Every headline below therefore uses COMPLETE months only, and the page says
   * which months those are.
   */
  const settled = completeRows(monthsAll, matrix.streams);
  const stillFilling = incompleteTail(monthsAll, matrix.streams);
  const latestComplete = findLatestComplete(monthsAll, matrix.streams);
  const latestRecordedMonth = monthsAll.length ? monthsAll[monthsAll.length - 1] : null;

  // The period the cards cover. Defaults to the newest month we can trust.
  const asStr = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const defaultMonth = latestComplete?.month ?? latestRecordedMonth?.month ?? monthKey(new Date());
  const normalise = (raw: string | undefined, fallback: string) => {
    const value = raw?.trim();
    if (!value) return fallback;
    // Accept YYYY-MM from the month input as well as a full date.
    const candidate = /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value;
    return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : fallback;
  };
  let periodFrom = normalise(asStr(searchParams?.from), defaultMonth);
  let periodTo = normalise(asStr(searchParams?.to), defaultMonth);
  if (periodFrom > periodTo) [periodFrom, periodTo] = [periodTo, periodFrom];

  const periodRows = settled.filter((r) => r.month >= periodFrom && r.month <= periodTo);
  const periodHasData = periodRows.length > 0;
  const periodLabel =
    periodFrom === periodTo
      ? monthName(periodFrom)
      : `${monthName(periodFrom)} – ${monthName(periodTo)}`;

  // Months inside the chosen range that were skipped because they are unsettled.
  const excludedInPeriod = stillFilling.filter((m) => m.month >= periodFrom && m.month <= periodTo);

  const totalRevenue = periodRows.reduce((sum, r) => sum + Number(r.total ?? 0), 0);
  const latestRecordedYear = latestComplete ? new Date(latestComplete.month).getFullYear() : null;

  // Year to date, counting settled months only, so a part-filled month cannot
  // drag the running total down.
  const ytdRows = latestRecordedYear == null
    ? []
    : settled.filter((r) => new Date(r.month).getFullYear() === latestRecordedYear);
  const ytdTotal = ytdRows.reduce((s, r) => s + Number(r.total ?? 0), 0);
  const ytdThrough = ytdRows.length ? monthName(ytdRows[ytdRows.length - 1].month) : null;

  const bestStream = periodHasData
    ? matrix.streams.reduce<{ name: string; value: number } | null>((best, stream) => {
        const val = periodRows.reduce((sum, r) => sum + Number(r[stream.slug] ?? 0), 0);
        return !best || val > best.value ? { name: stream.name, value: val } : best;
      }, null)
    : null;
  const bestStreamShare = bestStream && totalRevenue ? (bestStream.value / totalRevenue) * 100 : null;
  const bestStreamIndex = bestStream ? matrix.streams.findIndex((x) => x.name === bestStream.name) : -1;
  // Server-rendered, so resolve the dark step; the client charts pick per theme.
  const bestStreamColor = bestStreamIndex >= 0 ? seriesColor(bestStreamIndex, false) : undefined;

  // Same period one year earlier — a like-for-like comparison that survives late
  // reporting, unlike comparing with the month before.
  const shiftYear = (month: string, delta: number) => {
    const d = new Date(month);
    d.setFullYear(d.getFullYear() + delta);
    return monthKey(d);
  };
  const priorYearRows = settled.filter(
    (r) => r.month >= shiftYear(periodFrom, -1) && r.month <= shiftYear(periodTo, -1)
  );
  const priorYearTotal = priorYearRows.reduce((sum, r) => sum + Number(r.total ?? 0), 0);
  const yoyChange =
    priorYearRows.length === periodRows.length && priorYearTotal > 0
      ? ((totalRevenue - priorYearTotal) / priorYearTotal) * 100
      : null;

  const presets = (() => {
    if (!latestComplete) return [];
    const last = latestComplete.month;
    const back = (n: number) => {
      const d = new Date(last);
      d.setMonth(d.getMonth() - (n - 1));
      return monthKey(d);
    };
    const year = new Date(last).getFullYear();
    return [
      { label: 'Latest full month', from: last, to: last },
      { label: 'Last 3 months', from: back(3), to: last },
      { label: 'Last 12 months', from: back(12), to: last },
      { label: `${year}`, from: `${year}-01-01`, to: last },
    ];
  })();

  const expected = monthRange('2025-01-01', monthKey(new Date()));
  const existingSet = new Set(monthsAll.map((m) => m.month));
  const missingMonths = expected.filter((m) => !existingSet.has(m));

  const currentCalendarMonth = monthKey(new Date());
  const hasCurrentData = existingSet.has(currentCalendarMonth);

  // The architecture diagram shows one month, so it uses the newest settled one.
  const diagramMonth = latestComplete?.month ?? '';
  const totalFor = (slug: string) => Number(streamTotals[slug]?.[diagramMonth] ?? 0);
  const diagramRow = latestComplete;
  const directCurrent = matrix.streams
    .filter((s2) => !['ringtune', 'eauc', 'combo'].includes(s2.slug))
    .reduce((sum, s2) => sum + Number(diagramRow?.[s2.slug] ?? 0), 0);

  const trendRows = loadAll ? monthsAll : months;

  // The donut takes a single row, so collapse the chosen period into per-stream
  // totals. Built from settled months only, like every other headline figure.
  const periodTotalsRow = periodHasData
    ? {
        month: periodTo,
        total: totalRevenue,
        ...Object.fromEntries(
          matrix.streams.map((stream) => [
            stream.slug,
            periodRows.reduce((sum, r) => sum + Number(r[stream.slug] ?? 0), 0),
          ])
        ),
      }
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title font-bold text-primary tracking-tight">Overview</h1>
        <p className="text-body text-secondary mt-0.5">
          A simple summary of how much money we are making.
        </p>
      </div>

      {stillFilling.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-body font-semibold text-primary">
            {stillFilling.length === 1
              ? `${monthName(stillFilling[0].month)} is still being filled in`
              : `${stillFilling.length} months are still being filled in`}
          </p>
          <p className="mt-1 text-caption leading-relaxed text-secondary">
            {stillFilling
              .map((m) => `${monthName(m.month)} has ${m.reporting} of about ${m.usual} streams`)
              .join('; ')}
            . Distributor reports arrive late, so the figures below leave these months out
            on purpose. They will be included automatically once the rest of the figures
            are entered.
          </p>
          <a
            href={`/entry?month=${stillFilling[stillFilling.length - 1].month}`}
            className="mt-2 inline-block text-caption font-medium text-gold underline"
          >
            Enter missing figures
          </a>
        </div>
      )}

      {!hasCurrentData && stillFilling.length === 0 && (
        <div className="rounded-xl border border-border bg-elevated p-3.5 text-body text-secondary">
          <span className="font-medium text-primary">{monthName(currentCalendarMonth)}</span> has not
          been filled in yet.{' '}
          <a href={`/entry?month=${currentCalendarMonth}`} className="font-medium text-gold underline">
            Add this month&apos;s figures
          </a>
        </div>
      )}

      {/* ============ Period the figures cover ============ */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-3">
          <p className="text-body font-semibold text-primary">Figures below cover {periodLabel}</p>
          <p className="mt-0.5 text-caption text-secondary">
            Only months with their full set of figures are counted. Change the months to compare any
            period you like.
          </p>
        </div>
        <PeriodPicker
          from={periodFrom}
          to={periodTo}
          latestCompleteMonth={latestComplete?.month ?? null}
          presets={presets}
        />
        {excludedInPeriod.length > 0 && (
          <p className="mt-3 text-caption text-amber-300">
            {excludedInPeriod.map((m) => monthName(m.month)).join(', ')}{' '}
            {excludedInPeriod.length === 1 ? 'is' : 'are'} inside these dates but not counted yet,
            because {excludedInPeriod.length === 1 ? 'it is' : 'they are'} still being filled in.
          </p>
        )}
      </div>

      {/* ============ Headline numbers, in plain language ============ */}
      {!periodHasData ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-body text-secondary">
          No months with complete figures fall inside {periodLabel}. Choose a wider period, or
          finish entering the months listed above.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatTile
            accent
            label="Money earned"
            magnitude={totalRevenue}
            value={<FormattedCurrency value={totalRevenue} />}
            sub={
              periodRows.length === 1
                ? `in ${periodLabel}`
                : `across ${periodRows.length} full months (${periodLabel})`
            }
          />
          <StatTile
            label={`Earned in ${latestRecordedYear ?? 'this year'} so far`}
            magnitude={ytdTotal}
            value={<FormattedCurrency value={ytdTotal} />}
            sub={ytdThrough ? `complete months up to ${ytdThrough}` : 'no complete months yet'}
          />
          <StatTile
            label="Biggest earner"
            value={bestStream?.name ?? '—'}
            dot={bestStreamColor}
            sub={
              bestStreamShare != null
                ? `${bestStreamShare.toFixed(0)}% of the money in ${periodLabel}`
                : 'no data yet'
            }
          />
        </div>
      )}

      {periodHasData && (
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <p className="text-body font-semibold text-primary">
            Compared with the same months a year earlier
          </p>
          {yoyChange != null ? (
            <p className="mt-1.5 text-caption leading-relaxed text-secondary">
              {periodLabel} {plainChange(yoyChange)} against the same period in{' '}
              {new Date(periodFrom).getFullYear() - 1}. Comparing the same months a year apart is
              the fairest measure we have, because both periods have had time to be filled in —
              unlike comparing with last month, where the reports have usually not arrived yet.
            </p>
          ) : (
            <p className="mt-1.5 text-caption leading-relaxed text-secondary">
              We cannot compare this period yet: the same months a year earlier are not all
              complete in our records. Pick a period where both years have full figures.
            </p>
          )}
        </div>
      )}

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
          <RevenueTrendChart data={trendRows} streams={matrix.streams} />
          <Explain
            shows="The coloured bands stack up to the month's total, so you can see both the total and which streams made it up. Use the buttons above the chart to look at a shorter or longer period."
            means={
              stillFilling.length
                ? `The chart shows every month we have recorded, including ${stillFilling
                    .map((m) => monthName(m.month))
                    .join(' and ')}, which ${stillFilling.length === 1 ? 'is' : 'are'} still being filled in. The drop at the right-hand end is missing figures, not lost business — judge the direction from the earlier months.`
                : yoyChange != null
                  ? `Against the same months a year earlier, the total ${plainChange(yoyChange)}. Watch the direction over several months rather than reacting to one month on its own.`
                  : undefined
            }
          />
        </ChartCard>

        <ChartCard
          title={`Where did the money come from in ${periodHasData ? periodLabel : 'the latest full month'}?`}
          subtitle="Biggest earner first, with its share of the total. Complete months only."
        >
          <StreamDonutChart data={periodTotalsRow} streams={matrix.streams} />
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
          ringtune: Number(diagramRow?.ringtune ?? 0),
          eauc: Number(diagramRow?.eauc ?? 0),
          combo: Number(diagramRow?.combo ?? 0),
          total: Number(diagramRow?.total ?? 0),
        }}
      />

      <RevenueHistoryTable rows={monthsAll} streams={matrix.streams} missingMonths={missingMonths} />
    </div>
  );
}
