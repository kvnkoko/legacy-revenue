'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Drawer } from '@/components/ui/dialog/Dialog';
import { PermissionsMatrix } from '@/components/admin/users/PermissionsMatrix';
import { PERMISSION_PRESETS, type PermissionPresetKey } from '@/lib/permission-presets';
import type { PermissionMap } from '@/lib/authz/types';
import { inviteManagedUser } from '@/app/admin/users/actions';

function normalizePermissions(raw: unknown): PermissionMap {
  if (!raw || typeof raw !== 'object') return PERMISSION_PRESETS.READ_ONLY.permissions;
  const map = (raw as Record<string, unknown>).default_permissions ?? raw;
  if (!map || typeof map !== 'object') return PERMISSION_PRESETS.READ_ONLY.permissions;
  const m = map as Record<string, boolean>;
  const keys: (keyof PermissionMap)[] = [
    'can_enter_data', 'can_edit_data', 'can_delete_data', 'can_import_excel', 'can_export_data',
    'can_view_analytics', 'can_view_streams', 'can_view_audit_log', 'can_manage_users', 'can_manage_settings',
    'can_view_mpt_detail', 'can_view_sznb', 'can_view_international', 'can_view_telecom', 'can_view_flow',
  ];
  const result = { ...PERMISSION_PRESETS.READ_ONLY.permissions };
  keys.forEach((k) => {
    if (k in m && typeof m[k] === 'boolean') result[k] = m[k];
  });
  return result;
}

export function InviteUserDrawer({
  open,
  onClose,
  defaultPermissions: defaultPermissionsRaw,
}: {
  open: boolean;
  onClose: () => void;
  defaultPermissions?: Record<string, unknown>;
}) {
  const defaultPerms = defaultPermissionsRaw ? normalizePermissions(defaultPermissionsRaw) : PERMISSION_PRESETS.READ_ONLY.permissions;
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState<'admin' | 'staff'>('staff');
  const [preset, setPreset] = useState<PermissionPresetKey | 'CUSTOM' | 'DEFAULT'>('DEFAULT');
  const [message, setMessage] = useState('');
  const [customPermissions, setCustomPermissions] = useState<PermissionMap>(defaultPerms);
  const [pending, startTransition] = useTransition();

  const effectivePermissions =
    role === 'admin'
      ? PERMISSION_PRESETS.FULL_ACCESS_STAFF.permissions
      : preset === 'CUSTOM'
        ? customPermissions
        : preset === 'DEFAULT'
          ? defaultPerms
          : PERMISSION_PRESETS[preset].permissions;

  const submit = () => {
    if (!fullName.trim() || !email.trim()) {
      toast.error('Full name and email are required');
      return;
    }
    startTransition(async () => {
      try {
        await inviteManagedUser({
          fullName: fullName.trim(),
          email: email.trim(),
          role,
          jobTitle: jobTitle || undefined,
          department: department || undefined,
          permissions: effectivePermissions,
          message,
        });
        toast.success(`${email} is now invited. They can sign up at /signup with this email.`);
        onClose();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to send invite');
      }
    });
  };

  return (
    <Drawer open={open} onClose={onClose} title="Invite User">
      <div className="space-y-4">
        <label className="block text-caption text-secondary">
          Full Name
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-primary" />
        </label>
        <label className="block text-caption text-secondary">
          Email Address
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-primary" />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-caption text-secondary">
            Job Title
            <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-primary" />
          </label>
          <label className="block text-caption text-secondary">
            Department
            <input value={department} onChange={(e) => setDepartment(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-primary" />
          </label>
        </div>
        <div className="rounded-lg border border-border bg-elevated p-3">
          <p className="text-caption text-secondary">Role</p>
          <div className="mt-2 flex gap-4">
            <label className="text-body text-primary">
              <input type="radio" checked={role === 'staff'} onChange={() => setRole('staff')} className="mr-2" />
              Staff
            </label>
            <label className="text-body text-primary">
              <input type="radio" checked={role === 'admin'} onChange={() => setRole('admin')} className="mr-2" />
              Admin
            </label>
          </div>
        </div>
        {role === 'staff' && (
          <label className="block text-caption text-secondary">
            Permission Preset
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as PermissionPresetKey | 'CUSTOM' | 'DEFAULT')}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-primary"
            >
              <option value="DEFAULT">Default (from Admin Settings)</option>
              {Object.entries(PERMISSION_PRESETS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
              <option value="CUSTOM">Custom</option>
            </select>
          </label>
        )}
        {role === 'staff' && preset === 'DEFAULT' && (
          <div className="rounded-lg border border-border bg-elevated p-3">
            <p className="text-caption text-secondary">Using default permissions from Admin Settings. Change preset to customize.</p>
          </div>
        )}
        {role === 'staff' && preset === 'CUSTOM' && (
          <PermissionsMatrix value={customPermissions} onChange={setCustomPermissions} />
        )}
        <label className="block text-caption text-secondary">
          Personal message
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-primary" />
        </label>
        <div className="rounded-lg border border-border bg-elevated p-3">
          <p className="text-caption text-secondary">Invite email preview</p>
          <p className="mt-1 text-body text-primary">
            Hello {fullName || 'teammate'}, you were invited to Legacy Revenue Portal as {role}.
          </p>
          {message && <p className="mt-1 text-caption text-secondary">Note: {message}</p>}
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="w-full rounded-lg bg-teal px-4 py-2 text-body font-medium text-background disabled:opacity-50"
        >
          {pending ? 'Sending Invite…' : 'Send Invite'}
        </button>
      </div>
    </Drawer>
  );
}
