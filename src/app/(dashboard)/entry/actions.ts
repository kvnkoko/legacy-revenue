'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/authz/server';

export type EntryPayload = {
  month: string;
  mpt: Record<string, number>;
  atom: {
    ringtune: number;
    eauc: number;
    combo: number;
  };
  ringtune_ooredoo: number;
  sznb: Record<string, number>;
  flow_mpt: number;
  flow_kpay: number;
  youtube: Record<string, number>;
  spotify: Record<string, number>;
  tiktok: Record<string, number>;
};

function num(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') return parseFloat(v) || 0;
  return 0;
}

export async function addMonth(payload: EntryPayload) {
  const perms = await requirePermission('can_enter_data');
  const supabase = await createClient();

  const month = payload.month;
  const { data: existing } = await supabase.from('revenue_summary').select('month').eq('month', month).maybeSingle();
  if (existing && !perms.isAdmin && !perms.can.editData) {
    throw new Error('You can add new months, but editing existing months requires can_edit_data permission.');
  }
  const m = payload.mpt ?? {};
  const legacyRt = num(m.legacy_ringtune);
  const legacyE = num(m.legacy_eauc);
  const legacyC = num(m.legacy_combo);
  const etradeRt = num(m.etrade_ringtune);
  const etradeE = num(m.etrade_eauc);
  const etradeC = num(m.etrade_combo);
  const fortuneRt = num(m.fortune_ringtune);
  const fortuneE = num(m.fortune_eauc);
  const fortuneC = num(m.fortune_combo);
  const unicoRt = num(m.unico_ringtune);
  const unicoE = num(m.unico_eauc);
  const unicoC = num(m.unico_combo);
  const mptTotal = legacyRt + legacyE + legacyC + etradeRt + etradeE + etradeC + fortuneRt + fortuneE + fortuneC + unicoRt + unicoE + unicoC;
  const ringtuneAtom = num(payload.atom?.ringtune);
  const ringtuneOoredoo = num(payload.ringtune_ooredoo);
  const eaucAtom = num(payload.atom?.eauc);
  const comboAtom = num(payload.atom?.combo);
  const sznbRow = payload.sznb ?? {};
  const yt = payload.youtube ?? {};
  const sp = payload.spotify ?? {};
  const tt = payload.tiktok ?? {};

  const upsert = async (table: string, row: Record<string, unknown>) => {
    const payloadRow = { ...row, month };
    const { error } = await supabase.from(table).upsert(payloadRow, { onConflict: 'month' });
    if (error) throw new Error(`${table}: ${error.message}`);
  };

  await upsert('mpt', {
    legacy_ringtune: legacyRt,
    legacy_eauc: legacyE,
    legacy_combo: legacyC,
    etrade_ringtune: etradeRt,
    etrade_eauc: etradeE,
    etrade_combo: etradeC,
    fortune_ringtune: fortuneRt,
    fortune_eauc: fortuneE,
    fortune_combo: fortuneC,
    unico_ringtune: unicoRt,
    unico_eauc: unicoE,
    unico_combo: unicoC,
  });
  await upsert('atom', {
    ringtune: ringtuneAtom,
    eauc: eaucAtom,
    combo: comboAtom,
  });
  await upsert('ringtune', { ooredoo: ringtuneOoredoo });
  await upsert('local', {
    mpt: mptTotal,
    atom: ringtuneAtom + eaucAtom + comboAtom,
    ooredoo: ringtuneOoredoo,
  });
  await upsert('sznb', {
    mpt: num(sznbRow.mpt),
    atom: num(sznbRow.atom),
    kpay_mini_app: num(sznbRow.kpay_mini_app),
    kpay_qr: num(sznbRow.kpay_qr),
    kpay_ecommerce: num(sznbRow.kpay_ecommerce),
    wave_money: num(sznbRow.wave_money),
    dinger: num(sznbRow.dinger),
  });
  await upsert('flow_subscription', { mpt: num(payload.flow_mpt), kpay: num(payload.flow_kpay) });
  await upsert('youtube', {
    solution_one: num(yt.solution_one),
    fuga: num(yt.fuga),
    believe: num(yt.believe),
  });
  await upsert('spotify', { fuga: num(sp.fuga), believe: num(sp.believe) });
  await upsert('tiktok', { fuga: num(tt.fuga), believe: num(tt.believe) });
  await upsert('international', {
    solution_one: num(yt.solution_one),
    fuga: num(yt.fuga) + num(sp.fuga) + num(tt.fuga),
    believe: num(yt.believe) + num(sp.believe) + num(tt.believe),
  });
  revalidatePath('/dashboard');
  revalidatePath('/streams');
  revalidatePath('/entry');
  revalidatePath('/analytics');
  revalidatePath('/import');
}
