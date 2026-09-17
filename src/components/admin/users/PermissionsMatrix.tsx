'use client';

import type { PermissionMap } from '@/lib/authz/types';

const GROUPS: Array<{ title: string; items: Array<{ key: keyof PermissionMap; label: string }> }> = [
  {
    title: 'Data Access',
    items: [
      { key: 'can_view_streams', label: 'View Revenue Streams' },
      { key: 'can_view_analytics', label: 'View Analytics Dashboard' },
      { key: 'can_view_mpt_detail', label: 'View MPT Detail Breakdown' },
      { key: 'can_view_sznb', label: 'View SZNB Stream' },
      { key: 'can_view_international', label: 'View International (YT/Spot/TT)' },
      { key: 'can_view_telecom', label: 'View Telecom Streams' },
      { key: 'can_view_flow', label: 'View Flow Subscription' },
    ],
  },
  {
    title: 'Data Management',
    items: [
      { key: 'can_enter_data', label: 'Enter Monthly Data' },
      { key: 'can_edit_data', label: 'Edit Existing Data' },
      { key: 'can_delete_data', label: 'Delete Data' },
      { key: 'can_import_excel', label: 'Import from Excel' },
      { key: 'can_export_data', label: 'Export Data' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { key: 'can_view_audit_log', label: 'View Audit Log' },
      { key: 'can_configure_streams', label: 'Configure Revenue Streams & Fields' },
      { key: 'can_manage_users', label: 'Manage Users' },
      { key: 'can_manage_settings', label: 'System Settings' },
    ],
  },
];

/** Human label for a permission key, for use in summaries elsewhere. */
export const PERMISSION_LABELS: Record<string, string> = Object.fromEntries(
  GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.label]))
);

export function PermissionsMatrix({
  value,
  onChange,
  disabled,
  roleDefaults,
}: {
  value: PermissionMap;
  onChange: (next: PermissionMap) => void;
  disabled?: boolean;
  /**
   * What this person's ROLE grants. Any checkbox differing from it is a
   * per-person exception and is marked as such. Without this, an unchecked box
   * on an Editor looked identical to a role that simply does not include it,
   * so admins could not tell why someone was missing access.
   */
  roleDefaults?: PermissionMap;
}) {
  return (
    <div className="space-y-4">
      {GROUPS.map((group) => (
        <section key={group.title} className="rounded-lg border border-border bg-elevated p-3">
          <h4 className="mb-2 text-caption font-semibold uppercase tracking-wide text-secondary">{group.title}</h4>
          <div className="space-y-2">
            {group.items.map((item) => {
              const current = Boolean(value[item.key]);
              const fromRole = roleDefaults ? Boolean(roleDefaults[item.key]) : current;
              const differs = Boolean(roleDefaults) && !disabled && current !== fromRole;
              return (
                <label key={item.key} className="flex items-start justify-between gap-3">
                  <span className="text-body text-primary">
                    {item.label}
                    {differs && (
                      <span
                        className={`ml-2 whitespace-nowrap rounded px-1.5 py-0.5 align-middle text-micro font-semibold ${
                          current ? 'bg-gold/15 text-gold' : 'bg-amber-500/15 text-amber-400'
                        }`}
                      >
                        {current ? 'added for this person' : 'blocked for this person'}
                      </span>
                    )}
                    {differs && (
                      <span className="mt-0.5 block text-micro text-secondary">
                        Their role {fromRole ? 'normally allows this' : 'does not normally include this'}.
                      </span>
                    )}
                  </span>
                  <input
                    type="checkbox"
                    checked={current}
                    disabled={disabled}
                    title={disabled ? 'Admins always have full access. Change the role to restrict permissions.' : ''}
                    onChange={(e) => onChange({ ...value, [item.key]: e.target.checked })}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-border text-gold focus:ring-gold"
                  />
                </label>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
