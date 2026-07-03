// Excel import resolution against the stream config.
//
// The team's existing workbook keeps working unchanged:
//  * Base sheets (MPT, Atom, SZNB, Flow Subscription, YouTube, Spotify, Tiktok,
//    plus Ringtune's ooredoo column and Revenue's flow_music_zone/flow_data_pack
//    columns) map to entry-stream fields via attributes.import seeded in 014.
//  * Derived sheets (Ringtune, EAUC, Combo, Local, International, Revenue) are
//    VERIFY-ONLY: values are compared against the computed views and mismatches
//    produce warnings — base data is authoritative, nothing is written.
//  * Streams created later in the UI match sheets by normalized name/slug.

import type { FieldDef, StreamConfig } from './types';

export function normalizeKey(key: string): string {
  return key.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/** Sheet historically named "Revenue" mirrors the summary pivot. */
const SUMMARY_SHEET_ALIAS = 'revenue';

/** Any derived stream (seeded or created later) whose sheet is verify-only:
 *  values are checked against the computed total, never written. */
function resolveVerifySlug(config: StreamConfig, sheetName: string): string | null {
  const normalized = normalizeKey(sheetName);
  if (normalized === SUMMARY_SHEET_ALIAS) return 'summary';
  const derived = config.streams.find(
    (s) => s.kind === 'derived' && (normalizeKey(s.slug) === normalized || normalizeKey(s.name) === normalized)
  );
  return derived?.slug ?? null;
}

export type WritableColumn = {
  field: FieldDef;
  /** Normalized column keys that map to this field. */
  keys: string[];
};

export type SheetPlan = {
  sheetName: string;
  writable: WritableColumn[];
  /** Derived stream slug (or 'summary') whose values this sheet mirrors; verified, never written. */
  verifyStreamSlug: string | null;
  /** The MPT sheet historically parses via positional __EMPTY columns. */
  mptPositional: boolean;
};

export function resolveSheetPlan(config: StreamConfig, sheetName: string): SheetPlan {
  const entryStreams = config.streams.filter((s) => s.kind === 'entry' && s.isActive);
  const entryStreamIds = new Set(entryStreams.map((s) => s.id));

  // 1. Seeded mapping: fields that declare this exact sheet name.
  let writable: WritableColumn[] = config.fields
    .filter(
      (f) =>
        f.isActive &&
        entryStreamIds.has(f.streamId) &&
        f.attributes.import?.sheet === sheetName
    )
    .map((f) => ({
      field: f,
      keys: (f.attributes.import?.column_keys ?? [f.slug]).map(normalizeKey),
    }));

  // 2. Fallback for UI-created streams: sheet name matches stream name/slug.
  if (!writable.length) {
    const normalized = normalizeKey(sheetName);
    const stream = entryStreams.find(
      (s) => normalizeKey(s.slug) === normalized || normalizeKey(s.name) === normalized
    );
    if (stream) {
      writable = config.fields
        .filter((f) => f.isActive && f.streamId === stream.id)
        .map((f) => ({
          field: f,
          keys: Array.from(new Set([normalizeKey(f.slug), normalizeKey(f.label)])),
        }));
    }
  }

  const verifyStreamSlug = resolveVerifySlug(config, sheetName);
  const mptStream = config.streams.find((s) => s.slug === 'mpt');
  const mptPositional = Boolean(
    mptStream && writable.some((w) => w.field.streamId === mptStream.id)
  );

  return { sheetName, writable, verifyStreamSlug, mptPositional };
}

/** Positional layout of the historical MPT sheet (merged header row exports
 *  as Legacy/__EMPTY/__EMPTY_1/... in SheetJS). Maps raw keys → field slug. */
export const MPT_POSITIONAL_LAYOUT: Record<string, string> = {
  Legacy: 'legacy_ringtune',
  __EMPTY: 'legacy_eauc',
  __EMPTY_1: 'legacy_combo',
  Etrade: 'etrade_ringtune',
  __EMPTY_2: 'etrade_eauc',
  __EMPTY_3: 'etrade_combo',
  Fortune: 'fortune_ringtune',
  __EMPTY_4: 'fortune_eauc',
  __EMPTY_5: 'fortune_combo',
  Unico: 'unico_ringtune',
  __EMPTY_6: 'unico_eauc',
  __EMPTY_7: 'unico_combo',
};

export function isMptPositionalRow(row: Record<string, unknown>): boolean {
  return 'Legacy' in row && '__EMPTY' in row && '__EMPTY_1' in row;
}

/** Spec for a downloadable template that always matches the current config:
 *  one sheet per entry stream, columns = month + field labels. */
export function buildTemplateSpec(config: StreamConfig): Array<{ sheet: string; headers: string[] }> {
  const entryStreams = config.streams.filter((s) => s.kind === 'entry' && s.isActive);
  return entryStreams.map((s) => {
    const fields = config.fields.filter((f) => f.isActive && f.streamId === s.id);
    const sheet = fields[0]?.attributes.import?.sheet ?? s.name;
    const headers = ['month', ...fields.map((f) => f.attributes.import?.column_keys?.[0] ?? f.slug)];
    return { sheet, headers };
  });
}
