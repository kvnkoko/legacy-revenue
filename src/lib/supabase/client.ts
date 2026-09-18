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
   * In the browser, talk to Supabase through this app's own origin (/sb, see
   * the rewrite in next.config.mjs) instead of https://<project>.supabase.co.
   *
   * Staff on restricted networks could load the portal but every sign-in died
   * with "Failed to fetch", because the page came from our domain while the
   * auth request went to a host their network blocks. Routing through our own
   * origin removes that second host entirely. Server-side code keeps using the
   * direct URL: it runs on Vercel, where the host is reachable, and it must not
   * call back through its own rewrite.
   *
   * Set NEXT_PUBLIC_SUPABASE_DIRECT=1 to go straight to Supabase again.
   */
  const useProxy =
    typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SUPABASE_DIRECT !== '1';
  const browserUrl = useProxy ? `${window.location.origin}/sb` : url;

  return createBrowserClient(browserUrl, key);
}
