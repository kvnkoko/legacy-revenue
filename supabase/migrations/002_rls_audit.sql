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
