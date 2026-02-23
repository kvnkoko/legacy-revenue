import { createBrowserClient } from '@supabase/ssr';

// Dev fallback when env inlining fails (e.g. running from parent dir)
const DEV_URL = 'https://nqjjptwktabqpjyvbkxc.supabase.co';
const DEV_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xampwdHdrdGFicXBqeXZia3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MDUxNzcsImV4cCI6MjA4NzA4MTE3N30.cZLr4DJ6YrHOtlXxRFlqGfcCU60RZ0-EnULuGuawKGc';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEV_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEV_KEY;
  if (url.includes('your-project') || key === 'your-anon-key') {
    throw new Error(
      'Supabase still using placeholder. Update .env.local with your project URL and anon key.'
    );
  }
  return createBrowserClient(url, key);
}
