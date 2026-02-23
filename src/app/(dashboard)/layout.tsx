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
        .select('display_currency, currency_overrides')
        .eq('id', user.id)
        .maybeSingle();
      const raw = (profile?.display_currency as string) ?? 'MMK';
      displayCurrency = raw as CurrencyCode;
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
      initialCurrency={displayCurrency as CurrencyCode}
      initialCurrencyOverrides={currencyOverrides}
      sessionIdleMinutes={sessionIdleMinutes}
    >
      {children}
    </DashboardShell>
  );
}
