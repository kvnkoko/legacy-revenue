'use client';

import { InfoIcon, LightbulbFilamentIcon } from '@phosphor-icons/react';

/**
 * Plain-language layer for the analytics page.
 *
 * Two rules drive everything here, because much of the team reads English as a
 * second language:
 *  1. No idioms and no analyst jargon. "Momentum", "concentration",
 *     "seasonality", "deep dive", "heating up", "under the hood" and "YoY" all
 *     fail for a non-native reader. Short sentences and common words instead.
 *  2. A chart is not useful until it says what it *means*. Every card states
 *     the answer in words, computed from the real numbers, so the page supports
 *     a decision instead of just displaying a shape.
 */

/** Money as words: 482,238,452 → "482.2 million". Clearer than "482.2M". */
export function plainMoney(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)} billion`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)} million`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(0)} thousand`;
  return `${sign}${Math.round(abs)}`;
}

/** "grew by 12%" / "fell by 8%" / "stayed about the same" — no jargon. */
export function plainChange(pct: number): string {
  const rounded = Math.round(Math.abs(pct));
  if (rounded < 2) return 'stayed about the same';
  return `${pct > 0 ? 'grew' : 'fell'} by ${rounded}%`;
}

/**
 * The explanation shown under a chart.
 * `shows` = what the picture is, in one short sentence.
 * `means` = the takeaway from this data, for planning. Optional.
 */
export function Explain({ shows, means }: { shows: string; means?: string }) {
  return (
    <div className="mt-4 space-y-2 border-t border-border pt-3">
      <p className="flex gap-2 text-caption leading-relaxed text-secondary">
        <InfoIcon size={15} weight="duotone" className="mt-0.5 shrink-0 text-secondary" />
        <span>{shows}</span>
      </p>
      {means && (
        <p className="flex gap-2 text-caption leading-relaxed text-primary">
          <LightbulbFilamentIcon size={15} weight="duotone" className="mt-0.5 shrink-0 text-gold" />
          <span>{means}</span>
        </p>
      )}
    </div>
  );
}
