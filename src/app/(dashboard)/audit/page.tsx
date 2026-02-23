import { createClient } from '@/lib/supabase/server';
import { AuditTable } from '@/components/audit/AuditTable';
import { getServerPermissions } from '@/lib/authz/server';
import { AccessDenied } from '@/components/authz/AccessDenied';
import { getAppSettings } from '@/app/(dashboard)/admin/settings/actions';

export const dynamic = 'force-dynamic';

export default async function AuditPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const perms = await getServerPermissions();
  if (!perms.profile) {
    return <AccessDenied permissionName="Authentication" message="Please sign in to continue." />;
  }
  if (!perms.isAdmin && !perms.can.viewAuditLog) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-title font-bold text-primary tracking-tight">Audit Log</h1>
          <p className="text-body text-secondary mt-0.5">Recent data changes and imports</p>
        </div>
        <AccessDenied permissionName="can_view_audit_log" profile={perms.profile} />
      </div>
    );
  }

  const supabase = await createClient();
  let retentionDays = 365;
  try {
    const sessionSettings = await getAppSettings('session');
    const val = Number(sessionSettings?.audit_retention_days);
    if (val >= 30 && val <= 3650) retentionDays = val;
  } catch {
    // Use default
  }
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const cutoffIso = cutoff.toISOString();
  const { data: logs } = await supabase
    .from('audit_log')
    .select('*')
    .gte('created_at', cutoffIso)
    .order('created_at', { ascending: false })
    .limit(100);
  const userIds = Array.from(new Set((logs ?? []).map((l) => l.user_id).filter(Boolean))) as string[];
  const { data: profiles } = userIds.length
    ? await supabase.from('user_profiles').select('id, full_name, display_name').in('id', userIds)
    : { data: [] as { id: string; full_name: string; display_name: string | null }[] };
  const userNames = Object.fromEntries(
    (profiles ?? []).map((p) => [
      p.id,
      (p.full_name && p.full_name.trim()) || (p.display_name ? `@${p.display_name}` : null),
    ])
  ) as Record<string, string | null>;

  type AuditRow = { sqlid: number; user_id: string | null; user_name?: string | null; user_role?: string | null; user_email?: string | null; action: string; table_name: string; row_id: string | null; old_value: unknown; new_value: unknown; ip_address: string | null; created_at: string };
  const auditLogs: { id: number; user_id: string | null; user_name?: string | null; user_role?: string | null; user_email?: string | null; action: string; table_name: string; row_id: string | null; old_value: unknown; new_value: unknown; ip_address: string | null; created_at: string }[] = (logs ?? []).map((l: AuditRow) => ({ ...l, id: l.sqlid, row_id: l.row_id }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title font-bold text-primary tracking-tight">Audit Log</h1>
        <p className="text-body text-secondary mt-0.5">Recent data changes and imports</p>
      </div>
      <AuditTable
        logs={
          auditLogs as unknown as {
            id: number;
            user_id: string | null;
            action: string;
            table_name: string;
            row_id: string | number | null;
            old_value: unknown;
            new_value: unknown;
            ip_address: string | null;
            created_at: string;
          }[]
        }
        userNames={userNames}
        canExport={perms.isAdmin}
        initialUserFilter={typeof searchParams?.user === 'string' ? searchParams.user : 'all'}
      />
    </div>
  );
}
