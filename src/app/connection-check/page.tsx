'use client';

import { useEffect, useState } from 'react';

/**
 * Public connection test, for diagnosing access problems from a staff machine
 * (reported from Myanmar). It answers the one question we cannot answer from
 * here: WHICH host their network refuses.
 *
 * Deliberately public (see the middleware allowlist) because someone who
 * cannot sign in must still be able to open it. It exposes nothing sensitive:
 * the Supabase URL is already in the public browser bundle, no credentials are
 * sent, and every request here is an unauthenticated reachability ping that
 * returns "no API key" by design.
 */

type Result = { label: string; state: 'pending' | 'ok' | 'fail'; detail: string; meaning: string };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const BUILD = process.env.NEXT_PUBLIC_BUILD_SHA ?? 'unknown';

export default function ConnectionCheck() {
  const [results, setResults] = useState<Result[]>([
    {
      label: 'This website',
      state: 'pending',
      detail: '',
      meaning: 'If you can read this page at all, the website itself is reachable.',
    },
    {
      label: 'Database through this website',
      state: 'pending',
      detail: '',
      meaning: 'This is the path the app now uses. It must work for signing in to work.',
    },
    {
      label: 'Database directly',
      state: 'pending',
      detail: '',
      meaning: 'The old path. It is normal and fine for this one to fail.',
    },
  ]);

  useEffect(() => {
    let cancelled = false;
    const update = (i: number, patch: Partial<Result>) =>
      setResults((prev) => (cancelled ? prev : prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r))));

    const ping = async (i: number, url: string) => {
      const started = Date.now();
      try {
        const res = await fetch(url, { cache: 'no-store' });
        // 401 "no API key" is the expected healthy answer for these pings.
        update(i, { state: 'ok', detail: `reached in ${Date.now() - started} ms (status ${res.status})` });
      } catch (e) {
        update(i, { state: 'fail', detail: e instanceof Error ? e.message : 'could not connect' });
      }
    };

    update(0, { state: 'ok', detail: 'this page loaded' });
    void ping(1, '/sb/auth/v1/health');
    if (SUPABASE_URL) void ping(2, `${SUPABASE_URL}/auth/v1/health`);
    else update(2, { state: 'fail', detail: 'not configured' });

    return () => {
      cancelled = true;
    };
  }, []);

  const site = results[0];
  const viaSite = results[1];
  const direct = results[2];

  const verdict =
    viaSite.state === 'pending'
      ? 'Checking…'
      : viaSite.state === 'ok'
        ? 'Good news: this computer can reach everything the portal needs. If signing in still fails, the browser is probably using an old saved copy of the app — hold Shift and press the reload button, or clear this site’s data, then try again.'
        : site.state === 'ok'
          ? 'This computer can open the website but cannot reach the database through it. Please send this whole page to your admin — it means the portal needs to be moved to a different address.'
          : 'This computer cannot reach the website at all.';

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="text-title font-bold text-primary">Connection check</h1>
      <p className="mt-1 text-body text-secondary">
        This page tests whether your internet connection can reach the parts of the portal. You do
        not need to sign in. Nothing here changes any data.
      </p>

      <div className="mt-6 rounded-2xl border border-gold/40 bg-gold/[0.06] p-4">
        <p className="text-caption font-semibold uppercase tracking-[0.08em] text-secondary">What this means</p>
        <p className="mt-1.5 text-body leading-relaxed text-primary">{verdict}</p>
      </div>

      <ul className="mt-6 space-y-3">
        {results.map((r) => (
          <li key={r.label} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                  r.state === 'ok' ? 'bg-gold' : r.state === 'fail' ? 'bg-danger' : 'bg-muted'
                }`}
              />
              <span className="text-body font-semibold text-primary">{r.label}</span>
              <span className="ml-auto text-caption text-secondary">
                {r.state === 'pending' ? 'checking…' : r.state === 'ok' ? 'reached' : 'could not reach'}
              </span>
            </div>
            {r.detail && <p className="mt-1.5 break-words text-caption text-secondary">{r.detail}</p>}
            <p className="mt-1 text-micro leading-relaxed text-muted">{r.meaning}</p>
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-2xl border border-border bg-elevated p-4 text-caption text-secondary">
        <p>
          <span className="font-medium text-primary">App version:</span>{' '}
          <span className="break-all font-mono">{BUILD}</span>
        </p>
        <p className="mt-1.5">
          Please include this version when reporting a problem. If it does not match the newest
          version, your browser is showing an old saved copy of the app.
        </p>
        <p className="mt-3">
          Tested from: <span className="break-all font-mono">{typeof window !== 'undefined' ? window.location.origin : ''}</span>
        </p>
      </div>

      <a href="/login" className="mt-6 inline-block text-body font-medium text-gold underline">
        Go to sign in
      </a>
      {direct.state === 'fail' && viaSite.state === 'ok' && (
        <p className="mt-4 text-caption text-muted">
          Note: &ldquo;Database directly&rdquo; failing while the middle test passes is exactly what we
          expect — it means the fix is working as designed.
        </p>
      )}
    </main>
  );
}
