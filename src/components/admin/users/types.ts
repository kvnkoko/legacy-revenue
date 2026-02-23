import type { PermissionMap } from '@/lib/authz/types';

export type ManagedUser = {
  id: string;
  full_name: string;
  display_name: string | null;
  email: string;
  role: 'admin' | 'staff';
  status: 'active' | 'suspended' | 'pending';
  permissions: PermissionMap;
  job_title: string | null;
  department: string | null;
  avatar_url: string | null;
  last_seen_at: string | null;
  invited_at: string | null;
  created_at: string | null;
  notes: string | null;
};

export type UserActivityRow = {
  sqlid: number;
  user_id: string | null;
  row_id: string | null;
  user_role: string | null;
  action: string;
  table_name: string;
  created_at: string;
  new_value: unknown;
};
