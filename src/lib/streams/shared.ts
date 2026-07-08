// Pure helpers shared by the server and browser stream data layers.

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  FieldDef,
  FieldLinkDef,
  MatrixColumn,
  StreamConfig,
  StreamDef,
  StreamMatrix,
} from './types';

/**
 * Reads EVERY row of a query, paging past PostgREST's 1000-row response cap.
 * Revenue data grows one batch of rows per month, so any unbounded select on
 * revenue_entries / v_stream_month_totals will silently drop the most recent
 * months once the table passes 1000 rows — which reads back as "missing" data.
 * Always route financial reads through this.
 */
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const pageSize = 1000;
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}

/** Fallback palette for streams created without an explicit color. */
export const STREAM_FALLBACK_COLORS = [
  '#d4af37', '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981',
  '#ef4444', '#22c55e', '#ec4899', '#0ea5e9', '#a78bfa',
  '#f97316', '#6366f1', '#14b8a6', '#84cc16', '#64748b',
] as const;

export function getStreamColor(stream: StreamDef, index = 0): string {
  return stream.color ?? STREAM_FALLBACK_COLORS[index % STREAM_FALLBACK_COLORS.length];
}

type StreamRow = Record<string, unknown>;

function mapStream(r: StreamRow): StreamDef {
  return {
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    color: (r.color as string | null) ?? null,
    sort: Number(r.sort ?? 0),
    kind: r.kind as StreamDef['kind'],
    groupDimensionLabels: (r.group_dimension_labels as string[] | null) ?? null,
    attributes: (r.attributes as StreamDef['attributes']) ?? {},
    isActive: Boolean(r.is_active),
  };
}

function mapField(r: StreamRow): FieldDef {
  return {
    id: String(r.id),
    streamId: String(r.stream_id),
    slug: String(r.slug),
    label: String(r.label),
    groupValues: (r.group_values as string[] | null) ?? null,
    sort: Number(r.sort ?? 0),
    attributes: (r.attributes as FieldDef['attributes']) ?? {},
    isActive: Boolean(r.is_active),
  };
}

function mapLink(r: StreamRow): FieldLinkDef {
  return {
    id: String(r.id),
    sourceFieldId: String(r.source_field_id),
    targetStreamId: String(r.target_stream_id),
    targetBucketSlug: String(r.target_bucket_slug),
    targetBucketLabel: String(r.target_bucket_label),
    sort: Number(r.sort ?? 0),
  };
}

/** Fetches the full stream config with any Supabase client (server or browser). */
export async function fetchStreamConfig(
  supabase: SupabaseClient,
  { includeInactive = false }: { includeInactive?: boolean } = {}
): Promise<StreamConfig> {
  let streamsQuery = supabase.from('revenue_streams').select('*').order('sort', { ascending: true });
  let fieldsQuery = supabase.from('stream_fields').select('*').order('sort', { ascending: true });
  if (!includeInactive) {
    streamsQuery = streamsQuery.eq('is_active', true);
    fieldsQuery = fieldsQuery.eq('is_active', true);
  }
  const [streamsRes, fieldsRes, linksRes] = await Promise.all([
    streamsQuery,
    fieldsQuery,
    supabase.from('field_links').select('*').order('sort', { ascending: true }),
  ]);
  if (streamsRes.error) throw streamsRes.error;
  if (fieldsRes.error) throw fieldsRes.error;
  if (linksRes.error) throw linksRes.error;
  return {
    streams: (streamsRes.data ?? []).map(mapStream),
    fields: (fieldsRes.data ?? []).map(mapField),
    links: (linksRes.data ?? []).map(mapLink),
  };
}

export function streamBySlug(config: StreamConfig, slug: string): StreamDef | undefined {
  return config.streams.find((s) => s.slug === slug);
}

export function fieldsForStream(config: StreamConfig, streamId: string): FieldDef[] {
  return config.fields.filter((f) => f.streamId === streamId);
}

/** Columns of a stream matrix: entry fields, or derived buckets (deduped by slug). */
export function matrixColumns(config: StreamConfig, stream: StreamDef): MatrixColumn[] {
  if (stream.kind === 'entry') {
    return fieldsForStream(config, stream.id).map((f) => ({
      slug: f.slug,
      label: f.label,
      fieldId: f.id,
      groupValues: f.groupValues,
      sort: f.sort,
    }));
  }
  const buckets = new Map<string, MatrixColumn>();
  for (const link of config.links.filter((l) => l.targetStreamId === stream.id)) {
    if (!buckets.has(link.targetBucketSlug)) {
      buckets.set(link.targetBucketSlug, {
        slug: link.targetBucketSlug,
        label: link.targetBucketLabel,
        fieldId: null,
        groupValues: null,
        sort: link.sort,
      });
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.sort - b.sort);
}

/** Builds the month-by-column matrix for one stream (legacy-table shape). */
export async function fetchStreamMatrix(
  supabase: SupabaseClient,
  config: StreamConfig,
  slug: string,
  { fromMonth }: { fromMonth?: string } = {}
): Promise<StreamMatrix | null> {
  const stream = streamBySlug(config, slug);
  if (!stream || stream.kind === 'summary') return null;
  const columns = matrixColumns(config, stream);
  const rowsByMonth = new Map<string, Record<string, number | string>>();

  const ensureRow = (month: string) => {
    let row = rowsByMonth.get(month);
    if (!row) {
      row = { month };
      for (const c of columns) row[c.slug] = 0;
      row.total = 0;
      rowsByMonth.set(month, row);
    }
    return row;
  };

  if (stream.kind === 'entry') {
    const fieldIds = columns.map((c) => c.fieldId).filter(Boolean) as string[];
    const idToSlug = new Map(columns.map((c) => [c.fieldId, c.slug]));
    if (fieldIds.length) {
      const data = await fetchAllRows<{ month: string; field_id: string; amount: number }>((from, to) => {
        let query = supabase
          .from('revenue_entries')
          .select('month, field_id, amount')
          .in('field_id', fieldIds)
          .order('month', { ascending: true })
          .range(from, to);
        if (fromMonth) query = query.gte('month', fromMonth);
        return query;
      });
      for (const r of data) {
        const row = ensureRow(String(r.month));
        const colSlug = idToSlug.get(String(r.field_id));
        if (!colSlug) continue;
        const amount = Number(r.amount ?? 0);
        row[colSlug] = amount;
        row.total = Number(row.total) + amount;
      }
    }
  } else {
    const data = await fetchAllRows<{ month: string; bucket_slug: string; amount: number }>((from, to) => {
      let query = supabase
        .from('v_derived_bucket_totals')
        .select('month, bucket_slug, amount')
        .eq('stream_id', stream.id)
        .order('month', { ascending: true })
        .range(from, to);
      if (fromMonth) query = query.gte('month', fromMonth);
      return query;
    });
    for (const r of data) {
      const row = ensureRow(String(r.month));
      const amount = Number(r.amount ?? 0);
      row[String(r.bucket_slug)] = amount;
      row.total = Number(row.total) + amount;
    }
  }

  const rows = Array.from(rowsByMonth.values()).sort((a, b) =>
    String(a.month).localeCompare(String(b.month))
  );
  return { stream, columns, rows };
}

/** Human-readable lineage lines for a stream, derived from field_links. */
export function lineageLines(config: StreamConfig, stream: StreamDef): string[] {
  const streamById = new Map(config.streams.map((s) => [s.id, s]));
  const fieldById = new Map(config.fields.map((f) => [f.id, f]));
  if (stream.kind === 'entry') {
    const targets = new Map<string, Set<string>>();
    for (const link of config.links) {
      const field = fieldById.get(link.sourceFieldId);
      if (!field || field.streamId !== stream.id) continue;
      const target = streamById.get(link.targetStreamId);
      if (!target) continue;
      if (!targets.has(target.name)) targets.set(target.name, new Set());
      targets.get(target.name)!.add(link.targetBucketLabel);
    }
    if (!targets.size) return [`[${stream.name}] -> [Revenue]`];
    return Array.from(targets.entries()).map(
      ([name, buckets]) => `[${stream.name}] -> [${name}: ${Array.from(buckets).join(', ')}]`
    );
  }
  const sources = new Map<string, Set<string>>();
  for (const link of config.links.filter((l) => l.targetStreamId === stream.id)) {
    const field = fieldById.get(link.sourceFieldId);
    if (!field) continue;
    const source = streamById.get(field.streamId);
    if (!source) continue;
    if (!sources.has(source.name)) sources.set(source.name, new Set());
    sources.get(source.name)!.add(link.targetBucketLabel);
  }
  return Array.from(sources.entries()).map(
    ([name, buckets]) => `[${name}] -> [${stream.name}: ${Array.from(buckets).join(', ')}]`
  );
}
