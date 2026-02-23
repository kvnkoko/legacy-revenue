'use client';

import Link from 'next/link';
import { LockSimpleIcon } from '@phosphor-icons/react';
import type { UserProfile } from '@/lib/authz/types';

export function AccessDenied({
  permissionName,
  profile,
  message,
}: {
  permissionName?: string;
  profile?: UserProfile | null;
  message?: string;
}) {
  const contactEmail = profile?.email ?? 'admin@legacy.local';
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-amber/50 bg-amber/10 text-amber">
        <LockSimpleIcon size={24} weight="duotone" />
      </div>
      <h2 className="text-title font-semibold text-primary">Access Restricted</h2>
      <p className="mx-auto mt-2 max-w-xl text-body text-secondary">
        {message ??
          `You don't have permission to access this section. ${
            permissionName ? `${permissionName} is required.` : ''
          } Contact your administrator if you need access.`}
      </p>
      <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
        <Link
          href="/dashboard"
          className="rounded-lg border border-border px-4 py-2 text-body text-primary hover:bg-elevated"
        >
          ← Back to Dashboard
        </Link>
        <a
          href={`mailto:${contactEmail}?subject=Access%20Request&body=Hello%2C%20I%20need%20access%20to%20${encodeURIComponent(
            permissionName ?? 'this section'
          )}.`}
          className="rounded-lg bg-teal px-4 py-2 text-body font-medium text-background hover:opacity-90"
        >
          Contact Admin →
        </a>
      </div>
    </div>
  );
}
