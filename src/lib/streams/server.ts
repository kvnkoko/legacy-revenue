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
