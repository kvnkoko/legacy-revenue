'use client';

import { ArrowClockwiseIcon, WarningCircleIcon } from '@phosphor-icons/react';

/**
 * Scoped to the dashboard group, so a failure in one page (a chart, a query)
 * leaves the sidebar and header working instead of blanking the whole portal.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
          <WarningCircleIcon size={26} weight="duotone" className="text-amber-400" />
        </div>
        <h1 className="mt-4 text-title font-bold text-primary">This section could not load</h1>
        <p className="mt-3 text-body leading-relaxed text-secondary">
          Something went wrong while loading this page. Your data is safe — nothing
          was changed or deleted.
        </p>
        <p className="mt-3 text-body leading-relaxed text-secondary">
          Press <span className="font-semibold text-primary">Try again</span>. If it
          still does not work, use the menu to open another page, or tell your admin.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gold px-5 py-2.5 text-body font-semibold text-background transition-opacity hover:opacity-90"
        >
          <ArrowClockwiseIcon size={17} weight="bold" />
          Try again
        </button>
        {error?.digest && (
          <p className="mt-5 text-micro text-muted">Error code: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
