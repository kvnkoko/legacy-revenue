'use client';

import { useMemo, useState } from 'react';
import { UserListPanel } from '@/components/admin/users/UserListPanel';
import { UserDetailPanel } from '@/components/admin/users/UserDetailPanel';
import type { ManagedUser, UserActivityRow, PendingInvite } from '@/components/admin/users/types';

const PENDING_PREFIX = 'pending:';

export function AdminUsersPageClient({
  users,
  pendingInvites = [],
  activity,
  defaultPermissions,
}: {
  users: ManagedUser[];
  pendingInvites?: PendingInvite[];
  activity: UserActivityRow[];
  defaultPermissions?: Record<string, unknown>;
}) {
  const firstUserId = users[0]?.id ?? null;
  const firstPendingId = pendingInvites[0] ? `${PENDING_PREFIX}${pendingInvites[0].id}` : null;
  const [selectedId, setSelectedId] = useState<string | null>(firstUserId ?? firstPendingId);
  const selectedUser = users.find((u) => u.id === selectedId) ?? null;
  const selectedPendingInvite =
    selectedId?.startsWith(PENDING_PREFIX) === true
      ? pendingInvites.find((p) => `${PENDING_PREFIX}${p.id}` === selectedId) ?? null
      : null;
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
        <UserListPanel
          users={users}
          pendingInvites={pendingInvites}
          selectedId={selectedId}
          onSelect={setSelectedId}
          defaultPermissions={defaultPermissions}
        />
      </div>
      <div className="xl:col-span-2">
        <UserDetailPanel
          user={selectedUser}
          pendingInvite={selectedPendingInvite}
          activities={selectedActivity}
        />
      </div>
    </div>
  );
}
