-- =============================================================================
-- 013_config_schema.sql — Config-driven revenue model: schema, audit, RLS
-- =============================================================================
-- Creates the stream/field definition tables and the single fact table.
-- No data is migrated here (see 015). The legacy tables are untouched.
--
-- Idempotent. Transactional. Self-verifying (RAISE EXCEPTION rolls everything
-- back). Rehearse on the rehearsal project first (docs/migration-runbook.md).
-- =============================================================================

BEGIN;

-- ============ TABLES ========================================================

CREATE TABLE IF NOT EXISTS public.revenue_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  color TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL CHECK (kind IN ('entry', 'derived', 'summary')),
  -- Labels of the grouping dimensions for this stream's fields,
  -- e.g. {'Distributor','Product'} for MPT's 4x3 grid. NULL = flat field list.
  group_dimension_labels TEXT[],
  -- Free-form stream settings, e.g. {"in_summary": true, "summary_column": "ringtune"}
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stream_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES public.revenue_streams(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  label TEXT NOT NULL,
  -- Position of this field along the stream's group dimensions,
  -- e.g. {'Legacy','Ringtune'}. NULL for flat streams.
  group_values TEXT[],
  sort INTEGER NOT NULL DEFAULT 0,
  -- Metadata: where this field's history lived in the legacy schema and how
  -- the Excel importer recognizes it.
  --   {"legacy": {"table": "mpt", "column": "legacy_ringtune"},
  --    "import": {"sheet": "MPT", "column_keys": ["legacy_ringtune"]}}
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (stream_id, slug)
);

-- Lineage: an entry field contributes to a bucket of a derived stream.
CREATE TABLE IF NOT EXISTS public.field_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_field_id UUID NOT NULL REFERENCES public.stream_fields(id) ON DELETE CASCADE,
  target_stream_id UUID NOT NULL REFERENCES public.revenue_streams(id) ON DELETE CASCADE,
  target_bucket_slug TEXT NOT NULL,
  target_bucket_label TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_field_id, target_stream_id)
);

-- The single fact table. Base facts ONLY; derived numbers are views.
CREATE TABLE IF NOT EXISTS public.revenue_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE NOT NULL,
  -- RESTRICT: a field (and transitively its stream) can never be hard-deleted
  -- while facts reference it; archive via is_active instead.
  field_id UUID NOT NULL REFERENCES public.stream_fields(id) ON DELETE RESTRICT,
  amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (month, field_id)
);

CREATE INDEX IF NOT EXISTS idx_revenue_entries_month ON public.revenue_entries(month);
CREATE INDEX IF NOT EXISTS idx_revenue_entries_field_month ON public.revenue_entries(field_id, month);
CREATE INDEX IF NOT EXISTS idx_stream_fields_stream ON public.stream_fields(stream_id);
CREATE INDEX IF NOT EXISTS idx_field_links_source ON public.field_links(source_field_id);
CREATE INDEX IF NOT EXISTS idx_field_links_target ON public.field_links(target_stream_id);

-- ============ updated_at TRIGGERS ==========================================
-- Reuses set_updated_at() from 001.

DROP TRIGGER IF EXISTS set_updated_at_revenue_streams ON public.revenue_streams;
CREATE TRIGGER set_updated_at_revenue_streams BEFORE UPDATE ON public.revenue_streams
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_stream_fields ON public.stream_fields;
CREATE TRIGGER set_updated_at_stream_fields BEFORE UPDATE ON public.stream_fields
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_revenue_entries ON public.revenue_entries;
CREATE TRIGGER set_updated_at_revenue_entries BEFORE UPDATE ON public.revenue_entries
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============ AUDIT TRIGGERS ===============================================
-- Same append-only pattern as 007's audit_trigger_fn, with payloads enriched
-- so audit rows stay human-readable: entries carry stream/field slugs+labels.

CREATE OR REPLACE FUNCTION public.audit_config_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
  old_json JSONB;
  new_json JSONB;
  row_id_val TEXT;
  actor_id UUID;
  actor_name TEXT;
  actor_role TEXT;
  actor_email TEXT;
  enrich JSONB := '{}'::jsonb;
  f RECORD;
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

  IF TG_TABLE_NAME = 'revenue_entries' THEN
    SELECT sf.slug AS field_slug, sf.label AS field_label,
           rs.slug AS stream_slug, rs.name AS stream_name
    INTO f
    FROM public.stream_fields sf
    JOIN public.revenue_streams rs ON rs.id = sf.stream_id
    WHERE sf.id = COALESCE(NEW.field_id, OLD.field_id);
    IF FOUND THEN
      enrich := jsonb_build_object(
        'stream_slug', f.stream_slug,
        'stream_name', f.stream_name,
        'field_slug', f.field_slug,
        'field_label', f.field_label
      );
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    old_json := to_jsonb(OLD) || enrich;
    row_id_val := (OLD).id::TEXT;
    INSERT INTO public.audit_log (user_id, user_name, user_role, user_email, action, table_name, row_id, old_value, new_value)
    VALUES (actor_id, actor_name, actor_role, actor_email, 'DELETE', TG_TABLE_NAME, row_id_val, old_json, NULL);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    old_json := to_jsonb(OLD) || enrich;
    new_json := to_jsonb(NEW) || enrich;
    row_id_val := (NEW).id::TEXT;
    INSERT INTO public.audit_log (user_id, user_name, user_role, user_email, action, table_name, row_id, old_value, new_value)
    VALUES (actor_id, actor_name, actor_role, actor_email, 'UPDATE', TG_TABLE_NAME, row_id_val, old_json, new_json);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    new_json := to_jsonb(NEW) || enrich;
    row_id_val := (NEW).id::TEXT;
    INSERT INTO public.audit_log (user_id, user_name, user_role, user_email, action, table_name, row_id, old_value, new_value)
    VALUES (actor_id, actor_name, actor_role, actor_email, 'INSERT', TG_TABLE_NAME, row_id_val, NULL, new_json);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_trigger ON public.revenue_streams;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.revenue_streams
FOR EACH ROW EXECUTE FUNCTION public.audit_config_trigger_fn();

DROP TRIGGER IF EXISTS audit_trigger ON public.stream_fields;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.stream_fields
FOR EACH ROW EXECUTE FUNCTION public.audit_config_trigger_fn();

DROP TRIGGER IF EXISTS audit_trigger ON public.field_links;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.field_links
FOR EACH ROW EXECUTE FUNCTION public.audit_config_trigger_fn();

DROP TRIGGER IF EXISTS audit_trigger ON public.revenue_entries;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.revenue_entries
FOR EACH ROW EXECUTE FUNCTION public.audit_config_trigger_fn();

-- ============ ROW LEVEL SECURITY ===========================================
-- auth_user_can() calls are wrapped in (SELECT ...) so Postgres evaluates them
-- once per statement (initplan) instead of per row — revenue_entries holds
-- ~35 rows per month and grows with every configured field.
--
-- Config tables: readable by anyone who can view streams/analytics; writable
-- by admins and (once 018 adds the key) can_configure_streams holders.
-- can_configure_streams simply evaluates to FALSE until then.

ALTER TABLE public.revenue_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stream_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_entries ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
  cfg_tables TEXT[] := ARRAY['revenue_streams', 'stream_fields', 'field_links'];
BEGIN
  FOREACH tbl IN ARRAY cfg_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'rbac_' || tbl || '_select', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (
         (SELECT public.auth_user_is_admin(auth.uid()))
         OR (SELECT public.auth_user_can(''can_view_streams'', auth.uid()))
         OR (SELECT public.auth_user_can(''can_view_analytics'', auth.uid()))
       )',
      'rbac_' || tbl || '_select', tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'rbac_' || tbl || '_write', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (
         (SELECT public.auth_user_is_admin(auth.uid()))
         OR (SELECT public.auth_user_can(''can_configure_streams'', auth.uid()))
       ) WITH CHECK (
         (SELECT public.auth_user_is_admin(auth.uid()))
         OR (SELECT public.auth_user_can(''can_configure_streams'', auth.uid()))
       )',
      'rbac_' || tbl || '_write', tbl
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS "rbac_revenue_entries_select" ON public.revenue_entries;
CREATE POLICY "rbac_revenue_entries_select" ON public.revenue_entries
FOR SELECT TO authenticated USING (
  (SELECT public.auth_user_is_admin(auth.uid()))
  OR (SELECT public.auth_user_can('can_view_streams', auth.uid()))
  OR (SELECT public.auth_user_can('can_view_analytics', auth.uid()))
);

DROP POLICY IF EXISTS "rbac_revenue_entries_insert" ON public.revenue_entries;
CREATE POLICY "rbac_revenue_entries_insert" ON public.revenue_entries
FOR INSERT TO authenticated WITH CHECK (
  (SELECT public.auth_user_is_admin(auth.uid()))
  OR (SELECT public.auth_user_can('can_enter_data', auth.uid()))
  OR (SELECT public.auth_user_can('can_import_excel', auth.uid()))
);

DROP POLICY IF EXISTS "rbac_revenue_entries_update" ON public.revenue_entries;
CREATE POLICY "rbac_revenue_entries_update" ON public.revenue_entries
FOR UPDATE TO authenticated USING (
  (SELECT public.auth_user_is_admin(auth.uid()))
  OR (SELECT public.auth_user_can('can_edit_data', auth.uid()))
  OR (SELECT public.auth_user_can('can_import_excel', auth.uid()))
) WITH CHECK (
  (SELECT public.auth_user_is_admin(auth.uid()))
  OR (SELECT public.auth_user_can('can_edit_data', auth.uid()))
  OR (SELECT public.auth_user_can('can_import_excel', auth.uid()))
);

DROP POLICY IF EXISTS "rbac_revenue_entries_delete" ON public.revenue_entries;
CREATE POLICY "rbac_revenue_entries_delete" ON public.revenue_entries
FOR DELETE TO authenticated USING (
  (SELECT public.auth_user_is_admin(auth.uid()))
  OR (SELECT public.auth_user_can('can_delete_data', auth.uid()))
);

COMMENT ON TABLE public.revenue_streams IS 'Config-driven revenue stream definitions (entry = holds facts, derived = computed via field_links, summary = pivot membership).';
COMMENT ON TABLE public.revenue_entries IS 'Single fact table for all revenue data; base facts only, derived numbers are views. Audited append-style via audit_log.';

-- ============ VERIFICATION (RAISE = rollback of the whole script) ==========
DO $$
DECLARE
  missing TEXT := '';
  n INT;
BEGIN
  -- Tables
  FOR n IN 1..1 LOOP
    IF to_regclass('public.revenue_streams') IS NULL THEN missing := missing || ' revenue_streams'; END IF;
    IF to_regclass('public.stream_fields') IS NULL THEN missing := missing || ' stream_fields'; END IF;
    IF to_regclass('public.field_links') IS NULL THEN missing := missing || ' field_links'; END IF;
    IF to_regclass('public.revenue_entries') IS NULL THEN missing := missing || ' revenue_entries'; END IF;
  END LOOP;
  IF missing <> '' THEN
    RAISE EXCEPTION '013 verification failed: missing tables:%', missing;
  END IF;

  -- Audit triggers on all four tables
  SELECT COUNT(*) INTO n FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  WHERE t.tgname = 'audit_trigger'
    AND c.relname IN ('revenue_streams', 'stream_fields', 'field_links', 'revenue_entries');
  IF n <> 4 THEN
    RAISE EXCEPTION '013 verification failed: expected 4 audit triggers, found %', n;
  END IF;

  -- RLS enabled + policies present
  SELECT COUNT(*) INTO n FROM pg_class c
  WHERE c.relname IN ('revenue_streams', 'stream_fields', 'field_links', 'revenue_entries')
    AND c.relrowsecurity;
  IF n <> 4 THEN
    RAISE EXCEPTION '013 verification failed: RLS not enabled on all 4 tables (got %)', n;
  END IF;

  SELECT COUNT(*) INTO n FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('revenue_streams', 'stream_fields', 'field_links', 'revenue_entries');
  IF n < 10 THEN
    RAISE EXCEPTION '013 verification failed: expected >= 10 policies, found %', n;
  END IF;

  RAISE NOTICE '013 OK: 4 tables, 4 audit triggers, RLS + % policies in place.', n;
END $$;

COMMIT;
