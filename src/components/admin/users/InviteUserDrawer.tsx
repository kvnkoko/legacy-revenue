'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Drawer } from '@/components/ui/dialog/Dialog';
import { PermissionsMatrix } from '@/components/admin/users/PermissionsMatrix';
import { ROLE_DEFAULT_PERMISSIONS, ROLE_DESCRIPTIONS } from '@/lib/permission-presets';
import { ROLE_LABELS, type PermissionMap, type Role } from '@/lib/authz/types';
import { inviteManagedUser } from '@/app/admin/users/actions';

type AssignableRole = Exclude<Role, 'staff'>;
const ROLES: AssignableRole[] = ['viewer', 'data', 'editor', 'admin'];

export function InviteUserDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
  defaultPermissions?: Record<string, unknown>;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState<AssignableRole>('viewer');
  const [customize, setCustomize] = useState(false);
  const [message, setMessage] = useState('');
  const [customPermissions, setCustomPermissions] = useState<PermissionMap>({
    ...ROLE_DEFAULT_PERMISSIONS.viewer,
  });
  const [pending, startTransition] = useTransition();

  const pickRole = (next: AssignableRole) => {
    setRole(next);
    setCustomPermissions({ ...ROLE_DEFAULT_PERMISSIONS[next] });
    if (next === 'admin') setCustomize(false);
  };

  const effectivePermissions =
    role === 'admin'
      ? ROLE_DEFAULT_PERMISSIONS.admin
      : customize
        ? customPermissions
        : ROLE_DEFAULT_PERMISSIONS[role];

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
          <div className="mt-2 space-y-2">
            {ROLES.map((r) => (
              <label
                key={r}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-2.5 transition-colors ${
                  role === r ? 'border-teal/50 bg-teal/5' : 'border-border hover:bg-card'
                }`}
              >
                <input type="radio" checked={role === r} onChange={() => pickRole(r)} className="mt-1" />
                <span>
                  <span className="block text-body font-medium text-primary">{ROLE_LABELS[r]}</span>
                  <span className="block text-caption text-secondary">{ROLE_DESCRIPTIONS[r]}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        {role !== 'admin' && (
          <label className="flex items-center gap-2 text-caption text-secondary">
            <input type="checkbox" checked={customize} onChange={(e) => setCustomize(e.target.checked)} className="h-4 w-4" />
            Customize permissions beyond the {ROLE_LABELS[role]} defaults
          </label>
        )}
        {role !== 'admin' && customize && (
          <PermissionsMatrix value={customPermissions} onChange={setCustomPermissions} />
        )}
        <label className="block text-caption text-secondary">
          Personal message
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-primary" />
        </label>
        <div className="rounded-lg border border-border bg-elevated p-3">
          <p className="text-caption text-secondary">Invite email preview</p>
          <p className="mt-1 text-body text-primary">
            Hello {fullName || 'teammate'}, you were invited to Legacy Revenue Portal as {ROLE_LABELS[role]}.
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
