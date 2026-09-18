'use client';

import { InfoIcon, LightbulbFilamentIcon } from '@phosphor-icons/react';

/**
 * Plain-language layer for the analytics page.
 *
 * Two rules drive everything here, because much of the team reads English as a
 * second language:
 * Pure number helpers live in src/lib/plain-language.ts instead, because the
 * Overview page renders on the server and cannot call functions exported from
 * a 'use client' module.
 *
 *  1. No idioms and no analyst jargon. "Momentum", "concentration",
 *     "seasonality", "deep dive", "heating up", "under the hood" and "YoY" all
 *     fail for a non-native reader. Short sentences and common words instead.
 *  2. A chart is not useful until it says what it *means*. Every card states
 *     the answer in words, computed from the real numbers, so the page supports
 *     a decision instead of just displaying a shape.
 */

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
