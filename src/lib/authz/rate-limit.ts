import { createClient } from '@/lib/supabase/server';

export async function assertAdminRateLimit(userId: string, operation: string, maxPerHour = 20) {
  const supabase = await createClient();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('audit_log')
    .select('sqlid', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('table_name', 'user_management')
    .gte('created_at', oneHourAgo);
  if (error) throw new Error(error.message);
  if ((count ?? 0) >= maxPerHour) {
    throw new Error(`Rate limit exceeded for ${operation}. Maximum ${maxPerHour} user operations per hour.`);
  }
}
