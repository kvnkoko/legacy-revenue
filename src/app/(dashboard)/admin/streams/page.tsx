import { getServerPermissions } from '@/lib/authz/server';
import { getStreamConfigWithInactive } from '@/lib/streams/server';
import { AccessDenied } from '@/components/authz/AccessDenied';
import { StreamManagerClient } from '@/components/admin/streams/StreamManagerClient';

export const dynamic = 'force-dynamic';

export default async function AdminStreamsPage() {
  const perms = await getServerPermissions();
  if (!perms.profile) {
    return <AccessDenied permissionName="Authentication" message="Please sign in to continue." />;
  }
  if (!perms.isAdmin && !perms.can.configureStreams) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-title font-bold text-primary tracking-tight">Stream Management</h1>
          <p className="text-body text-secondary mt-0.5">Configure revenue streams, fields and lineage</p>
        </div>
        <AccessDenied
          permissionName="can_configure_streams"
          profile={perms.profile}
          message="Stream configuration requires the Editor or Admin role."
        />
      </div>
    );
  }

  const config = await getStreamConfigWithInactive();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-title font-bold text-primary tracking-tight">Stream Management</h1>
        <p className="text-body text-secondary mt-0.5">
          Add revenue streams (e.g. Apple Music, Tidal), define their fields and categories, and wire
          how they roll up. Every change is recorded in the audit log; streams with recorded data can
          only be archived, never deleted.
        </p>
      </div>
      <StreamManagerClient config={config} />
    </div>
  );
}
