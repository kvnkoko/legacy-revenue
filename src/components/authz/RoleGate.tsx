'use client';

import { usePermissions } from '@/hooks/usePermissions';
import { AccessDenied } from '@/components/authz/AccessDenied';
import type { Role } from '@/lib/authz/types';

export function RoleGate({
  role,
  children,
  fallback,
}: {
  role: Role;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const perms = usePermissions();
  if (perms.loading) return null;
  if (perms.role !== role) {
    return <>{fallback ?? <AccessDenied permissionName={`${role} role`} profile={perms.profile} />}</>;
  }
  return <>{children}</>;
}
