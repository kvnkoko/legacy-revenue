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
      { key: 'can_manage_users', label: 'Manage Users' },
      { key: 'can_manage_settings', label: 'System Settings' },
    ],
  },
];

export function PermissionsMatrix({
  value,
  onChange,
  disabled,
}: {
  value: PermissionMap;
  onChange: (next: PermissionMap) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      {GROUPS.map((group) => (
        <section key={group.title} className="rounded-lg border border-border bg-elevated p-3">
          <h4 className="mb-2 text-caption font-semibold uppercase tracking-wide text-secondary">{group.title}</h4>
          <div className="space-y-2">
            {group.items.map((item) => (
              <label key={item.key} className="flex items-center justify-between gap-3">
                <span className="text-body text-primary">{item.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(value[item.key])}
                  disabled={disabled}
                  title={disabled ? 'Admins always have full access. Demote to Staff to restrict permissions.' : ''}
                  onChange={(e) => onChange({ ...value, [item.key]: e.target.checked })}
                  className="h-4 w-4 rounded border-border text-teal focus:ring-teal"
                />
              </label>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
