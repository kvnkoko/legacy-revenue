'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn, formatMMK } from '@/lib/utils';
import type { FieldDef, StreamConfig, StreamDef } from '@/lib/streams/types';
import { saveStreamEntries } from '@/app/(dashboard)/entry/actions';

export type MonthCoverage = { month: string; state: 'complete' | 'partial' | 'missing' | 'future' };

type Props = {
  config: StreamConfig;
  /** Existing saved amounts: { [month]: { [fieldId]: amount } } */
  initialByMonth: Record<string, Record<string, number>>;
  defaultMonth: string;
  selectedMonth?: string;
  coverage: MonthCoverage[];
  coverageSummary: string;
  viewOnly?: boolean;
  submittingAs: string;
  duplicateMonthBehavior: 'allow' | 'confirm' | 'block';
  canEditExisting: boolean;
};

function monthLabel(month: string): string {
  return new Date(month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function shiftMonth(month: string, delta: number): string {
  const d = new Date(month);
  d.setMonth(d.getMonth() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function EntryWorkspace({
  config,
  initialByMonth,
  defaultMonth,
  selectedMonth,
  coverage,
  coverageSummary,
  viewOnly = false,
  submittingAs,
  duplicateMonthBehavior,
  canEditExisting,
}: Props) {
  const router = useRouter();
  const entryStreams = useMemo(
    () => config.streams.filter((s) => s.kind === 'entry' && s.isActive),
    [config]
  );
  const fieldsByStream = useMemo(() => {
    const map = new Map<string, FieldDef[]>();
    for (const s of entryStreams) {
      map.set(s.id, config.fields.filter((f) => f.streamId === s.id && f.isActive));
    }
    return map;
  }, [config, entryStreams]);

  const [month, setMonth] = useState(selectedMonth ?? defaultMonth);
  // savedAmounts = what the database has; amounts = what's on screen.
  const [savedAmounts, setSavedAmounts] = useState<Record<string, number>>(
    () => ({ ...(initialByMonth[selectedMonth ?? defaultMonth] ?? {}) })
  );
  const [amounts, setAmounts] = useState<Record<string, number>>(
    () => ({ ...(initialByMonth[selectedMonth ?? defaultMonth] ?? {}) })
  );
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Open the streams that still need numbers; keep saved ones tucked away.
    const initial = initialByMonth[selectedMonth ?? defaultMonth] ?? {};
    const open = new Set<string>();
    for (const s of config.streams.filter((x) => x.kind === 'entry' && x.isActive)) {
      const fields = config.fields.filter((f) => f.streamId === s.id && f.isActive);
      if (!fields.some((f) => f.id in initial)) open.add(s.id);
    }
    return open;
  });
  const [savingStream, setSavingStream] = useState<string | null>(null);

  const isDirty = (fieldId: string) => {
    const current = amounts[fieldId];
    const saved = savedAmounts[fieldId];
    if (current === undefined || Number.isNaN(current)) return false;
    if (saved === undefined) return current !== 0 || fieldId in amounts === false ? current !== undefined && current !== 0 : false;
    return Math.abs(current - saved) >= 0.005;
  };

  const streamDirty = (stream: StreamDef) =>
    (fieldsByStream.get(stream.id) ?? []).some((f) => isDirty(f.id));

  const anyDirty = entryStreams.some((s) => streamDirty(s));

  const streamStatus = (stream: StreamDef): 'saved' | 'partial' | 'empty' => {
    const fields = fieldsByStream.get(stream.id) ?? [];
    const savedCount = fields.filter((f) => f.id in savedAmounts).length;
    if (savedCount === 0) return 'empty';
    return savedCount === fields.length ? 'saved' : 'partial';
  };

  const pickMonth = (next: string) => {
    if (next === month) return;
    if (anyDirty && !viewOnly) {
      const ok = window.confirm('You have unsaved changes on this month. Discard them and switch?');
      if (!ok) return;
    }
    setMonth(next);
    setSavedAmounts({ ...(initialByMonth[next] ?? {}) });
    setAmounts({ ...(initialByMonth[next] ?? {}) });
    const initial = initialByMonth[next] ?? {};
    const open = new Set<string>();
    for (const s of entryStreams) {
      const fields = fieldsByStream.get(s.id) ?? [];
      if (!fields.some((f) => f.id in initial)) open.add(s.id);
    }
    setExpanded(open);
  };

  const setAmount = (fieldId: string, raw: string) => {
    setAmounts((prev) => {
      const next = { ...prev };
      if (raw === '') {
        delete next[fieldId];
        // Keep a saved value visible as "cleared" is ambiguous — restore saved.
        if (fieldId in savedAmounts) next[fieldId] = savedAmounts[fieldId];
        return next;
      }
      const value = parseFloat(raw);
      next[fieldId] = Number.isNaN(value) ? 0 : value;
      return next;
    });
  };

  const monthTotal = useMemo(() => {
    const inSummaryStreamIds = new Set(
      config.streams.filter((s) => s.attributes.in_summary).map((s) => s.id)
    );
    const fieldById = new Map(config.fields.map((f) => [f.id, f]));
    // Entry streams counting directly + entry fields linked into in-summary derived streams.
    let total = 0;
    const counted = new Set<string>();
    for (const [fieldId, value] of Object.entries(amounts)) {
      const field = fieldById.get(fieldId);
      if (!field) continue;
      const direct = inSummaryStreamIds.has(field.streamId);
      const viaLink = config.links.some(
        (l) => l.sourceFieldId === fieldId && inSummaryStreamIds.has(l.targetStreamId)
      );
      if ((direct || viaLink) && !counted.has(fieldId)) {
        total += Number(value ?? 0);
        counted.add(fieldId);
      }
    }
    return total;
  }, [amounts, config]);

  const derivedPreview = useMemo(() => {
    const fieldById = new Map(config.fields.map((f) => [f.id, f]));
    const byStream = new Map<string, number>();
    for (const link of config.links) {
      const field = fieldById.get(link.sourceFieldId);
      if (!field) continue;
      const amount = Number(amounts[field.id] ?? 0);
      byStream.set(link.targetStreamId, (byStream.get(link.targetStreamId) ?? 0) + amount);
    }
    return config.streams
      .filter((s) => s.kind === 'derived' && s.isActive && byStream.has(s.id))
      .map((s) => ({ name: s.name, total: byStream.get(s.id) ?? 0 }));
  }, [config, amounts]);

  const saveStream = async (stream: StreamDef) => {
    if (viewOnly) return;
    const fields = fieldsByStream.get(stream.id) ?? [];
    const changed = fields.filter((f) => isDirty(f.id));
    if (!changed.length) {
      toast.info(`${stream.name}: nothing changed.`);
      return;
    }
    const overwriting = changed.filter((f) => f.id in savedAmounts);
    if (overwriting.length && duplicateMonthBehavior === 'confirm') {
      const ok = window.confirm(
        `${stream.name} · ${monthLabel(month)}: this will change ${overwriting.length} already-saved value${overwriting.length > 1 ? 's' : ''}. Continue?`
      );
      if (!ok) return;
    }
    setSavingStream(stream.id);
    try {
      const payload: Record<string, number> = {};
      for (const f of changed) payload[f.id] = Number(amounts[f.id] ?? 0);
      const result = await saveStreamEntries({ month, streamId: stream.id, amounts: payload });
      if (result.unchanged) {
        toast.info(`${stream.name}: nothing changed.`);
      } else {
        toast.success(`${stream.name} · ${monthLabel(month)}: ${result.saved} value${result.saved > 1 ? 's' : ''} saved.`);
        setSavedAmounts((prev) => ({ ...prev, ...payload }));
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Failed to save ${stream.name}.`);
    } finally {
      setSavingStream(null);
    }
  };

  const monthState = coverage.find((c) => c.month === month)?.state
    ?? (Object.keys(savedAmounts).length ? 'partial' : 'missing');

  return (
    <div className="space-y-4">
      {/* ===== Month context bar (sticky) ===== */}
      <div className="sticky top-0 z-10 -mx-1 rounded-xl border border-gold/30 bg-card/95 p-4 shadow-glow-gold backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => pickMonth(shiftMonth(month, -1))}
            className="rounded-lg border border-border px-3 py-2 text-body text-secondary hover:bg-elevated"
            aria-label="Previous month"
          >
            ←
          </button>
          <div className="min-w-44">
            <p className="text-micro uppercase tracking-wide text-secondary">
              {viewOnly ? 'Viewing' : 'Editing'}
            </p>
            <p className="text-title font-bold text-gold leading-tight">{monthLabel(month)}</p>
          </div>
          <button
            type="button"
            onClick={() => pickMonth(shiftMonth(month, 1))}
            className="rounded-lg border border-border px-3 py-2 text-body text-secondary hover:bg-elevated"
            aria-label="Next month"
          >
            →
          </button>
          <input
            type="month"
            value={month.slice(0, 7)}
            onChange={(e) => e.target.value && pickMonth(`${e.target.value}-01`)}
            className="rounded-lg border border-border bg-elevated px-3 py-2 text-body text-primary"
            aria-label="Jump to month"
          />
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-micro font-semibold uppercase tracking-wide',
              monthState === 'complete' && 'bg-gold/15 text-gold',
              monthState === 'partial' && 'bg-amber-500/15 text-amber-400',
              (monthState === 'missing' || monthState === 'future') && 'bg-red-500/15 text-red-300'
            )}
          >
            {monthState === 'complete' ? 'All streams saved' : monthState === 'partial' ? 'Partially saved' : 'No data yet'}
          </span>
          <div className="ml-auto text-right">
            <p className="text-micro text-secondary">Month total (live)</p>
            <p className="text-body font-bold text-primary">{formatMMK(monthTotal)}</p>
          </div>
        </div>
        <p className="mt-2 text-micro text-muted">{coverageSummary} · Signed in as {submittingAs}</p>
      </div>

      {/* ===== Coverage strip ===== */}
      <div className="flex flex-wrap gap-1.5">
        {coverage.map((c) => (
          <button
            key={c.month}
            type="button"
            disabled={c.state === 'future'}
            onClick={() => pickMonth(c.month)}
            title={`${monthLabel(c.month)}: ${c.state}`}
            className={cn(
              'rounded px-2 py-1 text-micro border transition-colors',
              month === c.month && 'ring-2 ring-gold',
              c.state === 'complete' && 'border-gold/40 bg-gold/10 text-gold',
              c.state === 'partial' && 'border-amber-500/40 bg-amber-500/10 text-amber-300',
              c.state === 'missing' && 'border-red-500/40 bg-red-500/10 text-red-300',
              c.state === 'future' && 'border-border text-muted opacity-60'
            )}
          >
            {new Date(c.month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
          </button>
        ))}
      </div>

      {/* ===== One card per stream, each saves independently ===== */}
      <div className="space-y-3">
        {entryStreams.map((stream) => {
          const fields = fieldsByStream.get(stream.id) ?? [];
          const status = streamStatus(stream);
          const dirty = streamDirty(stream);
          const isOpen = expanded.has(stream.id);
          const subtotal = fields.reduce((sum, f) => sum + Number(amounts[f.id] ?? 0), 0);
          return (
            <section key={stream.id} className={cn('rounded-xl border bg-card', dirty ? 'border-amber-500/50' : 'border-border')}>
              <button
                type="button"
                onClick={() =>
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(stream.id)) next.delete(stream.id);
                    else next.add(stream.id);
                    return next;
                  })
                }
                className="flex w-full flex-wrap items-center gap-3 p-4 text-left"
              >
                <span className="text-body font-semibold text-primary">{stream.name}</span>
                {dirty ? (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-micro font-semibold uppercase text-amber-400">
                    Unsaved changes
                  </span>
                ) : status === 'saved' ? (
                  <span className="rounded-full bg-gold/15 px-2 py-0.5 text-micro font-semibold uppercase text-gold">Saved</span>
                ) : status === 'partial' ? (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-micro font-semibold uppercase text-amber-400">Partly saved</span>
                ) : (
                  <span className="rounded-full bg-elevated px-2 py-0.5 text-micro font-semibold uppercase text-secondary">No data yet</span>
                )}
                <span className="ml-auto text-caption text-secondary">
                  Subtotal <span className="font-semibold text-primary">{formatMMK(subtotal)}</span>
                </span>
                <span className="text-secondary" aria-hidden>{isOpen ? '▾' : '▸'}</span>
              </button>

              {isOpen && (
                <div className="border-t border-border p-4">
                  <StreamFields
                    stream={stream}
                    fields={fields}
                    amounts={amounts}
                    savedAmounts={savedAmounts}
                    onChange={setAmount}
                    locked={(f) => viewOnly || (!canEditExisting && f.id in savedAmounts)}
                    isDirty={isDirty}
                  />
                  {!viewOnly && !canEditExisting && fields.some((f) => f.id in savedAmounts) && (
                    <p className="mt-3 text-micro text-muted">
                      🔒 Already-saved values are locked for your role — you can fill in empty fields; changing saved numbers needs an Editor or Admin.
                    </p>
                  )}
                  {!viewOnly && (
                    <div className="mt-4 flex items-center justify-end gap-3">
                      {dirty && (
                        <button
                          type="button"
                          onClick={() => {
                            setAmounts((prev) => {
                              const next = { ...prev };
                              for (const f of fields) {
                                if (f.id in savedAmounts) next[f.id] = savedAmounts[f.id];
                                else delete next[f.id];
                              }
                              return next;
                            });
                          }}
                          className="rounded-lg border border-border px-3 py-2 text-caption text-secondary hover:bg-elevated"
                        >
                          Discard changes
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={savingStream === stream.id || !dirty}
                        onClick={() => saveStream(stream)}
                        className="rounded-lg bg-gold px-4 py-2 text-body font-medium text-background hover:opacity-90 disabled:opacity-40"
                      >
                        {savingStream === stream.id ? 'Saving…' : `Save ${stream.name}`}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* ===== Derived preview ===== */}
      {derivedPreview.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-caption text-secondary">
            Auto-calculated streams for {monthLabel(month)} (updates live as you type — never edited directly)
          </p>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {derivedPreview.map((d) => (
              <div key={d.name} className="rounded-lg border border-gold/30 bg-gold/5 p-3">
                <p className="text-caption text-secondary">{d.name}</p>
                <p className="text-body font-semibold text-gold">{formatMMK(d.total)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StreamFields({
  stream,
  fields,
  amounts,
  savedAmounts,
  onChange,
  locked,
  isDirty,
}: {
  stream: StreamDef;
  fields: FieldDef[];
  amounts: Record<string, number>;
  savedAmounts: Record<string, number>;
  onChange: (fieldId: string, raw: string) => void;
  locked: (f: FieldDef) => boolean;
  isDirty: (fieldId: string) => boolean;
}) {
  const dims = stream.groupDimensionLabels;
  const isGrid = Boolean(dims && dims.length === 2 && fields.every((f) => f.groupValues?.length === 2));

  // Enter moves to the next editable input inside this stream's section.
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const section = (e.target as HTMLElement).closest('section, div[data-stream-fields]');
    if (!section) return;
    const inputs = Array.from(section.querySelectorAll<HTMLInputElement>('input[type="number"]:not(:disabled)'));
    const idx = inputs.indexOf(e.target as HTMLInputElement);
    if (idx >= 0 && idx < inputs.length - 1) inputs[idx + 1].focus();
    else (e.target as HTMLInputElement).blur();
  };

  const inputClass = (f: FieldDef) =>
    cn(
      'w-full rounded-lg border bg-elevated px-3 py-2 text-body text-primary focus:border-gold focus:outline-none disabled:opacity-60',
      isDirty(f.id) ? 'border-amber-500/60' : 'border-border'
    );

  const fieldInput = (f: FieldDef) => (
    <input
      type="number"
      inputMode="decimal"
      step="0.01"
      min="0"
      aria-label={f.label}
      value={amounts[f.id] ?? ''}
      placeholder={f.id in savedAmounts ? String(savedAmounts[f.id]) : '0'}
      disabled={locked(f)}
      title={locked(f) && f.id in savedAmounts ? 'Saved value — locked for your role' : undefined}
      onChange={(e) => onChange(f.id, e.target.value)}
      onKeyDown={onKeyDown}
      className={inputClass(f)}
    />
  );

  if (!isGrid) {
    return (
      <div data-stream-fields className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => (
          <label key={f.id} className="block">
            <span className="text-caption text-secondary">
              {f.label}
              {locked(f) && f.id in savedAmounts && <span className="ml-1" aria-hidden>🔒</span>}
            </span>
            <div className="mt-1">{fieldInput(f)}</div>
          </label>
        ))}
      </div>
    );
  }

  const rows = Array.from(new Set(fields.map((f) => f.groupValues![0])));
  const cols = Array.from(new Set(fields.map((f) => f.groupValues![1])));
  const byCell = new Map(fields.map((f) => [`${f.groupValues![0]}|${f.groupValues![1]}`, f]));

  return (
    <div data-stream-fields className="overflow-x-auto">
      <table className="min-w-[560px] w-full text-body">
        <thead>
          <tr>
            <th className="p-2 text-left text-caption font-medium text-secondary">{dims![0]} \ {dims![1]}</th>
            {cols.map((c) => (
              <th key={c} className="p-2 text-left text-caption font-medium text-secondary">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r}>
              <td className="p-2 text-caption font-medium text-primary">{r}</td>
              {cols.map((c) => {
                const field = byCell.get(`${r}|${c}`);
                if (!field) return <td key={c} className="p-2 text-muted">—</td>;
                return (
                  <td key={c} className="p-2">
                    <div className="min-w-28">{fieldInput(field)}</div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
