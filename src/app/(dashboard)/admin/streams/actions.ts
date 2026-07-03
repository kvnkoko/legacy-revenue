'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/authz/server';
import { assertAdminRateLimit } from '@/lib/authz/rate-limit';

// All writes go through the user's client: RLS (admin OR can_configure_streams)
// is the authority, and the 013 DB triggers audit every change with labels.

function slugify(value: string): string {
  const slug = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!slug) throw new Error('Name must contain letters or numbers.');
  return slug;
}

async function getConfigContext() {
  const perms = await requirePermission('can_configure_streams');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  await assertAdminRateLimit(user.id, 'stream configuration', 60);
  return { perms, supabase, user };
}

function revalidateConfigPaths() {
  revalidatePath('/admin/streams');
  revalidatePath('/streams');
  revalidatePath('/entry');
  revalidatePath('/dashboard');
  revalidatePath('/analytics');
  revalidatePath('/import');
}

export async function createStream(input: {
  name: string;
  color?: string | null;
  inSummary?: boolean;
  /** Optional two-dimension category grid, e.g. Distributor × Product. */
  groupDimensions?: { labels: [string, string]; rows: string[]; cols: string[] } | null;
  /** Flat field labels (ignored when groupDimensions is set). */
  fields?: string[];
}) {
  const { supabase, user } = await getConfigContext();
  const name = input.name.trim();
  if (!name) throw new Error('Stream name is required.');
  const slug = slugify(name);

  const { data: maxSort } = await supabase
    .from('revenue_streams')
    .select('sort')
    .eq('kind', 'entry')
    .order('sort', { ascending: false })
    .limit(1)
    .maybeSingle();

  const attributes: Record<string, unknown> = {};
  if (input.inSummary) {
    attributes.in_summary = true;
    attributes.summary_column = slug;
  }

  const { data: stream, error } = await supabase
    .from('revenue_streams')
    .insert({
      slug,
      name,
      color: input.color ?? null,
      sort: Number(maxSort?.sort ?? 100) + 10,
      kind: 'entry',
      group_dimension_labels: input.groupDimensions ? input.groupDimensions.labels : null,
      attributes,
      created_by: user.id,
    })
    .select('id, slug')
    .single();
  if (error) {
    if (error.code === '23505') throw new Error(`A stream named "${name}" (slug ${slug}) already exists.`);
    throw new Error(error.message);
  }

  // Every field gets import metadata at birth so the Excel importer (and the
  // downloadable template) recognize it immediately — no separate "wire up
  // import" step. The sheet name is the stream's own name; a brand-new stream
  // gets its own tab, exactly like the legacy MPT/SZNB/YouTube sheets did.
  const fieldRows: Array<Record<string, unknown>> = [];
  if (input.groupDimensions) {
    const { rows, cols } = input.groupDimensions;
    let sort = 10;
    for (const r of rows) {
      for (const c of cols) {
        const fieldSlug = `${slugify(r)}_${slugify(c)}`;
        fieldRows.push({
          stream_id: stream.id,
          slug: fieldSlug,
          label: `${r.trim()} ${c.trim()}`,
          group_values: [r.trim(), c.trim()],
          sort,
          attributes: { import: { sheet: name, column_keys: [fieldSlug] } },
        });
        sort += 10;
      }
    }
  } else {
    (input.fields ?? []).forEach((label, i) => {
      const trimmed = label.trim();
      if (!trimmed) return;
      const fieldSlug = slugify(trimmed);
      fieldRows.push({
        stream_id: stream.id,
        slug: fieldSlug,
        label: trimmed,
        sort: (i + 1) * 10,
        attributes: { import: { sheet: name, column_keys: [fieldSlug] } },
      });
    });
  }
  if (fieldRows.length) {
    const { error: fieldError } = await supabase.from('stream_fields').insert(fieldRows);
    if (fieldError) throw new Error(fieldError.message);
  }

  revalidateConfigPaths();
  return { id: stream.id, slug: stream.slug };
}

export async function updateStream(input: {
  id: string;
  name?: string;
  color?: string | null;
  sort?: number;
  inSummary?: boolean;
  isActive?: boolean;
}) {
  const { supabase } = await getConfigContext();
  const { data: current, error: fetchErr } = await supabase
    .from('revenue_streams')
    .select('*')
    .eq('id', input.id)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.color !== undefined) patch.color = input.color;
  if (input.sort !== undefined) patch.sort = input.sort;
  if (input.isActive !== undefined) patch.is_active = input.isActive;
  if (input.inSummary !== undefined) {
    const attributes = { ...(current.attributes as Record<string, unknown>) };
    if (input.inSummary) {
      attributes.in_summary = true;
      attributes.summary_column = attributes.summary_column ?? current.slug;
    } else {
      delete attributes.in_summary;
    }
    patch.attributes = attributes;
  }

  const { error } = await supabase.from('revenue_streams').update(patch).eq('id', input.id);
  if (error) throw new Error(error.message);
  revalidateConfigPaths();
}

export async function deleteStream(id: string) {
  const { supabase } = await getConfigContext();
  const { data: stream } = await supabase
    .from('revenue_streams')
    .select('id, name, kind')
    .eq('id', id)
    .single();
  if (!stream) throw new Error('Stream not found.');

  const { data: fields } = await supabase.from('stream_fields').select('id').eq('stream_id', id);
  const fieldIds = (fields ?? []).map((f) => f.id);
  if (fieldIds.length) {
    const { count } = await supabase
      .from('revenue_entries')
      .select('id', { count: 'exact', head: true })
      .in('field_id', fieldIds);
    if ((count ?? 0) > 0) {
      throw new Error(
        `"${stream.name}" has ${count} recorded values. Archive it instead — revenue data is never hard-deleted with its stream.`
      );
    }
  }
  const { error } = await supabase.from('revenue_streams').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidateConfigPaths();
}

export async function createField(input: {
  streamId: string;
  label: string;
  groupValues?: [string, string] | null;
}) {
  const { supabase } = await getConfigContext();
  const label = input.label.trim();
  if (!label) throw new Error('Field label is required.');

  // A new column on an EXISTING stream must import under the same sheet as
  // its siblings (e.g. adding "Apple Music" to the "SZNB" sheet's tab), so
  // accountants can drop it straight into their next Excel upload. Fall back
  // to the stream's own name if it has no fields yet.
  const { data: sibling } = await supabase
    .from('stream_fields')
    .select('attributes')
    .eq('stream_id', input.streamId)
    .not('attributes->import->sheet', 'is', null)
    .limit(1)
    .maybeSingle();
  let sheetName = (sibling?.attributes as { import?: { sheet?: string } } | undefined)?.import?.sheet;
  if (!sheetName) {
    const { data: stream } = await supabase
      .from('revenue_streams')
      .select('name')
      .eq('id', input.streamId)
      .single();
    sheetName = stream?.name ?? label;
  }

  const { data: maxSort } = await supabase
    .from('stream_fields')
    .select('sort')
    .eq('stream_id', input.streamId)
    .order('sort', { ascending: false })
    .limit(1)
    .maybeSingle();

  const fieldSlug = input.groupValues
    ? `${slugify(input.groupValues[0])}_${slugify(input.groupValues[1])}`
    : slugify(label);

  const { error } = await supabase.from('stream_fields').insert({
    stream_id: input.streamId,
    slug: fieldSlug,
    label,
    group_values: input.groupValues ?? null,
    sort: Number(maxSort?.sort ?? 0) + 10,
    attributes: { import: { sheet: sheetName, column_keys: [fieldSlug] } },
  });
  if (error) {
    if (error.code === '23505') throw new Error(`A field with that name already exists in this stream.`);
    throw new Error(error.message);
  }
  revalidateConfigPaths();
}

export async function updateField(input: {
  id: string;
  label?: string;
  sort?: number;
  isActive?: boolean;
}) {
  const { supabase } = await getConfigContext();
  const patch: Record<string, unknown> = {};
  if (input.label !== undefined) {
    const label = input.label.trim();
    patch.label = label;

    // Recognize the new label as an import column too, without dropping the
    // old key — a spreadsheet exported before the rename should still import.
    const { data: current } = await supabase
      .from('stream_fields')
      .select('slug, attributes')
      .eq('id', input.id)
      .single();
    if (current) {
      const attrs = (current.attributes as { import?: { sheet?: string; column_keys?: string[] } }) ?? {};
      if (attrs.import) {
        const newKey = label
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
        const keys = new Set([...(attrs.import.column_keys ?? [current.slug]), newKey]);
        patch.attributes = { ...attrs, import: { ...attrs.import, column_keys: Array.from(keys) } };
      }
    }
  }
  if (input.sort !== undefined) patch.sort = input.sort;
  if (input.isActive !== undefined) patch.is_active = input.isActive;
  const { error } = await supabase.from('stream_fields').update(patch).eq('id', input.id);
  if (error) throw new Error(error.message);
  revalidateConfigPaths();
}

export async function deleteField(id: string) {
  const { supabase } = await getConfigContext();
  const { count } = await supabase
    .from('revenue_entries')
    .select('id', { count: 'exact', head: true })
    .eq('field_id', id);
  if ((count ?? 0) > 0) {
    throw new Error(
      `This field has ${count} recorded values. Archive it instead — revenue data is never hard-deleted with its field.`
    );
  }
  const { error } = await supabase.from('stream_fields').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidateConfigPaths();
}

/** Replaces the "counts toward" links of a field. */
export async function setFieldLinks(input: {
  fieldId: string;
  links: Array<{ targetStreamId: string; bucketSlug: string; bucketLabel: string }>;
}) {
  const { supabase } = await getConfigContext();

  const { error: delError } = await supabase
    .from('field_links')
    .delete()
    .eq('source_field_id', input.fieldId);
  if (delError) throw new Error(delError.message);

  if (input.links.length) {
    const { error } = await supabase.from('field_links').insert(
      input.links.map((l, i) => ({
        source_field_id: input.fieldId,
        target_stream_id: l.targetStreamId,
        target_bucket_slug: slugify(l.bucketSlug),
        target_bucket_label: l.bucketLabel.trim() || l.bucketSlug,
        sort: (i + 1) * 10,
      }))
    );
    if (error) throw new Error(error.message);
  }
  revalidateConfigPaths();
}

/** Creates a derived (computed) stream; its numbers come from field links. */
export async function createDerivedStream(input: { name: string; color?: string | null; inSummary?: boolean }) {
  const { supabase, user } = await getConfigContext();
  const name = input.name.trim();
  if (!name) throw new Error('Stream name is required.');
  const slug = slugify(name);
  const attributes: Record<string, unknown> = {};
  if (input.inSummary) {
    attributes.in_summary = true;
    attributes.summary_column = slug;
  }
  const { data: maxSort } = await supabase
    .from('revenue_streams')
    .select('sort')
    .eq('kind', 'derived')
    .order('sort', { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from('revenue_streams').insert({
    slug,
    name,
    color: input.color ?? null,
    sort: Number(maxSort?.sort ?? 300) + 10,
    kind: 'derived',
    attributes,
    created_by: user.id,
  });
  if (error) {
    if (error.code === '23505') throw new Error(`A stream named "${name}" (slug ${slug}) already exists.`);
    throw new Error(error.message);
  }
  revalidateConfigPaths();
}
