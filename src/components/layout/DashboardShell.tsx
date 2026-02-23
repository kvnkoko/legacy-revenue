'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import { SessionIdleProvider } from '@/contexts/SessionIdleProvider';
import type { CurrencyCode } from '@/lib/currency';

export function DashboardShell({
  children,
  initialCurrency = 'MMK',
  initialCurrencyOverrides = {},
  sessionIdleMinutes = 0,
}: {
  children: React.ReactNode;
  initialCurrency?: CurrencyCode;
  initialCurrencyOverrides?: Partial<Record<CurrencyCode, number>>;
  sessionIdleMinutes?: number;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <CurrencyProvider
      initialCurrency={initialCurrency as CurrencyCode}
      initialOverrides={initialCurrencyOverrides}
    >
    <SessionIdleProvider idleMinutes={sessionIdleMinutes}>
    <div className="min-h-screen bg-background md:flex">
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex min-h-screen flex-1 min-w-0 flex-col">
        <Header onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6 max-w-[1400px]">{children}</main>
      </div>
    </div>
    </SessionIdleProvider>
    </CurrencyProvider>
  );
}
