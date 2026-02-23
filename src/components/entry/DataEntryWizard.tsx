'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { formatMMK } from '@/lib/utils';
import { addMonth, type EntryPayload } from '@/app/(dashboard)/entry/actions';

const STEPS = [
  'Select month',
  'Local Telecom (MPT)',
  'SZNB',
  'Flow Subscription',
  'International',
  'Review & Confirm',
];

type FlatEntry = {
  month: string;
  legacy_ringtune: number;
  legacy_eauc: number;
  legacy_combo: number;
  etrade_ringtune: number;
  etrade_eauc: number;
  etrade_combo: number;
  fortune_ringtune: number;
  fortune_eauc: number;
  fortune_combo: number;
  unico_ringtune: number;
  unico_eauc: number;
  unico_combo: number;
  ringtune_mpt: number;
  ringtune_atom: number;
  ringtune_ooredoo: number;
  eauc_mpt: number;
  eauc_atom: number;
  combo_mpt: number;
  combo_atom: number;
  sznb_mpt: number;
  sznb_atom: number;
  sznb_kpay_mini_app: number;
  sznb_kpay_qr: number;
  sznb_kpay_ecommerce: number;
  sznb_wave_money: number;
  sznb_dinger: number;
  flow_mpt: number;
  flow_kpay: number;
  youtube_solution_one: number;
  youtube_fuga: number;
  youtube_believe: number;
  spotify_fuga: number;
  spotify_believe: number;
  tiktok_fuga: number;
  tiktok_believe: number;
};

const defaultPayload: FlatEntry = {
  month: '',
  legacy_ringtune: 0,
  legacy_eauc: 0,
  legacy_combo: 0,
  etrade_ringtune: 0,
  etrade_eauc: 0,
  etrade_combo: 0,
  fortune_ringtune: 0,
  fortune_eauc: 0,
  fortune_combo: 0,
  unico_ringtune: 0,
  unico_eauc: 0,
  unico_combo: 0,
  ringtune_mpt: 0,
  ringtune_atom: 0,
  ringtune_ooredoo: 0,
  eauc_mpt: 0,
  eauc_atom: 0,
  combo_mpt: 0,
  combo_atom: 0,
  sznb_mpt: 0,
  sznb_atom: 0,
  sznb_kpay_mini_app: 0,
  sznb_kpay_qr: 0,
  sznb_kpay_ecommerce: 0,
  sznb_wave_money: 0,
  sznb_dinger: 0,
  flow_mpt: 0,
  flow_kpay: 0,
  youtube_solution_one: 0,
  youtube_fuga: 0,
  youtube_believe: 0,
  spotify_fuga: 0,
  spotify_believe: 0,
  tiktok_fuga: 0,
  tiktok_believe: 0,
};

function num(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

export function DataEntryWizard() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FlatEntry>(defaultPayload);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const update = useCallback((updates: Partial<FlatEntry>) => {
    setData((d) => ({ ...d, ...updates }));
  }, []);

  const ringtuneTotal = num(data.ringtune_mpt) + num(data.ringtune_atom) + num(data.ringtune_ooredoo);
  const eaucTotal = num(data.eauc_mpt) + num(data.eauc_atom);
  const comboTotal = num(data.combo_mpt) + num(data.combo_atom);
  const sznbTotal =
    num(data.sznb_mpt) +
    num(data.sznb_atom) +
    num(data.sznb_kpay_mini_app) +
    num(data.sznb_kpay_qr) +
    num(data.sznb_kpay_ecommerce) +
    num(data.sznb_wave_money) +
    num(data.sznb_dinger);
  const flowTotal = num(data.flow_mpt) + num(data.flow_kpay);
  const youtubeTotal = num(data.youtube_solution_one) + num(data.youtube_fuga) + num(data.youtube_believe);
  const spotifyTotal = num(data.spotify_fuga) + num(data.spotify_believe);
  const tiktokTotal = num(data.tiktok_fuga) + num(data.tiktok_believe);
  const mptTotal =
    num(data.legacy_ringtune) +
    num(data.legacy_eauc) +
    num(data.legacy_combo) +
    num(data.etrade_ringtune) +
    num(data.etrade_eauc) +
    num(data.etrade_combo) +
    num(data.fortune_ringtune) +
    num(data.fortune_eauc) +
    num(data.fortune_combo) +
    num(data.unico_ringtune) +
    num(data.unico_eauc) +
    num(data.unico_combo);
  const grandTotal =
    ringtuneTotal + eaucTotal + comboTotal + sznbTotal + flowTotal + youtubeTotal + spotifyTotal + tiktokTotal;

  async function handleSubmit() {
    if (!data.month) {
      toast.error('Please select a month');
      return;
    }
    setSaving(true);
    try {
      const payload: EntryPayload = {
        month: data.month,
        mpt: {
          legacy_ringtune: data.legacy_ringtune,
          legacy_eauc: data.legacy_eauc,
          legacy_combo: data.legacy_combo,
          etrade_ringtune: data.etrade_ringtune,
          etrade_eauc: data.etrade_eauc,
          etrade_combo: data.etrade_combo,
          fortune_ringtune: data.fortune_ringtune,
          fortune_eauc: data.fortune_eauc,
          fortune_combo: data.fortune_combo,
          unico_ringtune: data.unico_ringtune,
          unico_eauc: data.unico_eauc,
          unico_combo: data.unico_combo,
        },
        atom: {
          ringtune: data.ringtune_atom,
          eauc: data.eauc_atom,
          combo: data.combo_atom,
        },
        ringtune_ooredoo: data.ringtune_ooredoo,
        sznb: {
          mpt: data.sznb_mpt,
          atom: data.sznb_atom,
          kpay_mini_app: data.sznb_kpay_mini_app,
          kpay_qr: data.sznb_kpay_qr,
          kpay_ecommerce: data.sznb_kpay_ecommerce,
          wave_money: data.sznb_wave_money,
          dinger: data.sznb_dinger,
        },
        flow_mpt: data.flow_mpt,
        flow_kpay: data.flow_kpay,
        youtube: {
          solution_one: data.youtube_solution_one,
          fuga: data.youtube_fuga,
          believe: data.youtube_believe,
        },
        spotify: { fuga: data.spotify_fuga, believe: data.spotify_believe },
        tiktok: { fuga: data.tiktok_fuga, believe: data.tiktok_believe },
      };
      await addMonth(payload);
      toast.success('Data saved successfully');
      router.refresh();
      setData(defaultPayload);
      setStep(0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      {/* Step indicator */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              step === i ? 'bg-teal text-background' : 'bg-elevated text-secondary hover:text-primary'
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {/* Step 0: Month */}
      {step === 0 && (
        <div className="space-y-4">
          <label className="block text-sm font-medium text-secondary">Month</label>
          <input
            type="month"
            value={data.month ? data.month.slice(0, 7) : ''}
            onChange={(e) => update({ month: e.target.value ? `${e.target.value}-01` : '' })}
            className="rounded-lg border border-border bg-elevated px-4 py-2.5 text-primary w-full max-w-xs"
          />
          <p className="text-muted text-sm">Select the month for this data entry. Duplicate months will be updated.</p>
        </div>
      )}

      {/* Step 1: Local Telecom / MPT */}
      {step === 1 && (
        <div className="space-y-6">
          <p className="text-secondary text-sm">MPT: Legacy, Etrade, Fortune, Unico × Ringtune, EAUC, Combo</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(['legacy', 'etrade', 'fortune', 'unico'] as const).map((dist) =>
              (['ringtune', 'eauc', 'combo'] as const).map((prod) => (
                <div key={`${dist}_${prod}`}>
                  <label className="block text-xs text-muted mb-0.5 capitalize">{dist} {prod}</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={data[`${dist}_${prod}` as keyof FlatEntry] ?? ''}
                    onChange={(e) => update({ [`${dist}_${prod}`]: e.target.value ? Number(e.target.value) : 0 } as Partial<FlatEntry>)}
                    className="w-full rounded border border-border bg-elevated px-3 py-2 text-primary text-sm"
                  />
                </div>
              ))
            )}
          </div>
          <p className="text-teal text-sm font-medium">MPT total: {formatMMK(mptTotal)}</p>
          <p className="text-secondary text-sm mt-2">Ringtune by telecom (MPT, Atom, Ooredoo)</p>
          <div className="flex gap-4 flex-wrap">
            <div>
              <label className="block text-xs text-muted mb-0.5">Ringtune MPT</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={data.ringtune_mpt || ''}
                onChange={(e) => update({ ringtune_mpt: e.target.value ? Number(e.target.value) : 0 })}
                className="w-32 rounded border border-border bg-elevated px-3 py-2 text-primary text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-0.5">Ringtune Atom</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={data.ringtune_atom || ''}
                onChange={(e) => update({ ringtune_atom: e.target.value ? Number(e.target.value) : 0 })}
                className="w-32 rounded border border-border bg-elevated px-3 py-2 text-primary text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-0.5">Ringtune Ooredoo</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={data.ringtune_ooredoo || ''}
                onChange={(e) => update({ ringtune_ooredoo: e.target.value ? Number(e.target.value) : 0 })}
                className="w-32 rounded border border-border bg-elevated px-3 py-2 text-primary text-sm"
              />
            </div>
          </div>
          <p className="text-teal text-sm">Ringtune total: {formatMMK(ringtuneTotal)}</p>
          <p className="text-secondary text-sm mt-2">EAUC (MPT, Atom) & Combo (MPT, Atom)</p>
          <div className="flex gap-4 flex-wrap">
            <div>
              <label className="block text-xs text-muted mb-0.5">EAUC MPT</label>
              <input type="number" min={0} step={0.01} value={data.eauc_mpt || ''} onChange={(e) => update({ eauc_mpt: e.target.value ? Number(e.target.value) : 0 })} className="w-32 rounded border border-border bg-elevated px-3 py-2 text-primary text-sm" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-0.5">EAUC Atom</label>
              <input type="number" min={0} step={0.01} value={data.eauc_atom || ''} onChange={(e) => update({ eauc_atom: e.target.value ? Number(e.target.value) : 0 })} className="w-32 rounded border border-border bg-elevated px-3 py-2 text-primary text-sm" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-0.5">Combo MPT</label>
              <input type="number" min={0} step={0.01} value={data.combo_mpt || ''} onChange={(e) => update({ combo_mpt: e.target.value ? Number(e.target.value) : 0 })} className="w-32 rounded border border-border bg-elevated px-3 py-2 text-primary text-sm" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-0.5">Combo Atom</label>
              <input type="number" min={0} step={0.01} value={data.combo_atom || ''} onChange={(e) => update({ combo_atom: e.target.value ? Number(e.target.value) : 0 })} className="w-32 rounded border border-border bg-elevated px-3 py-2 text-primary text-sm" />
            </div>
          </div>
          <p className="text-teal text-sm">EAUC total: {formatMMK(eaucTotal)} | Combo total: {formatMMK(comboTotal)}</p>
        </div>
      )}

      {/* Step 2: SZNB */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-secondary text-sm">SZNB: MPT, Atom, Kpay Mini App, Kpay QR, Kpay Ecommerce, Wave Money, Dinger</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { k: 'sznb_mpt', l: 'MPT' },
              { k: 'sznb_atom', l: 'Atom' },
              { k: 'sznb_kpay_mini_app', l: 'Kpay Mini' },
              { k: 'sznb_kpay_qr', l: 'Kpay QR' },
              { k: 'sznb_kpay_ecommerce', l: 'Kpay Ecom' },
              { k: 'sznb_wave_money', l: 'Wave Money' },
              { k: 'sznb_dinger', l: 'Dinger' },
            ].map(({ k, l }) => (
              <div key={k}>
                <label className="block text-xs text-muted mb-0.5">{l}</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={data[k as keyof FlatEntry] ?? ''}
                  onChange={(e) => update({ [k]: e.target.value ? Number(e.target.value) : 0 } as Partial<FlatEntry>)}
                  className="w-full rounded border border-border bg-elevated px-3 py-2 text-primary text-sm"
                />
              </div>
            ))}
          </div>
          <p className="text-teal text-sm font-medium">SZNB total: {formatMMK(sznbTotal)}</p>
        </div>
      )}

      {/* Step 3: Flow */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div>
              <label className="block text-sm text-secondary mb-1">MPT</label>
              <input type="number" min={0} step={0.01} value={data.flow_mpt || ''} onChange={(e) => update({ flow_mpt: e.target.value ? Number(e.target.value) : 0 })} className="w-40 rounded-lg border border-border bg-elevated px-4 py-2 text-primary" />
            </div>
            <div>
              <label className="block text-sm text-secondary mb-1">Kpay</label>
              <input type="number" min={0} step={0.01} value={data.flow_kpay || ''} onChange={(e) => update({ flow_kpay: e.target.value ? Number(e.target.value) : 0 })} className="w-40 rounded-lg border border-border bg-elevated px-4 py-2 text-primary" />
            </div>
          </div>
          <p className="text-teal font-medium">Flow Subscription total: {formatMMK(flowTotal)}</p>
        </div>
      )}

      {/* Step 4: International */}
      {step === 4 && (
        <div className="space-y-6">
          <p className="text-secondary text-sm">YouTube: Solution One, FUGA, Believe</p>
          <div className="flex gap-4 flex-wrap">
            <div><label className="block text-xs text-muted mb-0.5">Solution One</label><input type="number" min={0} step={0.01} value={data.youtube_solution_one || ''} onChange={(e) => update({ youtube_solution_one: e.target.value ? Number(e.target.value) : 0 })} className="w-36 rounded border border-border bg-elevated px-3 py-2 text-primary text-sm" /></div>
            <div><label className="block text-xs text-muted mb-0.5">FUGA</label><input type="number" min={0} step={0.01} value={data.youtube_fuga || ''} onChange={(e) => update({ youtube_fuga: e.target.value ? Number(e.target.value) : 0 })} className="w-36 rounded border border-border bg-elevated px-3 py-2 text-primary text-sm" /></div>
            <div><label className="block text-xs text-muted mb-0.5">Believe</label><input type="number" min={0} step={0.01} value={data.youtube_believe || ''} onChange={(e) => update({ youtube_believe: e.target.value ? Number(e.target.value) : 0 })} className="w-36 rounded border border-border bg-elevated px-3 py-2 text-primary text-sm" /></div>
          </div>
          <p className="text-teal text-sm">YouTube total: {formatMMK(youtubeTotal)}</p>
          <p className="text-secondary text-sm">Spotify: FUGA, Believe</p>
          <div className="flex gap-4 flex-wrap">
            <div><label className="block text-xs text-muted mb-0.5">FUGA</label><input type="number" min={0} step={0.01} value={data.spotify_fuga || ''} onChange={(e) => update({ spotify_fuga: e.target.value ? Number(e.target.value) : 0 })} className="w-36 rounded border border-border bg-elevated px-3 py-2 text-primary text-sm" /></div>
            <div><label className="block text-xs text-muted mb-0.5">Believe</label><input type="number" min={0} step={0.01} value={data.spotify_believe || ''} onChange={(e) => update({ spotify_believe: e.target.value ? Number(e.target.value) : 0 })} className="w-36 rounded border border-border bg-elevated px-3 py-2 text-primary text-sm" /></div>
          </div>
          <p className="text-teal text-sm">Spotify total: {formatMMK(spotifyTotal)}</p>
          <p className="text-secondary text-sm">TikTok: FUGA, Believe</p>
          <div className="flex gap-4 flex-wrap">
            <div><label className="block text-xs text-muted mb-0.5">FUGA</label><input type="number" min={0} step={0.01} value={data.tiktok_fuga || ''} onChange={(e) => update({ tiktok_fuga: e.target.value ? Number(e.target.value) : 0 })} className="w-36 rounded border border-border bg-elevated px-3 py-2 text-primary text-sm" /></div>
            <div><label className="block text-xs text-muted mb-0.5">Believe</label><input type="number" min={0} step={0.01} value={data.tiktok_believe || ''} onChange={(e) => update({ tiktok_believe: e.target.value ? Number(e.target.value) : 0 })} className="w-36 rounded border border-border bg-elevated px-3 py-2 text-primary text-sm" /></div>
          </div>
          <p className="text-teal text-sm">TikTok total: {formatMMK(tiktokTotal)}</p>
        </div>
      )}

      {/* Step 5: Review */}
      {step === 5 && (
        <div className="space-y-4">
          <p className="text-secondary text-sm">Month: <strong className="text-primary">{data.month || '—'}</strong></p>
          <ul className="space-y-1 text-sm">
            <li>Ringtune: {formatMMK(ringtuneTotal)}</li>
            <li>EAUC: {formatMMK(eaucTotal)}</li>
            <li>Combo: {formatMMK(comboTotal)}</li>
            <li>SZNB: {formatMMK(sznbTotal)}</li>
            <li>Flow Subscription: {formatMMK(flowTotal)}</li>
            <li>YouTube: {formatMMK(youtubeTotal)}</li>
            <li>Spotify: {formatMMK(spotifyTotal)}</li>
            <li>TikTok: {formatMMK(tiktokTotal)}</li>
          </ul>
          <p className="text-teal text-xl font-bold pt-2">Grand total: {formatMMK(grandTotal)} MMK</p>
          <p className="text-muted text-xs">Saving will upsert all related tables and log to audit.</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8 pt-6 border-t border-border">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="rounded-lg border border-border bg-card px-4 py-2 text-secondary hover:bg-elevated disabled:opacity-50 transition"
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="rounded-lg bg-teal text-background px-4 py-2 font-medium hover:opacity-90 transition"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !data.month}
            className="rounded-lg bg-teal text-background px-4 py-2 font-medium hover:opacity-90 disabled:opacity-50 transition"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>
    </div>
  );
}
