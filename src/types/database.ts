export type RevenueSummaryRow = {
  id: number;
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

export type RingtuneRow = {
  id: number;
  month: string;
  mpt: number;
  atom: number;
  ooredoo: number;
  total: number;
  created_at: string;
  updated_at: string;
};

export type MptRow = {
  id: number;
  month: string;
  legacy_ringtune: number;
  legacy_eauc: number;
  legacy_combo: number;
  etrade_ringtune: number;
  etrade_eauc: number;
  etrade_combo: number;
  fortune_ringtune: number;
  fortune_eauc: number;
  fortune_combo: number;
  unico_ringtune: number;
  unico_eauc: number;
  unico_combo: number;
  total: number;
  created_at: string;
  updated_at: string;
};

export type AuditLogRow = {
  id: number;
  user_id: string | null;
  action: string;
  table_name: string;
  row_id: number | null;
  old_value: unknown;
  new_value: unknown;
  ip_address: string | null;
  created_at: string;
};
