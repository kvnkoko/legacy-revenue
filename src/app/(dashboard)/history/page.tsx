import { createClient } from '@/lib/supabase/server';
import { RevenueHistoryTable } from '@/components/history/RevenueHistoryTable';

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

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase.from('revenue_summary').select('*').order('month', { ascending: true });
  const historyRows = (rows ?? []).map((m) => ({
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
  const existingSet = new Set((rows ?? []).map((m) => m.month as string));
  const missingMonths = expected.filter((m) => !existingSet.has(m));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title font-bold text-primary tracking-tight">History</h1>
        <p className="text-body text-secondary mt-0.5">All monthly revenue records</p>
      </div>
      <RevenueHistoryTable rows={historyRows} missingMonths={missingMonths} />
    </div>
  );
}
