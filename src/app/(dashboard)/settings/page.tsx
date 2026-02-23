import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { SettingsForm } from '@/components/settings/SettingsForm';
import { getServerPermissions } from '@/lib/authz/server';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const perms = await getServerPermissions();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, display_name, role, display_currency, currency_overrides')
    .eq('id', user.id)
    .maybeSingle();
  const initialName = (profile?.full_name as string | undefined) ?? (user.user_metadata?.full_name as string | undefined) ?? '';
  const initialUsername = (profile?.display_name as string | undefined) ?? (user.user_metadata?.username as string | undefined) ?? '';
  const initialCurrency = (profile?.display_currency as string) ?? 'MMK';
  const initialCurrencyOverrides = (profile?.currency_overrides as Record<string, number>) ?? {};

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-title font-bold text-primary tracking-tight">Settings</h1>
        <p className="text-body text-secondary mt-0.5">Profile and preferences</p>
      </div>
      <SettingsForm
        user={user}
        initialName={initialName}
        initialUsername={initialUsername}
        initialCurrency={initialCurrency}
        initialCurrencyOverrides={initialCurrencyOverrides}
        role={(profile?.role as 'admin' | 'staff' | undefined) ?? (perms.role as 'admin' | 'staff')}
      />
    </div>
  );
}
