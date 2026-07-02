import { getStreamTotals, getSummaryMatrix } from '@/lib/streams/server';
import { formatPercent } from '@/lib/utils';
import { FormattedCurrency } from '@/components/ui/FormattedCurrency';
import { RevenueTrendChart } from '@/components/dashboard/RevenueTrendChart';
import { StreamDonutChart } from '@/components/dashboard/StreamDonutChart';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { RevenueHistoryTable } from '@/components/history/RevenueHistoryTable';
import { RevenueArchitectureDiagram } from '@/components/dashboard/RevenueArchitectureDiagram';

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

  // YoY: same calendar month, previous year (when history reaches that far).
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title font-bold text-primary tracking-tight">Overview</h1>
        <p className="text-body text-secondary mt-0.5">Revenue at a glance</p>
      </div>
      {!hasCurrentData && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-amber-200">
          {new Date(currentCalendarMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} data has not been entered yet.{' '}
          <a href={`/entry?month=${currentCalendarMonth}`} className="underline">Add month data</a>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 hover:border-border-hover transition shadow-glow-teal">
          <p className="text-caption font-medium text-secondary">Total Revenue (Latest Recorded Month)</p>
          <p className="text-title font-bold text-teal mt-1"><FormattedCurrency value={totalRevenue} /></p>
          <p className="text-micro text-muted mt-0.5">
            {latestRecordedMonth
              ? new Date(latestRecordedMonth.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
              : 'No data yet'}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 hover:border-border-hover transition">
          <p className="text-caption font-medium text-secondary">MoM Growth</p>
          <p
            className={`text-title font-bold mt-1 ${
              momGrowth != null && momGrowth < 0 ? 'text-danger' : 'text-teal'
            }`}
          >
            {momGrowth != null ? formatPercent(momGrowth) : '—'}
          </p>
          {yoyGrowth != null && (
            <p className={`text-micro mt-0.5 ${yoyGrowth < 0 ? 'text-danger' : 'text-secondary'}`}>
              YoY: {formatPercent(yoyGrowth)}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-5 hover:border-border-hover transition">
          <p className="text-caption font-medium text-secondary">YTD Total {latestRecordedYear ? `(${latestRecordedYear})` : ''}</p>
          <p className="text-title font-bold text-primary mt-1"><FormattedCurrency value={ytdTotal} /></p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 hover:border-border-hover transition">
          <p className="text-caption font-medium text-secondary">Best Performing Stream</p>
          <p className="text-title font-bold mt-1" style={{ color: bestStream?.color }}>
            {bestStream?.name ?? '—'}
          </p>
          {bestStream && (
            <p className="text-micro text-muted mt-0.5"><FormattedCurrency value={bestStream.value} /></p>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <QuickActions />
      <div className="text-left sm:text-right">
        <a href={loadAll ? '/dashboard' : '/dashboard?all=1'} className="text-caption text-secondary underline">
          {loadAll ? 'Show recent 12 months' : 'Load all months'}
        </a>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <h2 className="text-body font-semibold text-primary mb-4">Revenue trend</h2>
          <RevenueTrendChart data={months} streams={matrix.streams} />
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-body font-semibold text-primary mb-4">Latest recorded month by stream</h2>
          <StreamDonutChart data={latestRecordedMonth} streams={matrix.streams} />
        </div>
      </div>

      {/* Recent activity */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-body font-semibold text-primary mb-4">Recent data entry activity</h2>
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
