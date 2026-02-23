import { StreamsView } from './StreamsView';
import { getServerPermissions } from '@/lib/authz/server';
import { AccessDenied } from '@/components/authz/AccessDenied';

export const dynamic = 'force-dynamic';

export default async function StreamsPage() {
  const perms = await getServerPermissions();
  if (!perms.profile) {
    return <AccessDenied permissionName="Authentication" message="Please sign in to continue." />;
  }
  if (!perms.isAdmin && !perms.can.viewStreams) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-title font-bold text-primary tracking-tight">Revenue Streams</h1>
          <p className="text-body text-secondary mt-0.5">View revenue by stream</p>
        </div>
        <AccessDenied permissionName="can_view_streams" profile={perms.profile} />
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-title font-bold text-primary tracking-tight">Revenue Streams</h1>
        <p className="text-body text-secondary mt-0.5">View revenue by stream</p>
      </div>
      <StreamsView />
    </div>
  );
}
