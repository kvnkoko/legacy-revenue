import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

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
    role: 'admin' | 'staff';
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
    if (profile == null && (user.user_metadata?.role === 'admin' || user.email === 'admin@legacy.com')) {
      profile = {
        role: 'admin',
        status: 'active',
        permissions: {
          can_enter_data: true,
          can_edit_data: true,
          can_delete_data: true,
          can_import_excel: true,
          can_export_data: true,
          can_view_analytics: true,
          can_view_streams: true,
          can_view_audit_log: true,
          can_manage_users: true,
          can_manage_settings: true,
          can_view_mpt_detail: true,
          can_view_sznb: true,
          can_view_international: true,
          can_view_telecom: true,
          can_view_flow: true,
        },
      };
    }
  }

  const can = (key: string) =>
    profile?.role === 'admin' || Boolean((profile?.permissions as Record<string, boolean> | null)?.[key]);
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
