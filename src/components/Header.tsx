'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { CurrencyCircleDollarIcon, ListIcon, MoonIcon, SignOutIcon, SunIcon } from '@phosphor-icons/react';
import Link from 'next/link';
import { useCurrency } from '@/contexts/CurrencyContext';

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { displayCurrency } = useCurrency();
  const [user, setUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'light' ? 'light' : 'dark');
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }, [supabase.auth, router]);

  const toggleTheme = useCallback(() => {
    const next: 'light' | 'dark' = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  }, [theme]);

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-3 sm:px-4 md:px-6 shrink-0">
      <div className="text-body text-secondary">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex items-center justify-center rounded-lg p-2 text-secondary hover:bg-elevated hover:text-primary md:hidden"
            aria-label="Open navigation menu"
          >
            <ListIcon weight="duotone" size={20} />
          </button>
          {user?.email && <span className="text-primary font-medium max-w-[180px] truncate sm:max-w-none">{user.email}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/settings"
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-caption text-secondary hover:bg-elevated hover:text-primary transition-colors"
          title="Display currency (change in Settings)"
        >
          <CurrencyCircleDollarIcon weight="duotone" size={18} />
          <span>{displayCurrency}</span>
        </Link>
        <button
          type="button"
          onClick={toggleTheme}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-body text-secondary hover:bg-elevated hover:text-primary transition-colors"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <SunIcon weight="duotone" size={18} /> : <MoonIcon weight="duotone" size={18} />}
          <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
        <button
          type="button"
          onClick={signOut}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-body text-secondary hover:bg-elevated hover:text-primary transition-colors"
        >
          <SignOutIcon weight="duotone" size={18} />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
