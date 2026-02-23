import { DashboardShell } from '@/components/layout/DashboardShell';
import { createClient } from '@/lib/supabase/server';
import { getAppSettings } from '@/app/(dashboard)/admin/settings/actions';
import type { CurrencyCode } from '@/lib/currency';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let displayCurrency: CurrencyCode = 'MMK';
  let currencyOverrides: Record<string, number> = {};
  let sessionIdleMinutes = 0;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('display_currency, currency_overrides, last_seen_at')
        .eq('id', user.id)
        .maybeSingle();
      const raw = (profile?.display_currency as string) ?? 'MMK';
      displayCurrency = raw as CurrencyCode;
      currencyOverrides = (profile?.currency_overrides as Record<string, number>) ?? {};
      // Update last_seen_at at most every 2 minutes to avoid excessive writes
      const lastSeen = profile?.last_seen_at ? new Date(profile.last_seen_at as string).getTime() : 0;
      const now = Date.now();
      if (now - lastSeen > 2 * 60 * 1000) {
        await supabase
          .from('user_profiles')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', user.id);
      }
    }
    const sessionSettings = await getAppSettings('session');
    const val = Number(sessionSettings?.session_idle_minutes);
    if (val >= 5 && val <= 480) sessionIdleMinutes = val;
  } catch {
    // Use defaults if fetch fails
  }
  return (
    <DashboardShell
      initialCurrency={displayCurrency as CurrencyCode}
      initialCurrencyOverrides={currencyOverrides}
      sessionIdleMinutes={sessionIdleMinutes}
    >
      {children}
    </DashboardShell>
  );
}
