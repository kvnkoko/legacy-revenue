import { getServerPermissions } from '@/lib/authz/server';
import { AccessDenied } from '@/components/authz/AccessDenied';
import { ImportExcelClient } from '@/components/import/ImportExcelClient';

export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  const perms = await getServerPermissions();
  if (!perms.profile) {
    return <AccessDenied permissionName="Authentication" message="Please sign in to continue." />;
  }
  if (!perms.isAdmin && !perms.can.importExcel) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-title font-bold text-primary tracking-tight">Import Excel</h1>
          <p className="text-body text-secondary mt-0.5">Upload .xlsx or .xls to bulk import revenue data</p>
        </div>
        <AccessDenied permissionName="can_import_excel" profile={perms.profile} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-title font-bold text-primary tracking-tight">Import Excel</h1>
        <p className="text-body text-secondary mt-0.5">
          Upload .xlsx or .xls to bulk import revenue data. New streams and fields added in Stream
          Management are recognized automatically — download the template below to get the current
          column layout.
        </p>
      </div>
      <ImportExcelClient canExport={perms.isAdmin || perms.can.exportData} />
    </div>
  );
}
