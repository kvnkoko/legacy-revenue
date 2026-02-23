'use client';

import { useState } from 'react';
import { format } from 'date-fns';

type Log = {
  id: number;
  user_id: string | null;
  user_name?: string | null;
  user_role?: string | null;
  user_email?: string | null;
  action: string;
  table_name: string;
  row_id: string | number | null;
  old_value: unknown;
  new_value: unknown;
  ip_address: string | null;
  created_at: string;
};

function shortUser(userId: string | null): string {
  if (!userId) return 'Unknown';
  return `${userId.slice(0, 8)}…${userId.slice(-4)}`;
}

function summarizeChange(log: Log): string {
  if (log.action === 'IMPORT' && log.new_value && typeof log.new_value === 'object') {
    const payload = log.new_value as { inserted?: number; updated?: number; skipped?: number; filename?: string };
    return `Imported ${payload.filename ?? 'file'} (inserted: ${payload.inserted ?? 0}, updated: ${payload.updated ?? 0}, skipped: ${payload.skipped ?? 0})`;
  }

  if (log.new_value && typeof log.new_value === 'object') {
    const newObj = log.new_value as Record<string, unknown>;
    const oldObj = (log.old_value && typeof log.old_value === 'object' ? (log.old_value as Record<string, unknown>) : {}) ?? {};
    const changed = Object.keys(newObj)
      .filter((k) => !['created_at', 'updated_at', 'sqlid'].includes(k))
      .filter((k) => JSON.stringify(oldObj[k]) !== JSON.stringify(newObj[k]));
    if (changed.length > 0) {
      return `Changed: ${changed.slice(0, 5).join(', ')}${changed.length > 5 ? '…' : ''}`;
    }
  }

  if (log.action === 'DELETE') return 'Row deleted';
  return log.row_id ? `Row ${log.row_id}` : 'No field-level diff available';
}

export function AuditTable({
  logs,
  userNames = {},
  canExport = false,
  initialUserFilter = 'all',
}: {
  logs: Log[];
  userNames?: Record<string, string | null>;
  canExport?: boolean;
  initialUserFilter?: string;
}) {
  const [actionFilter, setActionFilter] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'staff'>('all');
  const [userFilter, setUserFilter] = useState<string>(initialUserFilter);

  const filtered = logs.filter((l) => {
    if (actionFilter && l.action.toLowerCase() !== actionFilter.toLowerCase()) return false;
    if (roleFilter !== 'all' && (l.user_role ?? '').toLowerCase() !== roleFilter) return false;
    if (userFilter !== 'all' && l.user_id !== userFilter) return false;
    return true;
  });

  const actions = Array.from(new Set<string>(logs.map((l) => l.action)));
  const users = Array.from(new Set(logs.map((l) => l.user_id).filter(Boolean))) as string[];

  const exportCsv = () => {
    const headers = ['timestamp', 'user_name', 'user_role', 'action', 'table', 'description', 'ip_address'];
    const rows = filtered.map((l) =>
      [
        l.created_at,
        l.user_name ?? userNames[l.user_id ?? ''] ?? shortUser(l.user_id),
        l.user_role ?? 'system',
        l.action,
        l.table_name,
        summarizeChange(l),
        l.ip_address ?? '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-4 border-b border-border flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <label className="text-sm text-secondary">Filter by action</label>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-lg border border-border bg-elevated px-3 py-1.5 text-primary text-sm"
        >
          <option value="">All</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="rounded-lg border border-border bg-elevated px-3 py-1.5 text-primary text-sm"
        >
          <option value="all">All users</option>
          {users.map((uid) => (
            <option key={uid} value={uid}>
              {userNames[uid] ?? shortUser(uid)}
            </option>
          ))}
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as 'all' | 'admin' | 'staff')}
          className="rounded-lg border border-border bg-elevated px-3 py-1.5 text-primary text-sm"
        >
          <option value="all">All roles</option>
          <option value="admin">Admins only</option>
          <option value="staff">Staff only</option>
        </select>
        {canExport && (
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-lg border border-border px-3 py-1.5 text-caption text-primary hover:bg-elevated"
          >
            Export Audit Log
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1020px] w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-elevated">
              <th className="text-left py-3 px-4 font-semibold text-primary">Timestamp</th>
              <th className="text-left py-3 px-4 font-semibold text-primary">User</th>
              <th className="text-left py-3 px-4 font-semibold text-primary">Role</th>
              <th className="text-left py-3 px-4 font-semibold text-primary">Action</th>
              <th className="text-left py-3 px-4 font-semibold text-primary">Table</th>
              <th className="text-left py-3 px-4 font-semibold text-primary">Change</th>
              <th className="text-left py-3 px-4 font-semibold text-primary">IP Address</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((log) => (
              <tr
                key={log.id}
                className={`border-b border-border hover:bg-elevated/50 ${
                  log.user_role === 'admin' ? 'bg-amber/5' : log.user_role === 'staff' ? 'bg-blue/5' : ''
                }`}
              >
                <td className="py-2.5 px-4 text-secondary whitespace-nowrap">
                  {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm')}
                </td>
                <td className="py-2.5 px-4 text-secondary whitespace-nowrap">
                  {log.user_name ?? (log.user_id ? (userNames[log.user_id] ?? shortUser(log.user_id)) : 'Unknown')}
                </td>
                <td className="py-2.5 px-4 text-secondary capitalize">{log.user_role ?? 'system'}</td>
                <td className="py-2.5 px-4">
                  <span className={`font-medium ${log.action === 'DELETE' ? 'text-danger' : log.action === 'IMPORT' ? 'text-amber' : 'text-teal'}`}>
                    {log.action}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-secondary">{log.table_name}</td>
                <td className="py-2.5 px-4 text-muted max-w-xl">
                  <span className="block truncate" title={summarizeChange(log)}>
                    {summarizeChange(log)}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-muted">{log.ip_address ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && (
        <div className="p-8 text-center text-secondary">No audit events match the filter.</div>
      )}
    </div>
  );
}
