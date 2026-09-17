'use client';

/**
 * Catches render/data errors in any page that is not inside the dashboard
 * shell (login, signup, landing). Keeps the app from ever showing a blank page.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md text-center">
        <p className="text-micro uppercase tracking-widest text-gold">Legacy Revenue</p>
        <h1 className="mt-3 text-title font-bold text-primary">This page could not load</h1>
        <p className="mt-3 text-body leading-relaxed text-secondary">
          Something went wrong. Your data is safe and nothing was changed.
          Please try again.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 rounded-lg bg-gold px-5 py-2.5 text-body font-semibold text-background transition-opacity hover:opacity-90"
        >
          Try again
        </button>
        {error?.digest && (
          <p className="mt-5 text-micro text-muted">Error code: {error.digest}</p>
        )}
      </div>
    </main>
  );
}
