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
-- =============================================================================
-- 014_seed_stream_config.sql — Seed streams/fields/links mirroring the legacy schema
-- =============================================================================
-- Seeds the config tables (013) with definitions that reproduce the current
-- hardcoded model exactly:
--   * 10 entry streams (hold facts)  — mpt, atom, ooredoo, sznb,
--     flow_subscription, flow_music_zone, flow_data_pack, youtube, spotify, tiktok
--   * 5 derived streams (views only) — ringtune, eauc, combo, local, international
--   * 1 summary stream
--   * 34 fields with attributes.legacy (backfill source) and attributes.import
--     (Excel template compatibility, incl. the historical 'kpay_ecomence' typo)
--   * 39 field_links reproducing the legacy lineage triggers
--
-- Idempotent via ON CONFLICT DO UPDATE — but note: re-running AFTER the team
-- has customized streams in the UI will reset the seeded rows to these values
-- (user-created streams are never touched). Intended to run once in Phase 1.
-- =============================================================================

BEGIN;

-- ============ STREAMS =======================================================
INSERT INTO public.revenue_streams (slug, name, color, sort, kind, group_dimension_labels, attributes)
VALUES
  -- entry streams (wizard order)
  ('mpt',               'MPT',               '#0ea5e9', 10,  'entry',   ARRAY['Distributor','Product'], '{}'),
  ('atom',              'Atom',              '#a78bfa', 20,  'entry',   NULL, '{}'),
  ('ooredoo',           'Ooredoo',           '#f97316', 30,  'entry',   NULL, '{}'),
  ('sznb',              'SZNB',              '#f59e0b', 40,  'entry',   NULL, '{"in_summary": true, "summary_column": "sznb"}'),
  ('flow_subscription', 'Flow Subscription', '#10b981', 50,  'entry',   NULL, '{"in_summary": true, "summary_column": "flow_subscription"}'),
  ('flow_music_zone',   'Flow Music Zone',   '#14b8a6', 60,  'entry',   NULL, '{"in_summary": true, "summary_column": "flow_music_zone"}'),
  ('flow_data_pack',    'Flow Data Pack',    '#84cc16', 70,  'entry',   NULL, '{"in_summary": true, "summary_column": "flow_data_pack"}'),
  ('youtube',           'YouTube',           '#ef4444', 80,  'entry',   NULL, '{"in_summary": true, "summary_column": "youtube"}'),
  ('spotify',           'Spotify',           '#22c55e', 90,  'entry',   NULL, '{"in_summary": true, "summary_column": "spotify"}'),
  ('tiktok',            'TikTok',            '#ec4899', 100, 'entry',   NULL, '{"in_summary": true, "summary_column": "tiktok"}'),
  -- derived streams (computed from field_links; legacy lineage equivalents)
  ('ringtune',          'Ringtune',          '#d4af37', 200, 'derived', NULL, '{"in_summary": true, "summary_column": "ringtune"}'),
  ('eauc',              'EAUC',              '#3b82f6', 210, 'derived', NULL, '{"in_summary": true, "summary_column": "eauc"}'),
  ('combo',             'Combo',             '#8b5cf6', 220, 'derived', NULL, '{"in_summary": true, "summary_column": "combo"}'),
  ('local',             'Local',             '#64748b', 230, 'derived', NULL, '{}'),
  ('international',     'International',     '#6366f1', 240, 'derived', NULL, '{}'),
  -- summary pivot
  ('summary',           'Revenue Summary',   NULL,      900, 'summary', NULL, '{}')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  color = EXCLUDED.color,
  sort = EXCLUDED.sort,
  kind = EXCLUDED.kind,
  group_dimension_labels = EXCLUDED.group_dimension_labels,
  attributes = EXCLUDED.attributes;

-- ============ FIELDS ========================================================
INSERT INTO public.stream_fields (stream_id, slug, label, group_values, sort, attributes)
SELECT s.id, v.slug, v.label, v.group_values, v.sort, v.attributes::jsonb
FROM (
  VALUES
  -- ---- mpt: 4 distributors x 3 products (Excel sheet: MPT) ----
  ('mpt', 'legacy_ringtune',  'Legacy Ringtune',  ARRAY['Legacy','Ringtune'],  10, '{"legacy":{"table":"mpt","column":"legacy_ringtune"},  "import":{"sheet":"MPT","column_keys":["legacy_ringtune"]}}'),
  ('mpt', 'legacy_eauc',      'Legacy EAUC',      ARRAY['Legacy','EAUC'],      20, '{"legacy":{"table":"mpt","column":"legacy_eauc"},      "import":{"sheet":"MPT","column_keys":["legacy_eauc"]}}'),
  ('mpt', 'legacy_combo',     'Legacy Combo',     ARRAY['Legacy','Combo'],     30, '{"legacy":{"table":"mpt","column":"legacy_combo"},     "import":{"sheet":"MPT","column_keys":["legacy_combo"]}}'),
  ('mpt', 'etrade_ringtune',  'eTrade Ringtune',  ARRAY['eTrade','Ringtune'],  40, '{"legacy":{"table":"mpt","column":"etrade_ringtune"},  "import":{"sheet":"MPT","column_keys":["etrade_ringtune"]}}'),
  ('mpt', 'etrade_eauc',      'eTrade EAUC',      ARRAY['eTrade','EAUC'],      50, '{"legacy":{"table":"mpt","column":"etrade_eauc"},      "import":{"sheet":"MPT","column_keys":["etrade_eauc"]}}'),
  ('mpt', 'etrade_combo',     'eTrade Combo',     ARRAY['eTrade','Combo'],     60, '{"legacy":{"table":"mpt","column":"etrade_combo"},     "import":{"sheet":"MPT","column_keys":["etrade_combo"]}}'),
  ('mpt', 'fortune_ringtune', 'Fortune Ringtune', ARRAY['Fortune','Ringtune'], 70, '{"legacy":{"table":"mpt","column":"fortune_ringtune"}, "import":{"sheet":"MPT","column_keys":["fortune_ringtune"]}}'),
  ('mpt', 'fortune_eauc',     'Fortune EAUC',     ARRAY['Fortune','EAUC'],     80, '{"legacy":{"table":"mpt","column":"fortune_eauc"},     "import":{"sheet":"MPT","column_keys":["fortune_eauc"]}}'),
  ('mpt', 'fortune_combo',    'Fortune Combo',    ARRAY['Fortune','Combo'],    90, '{"legacy":{"table":"mpt","column":"fortune_combo"},    "import":{"sheet":"MPT","column_keys":["fortune_combo"]}}'),
  ('mpt', 'unico_ringtune',   'Unico Ringtune',   ARRAY['Unico','Ringtune'],  100, '{"legacy":{"table":"mpt","column":"unico_ringtune"},   "import":{"sheet":"MPT","column_keys":["unico_ringtune"]}}'),
  ('mpt', 'unico_eauc',       'Unico EAUC',       ARRAY['Unico','EAUC'],      110, '{"legacy":{"table":"mpt","column":"unico_eauc"},       "import":{"sheet":"MPT","column_keys":["unico_eauc"]}}'),
  ('mpt', 'unico_combo',      'Unico Combo',      ARRAY['Unico','Combo'],     120, '{"legacy":{"table":"mpt","column":"unico_combo"},      "import":{"sheet":"MPT","column_keys":["unico_combo"]}}'),
  -- ---- atom (Excel sheet: Atom) ----
  ('atom', 'ringtune', 'Ringtune', NULL, 10, '{"legacy":{"table":"atom","column":"ringtune"}, "import":{"sheet":"Atom","column_keys":["ringtune"]}}'),
  ('atom', 'eauc',     'EAUC',     NULL, 20, '{"legacy":{"table":"atom","column":"eauc"},     "import":{"sheet":"Atom","column_keys":["eauc"]}}'),
  ('atom', 'combo',    'Combo',    NULL, 30, '{"legacy":{"table":"atom","column":"combo"},    "import":{"sheet":"Atom","column_keys":["combo"]}}'),
  -- ---- ooredoo: single base fact that lived inside the derived ringtune table ----
  ('ooredoo', 'ringtune', 'Ringtune', NULL, 10, '{"legacy":{"table":"ringtune","column":"ooredoo"}, "import":{"sheet":"Ringtune","column_keys":["ooredoo"]}}'),
  -- ---- sznb (Excel sheet: SZNB; keeps the historical kpay_ecomence typo alias) ----
  ('sznb', 'mpt',            'MPT',            NULL, 10, '{"legacy":{"table":"sznb","column":"mpt"},            "import":{"sheet":"SZNB","column_keys":["mpt"]}}'),
  ('sznb', 'atom',           'Atom',           NULL, 20, '{"legacy":{"table":"sznb","column":"atom"},           "import":{"sheet":"SZNB","column_keys":["atom"]}}'),
  ('sznb', 'kpay_mini_app',  'KPay Mini App',  NULL, 30, '{"legacy":{"table":"sznb","column":"kpay_mini_app"},  "import":{"sheet":"SZNB","column_keys":["kpay_mini_app"]}}'),
  ('sznb', 'kpay_qr',        'KPay QR',        NULL, 40, '{"legacy":{"table":"sznb","column":"kpay_qr"},        "import":{"sheet":"SZNB","column_keys":["kpay_qr"]}}'),
  ('sznb', 'kpay_ecommerce', 'KPay eCommerce', NULL, 50, '{"legacy":{"table":"sznb","column":"kpay_ecommerce"}, "import":{"sheet":"SZNB","column_keys":["kpay_ecommerce","kpay_ecomence"]}}'),
  ('sznb', 'wave_money',     'Wave Money',     NULL, 60, '{"legacy":{"table":"sznb","column":"wave_money"},     "import":{"sheet":"SZNB","column_keys":["wave_money"]}}'),
  ('sznb', 'dinger',         'Dinger',         NULL, 70, '{"legacy":{"table":"sznb","column":"dinger"},         "import":{"sheet":"SZNB","column_keys":["dinger"]}}'),
  -- ---- flow_subscription (Excel sheet: Flow Subscription) ----
  ('flow_subscription', 'mpt',  'MPT',  NULL, 10, '{"legacy":{"table":"flow_subscription","column":"mpt"},  "import":{"sheet":"Flow Subscription","column_keys":["mpt"]}}'),
  ('flow_subscription', 'kpay', 'KPay', NULL, 20, '{"legacy":{"table":"flow_subscription","column":"kpay"}, "import":{"sheet":"Flow Subscription","column_keys":["kpay"]}}'),
  -- ---- flow_music_zone / flow_data_pack: had no base table; lived as columns on revenue_summary ----
  ('flow_music_zone', 'amount', 'Amount', NULL, 10, '{"legacy":{"table":"revenue_summary","column":"flow_music_zone"}, "import":{"sheet":"Revenue","column_keys":["flow_music_zone"]}}'),
  ('flow_data_pack',  'amount', 'Amount', NULL, 10, '{"legacy":{"table":"revenue_summary","column":"flow_data_pack"},  "import":{"sheet":"Revenue","column_keys":["flow_data_pack"]}}'),
  -- ---- streaming platforms ----
  ('youtube', 'solution_one', 'Solution One', NULL, 10, '{"legacy":{"table":"youtube","column":"solution_one"}, "import":{"sheet":"YouTube","column_keys":["solution_one"]}}'),
  ('youtube', 'fuga',         'FUGA',         NULL, 20, '{"legacy":{"table":"youtube","column":"fuga"},         "import":{"sheet":"YouTube","column_keys":["fuga"]}}'),
  ('youtube', 'believe',      'Believe',      NULL, 30, '{"legacy":{"table":"youtube","column":"believe"},      "import":{"sheet":"YouTube","column_keys":["believe"]}}'),
  ('spotify', 'fuga',         'FUGA',         NULL, 10, '{"legacy":{"table":"spotify","column":"fuga"},         "import":{"sheet":"Spotify","column_keys":["fuga"]}}'),
  ('spotify', 'believe',      'Believe',      NULL, 20, '{"legacy":{"table":"spotify","column":"believe"},      "import":{"sheet":"Spotify","column_keys":["believe"]}}'),
  ('tiktok',  'fuga',         'FUGA',         NULL, 10, '{"legacy":{"table":"tiktok","column":"fuga"},          "import":{"sheet":"Tiktok","column_keys":["fuga"]}}'),
  ('tiktok',  'believe',      'Believe',      NULL, 20, '{"legacy":{"table":"tiktok","column":"believe"},       "import":{"sheet":"Tiktok","column_keys":["believe"]}}')
) AS v(stream_slug, slug, label, group_values, sort, attributes)
JOIN public.revenue_streams s ON s.slug = v.stream_slug
ON CONFLICT (stream_id, slug) DO UPDATE SET
  label = EXCLUDED.label,
  group_values = EXCLUDED.group_values,
  sort = EXCLUDED.sort,
  attributes = EXCLUDED.attributes;

-- ============ FIELD LINKS (legacy lineage, reproduced) ======================
-- ringtune  = mpt(*_ringtune) + atom.ringtune + ooredoo.ringtune   [buckets: MPT/Atom/Ooredoo]
-- eauc      = mpt(*_eauc) + atom.eauc                              [buckets: MPT/Atom]
-- combo     = mpt(*_combo) + atom.combo                            [buckets: MPT/Atom]
-- local     = all mpt + all atom + ooredoo                         [buckets: MPT/Atom/Ooredoo]
-- international = youtube.solution_one | (yt+sp+tt).fuga | (yt+sp+tt).believe
INSERT INTO public.field_links (source_field_id, target_stream_id, target_bucket_slug, target_bucket_label, sort)
SELECT f.id, t.id, v.bucket_slug, v.bucket_label, v.sort
FROM (
  VALUES
  -- ringtune buckets
  ('mpt', 'legacy_ringtune',  'ringtune', 'mpt',     'MPT',     10),
  ('mpt', 'etrade_ringtune',  'ringtune', 'mpt',     'MPT',     10),
  ('mpt', 'fortune_ringtune', 'ringtune', 'mpt',     'MPT',     10),
  ('mpt', 'unico_ringtune',   'ringtune', 'mpt',     'MPT',     10),
  ('atom', 'ringtune',        'ringtune', 'atom',    'Atom',    20),
  ('ooredoo', 'ringtune',     'ringtune', 'ooredoo', 'Ooredoo', 30),
  -- eauc buckets
  ('mpt', 'legacy_eauc',      'eauc', 'mpt',  'MPT',  10),
  ('mpt', 'etrade_eauc',      'eauc', 'mpt',  'MPT',  10),
  ('mpt', 'fortune_eauc',     'eauc', 'mpt',  'MPT',  10),
  ('mpt', 'unico_eauc',       'eauc', 'mpt',  'MPT',  10),
  ('atom', 'eauc',            'eauc', 'atom', 'Atom', 20),
  -- combo buckets
  ('mpt', 'legacy_combo',     'combo', 'mpt',  'MPT',  10),
  ('mpt', 'etrade_combo',     'combo', 'mpt',  'MPT',  10),
  ('mpt', 'fortune_combo',    'combo', 'mpt',  'MPT',  10),
  ('mpt', 'unico_combo',      'combo', 'mpt',  'MPT',  10),
  ('atom', 'combo',           'combo', 'atom', 'Atom', 20),
  -- local buckets (everything telecom)
  ('mpt', 'legacy_ringtune',  'local', 'mpt', 'MPT', 10),
  ('mpt', 'legacy_eauc',      'local', 'mpt', 'MPT', 10),
  ('mpt', 'legacy_combo',     'local', 'mpt', 'MPT', 10),
  ('mpt', 'etrade_ringtune',  'local', 'mpt', 'MPT', 10),
  ('mpt', 'etrade_eauc',      'local', 'mpt', 'MPT', 10),
  ('mpt', 'etrade_combo',     'local', 'mpt', 'MPT', 10),
  ('mpt', 'fortune_ringtune', 'local', 'mpt', 'MPT', 10),
  ('mpt', 'fortune_eauc',     'local', 'mpt', 'MPT', 10),
  ('mpt', 'fortune_combo',    'local', 'mpt', 'MPT', 10),
  ('mpt', 'unico_ringtune',   'local', 'mpt', 'MPT', 10),
  ('mpt', 'unico_eauc',       'local', 'mpt', 'MPT', 10),
  ('mpt', 'unico_combo',      'local', 'mpt', 'MPT', 10),
  ('atom', 'ringtune',        'local', 'atom', 'Atom', 20),
  ('atom', 'eauc',            'local', 'atom', 'Atom', 20),
  ('atom', 'combo',           'local', 'atom', 'Atom', 20),
  ('ooredoo', 'ringtune',     'local', 'ooredoo', 'Ooredoo', 30),
  -- international buckets
  ('youtube', 'solution_one', 'international', 'solution_one', 'Solution One', 10),
  ('youtube', 'fuga',         'international', 'fuga',         'FUGA',         20),
  ('spotify', 'fuga',         'international', 'fuga',         'FUGA',         20),
  ('tiktok',  'fuga',         'international', 'fuga',         'FUGA',         20),
  ('youtube', 'believe',      'international', 'believe',      'Believe',      30),
  ('spotify', 'believe',      'international', 'believe',      'Believe',      30),
  ('tiktok',  'believe',      'international', 'believe',      'Believe',      30)
) AS v(stream_slug, field_slug, target_slug, bucket_slug, bucket_label, sort)
JOIN public.revenue_streams src ON src.slug = v.stream_slug
JOIN public.stream_fields f ON f.stream_id = src.id AND f.slug = v.field_slug
JOIN public.revenue_streams t ON t.slug = v.target_slug
ON CONFLICT (source_field_id, target_stream_id) DO UPDATE SET
  target_bucket_slug = EXCLUDED.target_bucket_slug,
  target_bucket_label = EXCLUDED.target_bucket_label,
  sort = EXCLUDED.sort;

-- ============ VERIFICATION (RAISE = rollback) ===============================
DO $$
DECLARE
  n INT;
  bad INT;
  r RECORD;
BEGIN
  SELECT COUNT(*) INTO n FROM public.revenue_streams;
  IF n <> 16 THEN RAISE EXCEPTION '014 verification failed: expected 16 streams, found %', n; END IF;

  SELECT COUNT(*) INTO n FROM public.stream_fields;
  IF n <> 34 THEN RAISE EXCEPTION '014 verification failed: expected 34 fields, found %', n; END IF;

  SELECT COUNT(*) INTO n FROM public.field_links;
  IF n <> 39 THEN RAISE EXCEPTION '014 verification failed: expected 39 field_links, found %', n; END IF;

  -- Per-derived-stream link counts
  FOR r IN
    SELECT t.slug, COUNT(*) AS links
    FROM public.field_links fl
    JOIN public.revenue_streams t ON t.id = fl.target_stream_id
    GROUP BY t.slug
  LOOP
    IF (r.slug = 'ringtune' AND r.links <> 6)
       OR (r.slug = 'eauc' AND r.links <> 5)
       OR (r.slug = 'combo' AND r.links <> 5)
       OR (r.slug = 'local' AND r.links <> 16)
       OR (r.slug = 'international' AND r.links <> 7) THEN
      RAISE EXCEPTION '014 verification failed: derived stream % has % links', r.slug, r.links;
    END IF;
  END LOOP;

  -- Every entry field must have legacy + import metadata (backfill + template compat)
  SELECT COUNT(*) INTO bad
  FROM public.stream_fields f
  JOIN public.revenue_streams s ON s.id = f.stream_id
  WHERE s.kind = 'entry'
    AND (f.attributes->'legacy'->>'table' IS NULL
      OR f.attributes->'legacy'->>'column' IS NULL
      OR f.attributes->'import'->>'sheet' IS NULL
      OR jsonb_array_length(COALESCE(f.attributes->'import'->'column_keys', '[]'::jsonb)) = 0);
  IF bad > 0 THEN
    RAISE EXCEPTION '014 verification failed: % entry fields missing legacy/import metadata', bad;
  END IF;

  -- Every legacy mapping must reference a real table+column
  FOR r IN
    SELECT f.attributes->'legacy'->>'table' AS tbl, f.attributes->'legacy'->>'column' AS col
    FROM public.stream_fields f
    JOIN public.revenue_streams s ON s.id = f.stream_id
    WHERE s.kind = 'entry'
  LOOP
    PERFORM 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = r.tbl AND column_name = r.col;
    IF NOT FOUND THEN
      RAISE EXCEPTION '014 verification failed: legacy mapping %.% does not exist', r.tbl, r.col;
    END IF;
  END LOOP;

  -- Summary membership matches the legacy revenue_summary total formula (10 streams)
  SELECT COUNT(*) INTO n FROM public.revenue_streams
  WHERE (attributes->>'in_summary')::boolean IS TRUE;
  IF n <> 10 THEN
    RAISE EXCEPTION '014 verification failed: expected 10 in_summary streams, found %', n;
  END IF;

  RAISE NOTICE '014 OK: 16 streams, 34 fields, 39 links, all legacy/import metadata valid.';
END $$;

COMMIT;
-- =============================================================================
-- 015_backfill_and_views.sql — Derived views + backfill + FULL RECONCILIATION
-- =============================================================================
-- 1. Creates the three views that replace the legacy lineage triggers.
-- 2. Backfills revenue_entries from the legacy tables using the
--    attributes.legacy mapping seeded in 014.
-- 3. Verifies, inside the same transaction:
--      a) row-count identity per field,
--      b) cell-level identity (sum of absolute differences = 0),
--      c) view logic vs direct recomputation from legacy base tables (exact),
--      d) new values vs the OLD stored derived tables (tolerance 0.01,
--         aborting on any month not in ALLOWED_DRIFT_MONTHS below).
--    Any failure RAISEs and rolls back the entire script.
--
-- BEFORE RUNNING: run supabase/scripts/000_drift_audit.sql and triage every
-- row per docs/migration-runbook.md §4. Months you signed off as "recomputed
-- value is correct" go into ALLOWED_DRIFT_MONTHS in the final DO block.
--
-- Idempotent: re-running re-upserts the backfill and re-verifies.
-- =============================================================================

BEGIN;

-- ============ VIEWS =========================================================
-- security_invoker: the querying user's RLS applies (the views must not become
-- a hole around revenue_entries policies).

CREATE OR REPLACE VIEW public.v_derived_bucket_totals
WITH (security_invoker = on) AS
SELECT
  e.month,
  fl.target_stream_id AS stream_id,
  fl.target_bucket_slug AS bucket_slug,
  MIN(fl.target_bucket_label) AS bucket_label,
  MIN(fl.sort) AS bucket_sort,
  SUM(e.amount)::NUMERIC(18,2) AS amount
FROM public.revenue_entries e
JOIN public.field_links fl ON fl.source_field_id = e.field_id
GROUP BY e.month, fl.target_stream_id, fl.target_bucket_slug;

CREATE OR REPLACE VIEW public.v_stream_month_totals
WITH (security_invoker = on) AS
SELECT e.month, f.stream_id, SUM(e.amount)::NUMERIC(18,2) AS total
FROM public.revenue_entries e
JOIN public.stream_fields f ON f.id = e.field_id
GROUP BY e.month, f.stream_id
UNION ALL
SELECT month, stream_id, SUM(amount)::NUMERIC(18,2) AS total
FROM public.v_derived_bucket_totals
GROUP BY month, stream_id;

-- Shape-compatible replacement for the legacy revenue_summary table, so the
-- app's read path can cut over with a table-name change (Phase 2).
CREATE OR REPLACE VIEW public.v_revenue_summary_compat
WITH (security_invoker = on) AS
WITH tot AS (
  SELECT
    t.month,
    s.attributes->>'summary_column' AS col,
    COALESCE((s.attributes->>'in_summary')::BOOLEAN, FALSE) AS in_summary,
    t.total
  FROM public.v_stream_month_totals t
  JOIN public.revenue_streams s ON s.id = t.stream_id
),
month_meta AS (
  SELECT month, MIN(created_at) AS created_at, MAX(updated_at) AS updated_at
  FROM public.revenue_entries
  GROUP BY month
)
SELECT
  ROW_NUMBER() OVER (ORDER BY tot.month) AS sqlid,
  tot.month,
  COALESCE(SUM(total) FILTER (WHERE col = 'ringtune'), 0)::NUMERIC(18,2) AS ringtune,
  COALESCE(SUM(total) FILTER (WHERE col = 'eauc'), 0)::NUMERIC(18,2) AS eauc,
  COALESCE(SUM(total) FILTER (WHERE col = 'combo'), 0)::NUMERIC(18,2) AS combo,
  COALESCE(SUM(total) FILTER (WHERE col = 'sznb'), 0)::NUMERIC(18,2) AS sznb,
  COALESCE(SUM(total) FILTER (WHERE col = 'flow_music_zone'), 0)::NUMERIC(18,2) AS flow_music_zone,
  COALESCE(SUM(total) FILTER (WHERE col = 'flow_subscription'), 0)::NUMERIC(18,2) AS flow_subscription,
  COALESCE(SUM(total) FILTER (WHERE col = 'flow_data_pack'), 0)::NUMERIC(18,2) AS flow_data_pack,
  COALESCE(SUM(total) FILTER (WHERE col = 'youtube'), 0)::NUMERIC(18,2) AS youtube,
  COALESCE(SUM(total) FILTER (WHERE col = 'spotify'), 0)::NUMERIC(18,2) AS spotify,
  COALESCE(SUM(total) FILTER (WHERE col = 'tiktok'), 0)::NUMERIC(18,2) AS tiktok,
  COALESCE(SUM(total) FILTER (WHERE in_summary), 0)::NUMERIC(18,2) AS total,
  MIN(mm.created_at) AS created_at,
  MAX(mm.updated_at) AS updated_at
FROM tot
LEFT JOIN month_meta mm ON mm.month = tot.month
GROUP BY tot.month;

-- ============ BACKFILL ======================================================
DO $$
DECLARE
  f RECORD;
  total_rows BIGINT := 0;
  n BIGINT;
BEGIN
  -- Silence the row-level audit trigger for the bulk backfill; a single
  -- summary IMPORT row is written below instead. (audit_log itself is never
  -- modified — this only avoids thousands of synthetic INSERT rows.)
  ALTER TABLE public.revenue_entries DISABLE TRIGGER audit_trigger;

  FOR f IN
    SELECT sf.id AS field_id,
           sf.attributes->'legacy'->>'table' AS tbl,
           sf.attributes->'legacy'->>'column' AS col
    FROM public.stream_fields sf
    JOIN public.revenue_streams s ON s.id = sf.stream_id
    WHERE s.kind = 'entry'
      AND sf.attributes->'legacy'->>'table' IS NOT NULL
  LOOP
    EXECUTE format(
      'INSERT INTO public.revenue_entries (month, field_id, amount)
       SELECT month, %L::uuid, COALESCE(%I, 0)::NUMERIC(18,2)
       FROM public.%I
       ON CONFLICT (month, field_id) DO UPDATE SET amount = EXCLUDED.amount',
      f.field_id, f.col, f.tbl
    );
    GET DIAGNOSTICS n = ROW_COUNT;
    total_rows := total_rows + n;
  END LOOP;

  ALTER TABLE public.revenue_entries ENABLE TRIGGER audit_trigger;

  INSERT INTO public.audit_log (user_id, action, table_name, row_id, old_value, new_value)
  VALUES (
    NULL, 'IMPORT', 'revenue_entries', 'migration_015',
    NULL,
    jsonb_build_object(
      'source', 'migration 015_backfill_and_views',
      'backfilled_rows', total_rows,
      'ran_at', NOW()
    )
  );

  RAISE NOTICE '015 backfill: % entry rows upserted from legacy tables.', total_rows;
END $$;

-- ============ VERIFICATION (RAISE = rollback of views + backfill) ===========
DO $$
DECLARE
  -- Months signed off during drift triage (runbook §4): the RECOMPUTED value
  -- is accepted as correct even though the old stored derived value differs.
  --
  -- Signed off 2026-07-03: the `local` and `international` tables were never
  -- surfaced anywhere in the app (no tab, no chart ever read them) and were
  -- never populated for these months — the recomputed totals from the real,
  -- actively-used tables (mpt/atom/youtube/spotify/tiktok) are correct.
  -- Confirmed with the user that November 2025 is the last entered month.
  ALLOWED_DRIFT_MONTHS CONSTANT DATE[] := ARRAY[
    '2025-02-01', '2025-03-01', '2025-04-01', '2025-05-01', '2025-06-01',
    '2025-07-01', '2025-08-01', '2025-09-01', '2025-10-01', '2025-11-01'
  ]::DATE[];

  f RECORD;
  r RECORD;
  n BIGINT;
  src_count BIGINT;
  bad NUMERIC;
  fail_count INT := 0;
  months_new BIGINT;
  entries_count BIGINT;
  grand_old NUMERIC;
  grand_new NUMERIC;
BEGIN
  -- ---- (a) + (b): per-field row-count and cell-level identity --------------
  FOR f IN
    SELECT sf.id AS field_id, sf.slug AS field_slug, s.slug AS stream_slug,
           sf.attributes->'legacy'->>'table' AS tbl,
           sf.attributes->'legacy'->>'column' AS col
    FROM public.stream_fields sf
    JOIN public.revenue_streams s ON s.id = sf.stream_id
    WHERE s.kind = 'entry'
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM public.%I', f.tbl) INTO src_count;
    SELECT COUNT(*) INTO n FROM public.revenue_entries WHERE field_id = f.field_id;
    IF n <> src_count THEN
      RAISE EXCEPTION '015 verification failed (row count): field %.% has % entries, legacy %.% has % rows',
        f.stream_slug, f.field_slug, n, f.tbl, f.col, src_count;
    END IF;

    EXECUTE format(
      'SELECT COALESCE(SUM(ABS(COALESCE(o.%I, 0) - e.amount)), 0)
       FROM public.%I o
       JOIN public.revenue_entries e ON e.month = o.month AND e.field_id = %L::uuid',
      f.col, f.tbl, f.field_id
    ) INTO bad;
    IF bad <> 0 THEN
      RAISE EXCEPTION '015 verification failed (cell identity): field %.% differs from %.% by SUM(ABS)=%',
        f.stream_slug, f.field_slug, f.tbl, f.col, bad;
    END IF;
  END LOOP;
  RAISE NOTICE '015 check a+b OK: every backfilled cell matches its legacy source exactly.';

  -- ---- (c): view logic vs direct recomputation from legacy base tables -----
  -- Validates the field_links wiring, independent of the backfill identity.
  FOR r IN
    WITH recomputed AS (
      SELECT
        COALESCE(m.month, a.month, rt.month) AS month,
        COALESCE(m.legacy_ringtune,0)+COALESCE(m.etrade_ringtune,0)+COALESCE(m.fortune_ringtune,0)+COALESCE(m.unico_ringtune,0)
          + COALESCE(a.ringtune,0) + COALESCE(rt.ooredoo,0) AS ringtune,
        COALESCE(m.legacy_eauc,0)+COALESCE(m.etrade_eauc,0)+COALESCE(m.fortune_eauc,0)+COALESCE(m.unico_eauc,0)
          + COALESCE(a.eauc,0) AS eauc,
        COALESCE(m.legacy_combo,0)+COALESCE(m.etrade_combo,0)+COALESCE(m.fortune_combo,0)+COALESCE(m.unico_combo,0)
          + COALESCE(a.combo,0) AS combo
      FROM public.mpt m
      FULL JOIN public.atom a ON a.month = m.month
      FULL JOIN public.ringtune rt ON rt.month = COALESCE(m.month, a.month)
    ),
    new_side AS (
      SELECT month,
        SUM(CASE WHEN s.slug = 'ringtune' THEN t.total ELSE 0 END) AS ringtune,
        SUM(CASE WHEN s.slug = 'eauc' THEN t.total ELSE 0 END) AS eauc,
        SUM(CASE WHEN s.slug = 'combo' THEN t.total ELSE 0 END) AS combo
      FROM public.v_stream_month_totals t
      JOIN public.revenue_streams s ON s.id = t.stream_id AND s.kind = 'derived'
      GROUP BY month
    )
    SELECT rc.month,
           ABS(rc.ringtune - COALESCE(ns.ringtune, 0)) AS d_ringtune,
           ABS(rc.eauc - COALESCE(ns.eauc, 0)) AS d_eauc,
           ABS(rc.combo - COALESCE(ns.combo, 0)) AS d_combo
    FROM recomputed rc
    LEFT JOIN new_side ns ON ns.month = rc.month
    WHERE ABS(rc.ringtune - COALESCE(ns.ringtune, 0)) > 0
       OR ABS(rc.eauc - COALESCE(ns.eauc, 0)) > 0
       OR ABS(rc.combo - COALESCE(ns.combo, 0)) > 0
  LOOP
    fail_count := fail_count + 1;
    RAISE WARNING '015 check c mismatch: month % ringtune Δ% eauc Δ% combo Δ%',
      r.month, r.d_ringtune, r.d_eauc, r.d_combo;
  END LOOP;
  IF fail_count > 0 THEN
    RAISE EXCEPTION '015 verification failed (view recomputation): % months mismatched (see warnings)', fail_count;
  END IF;
  RAISE NOTICE '015 check c OK: derived views reproduce legacy lineage exactly.';

  -- ---- (d): new values vs OLD stored derived tables (drift-aware) ----------
  -- Summary columns
  FOR r IN
    SELECT c.month,
           GREATEST(
             ABS(c.ringtune - COALESCE(o.ringtune, 0)),
             ABS(c.eauc - COALESCE(o.eauc, 0)),
             ABS(c.combo - COALESCE(o.combo, 0)),
             ABS(c.sznb - COALESCE(o.sznb, 0)),
             ABS(c.flow_music_zone - COALESCE(o.flow_music_zone, 0)),
             ABS(c.flow_subscription - COALESCE(o.flow_subscription, 0)),
             ABS(c.flow_data_pack - COALESCE(o.flow_data_pack, 0)),
             ABS(c.youtube - COALESCE(o.youtube, 0)),
             ABS(c.spotify - COALESCE(o.spotify, 0)),
             ABS(c.tiktok - COALESCE(o.tiktok, 0)),
             ABS(c.total - COALESCE(o.total, 0))
           ) AS max_diff
    FROM public.v_revenue_summary_compat c
    FULL JOIN public.revenue_summary o ON o.month = c.month
  LOOP
    IF r.max_diff > 0.01 AND NOT (r.month = ANY(ALLOWED_DRIFT_MONTHS)) THEN
      RAISE EXCEPTION '015 verification failed (old vs new summary): month % max column diff % — triage per runbook §4 or add to ALLOWED_DRIFT_MONTHS',
        r.month, r.max_diff;
    END IF;
  END LOOP;

  -- Derived stream totals vs old derived tables
  FOR r IN
    WITH new_totals AS (
      SELECT t.month, s.slug, t.total
      FROM public.v_stream_month_totals t
      JOIN public.revenue_streams s ON s.id = t.stream_id
      WHERE s.slug IN ('ringtune', 'eauc', 'combo', 'local', 'international')
    ),
    old_totals AS (
      SELECT month, 'ringtune' AS slug, COALESCE(total, 0) AS total FROM public.ringtune
      UNION ALL SELECT month, 'eauc', COALESCE(total, 0) FROM public.eauc
      UNION ALL SELECT month, 'combo', COALESCE(total, 0) FROM public.combo
      UNION ALL SELECT month, 'local', COALESCE(total, 0) FROM public.local
      UNION ALL SELECT month, 'international', COALESCE(total, 0) FROM public.international
    )
    SELECT COALESCE(n.month, o.month) AS month, COALESCE(n.slug, o.slug) AS slug,
           ABS(COALESCE(n.total, 0) - COALESCE(o.total, 0)) AS diff
    FROM new_totals n
    FULL JOIN old_totals o ON o.month = n.month AND o.slug = n.slug
    WHERE ABS(COALESCE(n.total, 0) - COALESCE(o.total, 0)) > 0.01
  LOOP
    IF NOT (r.month = ANY(ALLOWED_DRIFT_MONTHS)) THEN
      RAISE EXCEPTION '015 verification failed (old vs new derived): stream % month % diff % — triage per runbook §4 or add to ALLOWED_DRIFT_MONTHS',
        r.slug, r.month, r.diff;
    END IF;
  END LOOP;
  RAISE NOTICE '015 check d OK: new model matches stored legacy values (allowlisted months: %).',
    COALESCE(array_length(ALLOWED_DRIFT_MONTHS, 1), 0);

  -- ---- Final reconciliation report ------------------------------------------
  SELECT COUNT(DISTINCT month), COUNT(*) INTO months_new, entries_count FROM public.revenue_entries;
  SELECT COALESCE(SUM(total), 0) INTO grand_old FROM public.revenue_summary;
  SELECT COALESCE(SUM(total), 0) INTO grand_new FROM public.v_revenue_summary_compat;
  RAISE NOTICE '015 RECONCILIATION REPORT: % months, % fact rows | grand total old=% new=% (diff %)',
    months_new, entries_count, grand_old, grand_new, grand_new - grand_old;
END $$;

COMMIT;
-- =============================================================================
-- 016_forward_sync_triggers.sql — Legacy tables → revenue_entries live sync
-- =============================================================================
-- After the 015 backfill, the OLD app keeps writing to the legacy tables until
-- the Phase 3 deploy. These triggers mirror every legacy base-table write into
-- revenue_entries (driven by the same attributes.legacy mapping), so the new
-- fact table stays current with zero app changes.
--
-- INSERT/UPDATE only: the legacy app has no delete path for revenue rows.
-- Removed by 017_freeze_legacy_tables.sql at write-cutover;
-- 016_rollback.sql removes them early if Phase 1 must be reverted.
--
-- Idempotent. Transactional. Self-verifying via a sentinel-month round trip.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_legacy_to_entries()
RETURNS TRIGGER AS $$
DECLARE
  f RECORD;
  row_json JSONB := to_jsonb(NEW);
  v NUMERIC(18,2);
BEGIN
  FOR f IN
    SELECT sf.id AS field_id, sf.attributes->'legacy'->>'column' AS col
    FROM public.stream_fields sf
    JOIN public.revenue_streams s ON s.id = sf.stream_id
    WHERE s.kind = 'entry'
      AND sf.attributes->'legacy'->>'table' = TG_TABLE_NAME
  LOOP
    v := COALESCE((row_json->>f.col)::NUMERIC, 0);
    INSERT INTO public.revenue_entries (month, field_id, amount)
    VALUES (NEW.month, f.field_id, v)
    ON CONFLICT (month, field_id) DO UPDATE
    SET amount = EXCLUDED.amount
    WHERE public.revenue_entries.amount IS DISTINCT FROM EXCLUDED.amount;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
DECLARE
  tbl TEXT;
  legacy_tables TEXT[] := ARRAY[
    'mpt', 'atom', 'ringtune', 'sznb', 'flow_subscription',
    'youtube', 'spotify', 'tiktok', 'revenue_summary'
  ];
BEGIN
  FOREACH tbl IN ARRAY legacy_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS forward_sync_to_entries ON public.%I', tbl);
    EXECUTE format(
      'CREATE TRIGGER forward_sync_to_entries AFTER INSERT OR UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.sync_legacy_to_entries()', tbl);
  END LOOP;
END $$;

-- ============ VERIFICATION: sentinel round trip (RAISE = rollback) ==========
DO $$
DECLARE
  sentinel CONSTANT DATE := '0001-01-01';
  n INT;
  amt NUMERIC;
  tbl TEXT;
  quiet_tables TEXT[] := ARRAY[
    'mpt', 'ringtune', 'eauc', 'combo', 'revenue_summary', 'revenue_entries'
  ];
BEGIN
  -- Keep the sentinel test out of audit_log (it is a migration self-test, not
  -- a data event). Only the audit triggers are paused, inside this transaction.
  FOREACH tbl IN ARRAY quiet_tables LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER audit_trigger', tbl);
  END LOOP;

  INSERT INTO public.mpt (month, legacy_ringtune) VALUES (sentinel, 123.45);

  SELECT COUNT(*) INTO n
  FROM public.revenue_entries e
  JOIN public.stream_fields sf ON sf.id = e.field_id
  JOIN public.revenue_streams s ON s.id = sf.stream_id
  WHERE e.month = sentinel AND s.slug = 'mpt';
  IF n <> 12 THEN
    RAISE EXCEPTION '016 verification failed: expected 12 sentinel mpt entries, found %', n;
  END IF;

  SELECT e.amount INTO amt
  FROM public.revenue_entries e
  JOIN public.stream_fields sf ON sf.id = e.field_id
  JOIN public.revenue_streams s ON s.id = sf.stream_id
  WHERE e.month = sentinel AND s.slug = 'mpt' AND sf.slug = 'legacy_ringtune';
  IF amt IS DISTINCT FROM 123.45 THEN
    RAISE EXCEPTION '016 verification failed: sentinel legacy_ringtune = % (expected 123.45)', amt;
  END IF;

  -- Cleanup: remove the sentinel from every table the legacy lineage triggers
  -- touched. Order matters — revenue_summary is re-upserted by the child
  -- tables'' delete triggers, so it goes second-to-last; entries last.
  DELETE FROM public.mpt WHERE month = sentinel;
  DELETE FROM public.ringtune WHERE month = sentinel;
  DELETE FROM public.eauc WHERE month = sentinel;
  DELETE FROM public.combo WHERE month = sentinel;
  DELETE FROM public.revenue_summary WHERE month = sentinel;
  DELETE FROM public.revenue_entries WHERE month = sentinel;

  -- Confirm no sentinel residue anywhere
  SELECT (SELECT COUNT(*) FROM public.mpt WHERE month = sentinel)
       + (SELECT COUNT(*) FROM public.ringtune WHERE month = sentinel)
       + (SELECT COUNT(*) FROM public.eauc WHERE month = sentinel)
       + (SELECT COUNT(*) FROM public.combo WHERE month = sentinel)
       + (SELECT COUNT(*) FROM public.revenue_summary WHERE month = sentinel)
       + (SELECT COUNT(*) FROM public.revenue_entries WHERE month = sentinel)
  INTO n;
  IF n <> 0 THEN
    RAISE EXCEPTION '016 verification failed: % sentinel rows left after cleanup', n;
  END IF;

  FOREACH tbl IN ARRAY quiet_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER audit_trigger', tbl);
  END LOOP;

  RAISE NOTICE '016 OK: forward-sync triggers live on 9 legacy tables; sentinel round trip passed.';
END $$;

COMMIT;
-- =============================================================================
-- 019_gold_palette.sql — Legacy gold brand: update the flagship stream color
-- =============================================================================
-- The app theme moved from teal to Legacy gold (#D4AF37). Stream colors are
-- config data; Ringtune (the flagship stream) carried the old teal brand color
-- and now carries the gold one. Other stream colors are categorical data-viz
-- colors and are intentionally unchanged. Editors can adjust any of them later
-- in /admin/streams.
--
-- Idempotent. Audited automatically by the config-table audit triggers.
-- =============================================================================

BEGIN;

UPDATE public.revenue_streams
SET color = '#d4af37'
WHERE slug = 'ringtune' AND color = '#00d4c8';

DO $$
DECLARE
  c TEXT;
BEGIN
  SELECT color INTO c FROM public.revenue_streams WHERE slug = 'ringtune';
  IF c IS DISTINCT FROM '#d4af37' THEN
    RAISE NOTICE '019: ringtune color is % (not the seeded teal) — left untouched, likely customized in the UI.', c;
  ELSE
    RAISE NOTICE '019 OK: ringtune now wears Legacy gold.';
  END IF;
END $$;

COMMIT;
