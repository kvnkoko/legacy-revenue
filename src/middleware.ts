import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // '/sb' is the same-origin passthrough to Supabase (see next.config.mjs).
    // It MUST be excluded: middleware redirects requests without a session to
    // /login, which would have bounced the sign-in request itself and made
    // logging in impossible.
    '/((?!sb/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
