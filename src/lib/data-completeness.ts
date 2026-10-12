/**
 * Which months can we trust?
 *
 * Distributors report late, so the newest months are nearly always part-filled.
 * Headline figures taken from them are wrong in a dangerous direction: a month
 * missing its telecom streams looked like a 62% collapse in revenue.
 *
 * Deliberately NOT a 'use client' module — the Overview page is a Server
 * Component and calls these while rendering.
 *
 * The rule: compare each month with the TWELVE MONTHS BEFORE IT, not with a
 * fixed expectation. Using each month's own recent history matters because the
 * number of streams grows over time (Apple Music and Tidal did not exist in
 * early 2025); judging 2025 against today's stream count would wrongly condemn
 * settled history.
 *
 * Known limitation: a stream that genuinely earned nothing in a month is
 * indistinguishable from one that was never entered, because the summary view
 * reports amounts rather than which cells were filled in.
 *
 * A month passes at 85% of its own recent norm. That is deliberately strict:
 * showing a figure built from a part-filled month is worse than showing one
 * month-old data, so we err towards excluding. One stream genuinely at zero
 * (11 of 12) still passes; a month missing a quarter of its streams does not.
 */

export type MonthRow = Record<string, unknown> & { month: string };
export type StreamRef = { slug: string };

export type MonthStatus = {
  month: string;
  /** How many streams reported a figure this month. */
  reporting: number;
  /** The usual number for the twelve months before it (0 when unknown). */
  usual: number;
  complete: boolean;
};

const WINDOW = 12;
const MIN_HISTORY = 3;
const THRESHOLD = 0.85;

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function countReporting(row: MonthRow | null | undefined, streams: StreamRef[]): number {
  if (!row) return 0;
  return streams.filter((s) => Number(row[s.slug] ?? 0) > 0).length;
}

/** Per-month verdict, oldest first — same order as the rows passed in. */
export function assessMonths(rows: MonthRow[], streams: StreamRef[]): MonthStatus[] {
  const counts = rows.map((r) => countReporting(r, streams));
  return rows.map((row, i) => {
    const history = counts.slice(Math.max(0, i - WINDOW), i).filter((n) => n > 0);
    const usual = median(history);
    // Too little history to judge — treat as usable rather than hiding data.
    const complete = history.length < MIN_HISTORY || usual === 0 ? true : counts[i] >= usual * THRESHOLD;
    return { month: row.month, reporting: counts[i], usual, complete };
  });
}

/** The newest month we can trust, or null when there is none. */
export function latestCompleteMonth(rows: MonthRow[], streams: StreamRef[]): MonthRow | null {
  const status = assessMonths(rows, streams);
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (status[i].complete) return rows[i];
  }
  return null;
}

/** Only the months we can trust, in the original order. */
export function completeRows(rows: MonthRow[], streams: StreamRef[]): MonthRow[] {
  const status = assessMonths(rows, streams);
  return rows.filter((_, i) => status[i].complete);
}

/** The newest months that are still filling in, oldest first. */
export function incompleteTail(rows: MonthRow[], streams: StreamRef[]): MonthStatus[] {
  const status = assessMonths(rows, streams);
  const tail: MonthStatus[] = [];
  for (let i = status.length - 1; i >= 0; i -= 1) {
    if (status[i].complete) break;
    tail.unshift(status[i]);
  }
  return tail;
}
