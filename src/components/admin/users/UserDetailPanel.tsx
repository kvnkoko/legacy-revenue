'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/dialog/ConfirmDialog';
import { PermissionsMatrix } from '@/components/admin/users/PermissionsMatrix';
import type { ManagedUser, UserActivityRow, PendingInvite } from '@/components/admin/users/types';
import { PERMISSION_PRESETS } from '@/lib/permission-presets';
import {
  deleteManagedUser,
  forceSignOutManagedUser,
  resendManagedUserInvite,
  revokePendingInvite,
  sendManagedUserPasswordReset,
  setUserPassword,
  updateManagedUserProfile,
  updateManagedUserRoleAndPermissions,
  updateManagedUserStatus,
} from '@/app/admin/users/actions';
type Tab = 'profile' | 'permissions' | 'activity' | 'security';

function PendingInviteDetail({
  invite,
  pending,
  startTransition,
}: {
  invite: PendingInvite;
  pending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const router = useRouter();
  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false);
  const signupUrl = typeof window !== 'undefined' ? `${window.location.origin}/signup` : '/signup';

  const copySignupLink = () => {
    const text = `${signupUrl}\n\nYou were invited to Legacy Revenue Portal. Sign up with this email: ${invite.email}`;
    navigator.clipboard.writeText(text).then(() => toast.success('Signup link copied to clipboard'));
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-body font-semibold text-primary">Pending invite</h2>
        <span className="rounded-full bg-amber/15 px-2 py-0.5 text-micro text-amber">Awaiting sign-up</span>
      </div>
      <dl className="space-y-3 text-body">
        <div>
          <dt className="text-caption text-secondary">Full name</dt>
          <dd className="text-primary">{invite.full_name}</dd>
        </div>
        <div>
          <dt className="text-caption text-secondary">Email</dt>
          <dd className="text-primary">{invite.email}</dd>
        </div>
        <div>
          <dt className="text-caption text-secondary">Role</dt>
          <dd className="text-primary capitalize">{invite.role}</dd>
        </div>
        {(invite.job_title || invite.department) && (
          <div>
            <dt className="text-caption text-secondary">Job title / Department</dt>
            <dd className="text-primary">{[invite.job_title, invite.department].filter(Boolean).join(' · ')}</dd>
          </div>
        )}
        <div>
          <dt className="text-caption text-secondary">Invited</dt>
          <dd className="text-primary">{new Date(invite.invited_at).toLocaleString()}</dd>
        </div>
      </dl>
      <p className="mt-4 text-caption text-secondary">
        They can create an account at <strong>{signupUrl}</strong> using this email. They will not appear in Team members until they complete sign-up.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copySignupLink}
          disabled={pending}
          className="rounded-lg border border-border bg-elevated px-4 py-2 text-caption font-medium text-primary hover:bg-card"
        >
          Copy signup link
        </button>
        <button
          type="button"
          onClick={() => setRevokeConfirmOpen(true)}
          disabled={pending}
          className="rounded-lg border border-danger/50 bg-danger/10 px-4 py-2 text-caption font-medium text-danger hover:bg-danger/20"
        >
          Revoke invite
        </button>
      </div>
      <ConfirmDialog
        open={revokeConfirmOpen}
        onClose={() => setRevokeConfirmOpen(false)}
        title="Revoke invite"
        message={`Remove this invite for ${invite.email}? They will need to be invited again to sign up.`}
        confirmText="Revoke"
        onConfirm={() =>
          startTransition(async () => {
            try {
              await revokePendingInvite({ inviteId: invite.id });
              toast.success('Invite revoked');
              setRevokeConfirmOpen(false);
              router.refresh();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Failed to revoke invite');
            }
          })
        }
      />
    </div>
  );
}

export function UserDetailPanel({
  user,
  pendingInvite,
  activities,
}: {
  user: ManagedUser | null;
  pendingInvite?: PendingInvite | null;
  activities: UserActivityRow[];
}) {
  const [tab, setTab] = useState<Tab>('profile');
  const [pending, startTransition] = useTransition();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [nameConfirm, setNameConfirm] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [form, setForm] = useState({
    full_name: user?.full_name ?? '',
    display_name: user?.display_name ?? '',
    job_title: user?.job_title ?? '',
    department: user?.department ?? '',
    notes: user?.notes ?? '',
  });
  const [permissions, setPermissions] = useState(user?.permissions ?? PERMISSION_PRESETS.READ_ONLY.permissions);
  const [role, setRole] = useState<'admin' | 'staff'>(user?.role ?? 'staff');
  const [status, setStatus] = useState<'active' | 'suspended' | 'pending'>(user?.status ?? 'active');

  useMemo(() => {
    setForm({
      full_name: user?.full_name ?? '',
      display_name: user?.display_name ?? '',
      job_title: user?.job_title ?? '',
      department: user?.department ?? '',
      notes: user?.notes ?? '',
    });
    setPermissions(user?.permissions ?? PERMISSION_PRESETS.READ_ONLY.permissions);
    setRole(user?.role ?? 'staff');
    setStatus(user?.status ?? 'active');
    setTab('profile');
  }, [user]);

  if (pendingInvite) {
    return (
      <PendingInviteDetail
        invite={pendingInvite}
        pending={pending}
        startTransition={startTransition}
      />
    );
  }

  if (!user) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-secondary">
        Select a user or pending invite to view details.
      </div>
    );
  }

  const saveProfile = () =>
    startTransition(async () => {
      try {
        await updateManagedUserProfile({ userId: user.id, ...form });
        toast.success('Profile updated');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to save profile');
      }
    });

  const saveRolePermissions = () =>
    startTransition(async () => {
      try {
        await updateManagedUserRoleAndPermissions({
          userId: user.id,
          role,
          permissions,
        });
        toast.success('Permissions updated');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update permissions');
      }
    });

  const saveStatus = () =>
    startTransition(async () => {
      try {
        await updateManagedUserStatus({ userId: user.id, status });
        toast.success(`Status updated to ${status}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update status');
      }
    });

  const applyPreset = (presetKey: keyof typeof PERMISSION_PRESETS) => {
    setPermissions(PERMISSION_PRESETS[presetKey].permissions);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-title font-semibold text-primary">{user.full_name}</h2>
          <p className="text-caption text-secondary">{user.email}</p>
          <p className="mt-1 text-micro text-muted">
            Last seen: {user.last_seen_at ? new Date(user.last_seen_at).toLocaleString() : 'Never'} • Member since:{' '}
            {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'staff')} className="rounded-lg border border-border bg-elevated px-3 py-2 text-caption text-primary">
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'suspended' | 'pending')} className="rounded-lg border border-border bg-elevated px-3 py-2 text-caption text-primary">
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending</option>
          </select>
          <button type="button" onClick={saveStatus} className="rounded-lg border border-border px-3 py-2 text-caption text-primary">
            Save Status
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
        {(['profile', 'permissions', 'activity', 'security'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-caption ${tab === t ? 'bg-teal/15 text-teal' : 'bg-elevated text-secondary'}`}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="space-y-3">
          {(
            [
              ['full_name', 'Full Name'],
              ['display_name', 'Display Name'],
              ['job_title', 'Job Title'],
              ['department', 'Department'],
            ] as const
          ).map(([field, label]) => (
            <label key={field} className="block text-caption text-secondary">
              {label}
              <input
                value={String(form[field] ?? '')}
                onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border bg-elevated px-3 py-2 text-body text-primary"
              />
            </label>
          ))}
          <label className="block text-caption text-secondary">
            Notes
            <textarea
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-lg border border-border bg-elevated px-3 py-2 text-body text-primary"
            />
          </label>
          <button type="button" onClick={saveProfile} disabled={pending} className="rounded-lg bg-teal px-4 py-2 text-body font-medium text-background disabled:opacity-50">
            Save Profile
          </button>
        </div>
      )}

      {tab === 'permissions' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <select
              onChange={(e) => applyPreset(e.target.value as keyof typeof PERMISSION_PRESETS)}
              className="rounded-lg border border-border bg-elevated px-3 py-2 text-caption text-primary"
              defaultValue=""
            >
              <option value="" disabled>
                Apply Preset
              </option>
              {Object.entries(PERMISSION_PRESETS).map(([k, p]) => (
                <option key={k} value={k}>
                  {p.label}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setPermissions(PERMISSION_PRESETS.READ_ONLY.permissions)} className="rounded-lg border border-border px-3 py-2 text-caption text-primary">
              Reset to Role Default
            </button>
          </div>
          <PermissionsMatrix value={permissions} onChange={setPermissions} disabled={role === 'admin'} />
          <button type="button" onClick={saveRolePermissions} disabled={pending} className="rounded-lg bg-teal px-4 py-2 text-body font-medium text-background disabled:opacity-50">
            Save Permissions
          </button>
        </div>
      )}

      {tab === 'activity' && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-caption">
            <thead>
              <tr className="border-b border-border bg-elevated">
                <th className="p-2 text-secondary">Timestamp</th>
                <th className="p-2 text-secondary">Action</th>
                <th className="p-2 text-secondary">Description</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a) => (
                <tr key={a.sqlid} className="border-b border-border">
                  <td className="p-2 text-primary">{new Date(a.created_at).toLocaleString()}</td>
                  <td className="p-2 text-primary">{a.action}</td>
                  <td className="p-2 text-secondary">{a.table_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <a href={`/audit?user=${user.id}`} className="block p-2 text-caption text-teal underline">
            View Full History →
          </a>
        </div>
      )}

      {tab === 'security' && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-elevated p-3">
            <p className="text-caption font-medium text-secondary">Set new password</p>
            <p className="mt-0.5 text-micro text-muted">Admin can set a new password for this user (min 6 chars).</p>
            <div className="mt-2 flex gap-2">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-body text-primary"
              />
              <button
                type="button"
                onClick={() =>
                  startTransition(async () => {
                    if (!newPassword || newPassword.length < 6) {
                      toast.error('Password must be at least 6 characters');
                      return;
                    }
                    try {
                      await setUserPassword({ userId: user.id, newPassword });
                      toast.success('Password updated');
                      setNewPassword('');
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : 'Failed to set password');
                    }
                  })
                }
                disabled={pending || !newPassword || newPassword.length < 6}
                className="rounded-lg bg-teal px-4 py-2 text-caption font-medium text-background disabled:opacity-50"
              >
                Set Password
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  try {
                    await sendManagedUserPasswordReset({ email: user.email });
                    toast.success('Password reset email sent');
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : 'Failed to send reset');
                  }
                })
              }
              className="rounded-lg border border-border px-3 py-2 text-caption text-primary"
            >
              Send Password Reset Email
            </button>
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  try {
                    await forceSignOutManagedUser({ userId: user.id });
                    toast.success('Sessions invalidated');
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : 'Failed to sign out sessions');
                  }
                })
              }
              className="rounded-lg border border-border px-3 py-2 text-caption text-primary"
            >
              Force Sign Out
            </button>
            {user.status === 'pending' && user.invited_at && Date.now() - new Date(user.invited_at).getTime() > 7 * 24 * 60 * 60 * 1000 && (
              <button
                type="button"
                onClick={() =>
                  startTransition(async () => {
                    try {
                      await resendManagedUserInvite({ email: user.email });
                      toast.success('Invite resent');
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : 'Failed to resend invite');
                    }
                  })
                }
                className="rounded-lg border border-border px-3 py-2 text-caption text-primary"
              >
                Resend Invite
              </button>
            )}
          </div>
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
            <p className="text-caption font-semibold text-red-300">Danger Zone</p>
            <p className="mt-1 text-micro text-secondary">Type the full name to delete this user permanently.</p>
            <input
              value={nameConfirm}
              onChange={(e) => setNameConfirm(e.target.value)}
              className="mt-2 w-full rounded-lg border border-border bg-card px-3 py-2 text-body text-primary"
              placeholder={user.full_name}
            />
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              className="mt-2 rounded-lg border border-red-400/60 bg-red-500/10 px-3 py-2 text-caption font-medium text-red-200"
            >
              Delete User
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        title="Delete user"
        message="This action is permanent and cannot be undone."
        confirmText="Delete user"
        onConfirm={() =>
          startTransition(async () => {
            try {
              await deleteManagedUser({ userId: user.id, fullNameConfirm: nameConfirm });
              toast.success('User deleted');
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Failed to delete user');
            }
          })
        }
      />
    </div>
  );
}
