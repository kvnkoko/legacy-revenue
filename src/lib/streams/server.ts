import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { StreamConfig, StreamMatrix } from './types';
import { fetchStreamConfig, fetchStreamMatrix } from './shared';

/** Full stream config, cached per request. */
export const getStreamConfig = cache(async (): Promise<StreamConfig> => {
  const supabase = await createClient();
  return fetchStreamConfig(supabase);
});

/** Config including archived streams/fields (admin surfaces). */
export const getStreamConfigWithInactive = cache(async (): Promise<StreamConfig> => {
  const supabase = await createClient();
  return fetchStreamConfig(supabase, { includeInactive: true });
});

/** Legacy-table-shaped matrix for one stream (entry fields or derived buckets). */
export async function getStreamMatrix(
  slug: string,
  opts: { fromMonth?: string } = {}
): Promise<StreamMatrix | null> {
  const supabase = await createClient();
  const config = await getStreamConfig();
  return fetchStreamMatrix(supabase, config, slug, opts);
}

export type SummaryStream = { slug: string; name: string; color: string };
export type SummaryMatrixRow = { month: string; total: number } & Record<string, number | string>;
export type SummaryMatrix = { streams: SummaryStream[]; rows: SummaryMatrixRow[] };

/**
 * Month × stream matrix of every stream that counts toward the revenue total
 * (attributes.in_summary), fully config-driven — streams added in the UI
 * appear automatically. Row shape: { month, [streamSlug]: total, total }.
 */
export async function getSummaryMatrix(
  opts: { fromMonth?: string } = {}
): Promise<SummaryMatrix> {
  const supabase = await createClient();
  const config = await getStreamConfig();
  const summaryStreams = config.streams
    .filter((s) => s.attributes.in_summary)
    .sort((a, b) => a.sort - b.sort);
  const streams: SummaryStream[] = summaryStreams.map((s, i) => ({
    slug: s.slug,
    name: s.name,
    color: s.color ?? ['#d4af37', '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#22c55e', '#ec4899'][i % 8],
  }));
  const idToSlug = new Map(summaryStreams.map((s) => [s.id, s.slug]));

  let query = supabase.from('v_stream_month_totals').select('month, stream_id, total');
  if (opts.fromMonth) query = query.gte('month', opts.fromMonth);
  const { data, error } = await query;
  if (error) throw error;

  const rowsByMonth = new Map<string, SummaryMatrixRow>();
  for (const r of data ?? []) {
    const slug = idToSlug.get(String(r.stream_id));
    if (!slug) continue;
    const month = String(r.month);
    let row = rowsByMonth.get(month);
    if (!row) {
      row = { month, total: 0 };
      for (const s of streams) row[s.slug] = 0;
      rowsByMonth.set(month, row);
    }
    const amount = Number(r.total ?? 0);
    row[slug] = amount;
    row.total += amount;
  }
  const rows = Array.from(rowsByMonth.values()).sort((a, b) => a.month.localeCompare(b.month));
  return { streams, rows };
}

/** Per-stream monthly totals keyed by stream slug: { [slug]: { [month]: total } }. */
export async function getStreamTotals(
  opts: { fromMonth?: string } = {}
): Promise<Record<string, Record<string, number>>> {
  const supabase = await createClient();
  const config = await getStreamConfig();
  const slugById = new Map(config.streams.map((s) => [s.id, s.slug]));
  let query = supabase.from('v_stream_month_totals').select('month, stream_id, total');
  if (opts.fromMonth) query = query.gte('month', opts.fromMonth);
  const { data, error } = await query;
  if (error) throw error;
  const out: Record<string, Record<string, number>> = {};
  for (const r of data ?? []) {
    const slug = slugById.get(String(r.stream_id));
    if (!slug) continue;
    (out[slug] ??= {})[String(r.month)] = Number(r.total ?? 0);
  }
  return out;
}
