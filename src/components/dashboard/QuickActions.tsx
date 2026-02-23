'use client';

import Link from 'next/link';
import { PlusIcon, FileXlsIcon, ChartLineUpIcon } from '@phosphor-icons/react';
import { usePermissions } from '@/hooks/usePermissions';

export function QuickActions() {
  const perms = usePermissions();
  return (
    <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
      {(perms.isAdmin || perms.can.enterData) && (
        <Link
          href="/entry"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal text-background font-medium py-2 px-4 text-body hover:opacity-90 transition sm:w-auto"
        >
          <PlusIcon weight="duotone" size={18} />
          Add Monthly Data
        </Link>
      )}
      {(perms.isAdmin || perms.can.importExcel) && (
        <Link
          href="/import"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card text-primary font-medium py-2 px-4 text-body hover:bg-elevated transition sm:w-auto"
        >
          <FileXlsIcon weight="duotone" size={18} />
          Import Excel
        </Link>
      )}
      {(perms.isAdmin || perms.can.viewAnalytics) && (
        <Link
          href="/analytics"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card text-primary font-medium py-2 px-4 text-body hover:bg-elevated transition sm:w-auto"
        >
          <ChartLineUpIcon weight="duotone" size={18} />
          View Analytics
        </Link>
      )}
    </div>
  );
}
