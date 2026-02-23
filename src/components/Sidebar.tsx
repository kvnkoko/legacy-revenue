'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import {
  ChartBarIcon,
  CurrencyCircleDollarIcon,
  PencilSimpleLineIcon,
  FileXlsIcon,
  ChartPieSliceIcon,
  ScrollIcon,
  GearIcon,
  UsersThreeIcon,
  SignOutIcon,
} from '@phosphor-icons/react';

export function Sidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const [months, setMonths] = useState<string[]>([]);
  const perms = usePermissions();
  const supabase = createClient();

  useEffect(() => {
    supabase.from('revenue_summary').select('month').order('month', { ascending: true }).then(({ data }) => {
      setMonths((data ?? []).map((m) => m.month as string));
    });
  }, [supabase]);

  const hasGap = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const start = new Date(2025, 0, 1);
    const existing = new Set(months);
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-01`;
      if (!existing.has(key)) return true;
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return false;
  }, [months]);

  const nav = useMemo(() => {
    const items = [
      { href: '/dashboard', label: 'Overview', Icon: ChartBarIcon, show: true },
      { href: '/streams', label: 'Revenue Streams', Icon: CurrencyCircleDollarIcon, show: perms.can.viewStreams || perms.isAdmin },
      { href: '/analytics', label: 'Analytics', Icon: ChartPieSliceIcon, show: perms.can.viewAnalytics || perms.isAdmin },
      { href: '/entry', label: 'Data Entry', Icon: PencilSimpleLineIcon, show: perms.can.enterData || perms.isAdmin },
      { href: '/import', label: 'Import Excel', Icon: FileXlsIcon, show: perms.can.importExcel || perms.isAdmin },
      { href: '/history', label: 'History', Icon: ScrollIcon, show: perms.can.viewStreams || perms.isAdmin },
      { href: '/admin/users', label: 'User Management', Icon: UsersThreeIcon, show: perms.can.manageUsers || perms.isAdmin },
      { href: '/audit', label: 'Audit Log', Icon: ScrollIcon, show: perms.can.viewAuditLog || perms.isAdmin },
      { href: '/settings', label: 'Settings', Icon: GearIcon, show: true },
      { href: '/admin/settings', label: 'Admin Settings', Icon: GearIcon, show: perms.isAdmin },
    ];
    return items.filter((item) => item.show);
  }, [perms]);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const initials = useMemo(() => {
    const fullName = perms.profile?.full_name ?? perms.profile?.email ?? 'U';
    return fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }, [perms.profile?.full_name, perms.profile?.email]);

  return (
    <>
      <button
        type="button"
        aria-label="Close mobile menu overlay"
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-black/40 transition-opacity md:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      />
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-border bg-card transition-transform md:sticky md:top-0 md:z-auto md:h-screen md:w-60 md:translate-x-0 md:self-start',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
      <div className="border-b border-border px-3 py-3 md:px-4 md:py-4">
        <Link
          href="/dashboard"
          className="block rounded-lg px-2.5 py-2.5 hover:bg-elevated/70 transition-colors"
          onClick={onClose}
        >
          <div className="relative h-11 w-full md:h-12">
            <Image
              src="/Horizontal%20Logo,%20White%202.png"
              alt="Legacy Revenue"
              fill
              sizes="240px"
              className="object-contain object-left theme-logo-dark"
              priority
            />
            <Image
              src="/Horizontal%20Logo%20Black.png"
              alt="Legacy Revenue"
              fill
              sizes="240px"
              className="object-contain object-left theme-logo-light"
              priority
            />
          </div>
        </Link>
      </div>
      <nav className="p-3 flex-1 overflow-y-auto min-h-0" aria-label="Main">
        <p className="px-2 pb-2 text-micro uppercase tracking-wide text-muted">Navigation</p>
        <ul className="space-y-1">
          {nav.map(({ href, label, Icon }) => {
            const isActive =
              pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-body font-medium transition-colors',
                    isActive
                      ? 'bg-teal/10 text-teal border border-teal/40'
                      : 'text-secondary hover:bg-elevated hover:text-primary border border-transparent'
                  )}
                >
                  <Icon weight="duotone" size={20} className="shrink-0" />
                  <span className="whitespace-nowrap">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        {hasGap && (
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-caption font-semibold text-amber-300">Gap Detected</p>
            <p className="mt-1 text-micro text-amber-200/90">
              Missing month entries found before last month.
            </p>
            <Link
              href="/entry"
              onClick={onClose}
              className="mt-2 inline-block text-caption font-medium text-amber-200 underline underline-offset-2"
            >
              Review in Data Entry
            </Link>
          </div>
        )}
      </nav>
      <div className="mt-auto shrink-0 border-t border-border p-3">
        <div className="rounded-lg border border-border bg-elevated p-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-teal/15 text-teal flex items-center justify-center text-caption font-semibold">
              {initials || 'U'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-caption font-medium text-primary">{perms.profile?.full_name ?? perms.profile?.email ?? 'User'}</p>
              <p className="text-micro text-secondary">{perms.role === 'admin' ? 'Admin' : 'Staff'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="mt-2 inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-caption text-secondary hover:bg-card"
          >
            <SignOutIcon size={14} />
            Sign Out
          </button>
        </div>
      </div>
      </aside>
    </>
  );
}
