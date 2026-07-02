import { createClient } from '@/lib/supabase/server';
import { getStreamMatrix } from '@/lib/streams/server';
import { AnalyticsCharts } from '@/components/analytics/AnalyticsCharts';
import { getServerPermissions } from '@/lib/authz/server';
import { AccessDenied } from '@/components/authz/AccessDenied';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const perms = await getServerPermissions();
  if (!perms.profile) {
    return <AccessDenied permissionName="Authentication" message="Please sign in to continue." />;
  }
  if (!perms.isAdmin && !perms.can.viewAnalytics) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-title font-bold text-primary tracking-tight">Analytics</h1>
          <p className="text-body text-secondary mt-0.5">Financial analytics and trends</p>
        </div>
        <AccessDenied permissionName="can_view_analytics" profile={perms.profile} />
      </div>
    );
  }

  const supabase = await createClient();
  const loadAll = searchParams?.all === '1';
  const fromMonth = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 11);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  })();
  const summaryQuery = supabase.from('v_revenue_summary_compat').select('*').order('month', { ascending: true });
  if (!loadAll) summaryQuery.gte('month', fromMonth);
  const matrixOpts = loadAll ? {} : { fromMonth };
  // Matrices are shaped like the frozen legacy tables (month + column slugs),
  // so AnalyticsCharts consumes them unchanged.
  const [{ data: summary }, ringtuneMatrix, mptMatrix, atomMatrix] = await Promise.all([
    summaryQuery,
    getStreamMatrix('ringtune', matrixOpts),
    getStreamMatrix('mpt', matrixOpts),
    getStreamMatrix('atom', matrixOpts),
  ]);
  const ringtune = ringtuneMatrix?.rows ?? [];
  const mpt = mptMatrix?.rows ?? [];
  const atom = atomMatrix?.rows ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title font-bold text-primary tracking-tight">Analytics</h1>
        <p className="text-body text-secondary mt-0.5">Financial analytics and trends</p>
        <a href={loadAll ? '/analytics' : '/analytics?all=1'} className="text-caption text-secondary underline">
          {loadAll ? 'Show recent 12 months' : 'Load all months'}
        </a>
      </div>
      <AnalyticsCharts summary={summary ?? []} ringtune={ringtune} mpt={mpt} atom={atom} />
    </div>
  );
}
