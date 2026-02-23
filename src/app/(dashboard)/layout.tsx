import { DashboardShell } from '@/components/layout/DashboardShell';
import { createClient } from '@/lib/supabase/server';
import { getAppSettings } from '@/app/(dashboard)/admin/settings/actions';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let displayCurrency = 'MMK';
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
        .select('display_currency, currency_overrides')
        .eq('id', user.id)
        .maybeSingle();
      displayCurrency = (profile?.display_currency as string) ?? 'MMK';
      currencyOverrides = (profile?.currency_overrides as Record<string, number>) ?? {};
    }
    const sessionSettings = await getAppSettings('session');
    const val = Number(sessionSettings?.session_idle_minutes);
    if (val >= 5 && val <= 480) sessionIdleMinutes = val;
  } catch {
    // Use defaults if fetch fails
  }
  return (
    <DashboardShell
      initialCurrency={displayCurrency}
      initialCurrencyOverrides={currencyOverrides}
      sessionIdleMinutes={sessionIdleMinutes}
    >
      {children}
    </DashboardShell>
  );
}
