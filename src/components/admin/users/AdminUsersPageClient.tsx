'use client';

import { useMemo, useState } from 'react';
import { UserListPanel } from '@/components/admin/users/UserListPanel';
import { UserDetailPanel } from '@/components/admin/users/UserDetailPanel';
import type { ManagedUser, UserActivityRow } from '@/components/admin/users/types';

export function AdminUsersPageClient({
  users,
  activity,
  defaultPermissions,
}: {
  users: ManagedUser[];
  activity: UserActivityRow[];
  defaultPermissions?: Record<string, unknown>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(users[0]?.id ?? null);
  const selected = users.find((u) => u.id === selectedId) ?? null;
  const selectedActivity = useMemo(
    () =>
      activity
        .filter((a) => a.user_id === selectedId || a.row_id === selectedId)
        .slice(0, 20),
    [activity, selectedId]
  );

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="xl:col-span-1">
        <UserListPanel users={users} selectedId={selectedId} onSelect={setSelectedId} defaultPermissions={defaultPermissions} />
      </div>
      <div className="xl:col-span-2">
        <UserDetailPanel user={selected} activities={selectedActivity} />
      </div>
    </div>
  );
}
