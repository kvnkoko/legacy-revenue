import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getServerPermissions } from '@/lib/authz/server';
import { getStreamConfig } from '@/lib/streams/server';
import { AccessDenied } from '@/components/authz/AccessDenied';
import { getAppSettings } from '@/app/(dashboard)/admin/settings/actions';
import { EntryWorkspace, type MonthCoverage } from '@/components/entry/EntryWorkspace';
import { DeleteMonthButton } from '@/components/entry/DeleteMonthButton';
import { fetchAllRows } from '@/lib/streams/shared';

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

export default async function EntryPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const perms = await getServerPermissions();
  if (!perms.profile) {
    return (
      <div className="space-y-5">
        <AccessDenied permissionName="Authentication" message="Please sign in to continue." />
      </div>
    );
  }
  if (!perms.isAdmin && !perms.can.enterData) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-title font-bold text-primary tracking-tight">Data Entry</h1>
          <p className="text-body text-secondary mt-0.5">Enter or update monthly revenue, one platform at a time</p>
        </div>
        <AccessDenied
          permissionName="can_enter_data"
          profile={perms.profile}
          message="Data entry access is required to add monthly figures. Contact your administrator."
        />
      </div>
    );
  }

  const supabase = await createClient();
  const selectedMonth = typeof searchParams?.month === 'string' ? searchParams.month : undefined;
  const viewOnly = searchParams?.view === '1';

  // Page through ALL entries — a plain select caps at 1000 rows, which would
  // silently drop the most recent months once history passes ~1000 values and
  // make saved data read back as empty. See fetchAllRows.
  const [config, entries, summaryRes] = await Promise.all([
    getStreamConfig(),
    fetchAllRows<{ month: string; field_id: string; amount: number }>((from, to) =>
      supabase
        .from('revenue_entries')
        .select('month, field_id, amount')
        .order('month', { ascending: true })
        .range(from, to)
    ),
    supabase.from('v_revenue_summary_compat').select('month, total, updated_at').order('month', { ascending: true }),
  ]);
  const summary = summaryRes.data ?? [];

  // Existing amounts per month, keyed by field id — the wizard's prefill.
  const initialByMonth: Record<string, Record<string, number>> = {};
  for (const e of entries) {
    const month = String(e.month);
    (initialByMonth[month] ??= {})[String(e.field_id)] = Number(e.amount ?? 0);
  }

  const existingMonths = Object.keys(initialByMonth).sort();
  const latestMonth = existingMonths.at(-1) ?? '2024-12-01';
  const latestDate = new Date(latestMonth);
  latestDate.setMonth(latestDate.getMonth() + 1);
  const defaultMonth = monthKey(latestDate);

  // Coverage: complete = every active entry stream has at least one value.
  const entryStreams = config.streams.filter((s) => s.kind === 'entry' && s.isActive);
  const streamByField = new Map(config.fields.map((f) => [f.id, f.streamId]));
  const streamsWithData = new Map<string, Set<string>>();
  for (const e of entries) {
    const sid = streamByField.get(String(e.field_id));
    if (!sid) continue;
    const month = String(e.month);
    if (!streamsWithData.has(month)) streamsWithData.set(month, new Set());
    streamsWithData.get(month)!.add(sid);
  }

  const currentMonth = monthKey(new Date());
  // Start the visible timeline at the earliest month that actually has data
  // (e.g. Jan 2024), never later than Jan 2025, so no recorded month is hidden.
  const rangeStart = existingMonths[0] && existingMonths[0] < '2025-01-01' ? existingMonths[0] : '2025-01-01';
  const expectedMonths = monthRange(rangeStart, currentMonth);
  const stateFor = (month: string): MonthCoverage['state'] => {
    const covered = streamsWithData.get(month);
    if (!covered || covered.size === 0) return 'missing';
    return entryStreams.every((s) => covered.has(s.id)) ? 'complete' : 'partial';
  };
  const coverage: MonthCoverage[] = [
    ...expectedMonths.map((month) => ({ month, state: stateFor(month) })),
    ...[1, 2, 3].map((offset) => {
      const d = new Date(currentMonth);
      d.setMonth(d.getMonth() + offset);
      return { month: monthKey(d), state: 'future' as const };
    }),
  ];
  const completeCount = expectedMonths.filter((m) => stateFor(m) === 'complete').length;
  const gapCount = expectedMonths.filter((m) => stateFor(m) === 'missing').length;
  const coverageSummary = gapCount > 0
    ? `${completeCount} of ${expectedMonths.length} months recorded — ${gapCount} gaps detected`
    : `${completeCount} of ${expectedMonths.length} months recorded`;

  let duplicateMonthBehavior: 'allow' | 'confirm' | 'block' = 'confirm';
  try {
    const dataEntrySettings = await getAppSettings('data-entry');
    const val = dataEntrySettings?.duplicate_month_behavior;
    if (val === 'allow' || val === 'confirm' || val === 'block') duplicateMonthBehavior = val;
  } catch {
    // Use default
  }

  const summaryByMonth = new Map(summary.map((s) => [String(s.month), s]));
  const historyRows = [...expectedMonths].reverse().map((month) => {
    const state = stateFor(month);
    return {
      month,
      total: Number(summaryByMonth.get(month)?.total ?? 0),
      entryDate: (summaryByMonth.get(month)?.updated_at as string | undefined) ?? null,
      status: state === 'complete' ? 'Complete' : state === 'partial' ? 'Partial' : 'Missing',
    };
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-title font-bold text-primary tracking-tight">Data Entry</h1>
        <p className="text-body text-secondary mt-0.5">
          Pick a month, open the platform you have numbers for, and save just that platform —
          no need to fill everything at once.
        </p>
      </div>
      {/* key forces a fresh mount when an Edit/View link targets a month, so
          the workspace always opens exactly the month that was clicked. */}
      <EntryWorkspace
        key={`${selectedMonth ?? 'default'}-${viewOnly ? 'view' : 'edit'}`}
        config={config}
        initialByMonth={initialByMonth}
        defaultMonth={defaultMonth}
        selectedMonth={selectedMonth}
        coverage={coverage}
        coverageSummary={coverageSummary}
        viewOnly={viewOnly}
        submittingAs={`${perms.profile.full_name} (${perms.role})`}
        duplicateMonthBehavior={duplicateMonthBehavior}
        canEditExisting={perms.isAdmin || perms.can.editData}
      />

      <section className="rounded-xl border border-border bg-card p-3 sm:p-5">
        <h2 className="text-body font-semibold text-primary">Monthly Entry History</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[860px] w-full text-left text-body">
            <thead>
              <tr className="border-b border-border">
                <th className="p-3 text-secondary font-medium">Month</th>
                <th className="p-3 text-secondary font-medium">Total Revenue</th>
                <th className="p-3 text-secondary font-medium">Last Updated</th>
                <th className="p-3 text-secondary font-medium">Status</th>
                <th className="p-3 text-secondary font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {historyRows.map((row) => (
                <tr key={row.month} className="border-b border-border last:border-0">
                  <td className="p-3 text-primary">{new Date(row.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</td>
                  <td className="p-3 text-primary">{row.status === 'Missing' ? '—' : row.total.toLocaleString()}</td>
                  <td className="p-3 text-secondary">{row.entryDate ? new Date(row.entryDate).toLocaleDateString() : '—'}</td>
                  <td className={`p-3 ${row.status === 'Complete' ? 'text-gold' : row.status === 'Partial' ? 'text-amber-500' : 'text-red-400'}`}>{row.status}</td>
                  <td className="p-3">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      {(perms.isAdmin || perms.can.editData || row.status === 'Missing') && (
                        <Link href={`/entry?month=${row.month}`} className="rounded border border-border px-2 py-1 text-caption text-primary hover:bg-elevated">
                          {row.status === 'Missing' ? 'Add Data' : 'Edit'}
                        </Link>
                      )}
                      <Link href={`/entry?month=${row.month}&view=1`} className="rounded border border-border px-2 py-1 text-caption text-secondary hover:bg-elevated">
                        View
                      </Link>
                      {row.status !== 'Missing' && (perms.isAdmin || perms.can.deleteData) && (
                        <DeleteMonthButton month={row.month} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
