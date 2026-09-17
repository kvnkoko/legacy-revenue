import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { normalizePermissions } from '@/lib/authz/utils';
import type { PermissionKey, Role } from '@/lib/authz/types';

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.next({ request });
  }
  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  type MiddlewareProfile = {
    role: Role;
    status: 'active' | 'suspended' | 'pending';
    permissions: Record<string, boolean> | null;
  };
  let profile: MiddlewareProfile | null = null;
  if (user) {
    const byId = await supabase
      .from('user_profiles')
      .select('role, status, permissions')
      .eq('id', user.id)
      .maybeSingle();
    if (!byId.error) {
      profile = (byId.data as MiddlewareProfile | null) ?? null;
    } else {
      const byLegacy = await supabase
        .from('user_profiles')
        .select('role, status, permissions')
        .eq('user_id', user.id)
        .maybeSingle();
      profile = (byLegacy.data as MiddlewareProfile | null) ?? null;
    }
    // No synthetic-admin fallback. user_metadata is writable by the user
    // themselves, so trusting user_metadata.role (or a hardcoded email) would
    // let any signed-up account grant itself admin routes. Access comes only
    // from a real user_profiles row; RLS remains the ultimate authority.
  }

  // Resolve exactly like the app does (role defaults + per-user overrides).
  // Reading the raw permissions column here was the cause of users who had
  // been given a role still being bounced off their own tabs: the column is
  // empty for role-based users, so every check silently returned false.
  const effective = profile ? normalizePermissions(profile.role, profile.permissions) : null;
  // When the profile row could not be read at all (transient DB/network error,
  // or a restrictive RLS predicate) we do NOT redirect: every protected page
  // re-checks with getServerPermissions() and RLS is the real authority, so
  // failing open here avoids locking legitimate admins out of their own portal
  // while still never granting data access.
  const can = (key: PermissionKey) => (effective ? Boolean(effective[key]) : true);
  const isAuthPage =
    request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup';
  if (!user && !isAuthPage && request.nextUrl.pathname !== '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }
  if (user && request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }
  if (user && profile?.status === 'suspended' && !isAuthPage) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('reason', 'suspended');
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname.startsWith('/admin/users') && !can('can_manage_users')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.searchParams.set('denied', 'users');
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname.startsWith('/admin/settings') && !can('can_manage_settings')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.searchParams.set('denied', 'settings');
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname.startsWith('/audit') && !can('can_view_audit_log')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.searchParams.set('denied', 'audit');
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
