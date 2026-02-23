'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';

type AuditRow = {
  sqlid: number;
  user_id: string | null;
  action: string;
  table_name: string;
  row_id: string | null;
  created_at: string;
};

export function RecentActivity() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from('audit_log')
      .select('sqlid, user_id, action, table_name, row_id, created_at')
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data, error }) => {
        if (!error) setRows((data ?? []) as AuditRow[]);
        setLoading(false);
      });
  }, [supabase]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-elevated" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-body text-muted">No activity yet. Add data or import Excel to see entries here.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li
          key={r.sqlid}
          className="flex items-center justify-between rounded-lg border border-border bg-elevated px-3 py-2.5 text-body"
        >
          <span className="text-primary">
            <span className="font-medium text-teal">{r.action}</span> on {r.table_name}
            {r.row_id && <span className="text-secondary"> ({r.row_id})</span>}
          </span>
          <span className="text-muted text-caption">{format(new Date(r.created_at), 'MMM d, HH:mm')}</span>
        </li>
      ))}
    </ul>
  );
}
