import { redirect } from 'next/navigation';
import { getServerPermissions } from '@/lib/authz/server';
import { AccessDenied } from '@/components/authz/AccessDenied';
import { AdminSettingsClient } from '@/components/admin/settings/AdminSettingsClient';
import { getAppSettings } from './actions';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const perms = await getServerPermissions();
  if (!perms.profile) redirect('/login');
  if (!perms.isAdmin && !perms.can.manageSettings) {
    return (
      <div className="space-y-6">
        <h1 className="text-title font-bold text-primary tracking-tight">Admin Settings</h1>
        <AccessDenied permissionName="can_manage_settings" profile={perms.profile} />
      </div>
    );
  }

  let orgSettings: Record<string, unknown> = {};
  let permSettings: Record<string, unknown> = {};
  let sessionSettings: Record<string, unknown> = {};
  let dataEntrySettings: Record<string, unknown> = {};
  try {
    const [org, perm, session, dataEntry] = await Promise.all([
      getAppSettings('organization'),
      getAppSettings('permissions'),
      getAppSettings('session'),
      getAppSettings('data-entry'),
    ]);
    orgSettings = org ?? { company_name: 'Legacy', timezone: 'Asia/Yangon' };
    permSettings = perm ?? {};
    sessionSettings = session ?? { session_idle_minutes: 60, audit_retention_days: 365 };
    dataEntrySettings = dataEntry ?? { duplicate_month_behavior: 'confirm' };
  } catch {
    orgSettings = { company_name: 'Legacy', timezone: 'Asia/Yangon' };
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title font-bold text-primary tracking-tight">Admin Settings</h1>
        <p className="text-body text-secondary mt-0.5">Organization-wide defaults and security policies</p>
      </div>
      <AdminSettingsClient
        initialOrgSettings={orgSettings}
        initialPermissions={permSettings}
        initialSession={sessionSettings}
        initialDataEntry={dataEntrySettings}
      />
    </div>
  );
}
