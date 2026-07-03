-- =============================================================
-- FILE: 001_schema.sql
-- =============================================================
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


-- =============================================================
-- FILE: 002_rls_audit.sql
-- =============================================================
-- RLS: Enable on all tables. Authenticated users can read/write; audit_log append-only.
-- Audit: Trigger to write to audit_log on INSERT/UPDATE/DELETE (except audit_log).

-- =============================================================================
-- AUDIT TRIGGER FUNCTION
-- =============================================================================
CREATE OR REPLACE FUNCTION audit_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
  old_json JSONB;
  new_json JSONB;
  row_id_val TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    old_json := to_jsonb(OLD);
    new_json := NULL;
    row_id_val := (OLD).sqlid::TEXT;
    INSERT INTO audit_log (user_id, action, table_name, row_id, old_value, new_value)
    VALUES (auth.uid(), 'DELETE', TG_TABLE_NAME, row_id_val, old_json, NULL);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);
    row_id_val := (NEW).sqlid::TEXT;
    INSERT INTO audit_log (user_id, action, table_name, row_id, old_value, new_value)
    VALUES (auth.uid(), 'UPDATE', TG_TABLE_NAME, row_id_val, old_json, new_json);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    new_json := to_jsonb(NEW);
    row_id_val := (NEW).sqlid::TEXT;
    INSERT INTO audit_log (user_id, action, table_name, row_id, old_value, new_value)
    VALUES (auth.uid(), 'INSERT', TG_TABLE_NAME, row_id_val, NULL, new_json);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated and service role
-- (audit_log insert runs with SECURITY DEFINER so it can write even if RLS blocks)

-- =============================================================================
-- DROP EXISTING (so this script can be re-run safely)
-- =============================================================================
DROP TRIGGER IF EXISTS audit_trigger ON revenue_summary;
DROP TRIGGER IF EXISTS audit_trigger ON ringtune;
DROP TRIGGER IF EXISTS audit_trigger ON mpt;
DROP TRIGGER IF EXISTS audit_trigger ON atom;
DROP TRIGGER IF EXISTS audit_trigger ON eauc;
DROP TRIGGER IF EXISTS audit_trigger ON combo;
DROP TRIGGER IF EXISTS audit_trigger ON local;
DROP TRIGGER IF EXISTS audit_trigger ON sznb;
DROP TRIGGER IF EXISTS audit_trigger ON flow_subscription;
DROP TRIGGER IF EXISTS audit_trigger ON international;
DROP TRIGGER IF EXISTS audit_trigger ON youtube;
DROP TRIGGER IF EXISTS audit_trigger ON spotify;
DROP TRIGGER IF EXISTS audit_trigger ON tiktok;

-- =============================================================================
-- AUDIT TRIGGERS ON ALL REVENUE TABLES (not on audit_log)
-- =============================================================================
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON revenue_summary FOR EACH ROW EXECUTE PROCEDURE audit_trigger_fn();
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON ringtune FOR EACH ROW EXECUTE PROCEDURE audit_trigger_fn();
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON mpt FOR EACH ROW EXECUTE PROCEDURE audit_trigger_fn();
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON atom FOR EACH ROW EXECUTE PROCEDURE audit_trigger_fn();
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON eauc FOR EACH ROW EXECUTE PROCEDURE audit_trigger_fn();
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON combo FOR EACH ROW EXECUTE PROCEDURE audit_trigger_fn();
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON local FOR EACH ROW EXECUTE PROCEDURE audit_trigger_fn();
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON sznb FOR EACH ROW EXECUTE PROCEDURE audit_trigger_fn();
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON flow_subscription FOR EACH ROW EXECUTE PROCEDURE audit_trigger_fn();
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON international FOR EACH ROW EXECUTE PROCEDURE audit_trigger_fn();
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON youtube FOR EACH ROW EXECUTE PROCEDURE audit_trigger_fn();
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON spotify FOR EACH ROW EXECUTE PROCEDURE audit_trigger_fn();
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON tiktok FOR EACH ROW EXECUTE PROCEDURE audit_trigger_fn();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
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
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (so this script can be re-run)
DROP POLICY IF EXISTS "Authenticated read revenue_summary" ON revenue_summary;
DROP POLICY IF EXISTS "Authenticated insert revenue_summary" ON revenue_summary;
DROP POLICY IF EXISTS "Authenticated update revenue_summary" ON revenue_summary;
DROP POLICY IF EXISTS "Authenticated delete revenue_summary" ON revenue_summary;
DROP POLICY IF EXISTS "Authenticated read ringtune" ON ringtune;
DROP POLICY IF EXISTS "Authenticated insert ringtune" ON ringtune;
DROP POLICY IF EXISTS "Authenticated update ringtune" ON ringtune;
DROP POLICY IF EXISTS "Authenticated delete ringtune" ON ringtune;
DROP POLICY IF EXISTS "Authenticated read mpt" ON mpt;
DROP POLICY IF EXISTS "Authenticated insert mpt" ON mpt;
DROP POLICY IF EXISTS "Authenticated update mpt" ON mpt;
DROP POLICY IF EXISTS "Authenticated delete mpt" ON mpt;
DROP POLICY IF EXISTS "Authenticated read atom" ON atom;
DROP POLICY IF EXISTS "Authenticated insert atom" ON atom;
DROP POLICY IF EXISTS "Authenticated update atom" ON atom;
DROP POLICY IF EXISTS "Authenticated delete atom" ON atom;
DROP POLICY IF EXISTS "Authenticated read eauc" ON eauc;
DROP POLICY IF EXISTS "Authenticated insert eauc" ON eauc;
DROP POLICY IF EXISTS "Authenticated update eauc" ON eauc;
DROP POLICY IF EXISTS "Authenticated delete eauc" ON eauc;
DROP POLICY IF EXISTS "Authenticated read combo" ON combo;
DROP POLICY IF EXISTS "Authenticated insert combo" ON combo;
DROP POLICY IF EXISTS "Authenticated update combo" ON combo;
DROP POLICY IF EXISTS "Authenticated delete combo" ON combo;
DROP POLICY IF EXISTS "Authenticated read local" ON local;
DROP POLICY IF EXISTS "Authenticated insert local" ON local;
DROP POLICY IF EXISTS "Authenticated update local" ON local;
DROP POLICY IF EXISTS "Authenticated delete local" ON local;
DROP POLICY IF EXISTS "Authenticated read sznb" ON sznb;
DROP POLICY IF EXISTS "Authenticated insert sznb" ON sznb;
DROP POLICY IF EXISTS "Authenticated update sznb" ON sznb;
DROP POLICY IF EXISTS "Authenticated delete sznb" ON sznb;
DROP POLICY IF EXISTS "Authenticated read flow_subscription" ON flow_subscription;
DROP POLICY IF EXISTS "Authenticated insert flow_subscription" ON flow_subscription;
DROP POLICY IF EXISTS "Authenticated update flow_subscription" ON flow_subscription;
DROP POLICY IF EXISTS "Authenticated delete flow_subscription" ON flow_subscription;
DROP POLICY IF EXISTS "Authenticated read international" ON international;
DROP POLICY IF EXISTS "Authenticated insert international" ON international;
DROP POLICY IF EXISTS "Authenticated update international" ON international;
DROP POLICY IF EXISTS "Authenticated delete international" ON international;
DROP POLICY IF EXISTS "Authenticated read youtube" ON youtube;
DROP POLICY IF EXISTS "Authenticated insert youtube" ON youtube;
DROP POLICY IF EXISTS "Authenticated update youtube" ON youtube;
DROP POLICY IF EXISTS "Authenticated delete youtube" ON youtube;
DROP POLICY IF EXISTS "Authenticated read spotify" ON spotify;
DROP POLICY IF EXISTS "Authenticated insert spotify" ON spotify;
DROP POLICY IF EXISTS "Authenticated update spotify" ON spotify;
DROP POLICY IF EXISTS "Authenticated delete spotify" ON spotify;
DROP POLICY IF EXISTS "Authenticated read tiktok" ON tiktok;
DROP POLICY IF EXISTS "Authenticated insert tiktok" ON tiktok;
DROP POLICY IF EXISTS "Authenticated update tiktok" ON tiktok;
DROP POLICY IF EXISTS "Authenticated delete tiktok" ON tiktok;
DROP POLICY IF EXISTS "Authenticated read audit_log" ON audit_log;
DROP POLICY IF EXISTS "Service role insert audit_log" ON audit_log;
DROP POLICY IF EXISTS "Authenticated insert audit_log" ON audit_log;

-- Policies: authenticated users can do everything on revenue tables
CREATE POLICY "Authenticated read revenue_summary" ON revenue_summary FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert revenue_summary" ON revenue_summary FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update revenue_summary" ON revenue_summary FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete revenue_summary" ON revenue_summary FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated read ringtune" ON ringtune FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert ringtune" ON ringtune FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update ringtune" ON ringtune FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete ringtune" ON ringtune FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated read mpt" ON mpt FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert mpt" ON mpt FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update mpt" ON mpt FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete mpt" ON mpt FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated read atom" ON atom FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert atom" ON atom FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update atom" ON atom FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete atom" ON atom FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated read eauc" ON eauc FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert eauc" ON eauc FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update eauc" ON eauc FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete eauc" ON eauc FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated read combo" ON combo FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert combo" ON combo FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update combo" ON combo FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete combo" ON combo FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated read local" ON local FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert local" ON local FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update local" ON local FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete local" ON local FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated read sznb" ON sznb FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert sznb" ON sznb FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update sznb" ON sznb FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete sznb" ON sznb FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated read flow_subscription" ON flow_subscription FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert flow_subscription" ON flow_subscription FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update flow_subscription" ON flow_subscription FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete flow_subscription" ON flow_subscription FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated read international" ON international FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert international" ON international FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update international" ON international FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete international" ON international FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated read youtube" ON youtube FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert youtube" ON youtube FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update youtube" ON youtube FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete youtube" ON youtube FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated read spotify" ON spotify FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert spotify" ON spotify FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update spotify" ON spotify FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete spotify" ON spotify FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated read tiktok" ON tiktok FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert tiktok" ON tiktok FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update tiktok" ON tiktok FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete tiktok" ON tiktok FOR DELETE TO authenticated USING (true);

-- audit_log: authenticated can read (admin filter in app); only INSERT allowed, no UPDATE/DELETE
CREATE POLICY "Authenticated read audit_log" ON audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role insert audit_log" ON audit_log FOR INSERT TO authenticated WITH CHECK (true);
-- No UPDATE or DELETE policies on audit_log so only SELECT and INSERT are allowed
-- (RLS blocks UPDATE/DELETE by not having policies for them)
-- Allow service_role to insert from triggers (trigger runs as definer; we need audit_log to accept inserts from trigger)
-- The trigger runs as SECURITY DEFINER so it runs as the function owner (superuser or postgres). So we need a policy that allows the trigger to insert.
-- In Supabase, triggers run with the same role as the statement (authenticated). So the INSERT into audit_log from the trigger is done by the same user. So "INSERT TO authenticated" is correct.
-- But wait: the trigger function is SECURITY DEFINER - so it runs as the owner of the function (postgres/superuser). So the insert bypasses RLS unless we use SET search_path and the owner is postgres. So actually the trigger insert might bypass RLS. Let me add a policy for role postgres or use a different approach. In Supabase, the trigger runs as the function owner. So we need to allow the database owner to insert. Typically we add: CREATE POLICY "Allow trigger insert" ON audit_log FOR INSERT TO public WITH CHECK (true); but that would allow anyone. Better: the audit_trigger_fn runs as SECURITY DEFINER so it runs as the user who created the function (e.g. postgres). In that case the insert is by postgres and RLS might not apply to postgres if postgres is table owner. Actually in Supabase, table owner is usually postgres and postgres bypasses RLS. So the trigger insert will work. For the anon/authenticated user, we don't want them to insert directly into audit_log (only via app with action=IMPORT). So we could remove INSERT for authenticated and only allow the trigger (postgres). So: remove "Service role insert audit_log" and keep only SELECT for authenticated. Then the app must use a separate path for IMPORT - e.g. a server action that uses service role to insert into audit_log with action=IMPORT. So we need either: (1) Allow authenticated to INSERT into audit_log (so app can write IMPORT entries and trigger writes others), or (2) Use service role in app for IMPORT and only trigger for others. I'll allow authenticated to INSERT so the app can log IMPORT actions. So the policy "Service role insert audit_log" I'll rename to "Authenticated insert audit_log".
CREATE POLICY "Authenticated insert audit_log" ON audit_log FOR INSERT TO authenticated WITH CHECK (true);


-- =============================================================
-- FILE: 003_lineage_triggers.sql
-- =============================================================
-- Parent-child lineage enforcement and summary propagation.

CREATE OR REPLACE FUNCTION sync_revenue_summary_month(p_month DATE)
RETURNS VOID AS $$
DECLARE
  ringtune_total NUMERIC(18,2);
  eauc_total NUMERIC(18,2);
  combo_total NUMERIC(18,2);
  sznb_total NUMERIC(18,2);
  flow_total NUMERIC(18,2);
  youtube_total NUMERIC(18,2);
  spotify_total NUMERIC(18,2);
  tiktok_total NUMERIC(18,2);
BEGIN
  SELECT COALESCE(total, 0) INTO ringtune_total FROM ringtune WHERE month = p_month;
  SELECT COALESCE(total, 0) INTO eauc_total FROM eauc WHERE month = p_month;
  SELECT COALESCE(total, 0) INTO combo_total FROM combo WHERE month = p_month;
  SELECT COALESCE(total, 0) INTO sznb_total FROM sznb WHERE month = p_month;
  SELECT COALESCE(total, 0) INTO flow_total FROM flow_subscription WHERE month = p_month;
  SELECT COALESCE(total, 0) INTO youtube_total FROM youtube WHERE month = p_month;
  SELECT COALESCE(total, 0) INTO spotify_total FROM spotify WHERE month = p_month;
  SELECT COALESCE(total, 0) INTO tiktok_total FROM tiktok WHERE month = p_month;

  INSERT INTO revenue_summary (
    month,
    ringtune,
    eauc,
    combo,
    sznb,
    flow_music_zone,
    flow_subscription,
    flow_data_pack,
    youtube,
    spotify,
    tiktok
  )
  VALUES (
    p_month,
    ringtune_total,
    eauc_total,
    combo_total,
    sznb_total,
    0,
    flow_total,
    0,
    youtube_total,
    spotify_total,
    tiktok_total
  )
  ON CONFLICT (month) DO UPDATE SET
    ringtune = EXCLUDED.ringtune,
    eauc = EXCLUDED.eauc,
    combo = EXCLUDED.combo,
    sznb = EXCLUDED.sznb,
    flow_music_zone = EXCLUDED.flow_music_zone,
    flow_subscription = EXCLUDED.flow_subscription,
    flow_data_pack = EXCLUDED.flow_data_pack,
    youtube = EXCLUDED.youtube,
    spotify = EXCLUDED.spotify,
    tiktok = EXCLUDED.tiktok;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_telecom_from_mpt()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO ringtune (month, mpt)
  VALUES (
    NEW.month,
    COALESCE(NEW.legacy_ringtune, 0)
      + COALESCE(NEW.etrade_ringtune, 0)
      + COALESCE(NEW.fortune_ringtune, 0)
      + COALESCE(NEW.unico_ringtune, 0)
  )
  ON CONFLICT (month) DO UPDATE SET
    mpt = EXCLUDED.mpt;

  INSERT INTO eauc (month, mpt)
  VALUES (
    NEW.month,
    COALESCE(NEW.legacy_eauc, 0)
      + COALESCE(NEW.etrade_eauc, 0)
      + COALESCE(NEW.fortune_eauc, 0)
      + COALESCE(NEW.unico_eauc, 0)
  )
  ON CONFLICT (month) DO UPDATE SET
    mpt = EXCLUDED.mpt;

  INSERT INTO combo (month, mpt)
  VALUES (
    NEW.month,
    COALESCE(NEW.legacy_combo, 0)
      + COALESCE(NEW.etrade_combo, 0)
      + COALESCE(NEW.fortune_combo, 0)
      + COALESCE(NEW.unico_combo, 0)
  )
  ON CONFLICT (month) DO UPDATE SET
    mpt = EXCLUDED.mpt;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_telecom_from_atom()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO ringtune (month, atom)
  VALUES (NEW.month, COALESCE(NEW.ringtune, 0))
  ON CONFLICT (month) DO UPDATE SET
    atom = EXCLUDED.atom;

  INSERT INTO eauc (month, atom)
  VALUES (NEW.month, COALESCE(NEW.eauc, 0))
  ON CONFLICT (month) DO UPDATE SET
    atom = EXCLUDED.atom;

  INSERT INTO combo (month, atom)
  VALUES (NEW.month, COALESCE(NEW.combo, 0))
  ON CONFLICT (month) DO UPDATE SET
    atom = EXCLUDED.atom;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_revenue_summary_from_children()
RETURNS TRIGGER AS $$
DECLARE
  changed_month DATE;
BEGIN
  changed_month := COALESCE(NEW.month, OLD.month);
  PERFORM sync_revenue_summary_month(changed_month);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mpt_sync_telecom_trigger ON mpt;
DROP TRIGGER IF EXISTS atom_sync_telecom_trigger ON atom;
DROP TRIGGER IF EXISTS ringtune_sync_revenue_trigger ON ringtune;
DROP TRIGGER IF EXISTS eauc_sync_revenue_trigger ON eauc;
DROP TRIGGER IF EXISTS combo_sync_revenue_trigger ON combo;
DROP TRIGGER IF EXISTS sznb_sync_revenue_trigger ON sznb;
DROP TRIGGER IF EXISTS flow_subscription_sync_revenue_trigger ON flow_subscription;
DROP TRIGGER IF EXISTS youtube_sync_revenue_trigger ON youtube;
DROP TRIGGER IF EXISTS spotify_sync_revenue_trigger ON spotify;
DROP TRIGGER IF EXISTS tiktok_sync_revenue_trigger ON tiktok;

CREATE TRIGGER mpt_sync_telecom_trigger
AFTER INSERT OR UPDATE ON mpt
FOR EACH ROW
EXECUTE FUNCTION sync_telecom_from_mpt();

CREATE TRIGGER atom_sync_telecom_trigger
AFTER INSERT OR UPDATE ON atom
FOR EACH ROW
EXECUTE FUNCTION sync_telecom_from_atom();

CREATE TRIGGER ringtune_sync_revenue_trigger
AFTER INSERT OR UPDATE OR DELETE ON ringtune
FOR EACH ROW
EXECUTE FUNCTION sync_revenue_summary_from_children();

CREATE TRIGGER eauc_sync_revenue_trigger
AFTER INSERT OR UPDATE OR DELETE ON eauc
FOR EACH ROW
EXECUTE FUNCTION sync_revenue_summary_from_children();

CREATE TRIGGER combo_sync_revenue_trigger
AFTER INSERT OR UPDATE OR DELETE ON combo
FOR EACH ROW
EXECUTE FUNCTION sync_revenue_summary_from_children();

CREATE TRIGGER sznb_sync_revenue_trigger
AFTER INSERT OR UPDATE OR DELETE ON sznb
FOR EACH ROW
EXECUTE FUNCTION sync_revenue_summary_from_children();

CREATE TRIGGER flow_subscription_sync_revenue_trigger
AFTER INSERT OR UPDATE OR DELETE ON flow_subscription
FOR EACH ROW
EXECUTE FUNCTION sync_revenue_summary_from_children();

CREATE TRIGGER youtube_sync_revenue_trigger
AFTER INSERT OR UPDATE OR DELETE ON youtube
FOR EACH ROW
EXECUTE FUNCTION sync_revenue_summary_from_children();

CREATE TRIGGER spotify_sync_revenue_trigger
AFTER INSERT OR UPDATE OR DELETE ON spotify
FOR EACH ROW
EXECUTE FUNCTION sync_revenue_summary_from_children();

CREATE TRIGGER tiktok_sync_revenue_trigger
AFTER INSERT OR UPDATE OR DELETE ON tiktok
FOR EACH ROW
EXECUTE FUNCTION sync_revenue_summary_from_children();

CREATE INDEX IF NOT EXISTS idx_revenue_summary_month_desc
ON revenue_summary (month DESC);


-- =============================================================
-- FILE: 004_user_profiles.sql
-- =============================================================
-- User profile directory for display names/usernames.

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  username TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_user_profiles ON user_profiles;
CREATE TRIGGER set_updated_at_user_profiles
BEFORE UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION set_user_profiles_updated_at();

CREATE OR REPLACE FUNCTION create_profile_on_user_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, full_name, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'username', '')
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION create_profile_on_user_signup();

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON user_profiles;

CREATE POLICY "Authenticated read user_profiles"
ON user_profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users update own profile"
ON user_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users insert own profile"
ON user_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);


-- =============================================================
-- FILE: 005_rbac_profiles_and_policies.sql
-- =============================================================
-- RBAC foundation: extend user_profiles, defaults, signup trigger, and safety guards.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'id'
  ) THEN
    ALTER TABLE public.user_profiles RENAME COLUMN user_id TO id;
  END IF;
END $$;

ALTER TABLE public.user_profiles
  ALTER COLUMN id SET NOT NULL;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'staff',
  ADD COLUMN IF NOT EXISTS permissions JSONB,
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invited_by UUID,
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND constraint_name = 'user_profiles_role_check'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_role_check CHECK (role IN ('admin', 'staff'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND constraint_name = 'user_profiles_status_check'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_status_check CHECK (status IN ('active', 'suspended', 'pending'));
  END IF;
END $$;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_invited_by_fkey;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_invited_by_fkey
  FOREIGN KEY (invited_by) REFERENCES public.user_profiles(id);

CREATE OR REPLACE FUNCTION public.rbac_staff_default_permissions()
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT '{
    "can_enter_data": false,
    "can_edit_data": false,
    "can_delete_data": false,
    "can_import_excel": false,
    "can_export_data": true,
    "can_view_analytics": true,
    "can_view_streams": true,
    "can_view_audit_log": false,
    "can_manage_users": false,
    "can_manage_settings": false,
    "can_view_mpt_detail": true,
    "can_view_sznb": true,
    "can_view_international": true,
    "can_view_telecom": true,
    "can_view_flow": true
  }'::jsonb;
$$;

CREATE OR REPLACE FUNCTION public.rbac_admin_permissions()
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT '{
    "can_enter_data": true,
    "can_edit_data": true,
    "can_delete_data": true,
    "can_import_excel": true,
    "can_export_data": true,
    "can_view_analytics": true,
    "can_view_streams": true,
    "can_view_audit_log": true,
    "can_manage_users": true,
    "can_manage_settings": true,
    "can_view_mpt_detail": true,
    "can_view_sznb": true,
    "can_view_international": true,
    "can_view_telecom": true,
    "can_view_flow": true
  }'::jsonb;
$$;

CREATE OR REPLACE FUNCTION public.rbac_effective_permissions(profile_role TEXT, profile_permissions JSONB)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN profile_role = 'admin' THEN public.rbac_admin_permissions()
    ELSE public.rbac_staff_default_permissions() || COALESCE(profile_permissions, '{}'::jsonb)
  END;
$$;

UPDATE public.user_profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR p.email = '');

ALTER TABLE public.user_profiles
  ALTER COLUMN permissions SET DEFAULT public.rbac_staff_default_permissions();

UPDATE public.user_profiles
SET permissions = public.rbac_staff_default_permissions()
WHERE permissions IS NULL;

UPDATE public.user_profiles
SET permissions = public.rbac_effective_permissions(role, permissions);

ALTER TABLE public.user_profiles
  ALTER COLUMN permissions SET NOT NULL;

ALTER TABLE public.user_profiles
  ALTER COLUMN email SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'user_profiles_email_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX user_profiles_email_unique_idx ON public.user_profiles(email);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.rbac_apply_profile_guards()
RETURNS TRIGGER AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'admin' THEN
      SELECT COUNT(*) INTO admin_count
      FROM public.user_profiles
      WHERE role = 'admin' AND id <> OLD.id;
      IF admin_count = 0 THEN
        RAISE EXCEPTION 'Cannot delete the last admin user';
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.role = 'admin' THEN
    NEW.permissions = public.rbac_admin_permissions();
  ELSE
    NEW.permissions = public.rbac_effective_permissions('staff', NEW.permissions);
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.role = 'admin' AND NEW.role <> 'admin' THEN
    SELECT COUNT(*) INTO admin_count
    FROM public.user_profiles
    WHERE role = 'admin' AND id <> OLD.id;
    IF admin_count = 0 THEN
      RAISE EXCEPTION 'Cannot demote the last admin user';
    END IF;
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_rbac_profile_guards ON public.user_profiles;
CREATE TRIGGER enforce_rbac_profile_guards
BEFORE INSERT OR UPDATE OR DELETE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.rbac_apply_profile_guards();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  has_admin BOOLEAN;
  next_role TEXT;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE role = 'admin') INTO has_admin;
  next_role := CASE WHEN has_admin THEN 'staff' ELSE 'admin' END;

  INSERT INTO public.user_profiles (
    id,
    email,
    full_name,
    display_name,
    role,
    permissions,
    status,
    invited_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email),
    NULLIF(NEW.raw_user_meta_data->>'username', ''),
    next_role,
    CASE WHEN next_role = 'admin' THEN public.rbac_admin_permissions() ELSE public.rbac_staff_default_permissions() END,
    CASE WHEN next_role = 'admin' THEN 'active' ELSE 'pending' END,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

UPDATE public.user_profiles
SET role = 'admin',
    status = 'active',
    permissions = public.rbac_admin_permissions()
WHERE id IN (
  SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM public.user_profiles WHERE role = 'admin'
);

CREATE OR REPLACE FUNCTION public.auth_user_is_admin(uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.user_profiles
    WHERE id = uid
      AND role = 'admin'
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_user_can(permission_key TEXT, uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles p
    WHERE p.id = uid
      AND p.status = 'active'
      AND (
        p.role = 'admin'
        OR COALESCE((public.rbac_effective_permissions(p.role, p.permissions)->>permission_key)::BOOLEAN, FALSE)
      )
  );
$$;


-- =============================================================
-- FILE: 006_rbac_rls_rewrite.sql
-- =============================================================
-- RBAC RLS rewrite: remove permissive authenticated policies and enforce role+permissions.

DO $$
DECLARE
  target_table TEXT;
  policy_record RECORD;
  tables TEXT[] := ARRAY[
    'revenue_summary',
    'ringtune',
    'mpt',
    'atom',
    'eauc',
    'combo',
    'local',
    'sznb',
    'flow_subscription',
    'international',
    'youtube',
    'spotify',
    'tiktok',
    'audit_log',
    'user_profiles'
  ];
BEGIN
  FOREACH target_table IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);
    FOR policy_record IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = target_table
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_record.policyname, target_table);
    END LOOP;
  END LOOP;
END $$;

-- Profile read/write policies.
CREATE POLICY "rbac_user_profiles_select"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.auth_user_is_admin(auth.uid()));

CREATE POLICY "rbac_user_profiles_insert_self_or_admin"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  id = auth.uid()
  OR public.auth_user_is_admin(auth.uid())
);

CREATE POLICY "rbac_user_profiles_update_self_or_admin"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR public.auth_user_is_admin(auth.uid())
)
WITH CHECK (
  id = auth.uid()
  OR public.auth_user_is_admin(auth.uid())
);

CREATE POLICY "rbac_user_profiles_delete_admin_only"
ON public.user_profiles
FOR DELETE
TO authenticated
USING (public.auth_user_is_admin(auth.uid()));

-- Audit log access.
CREATE POLICY "rbac_audit_select"
ON public.audit_log
FOR SELECT
TO authenticated
USING (
  public.auth_user_is_admin(auth.uid())
  OR public.auth_user_can('can_view_audit_log', auth.uid())
);

CREATE POLICY "rbac_audit_insert"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  user_id IS NULL OR user_id = auth.uid() OR public.auth_user_is_admin(auth.uid())
);

-- Revenue summary.
CREATE POLICY "rbac_summary_read"
ON public.revenue_summary
FOR SELECT
TO authenticated
USING (
  public.auth_user_is_admin(auth.uid())
  OR public.auth_user_can('can_view_streams', auth.uid())
  OR public.auth_user_can('can_view_analytics', auth.uid())
);

CREATE POLICY "rbac_summary_insert"
ON public.revenue_summary
FOR INSERT
TO authenticated
WITH CHECK (
  public.auth_user_is_admin(auth.uid())
  OR public.auth_user_can('can_enter_data', auth.uid())
  OR public.auth_user_can('can_import_excel', auth.uid())
);

CREATE POLICY "rbac_summary_update"
ON public.revenue_summary
FOR UPDATE
TO authenticated
USING (
  public.auth_user_is_admin(auth.uid())
  OR public.auth_user_can('can_edit_data', auth.uid())
  OR public.auth_user_can('can_import_excel', auth.uid())
)
WITH CHECK (
  public.auth_user_is_admin(auth.uid())
  OR public.auth_user_can('can_edit_data', auth.uid())
  OR public.auth_user_can('can_import_excel', auth.uid())
);

CREATE POLICY "rbac_summary_delete"
ON public.revenue_summary
FOR DELETE
TO authenticated
USING (
  public.auth_user_is_admin(auth.uid()) OR public.auth_user_can('can_delete_data', auth.uid())
);

-- Telecom cluster (ringtune/mpt/atom/eauc/combo/local).
CREATE POLICY "rbac_ringtune_read"
ON public.ringtune
FOR SELECT
TO authenticated
USING (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can('can_view_telecom', auth.uid()));

CREATE POLICY "rbac_mpt_read"
ON public.mpt
FOR SELECT
TO authenticated
USING (
  public.auth_user_is_admin(auth.uid())
  OR public.auth_user_can('can_view_telecom', auth.uid())
  OR public.auth_user_can('can_view_mpt_detail', auth.uid())
);

CREATE POLICY "rbac_atom_read"
ON public.atom
FOR SELECT
TO authenticated
USING (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can('can_view_telecom', auth.uid()));

CREATE POLICY "rbac_eauc_read"
ON public.eauc
FOR SELECT
TO authenticated
USING (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can('can_view_telecom', auth.uid()));

CREATE POLICY "rbac_combo_read"
ON public.combo
FOR SELECT
TO authenticated
USING (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can('can_view_telecom', auth.uid()));

CREATE POLICY "rbac_local_read"
ON public.local
FOR SELECT
TO authenticated
USING (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can('can_view_telecom', auth.uid()));

-- Stream-specific visibility.
CREATE POLICY "rbac_sznb_read"
ON public.sznb
FOR SELECT
TO authenticated
USING (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can('can_view_sznb', auth.uid()));

CREATE POLICY "rbac_flow_read"
ON public.flow_subscription
FOR SELECT
TO authenticated
USING (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can('can_view_flow', auth.uid()));

CREATE POLICY "rbac_international_read"
ON public.international
FOR SELECT
TO authenticated
USING (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can('can_view_international', auth.uid()));

CREATE POLICY "rbac_youtube_read"
ON public.youtube
FOR SELECT
TO authenticated
USING (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can('can_view_international', auth.uid()));

CREATE POLICY "rbac_spotify_read"
ON public.spotify
FOR SELECT
TO authenticated
USING (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can('can_view_international', auth.uid()));

CREATE POLICY "rbac_tiktok_read"
ON public.tiktok
FOR SELECT
TO authenticated
USING (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can('can_view_international', auth.uid()));

-- Shared write rules for data tables.
DO $$
DECLARE
  tbl TEXT;
  write_tables TEXT[] := ARRAY[
    'ringtune','mpt','atom','eauc','combo','local','sznb','flow_subscription','international','youtube','spotify','tiktok'
  ];
BEGIN
  FOREACH tbl IN ARRAY write_tables LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can(''can_enter_data'', auth.uid()) OR public.auth_user_can(''can_import_excel'', auth.uid()))',
      'rbac_' || tbl || '_insert',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can(''can_edit_data'', auth.uid()) OR public.auth_user_can(''can_import_excel'', auth.uid())) WITH CHECK (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can(''can_edit_data'', auth.uid()) OR public.auth_user_can(''can_import_excel'', auth.uid()))',
      'rbac_' || tbl || '_update',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can(''can_delete_data'', auth.uid()))',
      'rbac_' || tbl || '_delete',
      tbl
    );
  END LOOP;
END $$;


-- =============================================================
-- FILE: 007_rbac_audit_enrichment.sql
-- =============================================================
-- Audit enrichment: include user identity snapshot columns.

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS user_name TEXT,
  ADD COLUMN IF NOT EXISTS user_role TEXT,
  ADD COLUMN IF NOT EXISTS user_email TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id_created_at
ON public.audit_log(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
  old_json JSONB;
  new_json JSONB;
  row_id_val TEXT;
  actor_id UUID;
  actor_name TEXT;
  actor_role TEXT;
  actor_email TEXT;
BEGIN
  actor_id := auth.uid();
  IF actor_id IS NOT NULL THEN
    SELECT
      COALESCE(NULLIF(p.full_name, ''), p.display_name, u.email),
      p.role,
      COALESCE(p.email, u.email)
    INTO actor_name, actor_role, actor_email
    FROM auth.users u
    LEFT JOIN public.user_profiles p ON p.id = u.id
    WHERE u.id = actor_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    old_json := to_jsonb(OLD);
    row_id_val := COALESCE((OLD).sqlid::TEXT, NULL);
    INSERT INTO public.audit_log (user_id, user_name, user_role, user_email, action, table_name, row_id, old_value, new_value)
    VALUES (actor_id, actor_name, actor_role, actor_email, 'DELETE', TG_TABLE_NAME, row_id_val, old_json, NULL);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);
    row_id_val := COALESCE((NEW).sqlid::TEXT, NULL);
    INSERT INTO public.audit_log (user_id, user_name, user_role, user_email, action, table_name, row_id, old_value, new_value)
    VALUES (actor_id, actor_name, actor_role, actor_email, 'UPDATE', TG_TABLE_NAME, row_id_val, old_json, new_json);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    new_json := to_jsonb(NEW);
    row_id_val := COALESCE((NEW).sqlid::TEXT, NULL);
    INSERT INTO public.audit_log (user_id, user_name, user_role, user_email, action, table_name, row_id, old_value, new_value)
    VALUES (actor_id, actor_name, actor_role, actor_email, 'INSERT', TG_TABLE_NAME, row_id_val, NULL, new_json);
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================
-- FILE: 008_invited_emails.sql
-- =============================================================
-- Invite-only sign-up: store invited emails before user creation.
-- Admin "invites" = insert here. User signs up = we check this, create auth user, then create profile.

CREATE TABLE IF NOT EXISTS public.invited_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  permissions JSONB,
  job_title TEXT,
  department TEXT,
  invited_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_invited_emails_email ON public.invited_emails(email);
CREATE INDEX IF NOT EXISTS idx_invited_emails_used_at ON public.invited_emails(used_at) WHERE used_at IS NULL;

ALTER TABLE public.invited_emails ENABLE ROW LEVEL SECURITY;

-- No additional policies: anon/authenticated cannot access. Server actions use service role (bypasses RLS).


-- =============================================================
-- FILE: 009_remove_kokokevin.sql
-- =============================================================
-- One-time cleanup: remove kokokevin@gmail.com from auth and related tables.
-- audit_log references auth.users, so we null out user_id first, then delete user.
DO $$
DECLARE
  uid UUID;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = 'kokokevin@gmail.com';
  IF uid IS NOT NULL THEN
    UPDATE public.audit_log SET user_id = NULL WHERE user_id = uid;
    DELETE FROM public.user_profiles WHERE id = uid;
    DELETE FROM public.invited_emails WHERE email = 'kokokevin@gmail.com';
    DELETE FROM auth.users WHERE id = uid;
    RAISE NOTICE 'Removed user kokokevin@gmail.com';
  ELSE
    RAISE NOTICE 'User kokokevin@gmail.com not found (already removed or never existed)';
  END IF;
END $$;


-- =============================================================
-- FILE: 010_app_settings.sql
-- =============================================================
-- App settings key-value store for organization defaults and policies.
-- Server actions use createAdminClient (service role) to read/write; RLS restricts anon/authenticated.

CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- No additional policies: anon/authenticated cannot access. Server actions use service role (bypasses RLS).

INSERT INTO public.app_settings (key, value)
VALUES (
  'organization',
  '{"display_currency":"MMK","currency_overrides":{},"company_name":"Legacy","timezone":"Asia/Yangon"}'::jsonb
)
ON CONFLICT (key) DO NOTHING;


-- =============================================================
-- FILE: 011_user_currency_preferences.sql
-- =============================================================
-- Per-user currency display preferences. Each user can choose their own display currency and optional rate overrides.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS display_currency TEXT DEFAULT 'MMK',
  ADD COLUMN IF NOT EXISTS currency_overrides JSONB DEFAULT '{}';


-- =============================================================
-- FILE: 012_admin_settings_seed.sql
-- =============================================================
-- Seed additional app_settings keys for Admin Settings panels.
-- Run after 010_app_settings.sql. Uses ON CONFLICT to avoid overwriting existing values.

INSERT INTO public.app_settings (key, value)
VALUES (
  'permissions',
  '{"default_permissions":{"can_enter_data":false,"can_edit_data":false,"can_delete_data":false,"can_import_excel":false,"can_export_data":true,"can_view_analytics":true,"can_view_streams":true,"can_view_audit_log":false,"can_manage_users":false,"can_manage_settings":false,"can_view_mpt_detail":true,"can_view_sznb":true,"can_view_international":true,"can_view_telecom":true,"can_view_flow":true}}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value)
VALUES (
  'session',
  '{"session_idle_minutes":60,"audit_retention_days":365}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value)
VALUES (
  'data-entry',
  '{"duplicate_month_behavior":"confirm"}'::jsonb
)
ON CONFLICT (key) DO NOTHING;


