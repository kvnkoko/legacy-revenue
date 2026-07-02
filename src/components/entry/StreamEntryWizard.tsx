'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn, formatMMK } from '@/lib/utils';
import type { FieldDef, StreamConfig, StreamDef } from '@/lib/streams/types';
import { saveMonthEntries } from '@/app/(dashboard)/entry/actions';

export type MonthCoverage = { month: string; state: 'complete' | 'partial' | 'missing' | 'future' };

type Props = {
  config: StreamConfig;
  /** Existing amounts: { [month]: { [fieldId]: amount } } */
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

export function StreamEntryWizard({
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

  const steps = useMemo(
    () => ['Select month', ...entryStreams.map((s) => s.name), 'Review & Confirm'],
    [entryStreams]
  );

  const [step, setStep] = useState(selectedMonth ? 1 : 0);
  const [month, setMonth] = useState(selectedMonth ?? defaultMonth);
  const [amounts, setAmounts] = useState<Record<string, number>>(
    () => ({ ...(initialByMonth[selectedMonth ?? defaultMonth] ?? {}) })
  );
  const [saving, setSaving] = useState(false);

  const monthExists = Boolean(initialByMonth[month]);
  const blocked = monthExists && duplicateMonthBehavior === 'block';
  const editBlocked = monthExists && !canEditExisting;

  const pickMonth = (next: string) => {
    setMonth(next);
    setAmounts({ ...(initialByMonth[next] ?? {}) });
  };

  const setAmount = (fieldId: string, raw: string) => {
    const value = parseFloat(raw);
    setAmounts((prev) => ({ ...prev, [fieldId]: Number.isNaN(value) ? 0 : value }));
  };

  const streamTotal = (stream: StreamDef) =>
    (fieldsByStream.get(stream.id) ?? []).reduce((sum, f) => sum + Number(amounts[f.id] ?? 0), 0);

  const grandTotal = useMemo(
    () =>
      entryStreams
        .filter((s) => s.attributes.in_summary || linksIntoSummary(config, s))
        .reduce((sum, s) => sum + streamTotal(s), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [amounts, entryStreams, config]
  );

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
      .filter((s) => s.kind === 'derived' && byStream.has(s.id))
      .map((s) => ({ name: s.name, total: byStream.get(s.id) ?? 0 }));
  }, [config, amounts]);

  const submit = async () => {
    if (viewOnly) return;
    setSaving(true);
    try {
      const payload: Record<string, number> = {};
      for (const s of entryStreams) {
        for (const f of fieldsByStream.get(s.id) ?? []) {
          payload[f.id] = Number(amounts[f.id] ?? 0);
        }
      }
      const result = await saveMonthEntries({ month, amounts: payload });
      toast.success(`${monthLabel(month)} saved (${result.saved} values).`);
      router.refresh();
      setStep(0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save month.');
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (step === 0 && blocked) {
      toast.error('This month already has data and duplicate entries are blocked by policy.');
      return;
    }
    if (step === 0 && editBlocked) {
      toast.error('This month already has data. Editing requires the can_edit_data permission.');
      return;
    }
    if (step === 0 && monthExists && duplicateMonthBehavior === 'confirm') {
      const ok = window.confirm(`${monthLabel(month)} already has data. Continue and update it?`);
      if (!ok) return;
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const activeStream = step >= 1 && step <= entryStreams.length ? entryStreams[step - 1] : null;

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
      {/* Progress rail */}
      <ol className="flex flex-wrap gap-2 text-caption">
        {steps.map((label, i) => (
          <li
            key={label}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-2.5 py-1',
              i === step
                ? 'border-teal/50 bg-teal/10 text-teal'
                : i < step
                  ? 'border-border text-secondary'
                  : 'border-transparent text-muted'
            )}
          >
            <span className="text-[11px]">{i + 1}</span>
            <span className="hidden sm:inline">{label}</span>
          </li>
        ))}
      </ol>

      <div className="mt-5">
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label htmlFor="entry-month" className="block text-caption font-medium text-secondary">
                Month to {viewOnly ? 'view' : 'enter'}
              </label>
              <input
                id="entry-month"
                type="month"
                value={month.slice(0, 7)}
                onChange={(e) => e.target.value && pickMonth(`${e.target.value}-01`)}
                className="mt-1 rounded-lg border border-border bg-elevated px-3 py-2 text-body text-primary"
              />
              {monthExists && (
                <p className={cn('mt-2 text-caption', blocked || editBlocked ? 'text-red-400' : 'text-amber-400')}>
                  {monthLabel(month)} already has data
                  {blocked
                    ? ' — duplicate entries are blocked by policy.'
                    : editBlocked
                      ? ' — editing requires the can_edit_data permission.'
                      : ' — continuing will update it.'}
                </p>
              )}
            </div>
            <div>
              <p className="text-caption text-secondary">{coverageSummary}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {coverage.map((c) => (
                  <button
                    key={c.month}
                    type="button"
                    disabled={c.state === 'future'}
                    onClick={() => pickMonth(c.month)}
                    title={`${monthLabel(c.month)}: ${c.state}`}
                    className={cn(
                      'rounded px-2 py-1 text-micro border transition-colors',
                      month === c.month && 'ring-1 ring-teal',
                      c.state === 'complete' && 'border-teal/40 bg-teal/10 text-teal',
                      c.state === 'partial' && 'border-amber-500/40 bg-amber-500/10 text-amber-300',
                      c.state === 'missing' && 'border-red-500/40 bg-red-500/10 text-red-300',
                      c.state === 'future' && 'border-border text-muted opacity-60'
                    )}
                  >
                    {new Date(c.month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeStream && (
          <StreamStep
            stream={activeStream}
            fields={fieldsByStream.get(activeStream.id) ?? []}
            amounts={amounts}
            onChange={setAmount}
            viewOnly={viewOnly}
            subtotal={streamTotal(activeStream)}
          />
        )}

        {step === steps.length - 1 && (
          <div className="space-y-4">
            <h3 className="text-body font-semibold text-primary">Review {monthLabel(month)}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {entryStreams.map((s) => (
                <div key={s.id} className="rounded-lg border border-border bg-elevated p-3">
                  <p className="text-caption text-secondary">{s.name}</p>
                  <p className="text-body font-semibold text-primary">{formatMMK(streamTotal(s))}</p>
                </div>
              ))}
            </div>
            {derivedPreview.length > 0 && (
              <div>
                <p className="text-caption text-secondary">Derived streams (computed automatically)</p>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {derivedPreview.map((d) => (
                    <div key={d.name} className="rounded-lg border border-teal/30 bg-teal/5 p-3">
                      <p className="text-caption text-secondary">{d.name}</p>
                      <p className="text-body font-semibold text-teal">{formatMMK(d.total)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="rounded-lg border border-border bg-elevated p-4">
              <p className="text-caption text-secondary">Month total (summary streams)</p>
              <p className="text-title font-bold text-teal">{formatMMK(grandTotal)}</p>
              <p className="mt-1 text-micro text-muted">Submitting as {submittingAs}</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(s - 1, 0))}
          disabled={step === 0}
          className="rounded-lg border border-border px-4 py-2 text-body text-secondary hover:bg-elevated disabled:opacity-40"
        >
          Back
        </button>
        {step < steps.length - 1 ? (
          <button
            type="button"
            onClick={next}
            className="rounded-lg bg-teal px-4 py-2 text-body font-medium text-background hover:opacity-90"
          >
            Next
          </button>
        ) : viewOnly ? (
          <span className="text-caption text-muted">View only</span>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="rounded-lg bg-teal px-4 py-2 text-body font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : monthExists ? 'Update Month' : 'Save Month'}
          </button>
        )}
      </div>
    </section>
  );
}

function linksIntoSummary(config: StreamConfig, stream: StreamDef): boolean {
  const fieldIds = new Set(config.fields.filter((f) => f.streamId === stream.id).map((f) => f.id));
  const summaryStreamIds = new Set(
    config.streams.filter((s) => s.attributes.in_summary).map((s) => s.id)
  );
  return config.links.some(
    (l) => fieldIds.has(l.sourceFieldId) && summaryStreamIds.has(l.targetStreamId)
  );
}

function StreamStep({
  stream,
  fields,
  amounts,
  onChange,
  viewOnly,
  subtotal,
}: {
  stream: StreamDef;
  fields: FieldDef[];
  amounts: Record<string, number>;
  onChange: (fieldId: string, raw: string) => void;
  viewOnly: boolean;
  subtotal: number;
}) {
  const dims = stream.groupDimensionLabels;
  const isGrid = Boolean(dims && dims.length === 2 && fields.every((f) => f.groupValues?.length === 2));

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-body font-semibold text-primary">{stream.name}</h3>
        <p className="text-caption text-secondary">
          Subtotal: <span className="font-semibold text-teal">{formatMMK(subtotal)}</span>
        </p>
      </div>

      {isGrid ? (
        <GroupGrid fields={fields} dims={dims!} amounts={amounts} onChange={onChange} viewOnly={viewOnly} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((f) => (
            <label key={f.id} className="block">
              <span className="text-caption text-secondary">{f.label}</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={amounts[f.id] ?? ''}
                placeholder="0"
                readOnly={viewOnly}
                onChange={(e) => onChange(f.id, e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-elevated px-3 py-2 text-body text-primary focus:border-teal focus:outline-none"
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupGrid({
  fields,
  dims,
  amounts,
  onChange,
  viewOnly,
}: {
  fields: FieldDef[];
  dims: string[];
  amounts: Record<string, number>;
  onChange: (fieldId: string, raw: string) => void;
  viewOnly: boolean;
}) {
  const rows = Array.from(new Set(fields.map((f) => f.groupValues![0])));
  const cols = Array.from(new Set(fields.map((f) => f.groupValues![1])));
  const byCell = new Map(fields.map((f) => [`${f.groupValues![0]}|${f.groupValues![1]}`, f]));

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[560px] w-full text-body">
        <thead>
          <tr>
            <th className="p-2 text-left text-caption font-medium text-secondary">{dims[0]} \ {dims[1]}</th>
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
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      aria-label={field.label}
                      value={amounts[field.id] ?? ''}
                      placeholder="0"
                      readOnly={viewOnly}
                      onChange={(e) => onChange(field.id, e.target.value)}
                      className="w-full min-w-28 rounded-lg border border-border bg-elevated px-2.5 py-1.5 text-body text-primary focus:border-teal focus:outline-none"
                    />
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
