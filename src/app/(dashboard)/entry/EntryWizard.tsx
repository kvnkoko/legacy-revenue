'use client';

import { useMemo, useState } from 'react';
import { addMonth, type EntryPayload } from './actions';
import { formatMMK } from '@/lib/utils';
import { toast } from 'sonner';

const STEPS = [
  'Select Month',
  'MPT Distributor Data',
  'Atom Telecom Data',
  'Ringtune Sheet Review',
  'EAUC Sheet Review',
  'Combo Sheet Review',
  'SZNB Data',
  'Flow Subscription',
  'YouTube',
  'Spotify',
  'TikTok',
  'Final Review & Confirm',
];

const DISTRIBUTORS = ['legacy', 'etrade', 'fortune', 'unico'] as const;
const PRODUCTS = ['ringtune', 'eauc', 'combo'] as const;

type CoveragePill = {
  month: string;
  state: 'complete' | 'partial' | 'missing' | 'future';
};

type SavedMonthPayload = Omit<EntryPayload, 'month'> & {
  revenueTotal?: number;
  lastUpdatedAt?: string | null;
};

function emptyPayload(month: string): Partial<EntryPayload> {
  return {
    month,
    mpt: {},
    atom: { ringtune: 0, eauc: 0, combo: 0 },
    ringtune_ooredoo: 0,
    sznb: {},
    flow_mpt: 0,
    flow_kpay: 0,
    youtube: {},
    spotify: {},
    tiktok: {},
  };
}

export function EntryWizard({
  existingMonths,
  recordsByMonth,
  defaultMonth,
  selectedMonth,
  coverage,
  coverageSummary,
  viewOnly = false,
  submittingAs,
  duplicateMonthBehavior = 'confirm',
}: {
  existingMonths: string[];
  recordsByMonth: Record<string, SavedMonthPayload>;
  defaultMonth: string;
  selectedMonth?: string;
  coverage: CoveragePill[];
  coverageSummary: string;
  viewOnly?: boolean;
  submittingAs?: string;
  duplicateMonthBehavior?: 'allow' | 'confirm' | 'block';
}) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [editingMonth, setEditingMonth] = useState(false);
  const initialMonth = selectedMonth && recordsByMonth[selectedMonth] ? selectedMonth : defaultMonth;
  const [payload, setPayload] = useState<Partial<EntryPayload>>(
    recordsByMonth[initialMonth] ? { month: initialMonth, ...recordsByMonth[initialMonth] } : emptyPayload(initialMonth)
  );

  const computed = useMemo(() => {
    const m = payload.mpt ?? {};
    const mptRingtune = (m.legacy_ringtune ?? 0) + (m.etrade_ringtune ?? 0) + (m.fortune_ringtune ?? 0) + (m.unico_ringtune ?? 0);
    const eaucMpt = (m.legacy_eauc ?? 0) + (m.etrade_eauc ?? 0) + (m.fortune_eauc ?? 0) + (m.unico_eauc ?? 0);
    const comboMpt = (m.legacy_combo ?? 0) + (m.etrade_combo ?? 0) + (m.fortune_combo ?? 0) + (m.unico_combo ?? 0);
    const ringtune = mptRingtune + (payload.atom?.ringtune ?? 0) + (payload.ringtune_ooredoo ?? 0);
    const eaucTotal = eaucMpt + (payload.atom?.eauc ?? 0);
    const comboTotal = comboMpt + (payload.atom?.combo ?? 0);
    const sznbTotal = Object.values(payload.sznb ?? {}).reduce((a, b) => a + (Number(b) || 0), 0);
    const flowTotal = (payload.flow_mpt ?? 0) + (payload.flow_kpay ?? 0);
    const yt = payload.youtube ?? {};
    const ytTotal = (yt.solution_one ?? 0) + (yt.fuga ?? 0) + (yt.believe ?? 0);
    const sp = payload.spotify ?? {};
    const spTotal = (sp.fuga ?? 0) + (sp.believe ?? 0);
    const tt = payload.tiktok ?? {};
    const ttTotal = (tt.fuga ?? 0) + (tt.believe ?? 0);
    return {
      mptRingtune,
      eaucMpt,
      comboMpt,
      ringtune,
      eaucTotal,
      comboTotal,
      sznbTotal,
      flowTotal,
      ytTotal,
      spTotal,
      ttTotal,
      total: ringtune + eaucTotal + comboTotal + sznbTotal + flowTotal + ytTotal + spTotal + ttTotal,
    };
  }, [payload]);

  const updateMonth = (month?: string) => {
    if (!month) {
      setPayload((p) => ({ ...p, month: undefined }));
      return;
    }
    const saved = recordsByMonth[month];
    if (saved) {
      setEditingMonth(true);
      setPayload({ month, ...saved });
      return;
    }
    setEditingMonth(false);
    setPayload(emptyPayload(month));
  };

  async function handleSave() {
    if (viewOnly) return;
    if (!payload.month) {
      toast.error('Select a month');
      return;
    }
    const isOverwrite = existingMonths.includes(payload.month);
    if (isOverwrite && duplicateMonthBehavior === 'block') {
      toast.error('Overwriting existing months is disabled. Please choose a different month.');
      return;
    }
    if (isOverwrite && duplicateMonthBehavior === 'confirm') {
      const monthLabel = payload.month ? new Date(payload.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : payload.month;
      const ok = window.confirm(`Data for ${monthLabel} already exists. Overwriting will replace all values. Are you sure?`);
      if (!ok) return;
    }
    setSaving(true);
    try {
      await addMonth(payload as EntryPayload);
      toast.success(editingMonth ? 'Month updated successfully' : 'Month saved successfully');
      const nextMonth = getNextMonth([...(existingMonths || []), payload.month]);
      setStep(0);
      setEditingMonth(false);
      setPayload(emptyPayload(nextMonth));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4 md:p-6">
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(i)}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-caption sm:text-body font-medium transition-colors ${
              step === i ? 'bg-teal text-background' : 'bg-elevated text-secondary hover:text-primary'
            }`}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-3">
          <label className="block text-body text-secondary">Month</label>
          <input
            type="month"
            value={payload.month?.slice(0, 7) ?? ''}
            onChange={(e) => updateMonth(e.target.value ? `${e.target.value}-01` : undefined)}
            disabled={viewOnly}
            className="mt-1 rounded-lg border border-border bg-elevated px-3 py-2 text-primary disabled:opacity-60"
          />
          {payload.month && existingMonths.includes(payload.month) && !viewOnly && (
            <p className="text-amber-500">Data for this month already exists. You are editing existing records. Changes are logged in the audit trail.</p>
          )}
          <p className="text-caption text-secondary">{coverageSummary}</p>
          <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-elevated p-3">
            {coverage.map((pill) => (
              <span
                key={pill.month}
                className={`rounded-full border px-2 py-1 text-micro ${
                  pill.state === 'complete'
                    ? 'border-teal bg-teal/10 text-teal'
                    : pill.state === 'partial'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                      : pill.state === 'missing'
                        ? 'border-red-500 bg-red-500/10 text-red-400'
                        : 'border-border text-muted'
                }`}
              >
                {new Date(pill.month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
              </span>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-body text-secondary">Enter MPT distributor values for Ringtune, EAUC, and Combo.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {DISTRIBUTORS.map((d) =>
              PRODUCTS.map((p) => (
                <div key={`${d}-${p}`}>
                  <label className="text-caption text-muted">{d} {p}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={(payload.mpt as Record<string, number>)?.[`${d}_${p}`] ?? ''}
                    onChange={(e) =>
                      setPayload((prev) => ({
                        ...prev,
                        mpt: {
                          ...(prev.mpt as Record<string, number>),
                          [`${d}_${p}`]: e.target.value ? Number(e.target.value) : 0,
                        },
                      }))
                    }
                    disabled={viewOnly}
                    className="w-full rounded border border-border bg-elevated px-2 py-1 text-primary disabled:opacity-60"
                  />
                </div>
              ))
            )}
          </div>
          <div className="grid grid-cols-1 gap-2 rounded-lg border border-border bg-elevated p-3 sm:grid-cols-3 sm:gap-4">
            <p className="text-primary">MPT Ringtune: {formatMMK(computed.mptRingtune)}</p>
            <p className="text-primary">MPT EAUC: {formatMMK(computed.eaucMpt)}</p>
            <p className="text-primary">MPT Combo: {formatMMK(computed.comboMpt)}</p>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(['ringtune', 'eauc', 'combo'] as const).map((k) => (
            <div key={k}>
              <label className="text-body text-secondary">Atom {k}</label>
              <input
                type="number"
                step="0.01"
                value={payload.atom?.[k] ?? ''}
                onChange={(e) =>
                  setPayload((p) => ({
                    ...p,
                    atom: { ...(p.atom ?? { ringtune: 0, eauc: 0, combo: 0 }), [k]: e.target.value ? Number(e.target.value) : 0 },
                  }))
                }
                disabled={viewOnly}
                className="w-full rounded border border-border bg-elevated px-3 py-2 text-primary disabled:opacity-60"
              />
            </div>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h3 className="text-body font-semibold text-primary">Ringtune — Auto-computed from MPT & Atom</h3>
          <p className="text-body text-primary">⟵ MPT: {formatMMK(computed.mptRingtune)}</p>
          <p className="text-body text-primary">⟵ Atom: {formatMMK(payload.atom?.ringtune ?? 0)}</p>
          <div>
            <label className="text-body text-secondary">✎ Ooredoo Ringtune</label>
            <input
              type="number"
              step="0.01"
              value={payload.ringtune_ooredoo ?? ''}
              onChange={(e) => setPayload((p) => ({ ...p, ringtune_ooredoo: e.target.value ? Number(e.target.value) : 0 }))}
              disabled={viewOnly}
              className="w-full rounded border border-border bg-elevated px-3 py-2 text-primary disabled:opacity-60"
            />
          </div>
          <p className="text-teal font-semibold">Ringtune Total: {formatMMK(computed.ringtune)}</p>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-3">
          <h3 className="text-body font-semibold text-primary">EAUC — Auto-computed from MPT & Atom</h3>
          <p className="text-body text-primary">⟵ MPT: {formatMMK(computed.eaucMpt)}</p>
          <p className="text-body text-primary">⟵ Atom: {formatMMK(payload.atom?.eauc ?? 0)}</p>
          <p className="text-teal font-semibold">EAUC Total: {formatMMK(computed.eaucTotal)}</p>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-3">
          <h3 className="text-body font-semibold text-primary">Combo — Auto-computed from MPT & Atom</h3>
          <p className="text-body text-primary">⟵ MPT: {formatMMK(computed.comboMpt)}</p>
          <p className="text-body text-primary">⟵ Atom: {formatMMK(payload.atom?.combo ?? 0)}</p>
          <p className="text-teal font-semibold">Combo Total: {formatMMK(computed.comboTotal)}</p>
        </div>
      )}

      {step === 6 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {['mpt', 'atom', 'kpay_mini_app', 'kpay_qr', 'kpay_ecommerce', 'wave_money', 'dinger'].map((k) => (
            <div key={k}>
              <label className="text-body text-secondary">{k.replace(/_/g, ' ')}</label>
              <input
                type="number"
                step="0.01"
                value={(payload.sznb as Record<string, number>)?.[k] ?? ''}
                onChange={(e) =>
                  setPayload((p) => ({
                    ...p,
                    sznb: { ...(p.sznb as Record<string, number>), [k]: e.target.value ? Number(e.target.value) : 0 },
                  }))
                }
                disabled={viewOnly}
                className="w-full rounded border border-border bg-elevated px-3 py-2 text-primary disabled:opacity-60"
              />
            </div>
          ))}
          <p className="col-span-full text-teal font-semibold">SZNB Total: {formatMMK(computed.sznbTotal)}</p>
        </div>
      )}

      {step === 7 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-body text-secondary">Flow MPT</label>
            <input
              type="number"
              step="0.01"
              value={payload.flow_mpt ?? ''}
              onChange={(e) => setPayload((p) => ({ ...p, flow_mpt: e.target.value ? Number(e.target.value) : 0 }))}
              disabled={viewOnly}
              className="w-full rounded border border-border bg-elevated px-3 py-2 text-primary disabled:opacity-60"
            />
          </div>
          <div>
            <label className="text-body text-secondary">Flow Kpay</label>
            <input
              type="number"
              step="0.01"
              value={payload.flow_kpay ?? ''}
              onChange={(e) => setPayload((p) => ({ ...p, flow_kpay: e.target.value ? Number(e.target.value) : 0 }))}
              disabled={viewOnly}
              className="w-full rounded border border-border bg-elevated px-3 py-2 text-primary disabled:opacity-60"
            />
          </div>
          <p className="col-span-full text-teal font-semibold">Flow Total: {formatMMK(computed.flowTotal)}</p>
        </div>
      )}

      {step === 8 && (
        <div>
          <h3 className="mb-2 font-medium text-primary">YouTube (Solution One, FUGA, Believe)</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(['solution_one', 'fuga', 'believe'] as const).map((k) => (
              <div key={k}>
                <label className="text-caption text-muted">{k}</label>
                <input
                  type="number"
                  step="0.01"
                  value={(payload.youtube as Record<string, number>)?.[k] ?? ''}
                  onChange={(e) =>
                    setPayload((p) => ({
                      ...p,
                      youtube: { ...(p.youtube as Record<string, number>), [k]: e.target.value ? Number(e.target.value) : 0 },
                    }))
                  }
                  disabled={viewOnly}
                  className="w-full rounded border border-border bg-elevated px-2 py-1 text-primary disabled:opacity-60"
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-teal font-semibold">YouTube Total: {formatMMK(computed.ytTotal)}</p>
        </div>
      )}

      {step === 9 && (
        <div>
          <h3 className="mb-2 font-medium text-primary">Spotify (FUGA, Believe)</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(['fuga', 'believe'] as const).map((k) => (
              <div key={k}>
                <label className="text-caption text-muted">{k}</label>
                <input
                  type="number"
                  step="0.01"
                  value={(payload.spotify as Record<string, number>)?.[k] ?? ''}
                  onChange={(e) =>
                    setPayload((p) => ({
                      ...p,
                      spotify: { ...(p.spotify as Record<string, number>), [k]: e.target.value ? Number(e.target.value) : 0 },
                    }))
                  }
                  disabled={viewOnly}
                  className="w-full rounded border border-border bg-elevated px-2 py-1 text-primary disabled:opacity-60"
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-teal font-semibold">Spotify Total: {formatMMK(computed.spTotal)}</p>
        </div>
      )}

      {step === 10 && (
        <div>
          <h3 className="mb-2 font-medium text-primary">TikTok (FUGA, Believe)</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(['fuga', 'believe'] as const).map((k) => (
              <div key={k}>
                <label className="text-caption text-muted">{k}</label>
                <input
                  type="number"
                  step="0.01"
                  value={(payload.tiktok as Record<string, number>)?.[k] ?? ''}
                  onChange={(e) =>
                    setPayload((p) => ({
                      ...p,
                      tiktok: { ...(p.tiktok as Record<string, number>), [k]: e.target.value ? Number(e.target.value) : 0 },
                    }))
                  }
                  disabled={viewOnly}
                  className="w-full rounded border border-border bg-elevated px-2 py-1 text-primary disabled:opacity-60"
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-teal font-semibold">TikTok Total: {formatMMK(computed.ttTotal)}</p>
        </div>
      )}

      {step === 11 && (
        <div className="space-y-4">
          <p className="text-secondary">Month: <strong className="text-primary">{payload.month}</strong></p>
          {submittingAs && <p className="text-caption text-secondary">Submitting as: {submittingAs}</p>}
          <div className="rounded-lg border border-border bg-elevated p-4 space-y-1">
            <p className="text-primary">Ringtune {formatMMK(computed.ringtune)}</p>
            <p className="pl-4 text-secondary">⟵ MPT {formatMMK(computed.mptRingtune)}</p>
            <p className="pl-4 text-secondary">⟵ Atom {formatMMK(payload.atom?.ringtune ?? 0)}</p>
            <p className="pl-4 text-secondary">✎ Ooredoo {formatMMK(payload.ringtune_ooredoo ?? 0)}</p>
            <p className="text-primary">EAUC {formatMMK(computed.eaucTotal)}</p>
            <p className="text-primary">Combo {formatMMK(computed.comboTotal)}</p>
            <p className="text-primary">SZNB {formatMMK(computed.sznbTotal)}</p>
            <p className="text-primary">Flow Subscription {formatMMK(computed.flowTotal)}</p>
            <p className="text-primary">YouTube {formatMMK(computed.ytTotal)}</p>
            <p className="text-primary">Spotify {formatMMK(computed.spTotal)}</p>
            <p className="text-primary">TikTok {formatMMK(computed.ttTotal)}</p>
            <p className="pt-2 text-teal font-semibold">Σ Total Revenue {formatMMK(computed.total)}</p>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="w-full rounded-lg border border-[#2a3347] px-4 py-2 text-body text-primary disabled:opacity-50 sm:w-auto"
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="w-full rounded-lg bg-teal px-4 py-2 text-body font-medium text-[#0a0c10] sm:w-auto"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || viewOnly}
            className="w-full rounded-lg bg-teal px-4 py-2 text-body font-medium text-[#0a0c10] disabled:opacity-50 sm:w-auto"
          >
            {saving ? 'Saving…' : 'Confirm & Save'}
          </button>
        )}
      </div>
    </div>
  );
}

function getNextMonth(existing: string[]): string {
  if (!existing.length) return '2025-01-01';
  const latest = new Date([...existing].sort().at(-1) ?? '2025-01-01');
  latest.setMonth(latest.getMonth() + 1);
  return `${latest.getFullYear()}-${String(latest.getMonth() + 1).padStart(2, '0')}-01`;
}
