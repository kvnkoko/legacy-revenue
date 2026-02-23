import { createClient } from '@/lib/supabase/server';
import { formatPercent, formatStreamLabel, STREAM_COLORS } from '@/lib/utils';
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
  const supabase = await createClient();
  const loadAll = searchParams?.all === '1';
  const fromMonth = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 11);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  })();
  const summaryQuery = supabase
    .from('revenue_summary')
    .select('*')
    .order('month', { ascending: true });
  if (!loadAll) summaryQuery.gte('month', fromMonth);
  const [{ data: summary }, { data: summaryAll }, { data: mptRows }, { data: atomRows }, { data: ringtuneRows }] = await Promise.all([
    summaryQuery,
    supabase.from('revenue_summary').select('*').order('month', { ascending: true }),
    supabase.from('mpt').select('*').order('month', { ascending: true }),
    supabase.from('atom').select('*').order('month', { ascending: true }),
    supabase.from('ringtune').select('*').order('month', { ascending: true }),
  ]);

  const months = summary ?? [];
  const monthsAll = summaryAll ?? [];
  const latestRecordedMonth = monthsAll.length ? monthsAll[monthsAll.length - 1] : null;
  const prevRecordedMonth = monthsAll.length > 1 ? monthsAll[monthsAll.length - 2] : null;
  const latestRecordedYear = latestRecordedMonth ? new Date(String(latestRecordedMonth.month)).getFullYear() : null;

  const totalRevenue = latestRecordedMonth?.total ?? 0;
  const momGrowth =
    prevRecordedMonth && prevRecordedMonth.total
      ? ((Number(latestRecordedMonth?.total ?? 0) - Number(prevRecordedMonth.total)) / Number(prevRecordedMonth.total)) *
        100
      : null;
  const ytdTotal = latestRecordedYear == null
    ? 0
    : monthsAll
        .filter((r) => new Date(String(r.month)).getFullYear() === latestRecordedYear)
        .reduce((s, r) => s + Number(r.total ?? 0), 0);
  const streamNames = [
    'ringtune',
    'eauc',
    'combo',
    'sznb',
    'flow_subscription',
    'youtube',
    'spotify',
    'tiktok',
  ] as const;
  type StreamName = (typeof streamNames)[number];
  const bestStream = latestRecordedMonth
    ? streamNames.reduce<{ name: StreamName; value: number }>(
        (best, key) => {
          const val = Number((latestRecordedMonth as Record<string, unknown>)[key] ?? 0);
          return val > best.value ? { name: key, value: val } : best;
        },
        { name: 'ringtune', value: 0 }
      )
    : null;

  const historyRows = monthsAll.map((m) => ({
    month: m.month as string,
    ringtune: Number(m.ringtune ?? 0),
    eauc: Number(m.eauc ?? 0),
    combo: Number(m.combo ?? 0),
    sznb: Number(m.sznb ?? 0),
    flow_subscription: Number(m.flow_subscription ?? 0),
    youtube: Number(m.youtube ?? 0),
    spotify: Number(m.spotify ?? 0),
    tiktok: Number(m.tiktok ?? 0),
    total: Number(m.total ?? 0),
  }));
  const expected = monthRange('2025-01-01', monthKey(new Date()));
  const existingSet = new Set(monthsAll.map((m) => m.month as string));
  const missingMonths = expected.filter((m) => !existingSet.has(m));

  const currentCalendarMonth = monthKey(new Date());
  const hasCurrentData = existingSet.has(currentCalendarMonth);

  const mptCurrent = mptRows?.find((r) => r.month === latestRecordedMonth?.month);
  const atomCurrent = atomRows?.find((r) => r.month === latestRecordedMonth?.month);
  const ringtuneCurrent = ringtuneRows?.find((r) => r.month === latestRecordedMonth?.month);
  const directCurrent =
    Number(latestRecordedMonth?.sznb ?? 0) +
    Number(latestRecordedMonth?.flow_subscription ?? 0) +
    Number(latestRecordedMonth?.youtube ?? 0) +
    Number(latestRecordedMonth?.spotify ?? 0) +
    Number(latestRecordedMonth?.tiktok ?? 0);
  const mptTotal =
    Number(mptCurrent?.legacy_ringtune ?? 0) +
    Number(mptCurrent?.legacy_eauc ?? 0) +
    Number(mptCurrent?.legacy_combo ?? 0) +
    Number(mptCurrent?.etrade_ringtune ?? 0) +
    Number(mptCurrent?.etrade_eauc ?? 0) +
    Number(mptCurrent?.etrade_combo ?? 0) +
    Number(mptCurrent?.fortune_ringtune ?? 0) +
    Number(mptCurrent?.fortune_eauc ?? 0) +
    Number(mptCurrent?.fortune_combo ?? 0) +
    Number(mptCurrent?.unico_ringtune ?? 0) +
    Number(mptCurrent?.unico_eauc ?? 0) +
    Number(mptCurrent?.unico_combo ?? 0);

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
            {latestRecordedMonth?.month
              ? new Date(String(latestRecordedMonth.month)).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
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
        </div>
        <div className="rounded-xl border border-border bg-card p-5 hover:border-border-hover transition">
          <p className="text-caption font-medium text-secondary">YTD Total {latestRecordedYear ? `(${latestRecordedYear})` : ''}</p>
          <p className="text-title font-bold text-primary mt-1"><FormattedCurrency value={ytdTotal} /></p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 hover:border-border-hover transition">
          <p className="text-caption font-medium text-secondary">Best Performing Stream</p>
          <p
            className="text-title font-bold mt-1 capitalize"
            style={{ color: bestStream ? STREAM_COLORS[bestStream.name] : undefined }}
          >
            {bestStream ? formatStreamLabel(bestStream.name) : '—'}
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
          <RevenueTrendChart data={months} />
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-body font-semibold text-primary mb-4">Latest recorded month by stream</h2>
          <StreamDonutChart data={latestRecordedMonth} />
        </div>
      </div>

      {/* Recent activity */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-body font-semibold text-primary mb-4">Recent data entry activity</h2>
        <RecentActivity />
      </div>

      <RevenueArchitectureDiagram
        values={{
          mpt: mptTotal,
          atom: Number(atomCurrent?.total ?? 0),
          ooredoo: Number(ringtuneCurrent?.ooredoo ?? 0),
          direct: directCurrent,
          ringtune: Number(latestRecordedMonth?.ringtune ?? 0),
          eauc: Number(latestRecordedMonth?.eauc ?? 0),
          combo: Number(latestRecordedMonth?.combo ?? 0),
          total: Number(latestRecordedMonth?.total ?? 0),
        }}
      />

      <RevenueHistoryTable rows={historyRows} missingMonths={missingMonths} />
    </div>
  );
}
