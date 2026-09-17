'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowClockwiseIcon, LockSimpleIcon, WarningCircleIcon, XIcon } from '@phosphor-icons/react';
import { useAuthzContext } from '@/components/authz/AuthzProvider';
import { ROLE_LABELS } from '@/lib/authz/types';

/**
 * Two things used to fail silently and both looked like "my role is broken":
 *  1. Being redirected away from a page you cannot open (?denied=…) landed you
 *     on the dashboard with no explanation at all.
 *  2. A failed permission lookup quietly downgraded you to viewer, so tabs
 *     vanished with no error.
 * This surfaces both, in plain language, and says what to do next.
 */

const DENIED_LABELS: Record<string, string> = {
  users: 'User Management',
  settings: 'Admin Settings',
  audit: 'the Audit Log',
  streams: 'Stream Management',
};

export function AccessNotice() {
  const { profileError, refreshProfile, role, loading } = useAuthzContext();
  const searchParams = useSearchParams();
  const denied = searchParams.get('denied');
  const [dismissed, setDismissed] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // A new redirect should always be shown, even if a previous one was closed.
  useEffect(() => {
    setDismissed(false);
  }, [denied]);

  if (profileError) {
    return (
      <Banner
        tone="error"
        icon={<WarningCircleIcon size={20} weight="duotone" className="text-red-400" />}
        title="We could not check your access level"
        onDismiss={undefined}
      >
        <p>
          Some sections may be missing from your menu right now. This is a
          connection problem, not a change to your account.
        </p>
        <button
          type="button"
          disabled={retrying}
          onClick={async () => {
            setRetrying(true);
            await refreshProfile();
            setRetrying(false);
          }}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 font-medium text-primary transition-colors hover:bg-elevated disabled:opacity-60"
        >
          <ArrowClockwiseIcon size={14} weight="bold" />
          {retrying ? 'Checking…' : 'Check again'}
        </button>
      </Banner>
    );
  }

  if (denied && !dismissed && !loading) {
    const what = DENIED_LABELS[denied] ?? 'that page';
    return (
      <Banner
        tone="warn"
        icon={<LockSimpleIcon size={20} weight="duotone" className="text-amber-400" />}
        title={`You do not have access to ${what}`}
        onDismiss={() => setDismissed(true)}
      >
        <p>
          Your account level is{' '}
          <span className="font-semibold text-primary">{ROLE_LABELS[role] ?? role}</span>, which
          does not include this page, so we brought you back here. If you need
          it for your work, ask an admin to change your access level.
        </p>
      </Banner>
    );
  }

  return null;
}

function Banner({
  tone,
  icon,
  title,
  children,
  onDismiss,
}: {
  tone: 'warn' | 'error';
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  const ring = tone === 'error' ? 'border-red-500/40 bg-red-500/10' : 'border-amber-500/40 bg-amber-500/10';
  return (
    <div className={`mb-4 flex items-start gap-3 rounded-xl border p-3.5 ${ring}`} role="status">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1 text-caption text-secondary">
        <p className="text-body font-semibold text-primary">{title}</p>
        <div className="mt-1 space-y-1 leading-relaxed">{children}</div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="shrink-0 rounded-md p-1 text-secondary transition-colors hover:bg-elevated hover:text-primary"
        >
          <XIcon size={15} weight="bold" />
        </button>
      )}
    </div>
  );
}
