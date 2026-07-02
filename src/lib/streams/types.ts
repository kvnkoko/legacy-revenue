// Config-driven revenue stream model (mirrors supabase migrations 013/014).

export type StreamKind = 'entry' | 'derived' | 'summary';

export type StreamDef = {
  id: string;
  slug: string;
  name: string;
  color: string | null;
  sort: number;
  kind: StreamKind;
  /** Labels of the grouping dimensions, e.g. ['Distributor','Product'] for MPT. */
  groupDimensionLabels: string[] | null;
  attributes: {
    in_summary?: boolean;
    summary_column?: string;
    [key: string]: unknown;
  };
  isActive: boolean;
};

export type FieldDef = {
  id: string;
  streamId: string;
  slug: string;
  label: string;
  /** Position along the stream's group dimensions, e.g. ['Legacy','Ringtune']. */
  groupValues: string[] | null;
  sort: number;
  attributes: {
    legacy?: { table: string; column: string };
    import?: { sheet: string; column_keys: string[] };
    [key: string]: unknown;
  };
  isActive: boolean;
};

export type FieldLinkDef = {
  id: string;
  sourceFieldId: string;
  targetStreamId: string;
  targetBucketSlug: string;
  targetBucketLabel: string;
  sort: number;
};

export type StreamConfig = {
  streams: StreamDef[];
  fields: FieldDef[];
  links: FieldLinkDef[];
};

/** A column of a stream matrix: an entry field or a derived bucket. */
export type MatrixColumn = {
  slug: string;
  label: string;
  /** For entry streams, the backing field id; null for derived buckets. */
  fieldId: string | null;
  groupValues: string[] | null;
  sort: number;
};

/** Month-by-column matrix for one stream, shaped like the legacy tables:
 *  each row is { month, [columnSlug]: amount, total }. */
export type StreamMatrix = {
  stream: StreamDef;
  columns: MatrixColumn[];
  rows: Array<Record<string, number | string>>;
};
