'use client';

import { useState, useTransition } from 'react';
import type { User } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { resetPortalData, updateCurrencyPreference, updateMyPassword, updateProfileInfo } from '@/app/(dashboard)/settings/actions';
import { CURRENCIES, type CurrencyCode } from '@/lib/currency';
import { ConfirmDialog } from '@/components/ui/dialog/ConfirmDialog';

export function SettingsForm({
  user,
  initialName,
  initialUsername,
  initialCurrency = 'MMK',
  initialCurrencyOverrides = {},
  role,
}: {
  user: User;
  initialName: string;
  initialUsername: string;
  initialCurrency?: string;
  initialCurrencyOverrides?: Record<string, number>;
  role: 'admin' | 'staff';
}) {
  const [currency, setCurrency] = useState<CurrencyCode>((initialCurrency as CurrencyCode) ?? 'MMK');
  const [currencyOverrides, setCurrencyOverrides] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    Object.entries(initialCurrencyOverrides ?? {}).forEach(([k, v]) => {
      out[k] = String(v);
    });
    return out;
  });
  const [notifyOnEntry, setNotifyOnEntry] = useState(true);
  const [themePreference, setThemePreference] = useState<'system' | 'dark' | 'light'>('system');
  const [fullName, setFullName] = useState(initialName);
  const [username, setUsername] = useState(initialUsername);
  const [newPassword, setNewPassword] = useState('');
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSaveProfile() {
    startTransition(async () => {
      try {
        await updateProfileInfo({ fullName, username });
        toast.success('Profile updated');
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update profile');
      }
    });
  }

  function handleUpdatePassword() {
    if (!newPassword) {
      toast.error('Enter a new password');
      return;
    }
    startTransition(async () => {
      try {
        await updateMyPassword({ newPassword });
        setNewPassword('');
        toast.success('Password updated');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update password');
      }
    });
  }

  function handleSaveCurrency() {
    startTransition(async () => {
      try {
        const overrides: Record<string, number> = {};
        Object.entries(currencyOverrides).forEach(([k, v]) => {
          const n = parseFloat(v);
          if (!Number.isNaN(n) && n > 0) overrides[k] = n;
        });
        await updateCurrencyPreference({ displayCurrency: currency, currencyOverrides: overrides });
        toast.success('Currency preference saved');
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to save currency');
      }
    });
  }

  const setOverride = (code: CurrencyCode, value: string) => {
    setCurrencyOverrides((prev) => {
      const next = { ...prev };
      if (!value.trim()) delete next[code];
      else next[code] = value;
      return next;
    });
  };

  function handleResetAllData() {
    startTransition(async () => {
      try {
        await resetPortalData();
        toast.success('All portal data cleared. You can now import fresh data.');
        router.push('/import');
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to reset portal data');
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-8">
      <section>
        <h2 className="text-body font-semibold text-primary mb-4">Profile</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-caption text-secondary mb-1">Email</label>
            <p className="text-primary font-medium">{user.email ?? '—'}</p>
          </div>
          <div>
            <label className="block text-caption text-secondary mb-1">Full name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-primary"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="block text-caption text-secondary mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-primary"
              placeholder="your_username"
            />
          </div>
          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={isPending}
            className="w-full rounded-lg bg-teal px-4 py-2 text-body font-medium text-background disabled:opacity-50 sm:w-auto"
          >
            {isPending ? 'Saving…' : 'Save Profile'}
          </button>
          <p className="text-muted text-caption">Your profile updates are reflected across audit trails and team administration screens.</p>
        </div>
      </section>
      <section>
        <h2 className="text-body font-semibold text-primary mb-4">Preferences</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-caption text-secondary mb-1">Display currency</label>
            <p className="text-micro text-muted mb-2">All monetary values in your portal will be shown in this currency. Your choice does not affect other users.</p>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="rounded-lg border border-border bg-elevated px-3 py-2 text-primary w-full sm:w-auto"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol} {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-lg border border-border bg-elevated/50 p-3">
            <label className="block text-caption font-medium text-secondary mb-1">Currency rate overrides (optional)</label>
            <p className="text-micro text-muted mb-2">Override exchange rates (MMK per 1 unit) if the live rate is incorrect. Example: 1 THB = 60 MMK → enter 60.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {CURRENCIES.filter((c) => c.code !== 'MMK').map((c) => (
                <div key={c.code} className="flex items-center gap-2">
                  <label className="text-micro text-secondary w-12 shrink-0">{c.code}</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="e.g. 60"
                    value={currencyOverrides[c.code] ?? ''}
                    onChange={(e) => setOverride(c.code as CurrencyCode, e.target.value)}
                    className="flex-1 rounded border border-border bg-card px-3 py-2 text-body text-primary placeholder:text-muted"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleSaveCurrency}
              disabled={isPending}
              className="mt-3 rounded-lg bg-teal px-4 py-2 text-caption font-medium text-background disabled:opacity-50"
            >
              {isPending ? 'Saving…' : 'Save Currency'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="notify"
              checked={notifyOnEntry}
              onChange={(e) => setNotifyOnEntry(e.target.checked)}
              className="rounded border-border text-teal focus:ring-teal"
            />
            <label htmlFor="notify" className="text-body text-secondary">
              Notify when monthly data is entered (placeholder; integrate with email later)
            </label>
          </div>
          <div>
            <label className="block text-caption text-secondary mb-1">Theme preference (placeholder)</label>
            <select
              value={themePreference}
              onChange={(e) => setThemePreference(e.target.value as 'system' | 'dark' | 'light')}
              className="rounded-lg border border-border bg-elevated px-3 py-2 text-primary"
            >
              <option value="system">System</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
        </div>
      </section>
      <section>
        <h2 className="text-body font-semibold text-primary mb-4">Security</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-caption text-secondary mb-1">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-primary"
              placeholder="At least 8 characters"
            />
          </div>
          <button
            type="button"
            onClick={handleUpdatePassword}
            disabled={isPending}
            className="w-full rounded-lg border border-border px-4 py-2 text-body text-primary hover:bg-elevated disabled:opacity-50 sm:w-auto"
          >
            Update Password
          </button>
        </div>
      </section>
      {role === 'admin' && (
        <section className="rounded-lg border border-border bg-elevated/50 p-4 space-y-3">
          <h2 className="text-body font-semibold text-primary">Admin Controls</h2>
          <p className="text-caption text-secondary">
            Organization defaults, session policy, audit retention, and data entry rules are available in Admin Settings.
          </p>
          <a href="/admin/settings" className="inline-block rounded-lg border border-border px-3 py-2 text-caption text-primary hover:bg-card">
            Open Admin Settings
          </a>
        </section>
      )}
      <section className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
        <h2 className="text-body font-semibold text-red-300 mb-2">Danger Zone</h2>
        <p className="text-caption text-secondary mb-4">
          Reset all stored financial data and clear import artifacts so you can start from a fresh state.
        </p>
        <button
          type="button"
          onClick={() => setConfirmResetOpen(true)}
          disabled={isPending}
          className="w-full rounded-lg border border-red-400/50 bg-red-500/10 px-4 py-2 text-body font-medium text-red-200 hover:bg-red-500/20 disabled:opacity-50 sm:w-auto"
        >
          {isPending ? 'Resetting…' : 'Reset All Data'}
        </button>
      </section>
      <ConfirmDialog
        open={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        onConfirm={handleResetAllData}
        title="Reset all portal data"
        message="This will permanently delete all portal data and clear import artifacts. This action cannot be undone."
        confirmText="Reset All Data"
      />
    </div>
  );
}
