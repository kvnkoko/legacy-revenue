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
  return createBrowserClient(url, key);
}
