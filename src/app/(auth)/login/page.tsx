'use client';

import { useState, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

const inputClass =
  'w-full rounded-lg border border-border bg-elevated px-3.5 py-2.5 text-body text-primary placeholder-muted focus:border-gold focus:ring-1 focus:ring-gold outline-none transition';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/dashboard';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    let err: { message: string } | null = null;
    try {
      const supabase = createClient();
      ({ error: err } = await supabase.auth.signInWithPassword({ email, password }));
    } catch (thrown) {
      err = { message: thrown instanceof Error ? thrown.message : 'Sign in failed' };
    }
    setLoading(false);
    if (err) {
      // "Failed to fetch" / "NetworkError" means the browser could not reach
      // the server at all — usually the network or connection, not a wrong
      // password. Staff were shown the raw text and understandably read it as
      // the portal being broken.
      const raw = err.message ?? '';
      // Also catches the JSON-parse error the client throws when it receives an
      // error page instead of a JSON reply ("Unexpected token 'I', "Internal
      // S"... is not valid JSON"), which is a server/connection problem too.
      const isNetwork =
        /failed to fetch|networkerror|load failed|fetch failed|timeout|err_|is not valid json|unexpected token|<!doctype/i.test(
          raw
        );
      setError(
        isNetwork
          ? 'We could not reach the server. Please check your internet connection and try again. If other websites work but this keeps failing, tell your admin — your network may be blocking it.'
          : /invalid login credentials/i.test(raw)
            ? 'That email or password is not correct. Please try again.'
            : raw
      );
      return;
    }
    router.push(redirect);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-[400px]">
        <div className="rounded-xl border border-border bg-card p-6 shadow-glow-gold">
          <div className="text-center mb-6">
            <div className="relative mx-auto mb-4 h-10 w-[220px] max-w-full sm:h-11 sm:w-[240px]">
              <Image
                src="/Horizontal%20Logo,%20White%202.png"
                alt="Legacy Revenue"
                width={240}
                height={44}
                className="absolute inset-0 mx-auto h-full w-auto object-contain theme-logo-dark"
                priority
              />
              <Image
                src="/Horizontal%20Logo%20Black.png"
                alt="Legacy Revenue"
                width={240}
                height={44}
                className="absolute inset-0 mx-auto h-full w-auto object-contain theme-logo-light"
                priority
              />
            </div>
            <p className="text-body text-secondary mt-1">Sign in to the finance portal</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {searchParams.get('message') && (
              <div className="rounded-lg bg-gold/10 border border-gold/30 text-gold text-body px-3.5 py-2.5">
                {decodeURIComponent(searchParams.get('message') ?? '')}
              </div>
            )}
            {error && (
              <div className="rounded-lg bg-danger/10 border border-danger/30 text-danger text-body px-3.5 py-2.5">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-caption font-medium text-secondary mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className={inputClass}
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-caption font-medium text-secondary mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-gold text-background font-semibold py-2.5 px-4 text-body hover:opacity-90 focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 transition"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <p className="mt-5 text-center text-caption text-secondary">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-gold hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-body text-secondary">Loading…</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
