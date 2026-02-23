import Link from 'next/link';
import { EntryWizard } from './EntryWizard';
import { createClient } from '@/lib/supabase/server';
import { getServerPermissions } from '@/lib/authz/server';
import { AccessDenied } from '@/components/authz/AccessDenied';
import { getAppSettings } from '@/app/(dashboard)/admin/settings/actions';

type MonthStatus = 'complete' | 'partial' | 'missing' | 'future';

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
          <p className="text-body text-secondary mt-0.5">Add monthly revenue data step by step</p>
        </div>
        <AccessDenied
          permissionName="can_enter_data"
          profile={perms.profile}
          message={`Data entry access is required to add monthly figures. Contact your administrator.`}
        />
      </div>
    );
  }

  const supabase = await createClient();
  const selectedMonth = typeof searchParams?.month === 'string' ? searchParams.month : undefined;
  const viewOnly = searchParams?.view === '1';

  const [summaryRes, mptRes, atomRes, ringtuneRes, eaucRes, comboRes, sznbRes, flowRes, youtubeRes, spotifyRes, tiktokRes] = await Promise.all([
    supabase.from('revenue_summary').select('*').order('month', { ascending: true }),
    supabase.from('mpt').select('*').order('month', { ascending: true }),
    supabase.from('atom').select('*').order('month', { ascending: true }),
    supabase.from('ringtune').select('*').order('month', { ascending: true }),
    supabase.from('eauc').select('*').order('month', { ascending: true }),
    supabase.from('combo').select('*').order('month', { ascending: true }),
    supabase.from('sznb').select('*').order('month', { ascending: true }),
    supabase.from('flow_subscription').select('*').order('month', { ascending: true }),
    supabase.from('youtube').select('*').order('month', { ascending: true }),
    supabase.from('spotify').select('*').order('month', { ascending: true }),
    supabase.from('tiktok').select('*').order('month', { ascending: true }),
  ]);

  const summary = summaryRes.data ?? [];
  const existingMonths = summary.map((m) => m.month as string);
  const latestMonth = existingMonths.at(-1) ?? '2024-12-01';
  const latestDate = new Date(latestMonth);
  latestDate.setMonth(latestDate.getMonth() + 1);
  const defaultMonth = monthKey(latestDate);

  const mptByMonth = Object.fromEntries((mptRes.data ?? []).map((r) => [r.month as string, r]));
  const atomByMonth = Object.fromEntries((atomRes.data ?? []).map((r) => [r.month as string, r]));
  const ringtuneByMonth = Object.fromEntries((ringtuneRes.data ?? []).map((r) => [r.month as string, r]));
  const sznbByMonth = Object.fromEntries((sznbRes.data ?? []).map((r) => [r.month as string, r]));
  const flowByMonth = Object.fromEntries((flowRes.data ?? []).map((r) => [r.month as string, r]));
  const youtubeByMonth = Object.fromEntries((youtubeRes.data ?? []).map((r) => [r.month as string, r]));
  const spotifyByMonth = Object.fromEntries((spotifyRes.data ?? []).map((r) => [r.month as string, r]));
  const tiktokByMonth = Object.fromEntries((tiktokRes.data ?? []).map((r) => [r.month as string, r]));

  const allMonths = new Set<string>();
  [summary, mptRes.data, atomRes.data, ringtuneRes.data, sznbRes.data, flowRes.data, youtubeRes.data, spotifyRes.data, tiktokRes.data].forEach((rows) => {
    (rows ?? []).forEach((r) => allMonths.add(r.month as string));
  });

  const recordsByMonth = Object.fromEntries(
    Array.from(allMonths).map((month) => {
      const mpt = mptByMonth[month] ?? {};
      const atom = atomByMonth[month] ?? {};
      const ringtune = ringtuneByMonth[month] ?? {};
      const sznb = sznbByMonth[month] ?? {};
      const flow = flowByMonth[month] ?? {};
      const youtube = youtubeByMonth[month] ?? {};
      const spotify = spotifyByMonth[month] ?? {};
      const tiktok = tiktokByMonth[month] ?? {};
      const summaryRow = summary.find((r) => r.month === month);
      return [
        month,
        {
          mpt: {
            legacy_ringtune: Number(mpt.legacy_ringtune ?? 0),
            legacy_eauc: Number(mpt.legacy_eauc ?? 0),
            legacy_combo: Number(mpt.legacy_combo ?? 0),
            etrade_ringtune: Number(mpt.etrade_ringtune ?? 0),
            etrade_eauc: Number(mpt.etrade_eauc ?? 0),
            etrade_combo: Number(mpt.etrade_combo ?? 0),
            fortune_ringtune: Number(mpt.fortune_ringtune ?? 0),
            fortune_eauc: Number(mpt.fortune_eauc ?? 0),
            fortune_combo: Number(mpt.fortune_combo ?? 0),
            unico_ringtune: Number(mpt.unico_ringtune ?? 0),
            unico_eauc: Number(mpt.unico_eauc ?? 0),
            unico_combo: Number(mpt.unico_combo ?? 0),
          },
          atom: {
            ringtune: Number(atom.ringtune ?? 0),
            eauc: Number(atom.eauc ?? 0),
            combo: Number(atom.combo ?? 0),
          },
          ringtune_ooredoo: Number(ringtune.ooredoo ?? 0),
          sznb: {
            mpt: Number(sznb.mpt ?? 0),
            atom: Number(sznb.atom ?? 0),
            kpay_mini_app: Number(sznb.kpay_mini_app ?? 0),
            kpay_qr: Number(sznb.kpay_qr ?? 0),
            kpay_ecommerce: Number(sznb.kpay_ecommerce ?? 0),
            wave_money: Number(sznb.wave_money ?? 0),
            dinger: Number(sznb.dinger ?? 0),
          },
          flow_mpt: Number(flow.mpt ?? 0),
          flow_kpay: Number(flow.kpay ?? 0),
          youtube: {
            solution_one: Number(youtube.solution_one ?? 0),
            fuga: Number(youtube.fuga ?? 0),
            believe: Number(youtube.believe ?? 0),
          },
          spotify: {
            fuga: Number(spotify.fuga ?? 0),
            believe: Number(spotify.believe ?? 0),
          },
          tiktok: {
            fuga: Number(tiktok.fuga ?? 0),
            believe: Number(tiktok.believe ?? 0),
          },
          revenueTotal: Number(summaryRow?.total ?? 0),
          lastUpdatedAt: (summaryRow?.updated_at as string | undefined) ?? null,
        },
      ];
    })
  );

  const currentMonth = monthKey(new Date());
  const expectedMonths = monthRange('2025-01-01', currentMonth);
  const requiredMaps = [mptByMonth, atomByMonth, ringtuneByMonth, Object.fromEntries((eaucRes.data ?? []).map((r) => [r.month as string, r])), Object.fromEntries((comboRes.data ?? []).map((r) => [r.month as string, r])), sznbByMonth, flowByMonth, youtubeByMonth, spotifyByMonth, tiktokByMonth, Object.fromEntries(summary.map((r) => [r.month as string, r]))];
  const hasAny = (month: string) => requiredMaps.some((m) => Boolean(m[month]));
  const isComplete = (month: string) => requiredMaps.every((m) => Boolean(m[month]));

  const coverage = [
    ...expectedMonths.map((month) => {
      const state: MonthStatus = isComplete(month) ? 'complete' : hasAny(month) ? 'partial' : 'missing';
      return { month, state };
    }),
    ...[1, 2, 3].map((offset) => {
      const d = new Date(currentMonth);
      d.setMonth(d.getMonth() + offset);
      return { month: monthKey(d), state: 'future' as const };
    }),
  ];

  const completeCount = expectedMonths.filter((m) => isComplete(m)).length;
  const gapCount = expectedMonths.filter((m) => !hasAny(m)).length;
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

  const historyRows = [...expectedMonths].reverse().map((month) => ({
    month,
    total: Number(summary.find((s) => s.month === month)?.total ?? 0),
    entryDate: (summary.find((s) => s.month === month)?.updated_at as string | undefined) ?? null,
    status: isComplete(month) ? 'Complete' : hasAny(month) ? 'Partial' : 'Missing',
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-title font-bold text-primary tracking-tight">Data Entry</h1>
        <p className="text-body text-secondary mt-0.5">Add monthly revenue data step by step</p>
      </div>
      <EntryWizard
        existingMonths={existingMonths}
        recordsByMonth={recordsByMonth}
        defaultMonth={defaultMonth}
        selectedMonth={selectedMonth}
        coverage={coverage}
        coverageSummary={coverageSummary}
        viewOnly={viewOnly}
        submittingAs={`${perms.profile.full_name} (${perms.role})`}
        duplicateMonthBehavior={duplicateMonthBehavior}
      />

      <section className="rounded-xl border border-border bg-card p-3 sm:p-5">
        <h2 className="text-body font-semibold text-primary">Monthly Entry History</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[860px] w-full text-left text-body">
            <thead>
              <tr className="border-b border-border">
                <th className="p-3 text-secondary font-medium">Month</th>
                <th className="p-3 text-secondary font-medium">Total Revenue</th>
                <th className="p-3 text-secondary font-medium">Entry Date</th>
                <th className="p-3 text-secondary font-medium">Entered By</th>
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
                  <td className="p-3 text-secondary">Audit trail</td>
                  <td className={`p-3 ${row.status === 'Complete' ? 'text-teal' : row.status === 'Partial' ? 'text-amber-500' : 'text-red-400'}`}>{row.status}</td>
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
