'use client';

import { createClient } from '@/lib/supabase/client';

/**
 * Signs the person out and ALWAYS leaves them on the login page.
 *
 * Every caller used to do:
 *
 *     await supabase.auth.signOut();
 *     window.location.href = '/login';
 *
 * `signOut()` performs a network request to the Supabase host. Where that host
 * is unreachable (reported from Myanmar) the call rejects, so the redirect line
 * never ran and the Sign Out button appeared completely dead — the person stayed
 * signed in with no way out.
 *
 * Clearing the session locally is what actually signs someone out of this app:
 * the tokens live in browser storage and in cookies the middleware reads. So we
 * clear locally first, and treat revoking the token on the server as a
 * best-effort extra that must never block the redirect.
 */
export async function signOutAndRedirect(to = '/login'): Promise<void> {
  try {
    const supabase = createClient();
    // scope 'local' only touches this browser's stored session, so it succeeds
    // even when the Supabase host cannot be reached.
    await supabase.auth.signOut({ scope: 'local' });
    // Revoke server-side too when the network allows; never block on it.
    void supabase.auth.signOut({ scope: 'global' }).catch(() => {});
  } catch {
    // Fall through to the manual clear below.
  }

  // Belt and braces: drop any Supabase auth tokens still in browser storage, so
  // a failure above can never leave a stale session behind.
  try {
    for (const store of [window.localStorage, window.sessionStorage]) {
      const keys: string[] = [];
      for (let i = 0; i < store.length; i += 1) {
        const key = store.key(i);
        if (key && (key.startsWith('sb-') || key.includes('supabase.auth'))) keys.push(key);
      }
      keys.forEach((key) => store.removeItem(key));
    }
  } catch {
    // Private mode or blocked storage — nothing to clear.
  }

  // The middleware decides who is signed in from COOKIES, so a cookie left
  // behind sends the person straight back to the dashboard — the "Sign Out just
  // refreshes" loop. Expire every Supabase auth cookie (including chunked
  // .0/.1 variants) across the paths and domains they may have been set on.
  try {
    const names = document.cookie
      .split(';')
      .map((c) => c.split('=')[0]?.trim())
      .filter((n): n is string => Boolean(n) && (n.startsWith('sb-') || n.includes('supabase')));
    const domains = [undefined, window.location.hostname, `.${window.location.hostname}`];
    for (const name of names) {
      for (const domain of domains) {
        document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ''}`;
      }
    }
  } catch {
    // Cookies unavailable — the local sign-out above already cleared the session.
  }

  // Full navigation (not a client-side push) so every cached server component
  // and provider is rebuilt for a signed-out visitor.
  window.location.href = to;
}
