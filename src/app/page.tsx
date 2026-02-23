import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect('/dashboard');
  } catch {
    // Env missing or Supabase unreachable – show home so user can try login
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="text-center max-w-md">
        <h1 className="text-display font-bold text-primary tracking-tight">Legacy Revenue</h1>
        <p className="text-body text-secondary mt-2">
          Internal finance portal for music distribution revenue
        </p>
        <div className="mt-8 flex gap-3 justify-center">
          <Link
            href="/login"
            className="rounded-lg bg-teal text-background font-semibold py-2.5 px-5 text-body hover:opacity-90 transition"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg border border-border bg-card text-primary font-medium py-2.5 px-5 text-body hover:bg-elevated transition"
          >
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
