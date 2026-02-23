'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { updateAppSettings } from '@/app/(dashboard)/admin/settings/actions';
import { PermissionsMatrix } from '@/components/admin/users/PermissionsMatrix';
import { STAFF_DEFAULT_PERMISSIONS } from '@/lib/permission-presets';
import type { PermissionMap } from '@/lib/authz/types';

type PanelId = 'organization' | 'permissions' | 'session' | 'data-entry';

const PANELS: { id: PanelId; title: string; description: string }[] = [
  {
    id: 'organization',
    title: 'Organization Settings',
    description: 'Company name, logo URL, and timezone.',
  },
  {
    id: 'permissions',
    title: 'Default Permissions',
    description: 'Configure default staff permissions for new invites.',
  },
  {
    id: 'session',
    title: 'Session & Audit Policy',
    description: 'Set session timeout and audit-log retention policy.',
  },
  {
    id: 'data-entry',
    title: 'Data Entry Rules',
    description: 'Configure duplicate-month confirmation behavior.',
  },
];

const TIMEZONES = [
  { value: 'Asia/Yangon', label: 'Asia/Yangon (Myanmar)' },
  { value: 'Asia/Bangkok', label: 'Asia/Bangkok (Thailand)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore' },
  { value: 'America/New_York', label: 'America/New_York' },
  { value: 'Europe/London', label: 'Europe/London' },
  { value: 'UTC', label: 'UTC' },
];

const DUPLICATE_BEHAVIORS = [
  { value: 'allow', label: 'Allow overwrite', description: 'Overwrite existing month data without confirmation' },
  { value: 'confirm', label: 'Require confirmation', description: 'Show a confirmation dialog before overwriting' },
  { value: 'block', label: 'Block overwrite', description: 'Prevent overwriting; only allow new months' },
] as const;

function normalizePermissions(raw: unknown): PermissionMap {
  if (!raw || typeof raw !== 'object') return { ...STAFF_DEFAULT_PERMISSIONS };
  const map = raw as Record<string, boolean>;
  const keys: (keyof PermissionMap)[] = [
    'can_enter_data', 'can_edit_data', 'can_delete_data', 'can_import_excel', 'can_export_data',
    'can_view_analytics', 'can_view_streams', 'can_view_audit_log', 'can_manage_users', 'can_manage_settings',
    'can_view_mpt_detail', 'can_view_sznb', 'can_view_international', 'can_view_telecom', 'can_view_flow',
  ];
  const result: PermissionMap = { ...STAFF_DEFAULT_PERMISSIONS };
  keys.forEach((k) => {
    if (k in map && typeof map[k] === 'boolean') result[k] = map[k];
  });
  return result;
}

export type AdminSettingsProps = {
  initialOrgSettings?: Record<string, unknown>;
  initialPermissions?: Record<string, unknown>;
  initialSession?: Record<string, unknown>;
  initialDataEntry?: Record<string, unknown>;
};

export function AdminSettingsClient({
  initialOrgSettings = {},
  initialPermissions = {},
  initialSession = {},
  initialDataEntry = {},
}: AdminSettingsProps) {
  const [openPanel, setOpenPanel] = useState<PanelId | null>('organization');
  const [pending, startTransition] = useTransition();

  // Organization
  const [companyName, setCompanyName] = useState((initialOrgSettings?.company_name as string) ?? 'Legacy');
  const [logoUrl, setLogoUrl] = useState((initialOrgSettings?.logo_url as string) ?? '');
  const [timezone, setTimezone] = useState((initialOrgSettings?.timezone as string) ?? 'Asia/Yangon');

  // Permissions
  const [defaultPermissions, setDefaultPermissions] = useState<PermissionMap>(() =>
    normalizePermissions(initialPermissions?.default_permissions ?? initialPermissions)
  );

  // Session & Audit
  const [sessionIdleMinutes, setSessionIdleMinutes] = useState(
    Math.max(5, Math.min(480, Number(initialSession?.session_idle_minutes) || 60))
  );
  const [auditRetentionDays, setAuditRetentionDays] = useState(
    Math.max(30, Math.min(3650, Number(initialSession?.audit_retention_days) || 365))
  );

  // Data Entry
  const [duplicateMonthBehavior, setDuplicateMonthBehavior] = useState<'allow' | 'confirm' | 'block'>(
    (initialDataEntry?.duplicate_month_behavior as 'allow' | 'confirm' | 'block') ?? 'confirm'
  );

  const handleSaveOrganization = () => {
    startTransition(async () => {
      try {
        await updateAppSettings('organization', {
          company_name: companyName.trim() || 'Legacy',
          logo_url: logoUrl.trim() || null,
          timezone,
        });
        toast.success('Organization settings saved');
        window.location.reload();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to save');
      }
    });
  };

  const handleSavePermissions = () => {
    startTransition(async () => {
      try {
        await updateAppSettings('permissions', { default_permissions: defaultPermissions });
        toast.success('Default permissions saved');
        window.location.reload();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to save');
      }
    });
  };

  const handleSaveSession = () => {
    startTransition(async () => {
      try {
        const idle = Math.max(5, Math.min(480, sessionIdleMinutes));
        const retention = Math.max(30, Math.min(3650, auditRetentionDays));
        await updateAppSettings('session', {
          session_idle_minutes: idle,
          audit_retention_days: retention,
        });
        setSessionIdleMinutes(idle);
        setAuditRetentionDays(retention);
        toast.success('Session & audit policy saved');
        window.location.reload();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to save');
      }
    });
  };

  const handleSaveDataEntry = () => {
    startTransition(async () => {
      try {
        await updateAppSettings('data-entry', {
          duplicate_month_behavior: duplicateMonthBehavior,
        });
        toast.success('Data entry rules saved');
        window.location.reload();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to save');
      }
    });
  };

  const inputClass =
    'w-full rounded-lg border border-border bg-card px-3 py-2.5 text-body text-primary focus:border-teal focus:ring-1 focus:ring-teal outline-none';

  return (
    <div className="space-y-2">
      {PANELS.map(({ id, title, description }) => {
        const isOpen = openPanel === id;
        return (
          <section
            key={id}
            className="rounded-xl border border-border bg-card overflow-hidden transition-all hover:border-teal/40"
          >
            <button
              type="button"
              onClick={() => setOpenPanel(isOpen ? null : id)}
              className="flex w-full items-center justify-between gap-3 p-5 text-left transition-colors hover:bg-elevated/50 focus:outline-none focus:ring-2 focus:ring-teal/30 focus:ring-inset"
            >
              <div>
                <h2 className="text-body font-semibold text-primary">{title}</h2>
                <p className="text-caption text-secondary mt-0.5">{description}</p>
              </div>
              <span
                className={`shrink-0 text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                aria-hidden
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </button>
            {isOpen && id === 'organization' && (
              <div className="border-t border-border bg-elevated/30 px-5 py-5">
                <div className="space-y-6 max-w-2xl">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-caption font-medium text-secondary mb-1.5">Company name</label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className={inputClass}
                        placeholder="Legacy"
                      />
                    </div>
                    <div>
                      <label className="block text-caption font-medium text-secondary mb-1.5">Timezone</label>
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className={inputClass}
                      >
                        {TIMEZONES.map(({ value, label }) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-caption font-medium text-secondary mb-1.5">Logo URL (optional)</label>
                    <input
                      type="url"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      className={inputClass}
                      placeholder="https://example.com/logo.png"
                    />
                    <p className="mt-1 text-micro text-muted">Full URL to a logo image. Leave blank to use the default.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveOrganization}
                    disabled={pending}
                    className="rounded-lg bg-teal px-5 py-2.5 text-body font-medium text-background hover:opacity-90 disabled:opacity-50 transition"
                  >
                    {pending ? 'Saving…' : 'Save organization settings'}
                  </button>
                </div>
              </div>
            )}
            {isOpen && id === 'permissions' && (
              <div className="border-t border-border bg-elevated/30 px-5 py-5">
                <div className="space-y-6 max-w-2xl">
                  <p className="text-caption text-secondary">
                    These permissions are applied by default when inviting new staff. You can override them per invite.
                  </p>
                  <PermissionsMatrix value={defaultPermissions} onChange={setDefaultPermissions} />
                  <button
                    type="button"
                    onClick={handleSavePermissions}
                    disabled={pending}
                    className="rounded-lg bg-teal px-5 py-2.5 text-body font-medium text-background hover:opacity-90 disabled:opacity-50 transition"
                  >
                    {pending ? 'Saving…' : 'Save default permissions'}
                  </button>
                </div>
              </div>
            )}
            {isOpen && id === 'session' && (
              <div className="border-t border-border bg-elevated/30 px-5 py-5">
                <div className="space-y-6 max-w-2xl">
                  <div>
                    <label className="block text-caption font-medium text-secondary mb-1.5">Session idle timeout (minutes)</label>
                    <input
                      type="number"
                      min={5}
                      max={480}
                      value={sessionIdleMinutes}
                      onChange={(e) => setSessionIdleMinutes(Number(e.target.value) || 60)}
                      className={inputClass}
                    />
                    <p className="mt-1 text-micro text-muted">Sign out users after this many minutes of inactivity. Range: 5–480.</p>
                  </div>
                  <div>
                    <label className="block text-caption font-medium text-secondary mb-1.5">Audit log retention (days)</label>
                    <input
                      type="number"
                      min={30}
                      max={3650}
                      value={auditRetentionDays}
                      onChange={(e) => setAuditRetentionDays(Number(e.target.value) || 365)}
                      className={inputClass}
                    />
                    <p className="mt-1 text-micro text-muted">How long to keep audit log entries visible. Range: 30–3650 days.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveSession}
                    disabled={pending}
                    className="rounded-lg bg-teal px-5 py-2.5 text-body font-medium text-background hover:opacity-90 disabled:opacity-50 transition"
                  >
                    {pending ? 'Saving…' : 'Save session & audit policy'}
                  </button>
                </div>
              </div>
            )}
            {isOpen && id === 'data-entry' && (
              <div className="border-t border-border bg-elevated/30 px-5 py-5">
                <div className="space-y-6 max-w-2xl">
                  <div>
                    <label className="block text-caption font-medium text-secondary mb-2">Duplicate month behavior</label>
                    <p className="text-caption text-secondary mb-3">
                      When a user tries to save data for a month that already has data:
                    </p>
                    <div className="space-y-2">
                      {DUPLICATE_BEHAVIORS.map(({ value, label, description }) => (
                        <label
                          key={value}
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                            duplicateMonthBehavior === value
                              ? 'border-teal bg-teal/10'
                              : 'border-border bg-card hover:border-border-hover'
                          }`}
                        >
                          <input
                            type="radio"
                            name="duplicate-month"
                            value={value}
                            checked={duplicateMonthBehavior === value}
                            onChange={() => setDuplicateMonthBehavior(value)}
                            className="mt-0.5 h-4 w-4 border-border text-teal focus:ring-teal"
                          />
                          <div>
                            <span className="text-body font-medium text-primary">{label}</span>
                            <p className="text-caption text-secondary mt-0.5">{description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveDataEntry}
                    disabled={pending}
                    className="rounded-lg bg-teal px-5 py-2.5 text-body font-medium text-background hover:opacity-90 disabled:opacity-50 transition"
                  >
                    {pending ? 'Saving…' : 'Save data entry rules'}
                  </button>
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
