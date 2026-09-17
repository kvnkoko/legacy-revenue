'use client';

/**
 * Last-resort boundary. Without this file, any error thrown while rendering the
 * root layout produced a completely blank white page with no way to recover —
 * the "the site is just blank" reports. Deliberately dependency-free (no fonts,
 * no Tailwind classes that might not have loaded, no network calls) so it can
 * still render when almost everything else has failed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: '#0f1319',
          color: '#f0f4ff',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        }}
      >
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <p style={{ fontSize: 13, letterSpacing: '0.08em', color: '#d4af37', margin: 0 }}>
            LEGACY REVENUE
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '12px 0 0' }}>
            The page could not load
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: '#8892a4', margin: '12px 0 0' }}>
            Something went wrong on our side. Your data is safe and nothing was
            changed. Please try again.
          </p>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: '#8892a4', margin: '12px 0 0' }}>
            If this keeps happening, check your internet connection, then tell
            your admin.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 24,
              padding: '10px 20px',
              fontSize: 15,
              fontWeight: 600,
              color: '#0f1319',
              background: '#d4af37',
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          {error?.digest && (
            <p style={{ fontSize: 12, color: '#5d6675', marginTop: 20 }}>
              Error code: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
