'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { FieldDef, StreamConfig, StreamDef } from '@/lib/streams/types';
import { getStreamColor } from '@/lib/streams/shared';
import {
  createDerivedStream,
  createField,
  createStream,
  deleteField,
  deleteStream,
  setFieldLinks,
  updateField,
  updateStream,
} from '@/app/(dashboard)/admin/streams/actions';

export function StreamManagerClient({ config }: { config: StreamConfig }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(
    config.streams.find((s) => s.kind !== 'summary')?.id ?? null
  );
  const [creating, setCreating] = useState<'entry' | 'derived' | null>(null);

  const entryStreams = config.streams.filter((s) => s.kind === 'entry');
  const derivedStreams = config.streams.filter((s) => s.kind === 'derived');
  const selected = config.streams.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px,1fr]">
      <div className="space-y-4">
        <StreamListSection
          title="Entry streams"
          hint="Hold the numbers your team enters"
          streams={entryStreams}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <StreamListSection
          title="Derived streams"
          hint="Computed automatically from field links"
          streams={derivedStreams}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setCreating('entry')}
            className="rounded-lg bg-teal px-3 py-2 text-body font-medium text-background hover:opacity-90"
          >
            + New entry stream
          </button>
          <button
            type="button"
            onClick={() => setCreating('derived')}
            className="rounded-lg border border-border px-3 py-2 text-body text-secondary hover:bg-elevated"
          >
            + New derived stream
          </button>
        </div>
      </div>

      <div>
        {creating === 'entry' && (
          <NewEntryStreamForm onDone={() => { setCreating(null); router.refresh(); }} onCancel={() => setCreating(null)} />
        )}
        {creating === 'derived' && (
          <NewDerivedStreamForm onDone={() => { setCreating(null); router.refresh(); }} onCancel={() => setCreating(null)} />
        )}
        {!creating && selected && (
          <StreamEditor
            key={selected.id}
            stream={selected}
            config={config}
            onChanged={() => router.refresh()}
          />
        )}
        {!creating && !selected && (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-secondary">
            Select a stream to configure it.
          </div>
        )}
      </div>
    </div>
  );
}

function StreamListSection({
  title,
  hint,
  streams,
  selectedId,
  onSelect,
}: {
  title: string;
  hint: string;
  streams: StreamDef[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-3">
      <p className="text-caption font-semibold text-primary">{title}</p>
      <p className="text-micro text-muted">{hint}</p>
      <ul className="mt-2 space-y-1">
        {streams.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-body transition-colors',
                selectedId === s.id ? 'bg-teal/10 text-teal' : 'text-secondary hover:bg-elevated'
              )}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: getStreamColor(s, i) }}
                aria-hidden
              />
              <span className="truncate">{s.name}</span>
              {!s.isActive && (
                <span className="ml-auto rounded bg-amber-500/15 px-1.5 py-0.5 text-micro text-amber-400">archived</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StreamEditor({
  stream,
  config,
  onChanged,
}: {
  stream: StreamDef;
  config: StreamConfig;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(stream.name);
  const [color, setColor] = useState(stream.color ?? '#00d4c8');
  const [inSummary, setInSummary] = useState(Boolean(stream.attributes.in_summary));
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const fields = config.fields.filter((f) => f.streamId === stream.id);
  const seeded = fields.some((f) => f.attributes.legacy);

  const run = (fn: () => Promise<unknown>, ok: string) =>
    startTransition(async () => {
      try {
        await fn();
        toast.success(ok);
        onChanged();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Operation failed');
      }
    });

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-caption text-secondary">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block rounded-lg border border-border bg-elevated px-3 py-2 text-body text-primary" />
          </label>
          <label className="block text-caption text-secondary">
            Color
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="mt-1 block h-10 w-16 cursor-pointer rounded-lg border border-border bg-elevated" />
          </label>
          <label className="flex items-center gap-2 pb-2 text-caption text-secondary">
            <input type="checkbox" checked={inSummary} onChange={(e) => setInSummary(e.target.checked)} className="h-4 w-4" />
            Counts in revenue total
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => updateStream({ id: stream.id, name, color, inSummary }), 'Stream updated')}
            className="rounded-lg bg-teal px-4 py-2 text-body font-medium text-background disabled:opacity-50"
          >
            Save
          </button>
          <div className="ml-auto flex gap-2 pb-1">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(
                  () => updateStream({ id: stream.id, isActive: !stream.isActive }),
                  stream.isActive ? 'Stream archived (history preserved)' : 'Stream restored'
                )
              }
              className="rounded-lg border border-border px-3 py-2 text-caption text-secondary hover:bg-elevated"
            >
              {stream.isActive ? 'Archive' : 'Restore'}
            </button>
            {!seeded && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (window.confirm(`Delete "${stream.name}"? Only possible while it has no recorded data.`)) {
                    run(() => deleteStream(stream.id), 'Stream deleted');
                  }
                }}
                className="rounded-lg border border-red-500/40 px-3 py-2 text-caption text-red-400 hover:bg-red-500/10"
              >
                Delete
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 text-micro text-muted">
          Slug: <code>{stream.slug}</code>
          {stream.groupDimensionLabels ? ` • Categories: ${stream.groupDimensionLabels.join(' × ')}` : ''}
          {stream.kind === 'derived' ? ' • Derived: values are computed from linked fields below.' : ''}
        </p>
      </section>

      {stream.kind === 'entry' && (
        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-body font-semibold text-primary">Fields</h3>
          <p className="text-caption text-secondary">
            Each field is one number entered per month. Links define which derived streams a field also counts toward.
          </p>
          <div className="mt-3 space-y-2">
            {fields.map((field) => (
              <FieldRow key={field.id} field={field} config={config} pending={pending} run={run} />
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={newFieldLabel}
              onChange={(e) => setNewFieldLabel(e.target.value)}
              placeholder="New field label (e.g. FUGA)"
              className="flex-1 rounded-lg border border-border bg-elevated px-3 py-2 text-body text-primary"
            />
            <button
              type="button"
              disabled={pending || !newFieldLabel.trim()}
              onClick={() => {
                run(() => createField({ streamId: stream.id, label: newFieldLabel }), 'Field added');
                setNewFieldLabel('');
              }}
              className="rounded-lg border border-teal/50 px-3 py-2 text-body text-teal hover:bg-teal/10 disabled:opacity-50"
            >
              Add field
            </button>
          </div>
        </section>
      )}

      {stream.kind === 'derived' && (
        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-body font-semibold text-primary">Contributing fields</h3>
          <p className="text-caption text-secondary">
            These entry fields feed this stream, grouped into buckets. Edit links from the source stream&apos;s field rows.
          </p>
          <ul className="mt-3 space-y-1 text-body text-secondary">
            {config.links
              .filter((l) => l.targetStreamId === stream.id)
              .map((l) => {
                const field = config.fields.find((f) => f.id === l.sourceFieldId);
                const source = field && config.streams.find((s) => s.id === field.streamId);
                return (
                  <li key={l.id} className="flex flex-wrap gap-2">
                    <span className="text-primary">{source?.name}</span>
                    <span>/ {field?.label}</span>
                    <span className="ml-auto rounded bg-elevated px-2 py-0.5 text-micro">bucket: {l.targetBucketLabel}</span>
                  </li>
                );
              })}
          </ul>
        </section>
      )}
    </div>
  );
}

function FieldRow({
  field,
  config,
  pending,
  run,
}: {
  field: FieldDef;
  config: StreamConfig;
  pending: boolean;
  run: (fn: () => Promise<unknown>, ok: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const derivedStreams = config.streams.filter((s) => s.kind === 'derived');
  const myLinks = config.links.filter((l) => l.sourceFieldId === field.id);
  const [draft, setDraft] = useState(() =>
    derivedStreams.map((d) => {
      const link = myLinks.find((l) => l.targetStreamId === d.id);
      return {
        targetStreamId: d.id,
        name: d.name,
        enabled: Boolean(link),
        bucketSlug: link?.targetBucketSlug ?? '',
        bucketLabel: link?.targetBucketLabel ?? '',
      };
    })
  );
  const seeded = Boolean(field.attributes.legacy);

  return (
    <div className="rounded-lg border border-border bg-elevated">
      <div className="flex flex-wrap items-center gap-2 p-2.5">
        <span className={cn('text-body', field.isActive ? 'text-primary' : 'text-muted line-through')}>
          {field.label}
        </span>
        {field.groupValues && (
          <span className="rounded bg-card px-1.5 py-0.5 text-micro text-secondary">{field.groupValues.join(' × ')}</span>
        )}
        {myLinks.length > 0 && (
          <span className="text-micro text-teal">
            → {myLinks.map((l) => config.streams.find((s) => s.id === l.targetStreamId)?.name).join(', ')}
          </span>
        )}
        <div className="ml-auto flex gap-1.5">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded border border-border px-2 py-1 text-micro text-secondary hover:bg-card"
          >
            {expanded ? 'Close links' : 'Links'}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(
                () => updateField({ id: field.id, isActive: !field.isActive }),
                field.isActive ? 'Field archived (history preserved)' : 'Field restored'
              )
            }
            className="rounded border border-border px-2 py-1 text-micro text-secondary hover:bg-card"
          >
            {field.isActive ? 'Archive' : 'Restore'}
          </button>
          {!seeded && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (window.confirm(`Delete field "${field.label}"? Only possible while it has no recorded data.`)) {
                  run(() => deleteField(field.id), 'Field deleted');
                }
              }}
              className="rounded border border-red-500/40 px-2 py-1 text-micro text-red-400 hover:bg-red-500/10"
            >
              Delete
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border p-3">
          <p className="text-caption text-secondary">This field also counts toward:</p>
          <div className="mt-2 space-y-2">
            {draft.map((d, i) => (
              <div key={d.targetStreamId} className="flex flex-wrap items-center gap-2">
                <label className="flex w-40 items-center gap-2 text-body text-primary">
                  <input
                    type="checkbox"
                    checked={d.enabled}
                    onChange={(e) =>
                      setDraft((prev) => prev.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)))
                    }
                    className="h-4 w-4"
                  />
                  {d.name}
                </label>
                {d.enabled && (
                  <input
                    value={d.bucketLabel}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, bucketLabel: e.target.value, bucketSlug: e.target.value } : x
                        )
                      )
                    }
                    placeholder="Bucket (e.g. MPT)"
                    className="rounded border border-border bg-card px-2 py-1 text-caption text-primary"
                  />
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  setFieldLinks({
                    fieldId: field.id,
                    links: draft
                      .filter((d) => d.enabled && d.bucketLabel.trim())
                      .map((d) => ({
                        targetStreamId: d.targetStreamId,
                        bucketSlug: d.bucketLabel,
                        bucketLabel: d.bucketLabel,
                      })),
                  }),
                'Links updated'
              )
            }
            className="mt-3 rounded-lg border border-teal/50 px-3 py-1.5 text-caption text-teal hover:bg-teal/10 disabled:opacity-50"
          >
            Save links
          </button>
        </div>
      )}
    </div>
  );
}

function NewEntryStreamForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#0ea5e9');
  const [inSummary, setInSummary] = useState(true);
  const [mode, setMode] = useState<'flat' | 'grid'>('flat');
  const [fieldsText, setFieldsText] = useState('');
  const [dimA, setDimA] = useState('');
  const [dimB, setDimB] = useState('');
  const [rowsText, setRowsText] = useState('');
  const [colsText, setColsText] = useState('');

  const parseList = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

  const submit = () =>
    startTransition(async () => {
      try {
        await createStream({
          name,
          color,
          inSummary,
          groupDimensions:
            mode === 'grid'
              ? { labels: [dimA.trim(), dimB.trim()], rows: parseList(rowsText), cols: parseList(colsText) }
              : null,
          fields: mode === 'flat' ? parseList(fieldsText) : undefined,
        });
        toast.success(`Stream "${name}" created. It now appears in Data Entry, Streams, the import template and analytics.`);
        onDone();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to create stream');
      }
    });

  return (
    <section className="rounded-xl border border-teal/40 bg-card p-4">
      <h3 className="text-body font-semibold text-primary">New entry stream</h3>
      <p className="text-caption text-secondary">e.g. Apple Music with FUGA and Believe fields.</p>
      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-caption text-secondary">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Apple Music" className="mt-1 block rounded-lg border border-border bg-elevated px-3 py-2 text-body text-primary" />
          </label>
          <label className="block text-caption text-secondary">
            Color
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="mt-1 block h-10 w-16 cursor-pointer rounded-lg border border-border bg-elevated" />
          </label>
          <label className="flex items-center gap-2 pb-2 text-caption text-secondary">
            <input type="checkbox" checked={inSummary} onChange={(e) => setInSummary(e.target.checked)} className="h-4 w-4" />
            Counts in revenue total
          </label>
        </div>
        <div className="flex gap-2">
          {(['flat', 'grid'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-caption',
                mode === m ? 'bg-teal/15 text-teal' : 'bg-elevated text-secondary'
              )}
            >
              {m === 'flat' ? 'Simple fields' : 'Category grid (like MPT)'}
            </button>
          ))}
        </div>
        {mode === 'flat' ? (
          <label className="block text-caption text-secondary">
            Fields (comma or newline separated)
            <textarea value={fieldsText} onChange={(e) => setFieldsText(e.target.value)} rows={2} placeholder="FUGA, Believe" className="mt-1 w-full rounded-lg border border-border bg-elevated px-3 py-2 text-body text-primary" />
          </label>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-caption text-secondary">
              Row dimension label
              <input value={dimA} onChange={(e) => setDimA(e.target.value)} placeholder="Distributor" className="mt-1 w-full rounded-lg border border-border bg-elevated px-3 py-2 text-body text-primary" />
            </label>
            <label className="block text-caption text-secondary">
              Column dimension label
              <input value={dimB} onChange={(e) => setDimB(e.target.value)} placeholder="Product" className="mt-1 w-full rounded-lg border border-border bg-elevated px-3 py-2 text-body text-primary" />
            </label>
            <label className="block text-caption text-secondary">
              Rows (comma separated)
              <textarea value={rowsText} onChange={(e) => setRowsText(e.target.value)} rows={2} placeholder="Legacy, eTrade, Fortune, Unico" className="mt-1 w-full rounded-lg border border-border bg-elevated px-3 py-2 text-body text-primary" />
            </label>
            <label className="block text-caption text-secondary">
              Columns (comma separated)
              <textarea value={colsText} onChange={(e) => setColsText(e.target.value)} rows={2} placeholder="Ringtune, EAUC, Combo" className="mt-1 w-full rounded-lg border border-border bg-elevated px-3 py-2 text-body text-primary" />
            </label>
          </div>
        )}
        <div className="flex gap-2">
          <button type="button" disabled={pending || !name.trim()} onClick={submit} className="rounded-lg bg-teal px-4 py-2 text-body font-medium text-background disabled:opacity-50">
            {pending ? 'Creating…' : 'Create stream'}
          </button>
          <button type="button" onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-body text-secondary hover:bg-elevated">
            Cancel
          </button>
        </div>
      </div>
    </section>
  );
}

function NewDerivedStreamForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [inSummary, setInSummary] = useState(false);

  const submit = () =>
    startTransition(async () => {
      try {
        await createDerivedStream({ name, color, inSummary });
        toast.success(`Derived stream "${name}" created. Link entry fields into it to give it numbers.`);
        onDone();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to create stream');
      }
    });

  return (
    <section className="rounded-xl border border-teal/40 bg-card p-4">
      <h3 className="text-body font-semibold text-primary">New derived stream</h3>
      <p className="text-caption text-secondary">
        A computed roll-up (like Ringtune or International). It has no direct entry — instead, entry
        fields are linked into it and its totals are always derived from those.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block text-caption text-secondary">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block rounded-lg border border-border bg-elevated px-3 py-2 text-body text-primary" />
        </label>
        <label className="block text-caption text-secondary">
          Color
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="mt-1 block h-10 w-16 cursor-pointer rounded-lg border border-border bg-elevated" />
        </label>
        <label className="flex items-center gap-2 pb-2 text-caption text-secondary">
          <input type="checkbox" checked={inSummary} onChange={(e) => setInSummary(e.target.checked)} className="h-4 w-4" />
          Counts in revenue total
        </label>
        <button type="button" disabled={pending || !name.trim()} onClick={submit} className="rounded-lg bg-teal px-4 py-2 text-body font-medium text-background disabled:opacity-50">
          {pending ? 'Creating…' : 'Create'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-body text-secondary hover:bg-elevated">
          Cancel
        </button>
      </div>
    </section>
  );
}
