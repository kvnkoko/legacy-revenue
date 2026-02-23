-- Legacy Revenue Finance Portal - Database Schema
-- Run this in Supabase SQL Editor. Enable RLS on all tables.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============ AUDIT LOG (create first, referenced by triggers) ============
CREATE TABLE audit_log (
  sqlid BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'IMPORT')),
  table_name TEXT NOT NULL,
  row_id TEXT,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read and insert (append-only); no update/delete
CREATE POLICY "Authenticated read audit_log" ON audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert audit_log" ON audit_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "No update delete audit_log" ON audit_log FOR UPDATE TO authenticated USING (false);
CREATE POLICY "No delete audit_log" ON audit_log FOR DELETE TO authenticated USING (false);

-- ============ REVENUE TABLES ============

CREATE TABLE revenue_summary (
  sqlid BIGSERIAL PRIMARY KEY,
  month DATE NOT NULL UNIQUE,
  ringtune NUMERIC(18,2) DEFAULT 0,
  eauc NUMERIC(18,2) DEFAULT 0,
  combo NUMERIC(18,2) DEFAULT 0,
  sznb NUMERIC(18,2) DEFAULT 0,
  flow_music_zone NUMERIC(18,2) DEFAULT 0,
  flow_subscription NUMERIC(18,2) DEFAULT 0,
  flow_data_pack NUMERIC(18,2) DEFAULT 0,
  youtube NUMERIC(18,2) DEFAULT 0,
  spotify NUMERIC(18,2) DEFAULT 0,
  tiktok NUMERIC(18,2) DEFAULT 0,
  total NUMERIC(18,2) GENERATED ALWAYS AS (
    COALESCE(ringtune,0) + COALESCE(eauc,0) + COALESCE(combo,0) + COALESCE(sznb,0)
    + COALESCE(flow_music_zone,0) + COALESCE(flow_subscription,0) + COALESCE(flow_data_pack,0)
    + COALESCE(youtube,0) + COALESCE(spotify,0) + COALESCE(tiktok,0)
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ringtune (
  sqlid BIGSERIAL PRIMARY KEY,
  month DATE NOT NULL UNIQUE,
  mpt NUMERIC(18,2) DEFAULT 0,
  atom NUMERIC(18,2) DEFAULT 0,
  ooredoo NUMERIC(18,2) DEFAULT 0,
  total NUMERIC(18,2) GENERATED ALWAYS AS (COALESCE(mpt,0) + COALESCE(atom,0) + COALESCE(ooredoo,0)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mpt (
  sqlid BIGSERIAL PRIMARY KEY,
  month DATE NOT NULL UNIQUE,
  legacy_ringtune NUMERIC(18,2) DEFAULT 0,
  legacy_eauc NUMERIC(18,2) DEFAULT 0,
  legacy_combo NUMERIC(18,2) DEFAULT 0,
  etrade_ringtune NUMERIC(18,2) DEFAULT 0,
  etrade_eauc NUMERIC(18,2) DEFAULT 0,
  etrade_combo NUMERIC(18,2) DEFAULT 0,
  fortune_ringtune NUMERIC(18,2) DEFAULT 0,
  fortune_eauc NUMERIC(18,2) DEFAULT 0,
  fortune_combo NUMERIC(18,2) DEFAULT 0,
  unico_ringtune NUMERIC(18,2) DEFAULT 0,
  unico_eauc NUMERIC(18,2) DEFAULT 0,
  unico_combo NUMERIC(18,2) DEFAULT 0,
  total NUMERIC(18,2) GENERATED ALWAYS AS (
    COALESCE(legacy_ringtune,0)+COALESCE(legacy_eauc,0)+COALESCE(legacy_combo,0)
    +COALESCE(etrade_ringtune,0)+COALESCE(etrade_eauc,0)+COALESCE(etrade_combo,0)
    +COALESCE(fortune_ringtune,0)+COALESCE(fortune_eauc,0)+COALESCE(fortune_combo,0)
    +COALESCE(unico_ringtune,0)+COALESCE(unico_eauc,0)+COALESCE(unico_combo,0)
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE atom (
  sqlid BIGSERIAL PRIMARY KEY,
  month DATE NOT NULL UNIQUE,
  ringtune NUMERIC(18,2) DEFAULT 0,
  eauc NUMERIC(18,2) DEFAULT 0,
  combo NUMERIC(18,2) DEFAULT 0,
  total NUMERIC(18,2) GENERATED ALWAYS AS (COALESCE(ringtune,0) + COALESCE(eauc,0) + COALESCE(combo,0)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE eauc (
  sqlid BIGSERIAL PRIMARY KEY,
  month DATE NOT NULL UNIQUE,
  mpt NUMERIC(18,2) DEFAULT 0,
  atom NUMERIC(18,2) DEFAULT 0,
  total NUMERIC(18,2) GENERATED ALWAYS AS (COALESCE(mpt,0) + COALESCE(atom,0)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE combo (
  sqlid BIGSERIAL PRIMARY KEY,
  month DATE NOT NULL UNIQUE,
  mpt NUMERIC(18,2) DEFAULT 0,
  atom NUMERIC(18,2) DEFAULT 0,
  total NUMERIC(18,2) GENERATED ALWAYS AS (COALESCE(mpt,0) + COALESCE(atom,0)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE local (
  sqlid BIGSERIAL PRIMARY KEY,
  month DATE NOT NULL UNIQUE,
  mpt NUMERIC(18,2) DEFAULT 0,
  atom NUMERIC(18,2) DEFAULT 0,
  ooredoo NUMERIC(18,2) DEFAULT 0,
  total NUMERIC(18,2) GENERATED ALWAYS AS (COALESCE(mpt,0) + COALESCE(atom,0) + COALESCE(ooredoo,0)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sznb (
  sqlid BIGSERIAL PRIMARY KEY,
  month DATE NOT NULL UNIQUE,
  mpt NUMERIC(18,2) DEFAULT 0,
  atom NUMERIC(18,2) DEFAULT 0,
  kpay_mini_app NUMERIC(18,2) DEFAULT 0,
  kpay_qr NUMERIC(18,2) DEFAULT 0,
  kpay_ecommerce NUMERIC(18,2) DEFAULT 0,
  wave_money NUMERIC(18,2) DEFAULT 0,
  dinger NUMERIC(18,2) DEFAULT 0,
  total NUMERIC(18,2) GENERATED ALWAYS AS (
    COALESCE(mpt,0)+COALESCE(atom,0)+COALESCE(kpay_mini_app,0)+COALESCE(kpay_qr,0)
    +COALESCE(kpay_ecommerce,0)+COALESCE(wave_money,0)+COALESCE(dinger,0)
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE flow_subscription (
  sqlid BIGSERIAL PRIMARY KEY,
  month DATE NOT NULL UNIQUE,
  mpt NUMERIC(18,2) DEFAULT 0,
  kpay NUMERIC(18,2) DEFAULT 0,
  total NUMERIC(18,2) GENERATED ALWAYS AS (COALESCE(mpt,0) + COALESCE(kpay,0)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE international (
  sqlid BIGSERIAL PRIMARY KEY,
  month DATE NOT NULL UNIQUE,
  solution_one NUMERIC(18,2) DEFAULT 0,
  fuga NUMERIC(18,2) DEFAULT 0,
  believe NUMERIC(18,2) DEFAULT 0,
  total NUMERIC(18,2) GENERATED ALWAYS AS (COALESCE(solution_one,0) + COALESCE(fuga,0) + COALESCE(believe,0)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE youtube (
  sqlid BIGSERIAL PRIMARY KEY,
  month DATE NOT NULL UNIQUE,
  solution_one NUMERIC(18,2) DEFAULT 0,
  fuga NUMERIC(18,2) DEFAULT 0,
  believe NUMERIC(18,2) DEFAULT 0,
  total NUMERIC(18,2) GENERATED ALWAYS AS (COALESCE(solution_one,0) + COALESCE(fuga,0) + COALESCE(believe,0)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE spotify (
  sqlid BIGSERIAL PRIMARY KEY,
  month DATE NOT NULL UNIQUE,
  fuga NUMERIC(18,2) DEFAULT 0,
  believe NUMERIC(18,2) DEFAULT 0,
  total NUMERIC(18,2) GENERATED ALWAYS AS (COALESCE(fuga,0) + COALESCE(believe,0)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tiktok (
  sqlid BIGSERIAL PRIMARY KEY,
  month DATE NOT NULL UNIQUE,
  fuga NUMERIC(18,2) DEFAULT 0,
  believe NUMERIC(18,2) DEFAULT 0,
  total NUMERIC(18,2) GENERATED ALWAYS AS (COALESCE(fuga,0) + COALESCE(believe,0)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============ UPDATED_AT TRIGGER ============
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_revenue_summary BEFORE UPDATE ON revenue_summary FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_ringtune BEFORE UPDATE ON ringtune FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_mpt BEFORE UPDATE ON mpt FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_atom BEFORE UPDATE ON atom FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_eauc BEFORE UPDATE ON eauc FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_combo BEFORE UPDATE ON combo FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_local BEFORE UPDATE ON local FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_sznb BEFORE UPDATE ON sznb FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_flow_subscription BEFORE UPDATE ON flow_subscription FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_international BEFORE UPDATE ON international FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_youtube BEFORE UPDATE ON youtube FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_spotify BEFORE UPDATE ON spotify FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_tiktok BEFORE UPDATE ON tiktok FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============ ROW LEVEL SECURITY ============
-- Authenticated users can do everything on data tables (app will enforce org/role via app logic; for single-tenant you can allow all authenticated)
ALTER TABLE revenue_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE ringtune ENABLE ROW LEVEL SECURITY;
ALTER TABLE mpt ENABLE ROW LEVEL SECURITY;
ALTER TABLE atom ENABLE ROW LEVEL SECURITY;
ALTER TABLE eauc ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo ENABLE ROW LEVEL SECURITY;
ALTER TABLE local ENABLE ROW LEVEL SECURITY;
ALTER TABLE sznb ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_subscription ENABLE ROW LEVEL SECURITY;
ALTER TABLE international ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube ENABLE ROW LEVEL SECURITY;
ALTER TABLE spotify ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiktok ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access revenue_summary" ON revenue_summary FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access ringtune" ON ringtune FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access mpt" ON mpt FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access atom" ON atom FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access eauc" ON eauc FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access combo" ON combo FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access local" ON local FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access sznb" ON sznb FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access flow_subscription" ON flow_subscription FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access international" ON international FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access youtube" ON youtube FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access spotify" ON spotify FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access tiktok" ON tiktok FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ AUDIT TRIGGER HELPER ============
-- Audit is written from application layer with user_id and ip; no DB trigger for audit_log to avoid circular dependency.
-- Optionally add triggers that call a SECURITY DEFINER function to insert into audit_log if you want server-side audit.

COMMENT ON TABLE audit_log IS 'Append-only audit log; written by app (and optionally triggers).';
