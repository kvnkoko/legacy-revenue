import { createBrowserClient } from '@supabase/ssr';

/**
 * There is deliberately no hardcoded fallback project here.
 *
 * This file previously embedded the production URL and anon key as a "dev
 * fallback". That meant any environment where env inlining failed — a local
 * run from the wrong directory, or a deploy missing its env vars — would
 * silently connect to the LIVE database instead of failing. Pointing a dev or
 * misconfigured build at production data is exactly how real numbers get
 * overwritten, so a missing configuration now fails loudly and visibly.
 */
function missing(name: string): never {
  throw new Error(
    `${name} is not set. The app cannot connect to the database.\n` +
      'Local: add it to .env.local, then restart the dev server.\n' +
      'Production: set it in the Vercel project environment variables and redeploy.'
  );
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) missing('NEXT_PUBLIC_SUPABASE_URL');
  if (!key) missing('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (url.includes('your-project') || key === 'your-anon-key') {
    throw new Error(
      'Supabase is still using placeholder values. Update .env.local with your project URL and anon key.'
    );
  }

  /*
   * In the browser, Supabase traffic travels through this app's own origin
   * (/sb, see the rewrite in next.config.mjs) instead of
   * https://<project>.supabase.co, because staff on restricted networks could
   * load the portal but every request to that host failed ("Failed to fetch").
   *
   * IMPORTANT: the project URL passed to createBrowserClient must stay the REAL
   * Supabase URL. @supabase/ssr derives the session cookie name from it
   * (sb-<project-ref>-auth-token). Passing the proxy URL renamed that cookie,
   * so the browser and the server no longer read the same session: the server
   * still saw a signed-in admin while the browser saw nobody and fell back to
   * viewer defaults, and Sign Out cleared one cookie while the middleware kept
   * redirecting on the other — an endless refresh.
   *
   * So only the TRANSPORT is redirected, via a custom fetch. Cookie naming,
   * token refresh and everything else behave exactly as before.
   */
  const base = url.replace(/\/$/, '');
  const useProxy =
    typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SUPABASE_DIRECT !== '1';

  if (!useProxy) return createBrowserClient(url, key);

  const toSameOrigin = (target: string) =>
    target.startsWith(base) ? `${window.location.origin}/sb${target.slice(base.length)}` : target;

  const proxyFetch: typeof fetch = (input, init) => {
    if (typeof input === 'string') return fetch(toSameOrigin(input), init);
    if (input instanceof URL) return fetch(toSameOrigin(input.toString()), init);
    if (typeof Request !== 'undefined' && input instanceof Request) {
      const rewritten = toSameOrigin(input.url);
      return rewritten === input.url ? fetch(input, init) : fetch(new Request(rewritten, input), init);
    }
    return fetch(input, init);
  };

  return createBrowserClient(url, key, { global: { fetch: proxyFetch } });
}
