import { createClient } from '@/lib/supabase/server';
import { formatDistanceToNow } from 'date-fns';

export async function RecentActivity() {
  const supabase = await createClient();
  const { data: logs } = await supabase
    .from('audit_log')
    .select('sqlid, action, table_name, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (!logs?.length) {
    return (
      <p className="text-body text-secondary">No recent activity. Data entry and imports will appear here.</p>
    );
  }

  return (
    <ul className="space-y-2" role="list">
      {logs.map((log) => (
        <li
          key={log.sqlid}
          className="flex items-center gap-3 text-body py-2.5 border-b border-border last:border-0"
        >
          <span className="text-muted shrink-0 w-16">{log.action}</span>
          <span className="text-secondary">{log.table_name}</span>
          <span className="text-muted ml-auto">{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</span>
        </li>
      ))}
    </ul>
  );
}
