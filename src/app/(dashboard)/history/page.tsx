import { getSummaryMatrix } from '@/lib/streams/server';
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
  const matrix = await getSummaryMatrix();
  const expected = monthRange('2025-01-01', monthKey(new Date()));
  const existingSet = new Set(matrix.rows.map((m) => m.month));
  const missingMonths = expected.filter((m) => !existingSet.has(m));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-title font-bold text-primary tracking-tight">History</h1>
        <p className="text-body text-secondary mt-0.5">Every recorded month with month-over-month movement</p>
      </div>
      <RevenueHistoryTable rows={matrix.rows} streams={matrix.streams} missingMonths={missingMonths} />
    </div>
  );
}
