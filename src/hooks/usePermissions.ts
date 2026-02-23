'use client';

import { useAuthzContext } from '@/components/authz/AuthzProvider';
import type { UserPermissions } from '@/lib/authz/types';

export function usePermissions(): UserPermissions {
  const authz = useAuthzContext();
  return {
    role: authz.role,
    can: authz.can,
    isAdmin: authz.isAdmin,
    isStaff: authz.isStaff,
    profile: authz.profile,
    loading: authz.loading,
  };
}
