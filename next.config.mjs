import path from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env.local');
const env = {};
try {
  const content = readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '');
  content.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  });
} catch (_) {}

// Only inline keys that actually have a value. Inlining '' used to make a
// misconfigured build look configured, which then fell through to the
// hardcoded production fallback in lib/supabase/client.ts.
const publicEnv = {};
const missingEnv = [];
for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']) {
  const value = env[name] ?? process.env[name];
  if (value) publicEnv[name] = value;
  else missingEnv.push(name);
}

// Fail the BUILD, not the running site. If these are absent on Vercel the
// deployment is rejected and the previous working deployment keeps serving
// traffic — far safer than shipping a build that boots and then cannot reach
// the database. (Previously a missing var was inlined as '' and silently fell
// back to hardcoded production credentials.)
if (missingEnv.length && process.env.NODE_ENV === 'production') {
  throw new Error(
    `Cannot build: missing ${missingEnv.join(' and ')}.\n` +
      'Set these in Vercel → Project Settings → Environment Variables (Production), ' +
      'then redeploy. The previous deployment stays live until this is fixed.'
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['@phosphor-icons/react'],
  },
  env: publicEnv,
};

export default nextConfig;
