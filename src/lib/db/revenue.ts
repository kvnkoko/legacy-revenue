import { createClient } from '@/lib/supabase/server';

export type RevenueSummaryRow = {
  sqlid: number;
  month: string;
  ringtune: number;
  eauc: number;
  combo: number;
  sznb: number;
  flow_music_zone: number;
  flow_subscription: number;
  flow_data_pack: number;
  youtube: number;
  spotify: number;
  tiktok: number;
  total: number;
  created_at: string;
  updated_at: string;
};

export async function getRevenueSummary() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('revenue_summary')
    .select('*')
    .order('month', { ascending: true });
  if (error) throw error;
  return (data ?? []) as RevenueSummaryRow[];
}

export async function getRevenueSummaryForMonth(month: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('revenue_summary')
    .select('*')
    .eq('month', month)
    .single();
  if (error) throw error;
  return data as RevenueSummaryRow;
}
