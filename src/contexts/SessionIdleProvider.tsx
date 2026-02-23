'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function SessionIdleProvider({
  children,
  idleMinutes = 60,
}: {
  children: React.ReactNode;
  idleMinutes?: number;
}) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ms = Math.max(5 * 60 * 1000, Math.min(480 * 60 * 1000, idleMinutes * 60 * 1000));

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/login?reason=idle');
      router.refresh();
    }, ms);
  }, [ms, router]);

  useEffect(() => {
    if (idleMinutes <= 0) return;
    resetTimer();
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [idleMinutes, resetTimer]);

  return <>{children}</>;
}
