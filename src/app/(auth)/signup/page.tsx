'use client';

import { useState } from 'react';
import { signUpIfInvited } from './actions';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

const inputClass =
  'w-full rounded-lg border border-border bg-elevated px-3.5 py-2.5 text-body text-primary placeholder-muted focus:border-teal focus:ring-1 focus:ring-teal outline-none transition';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signUpIfInvited({
      email,
      password,
      fullName,
      username,
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
    setTimeout(() => router.push('/login?message=Account+created.+Please+sign+in.'), 2000);
    router.refresh();
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="rounded-xl border border-border bg-card p-6 text-center max-w-[400px]">
          <p className="text-body font-semibold text-teal">Account created</p>
          <p className="text-caption text-secondary mt-1">Redirecting to sign in…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-[400px]">
        <div className="rounded-xl border border-border bg-card p-6 shadow-glow-teal">
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
            <p className="text-body text-secondary mt-1">Create your account</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-danger/10 border border-danger/30 text-danger text-body px-3.5 py-2.5">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="full-name" className="block text-caption font-medium text-secondary mb-1.5">
                Full name
              </label>
              <input
                id="full-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
                className={inputClass}
                placeholder="Your name"
              />
            </div>
            <div>
              <label htmlFor="username" className="block text-caption font-medium text-secondary mb-1.5">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className={inputClass}
                placeholder="your_username"
              />
            </div>
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
                minLength={6}
                autoComplete="new-password"
                className={inputClass}
                placeholder="Min. 6 characters"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-teal text-background font-semibold py-2.5 px-4 text-body hover:opacity-90 focus:ring-2 focus:ring-teal focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 transition"
            >
              {loading ? 'Creating account…' : 'Sign up'}
            </button>
          </form>
          <p className="mt-5 text-center text-caption text-secondary">
            Already have an account?{' '}
            <Link href="/login" className="text-teal hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
