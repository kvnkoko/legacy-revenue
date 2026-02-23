'use client';

import { useState } from 'react';
import { format } from 'date-fns';

type Row = {
  sqlid: number;
  user_id: string | null;
  action: string;
  table_name: string;
  row_id: string | null;
  created_at: string;
};

export function AuditTable({ rows }: { rows: Row[] }) {
  const [filterAction, setFilterAction] = useState<string>('');

  const filtered = filterAction
    ? rows.filter((r) => r.action === filterAction)
    : rows;

  const actions = Array.from(new Set(rows.map((r) => r.action)));

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="rounded-lg border border-[#2a3347] bg-[#161b24] px-3 py-2 text-sm text-[#f0f4ff]"
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[#1e2535] bg-[#0f1117]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#1e2535]">
              <th className="p-3 font-medium text-[#8892a4]">Timestamp</th>
              <th className="p-3 font-medium text-[#8892a4]">User</th>
              <th className="p-3 font-medium text-[#8892a4]">Action</th>
              <th className="p-3 font-medium text-[#8892a4]">Table</th>
              <th className="p-3 font-medium text-[#8892a4]">Row ID</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.sqlid} className="border-b border-[#1e2535] last:border-0">
                <td className="p-3 text-[#f0f4ff]">{format(new Date(r.created_at), 'yyyy-MM-dd HH:mm:ss')}</td>
                <td className="p-3 text-[#8892a4]">{r.user_id?.slice(0, 8) ?? '—'}…</td>
                <td className="p-3">
                  <span className={r.action === 'IMPORT' ? 'text-amber-500' : 'text-[#00d4c8]'}>{r.action}</span>
                </td>
                <td className="p-3 text-[#f0f4ff]">{r.table_name}</td>
                <td className="p-3 text-[#8892a4]">{r.row_id ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
