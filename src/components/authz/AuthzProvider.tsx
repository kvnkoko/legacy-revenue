'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserProfile } from '@/lib/authz/types';
import { profileToUserPermissions } from '@/lib/authz/utils';
import { ADMIN_PERMISSIONS, STAFF_DEFAULT_PERMISSIONS } from '@/lib/permission-presets';

type AuthzContextValue = ReturnType<typeof profileToUserPermissions> & {
  refreshProfile: () => Promise<void>;
};

const AuthzContext = createContext<AuthzContextValue | null>(null);

function defaultProfile(userId: string, email: string | undefined): UserProfile {
  return {
    id: userId,
    email: email ?? '',
    full_name: email ?? '',
    display_name: null,
    role: 'staff',
    permissions: STAFF_DEFAULT_PERMISSIONS,
    job_title: null,
    department: null,
    avatar_url: null,
    status: 'active',
    last_seen_at: null,
    invited_by: null,
    invited_at: null,
    onboarded_at: null,
    notes: null,
    created_at: null,
    updated_at: null,
  };
}

export function AuthzProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    let data: Record<string, unknown> | null = null;
    const byId = await supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle();
    if (!byId.error) {
      data = (byId.data as Record<string, unknown> | null) ?? null;
    } else {
      const byLegacy = await supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle();
      data = (byLegacy.data as Record<string, unknown> | null) ?? null;
    }

    if (!data) {
      const fallback = defaultProfile(user.id, user.email);
      if (user.user_metadata?.role === 'admin' || user.email === 'admin@legacy.com') {
        fallback.role = 'admin';
        fallback.permissions = ADMIN_PERMISSIONS;
      }
      setProfile(fallback);
      setLoading(false);
      return;
    }
    const normalized: UserProfile = {
      ...defaultProfile(user.id, user.email),
      ...(data as Partial<UserProfile>),
      id: (data.id as string | undefined) ?? (data.user_id as string | undefined) ?? user.id,
      email: (data.email as string | undefined) ?? user.email ?? '',
      role: (data.role as 'admin' | 'staff' | undefined) ?? ((user.user_metadata?.role as 'admin' | 'staff' | undefined) ?? 'staff'),
    };
    if (normalized.role === 'admin') {
      normalized.permissions = ADMIN_PERMISSIONS;
    }
    setProfile(normalized);
    setLoading(false);
  };

  useEffect(() => {
    loadProfile();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      loadProfile();
    });
    return () => sub.subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo<AuthzContextValue>(() => {
    return {
      ...profileToUserPermissions(profile, loading),
      refreshProfile: loadProfile,
    };
  }, [profile, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  return <AuthzContext.Provider value={value}>{children}</AuthzContext.Provider>;
}

export function useAuthzContext() {
  const ctx = useContext(AuthzContext);
  if (!ctx) {
    return {
      ...profileToUserPermissions(null, true),
      refreshProfile: async () => {},
    };
  }
  return ctx;
}
