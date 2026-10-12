'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

/**
 * Chooses which months the headline figures cover.
 *
 * The choice lives in the URL rather than in React state, so the page stays
 * server-rendered, the view can be shared or bookmarked, and a figure quoted in
 * a report can be reproduced later from the same link — which matters on an
 * audit platform.
 */
export function PeriodPicker({
  from,
  to,
  latestCompleteMonth,
  presets,
}: {
  from: string;
  to: string;
  /** Used by the "latest complete month" preset. */
  latestCompleteMonth: string | null;
  presets: Array<{ label: string; from: string; to: string }>;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const apply = (nextFrom: string, nextTo: string) => {
    const next = new URLSearchParams(params.toString());
    next.set('from', nextFrom);
    next.set('to', nextTo);
    startTransition(() => router.push(`/dashboard?${next.toString()}`));
  };

  const active = (p: { from: string; to: string }) => p.from === from && p.to === to;

  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => apply(p.from, p.to)}
            disabled={pending}
            aria-pressed={active(p)}
            className={`rounded-lg border px-3 py-1.5 text-caption font-medium transition-colors disabled:opacity-60 ${
              active(p)
                ? 'border-gold/50 bg-gold/10 text-gold'
                : 'border-border bg-card text-secondary hover:bg-elevated hover:text-primary'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-micro uppercase tracking-[0.08em] text-secondary">From month</span>
          <input
            type="month"
            value={from.slice(0, 7)}
            max={to.slice(0, 7)}
            onChange={(e) => e.target.value && apply(`${e.target.value}-01`, to)}
            className="rounded-lg border border-border bg-elevated px-2.5 py-1.5 text-caption text-primary"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-micro uppercase tracking-[0.08em] text-secondary">To month</span>
          <input
            type="month"
            value={to.slice(0, 7)}
            min={from.slice(0, 7)}
            onChange={(e) => e.target.value && apply(from, `${e.target.value}-01`)}
            className="rounded-lg border border-border bg-elevated px-2.5 py-1.5 text-caption text-primary"
          />
        </label>
        {latestCompleteMonth && (
          <button
            type="button"
            onClick={() => apply(latestCompleteMonth, latestCompleteMonth)}
            disabled={pending}
            className="rounded-lg border border-border px-3 py-1.5 text-caption text-secondary transition-colors hover:bg-elevated hover:text-primary disabled:opacity-60"
          >
            Reset
          </button>
        )}
      </div>
      {pending && <span className="text-caption text-secondary">Updating…</span>}
    </div>
  );
}
