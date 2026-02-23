'use client';

import { useMemo, useState } from 'react';
import { InviteUserDrawer } from '@/components/admin/users/InviteUserDrawer';
import type { ManagedUser } from '@/components/admin/users/types';

type Filter = 'all' | 'admin' | 'staff' | 'active' | 'suspended' | 'pending';

export function UserListPanel({
  users,
  selectedId,
  onSelect,
  defaultPermissions,
}: {
  users: ManagedUser[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  defaultPermissions?: Record<string, unknown>;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<'name' | 'last_active' | 'joined' | 'role'>('name');
  const [inviteOpen, setInviteOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const next = users
      .filter((u) => {
        if (filter === 'admin' || filter === 'staff') return u.role === filter;
        if (filter === 'active' || filter === 'suspended' || filter === 'pending') return u.status === filter;
        return true;
      })
      .filter((u) => {
        if (!q) return true;
        return (
          u.full_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.department ?? '').toLowerCase().includes(q)
        );
      });

    next.sort((a, b) => {
      if (sort === 'name') return a.full_name.localeCompare(b.full_name);
      if (sort === 'role') return a.role.localeCompare(b.role);
      if (sort === 'joined') return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
      return String(b.last_seen_at ?? '').localeCompare(String(a.last_seen_at ?? ''));
    });
    return next;
  }, [users, query, filter, sort]);

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-body font-semibold text-primary">Team Members</h2>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="rounded-lg bg-teal px-3 py-2 text-caption font-medium text-background"
        >
          + Invite User
        </button>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name, email, department"
        className="mb-2 w-full rounded-lg border border-border bg-elevated px-3 py-2 text-body text-primary"
      />
      <div className="mb-2 flex flex-wrap gap-1">
        {(['all', 'admin', 'staff', 'active', 'suspended', 'pending'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-2 py-1 text-micro ${
              filter === f ? 'bg-teal/15 text-teal' : 'bg-elevated text-secondary'
            }`}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>
      <select
        value={sort}
        onChange={(e) => setSort(e.target.value as 'name' | 'last_active' | 'joined' | 'role')}
        className="mb-3 w-full rounded-lg border border-border bg-elevated px-3 py-2 text-caption text-primary"
      >
        <option value="name">Name A-Z</option>
        <option value="last_active">Last Active</option>
        <option value="joined">Date Joined</option>
        <option value="role">Role</option>
      </select>

      <div className="space-y-2">
        {filtered.map((user) => (
          <button
            key={user.id}
            type="button"
            onClick={() => onSelect(user.id)}
            className={`w-full rounded-lg border p-3 text-left transition-colors ${
              selectedId === user.id ? 'border-teal bg-teal/10' : 'border-border bg-elevated hover:border-border-hover'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-body font-medium text-primary">{user.full_name}</p>
                <p className="text-caption text-secondary">{user.job_title ?? user.email}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-micro ${user.role === 'admin' ? 'bg-amber/15 text-amber' : 'bg-blue/15 text-blue'}`}>
                {user.role}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-micro text-secondary">
              <span>{user.department ?? 'No department'}</span>
              <span>{user.last_seen_at ? new Date(user.last_seen_at).toLocaleDateString() : 'Never'}</span>
            </div>
          </button>
        ))}
      </div>

      <InviteUserDrawer open={inviteOpen} onClose={() => setInviteOpen(false)} defaultPermissions={defaultPermissions} />
    </div>
  );
}
