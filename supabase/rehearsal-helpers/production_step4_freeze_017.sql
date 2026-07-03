-- =============================================================================
-- 017_freeze_legacy_tables.sql — Write-cutover: freeze the legacy tables
-- =============================================================================
-- Run IMMEDIATELY AFTER deploying the Phase 3 app build and smoke-testing it
-- (runbook §5). From this point:
--   * revenue_entries is the only writable revenue store,
--   * legacy tables stay SELECT-able (historical reference) but reject writes,
--   * the legacy lineage triggers (003) and forward-sync triggers (016) are
--     removed (trigger functions are kept so 017_rollback.sql can restore).
--
-- audit_log is untouched. Idempotent. Transactional. Self-verifying.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
  legacy_tables TEXT[] := ARRAY[
    'revenue_summary', 'ringtune', 'mpt', 'atom', 'eauc', 'combo', 'local',
    'sznb', 'flow_subscription', 'international', 'youtube', 'spotify', 'tiktok'
  ];
BEGIN
  -- 1. Remove lineage triggers (003) and forward-sync triggers (016).
  --    Functions are intentionally kept for 017_rollback.sql.
  DROP TRIGGER IF EXISTS mpt_sync_telecom_trigger ON public.mpt;
  DROP TRIGGER IF EXISTS atom_sync_telecom_trigger ON public.atom;
  DROP TRIGGER IF EXISTS ringtune_sync_revenue_trigger ON public.ringtune;
  DROP TRIGGER IF EXISTS eauc_sync_revenue_trigger ON public.eauc;
  DROP TRIGGER IF EXISTS combo_sync_revenue_trigger ON public.combo;
  DROP TRIGGER IF EXISTS sznb_sync_revenue_trigger ON public.sznb;
  DROP TRIGGER IF EXISTS flow_subscription_sync_revenue_trigger ON public.flow_subscription;
  DROP TRIGGER IF EXISTS youtube_sync_revenue_trigger ON public.youtube;
  DROP TRIGGER IF EXISTS spotify_sync_revenue_trigger ON public.spotify;
  DROP TRIGGER IF EXISTS tiktok_sync_revenue_trigger ON public.tiktok;

  FOREACH tbl IN ARRAY legacy_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS forward_sync_to_entries ON public.%I', tbl);
  END LOOP;

  -- 2. Drop every INSERT/UPDATE/DELETE/ALL policy on the legacy tables
  --    (SELECT policies stay so history remains readable under RBAC).
  FOREACH tbl IN ARRAY legacy_tables LOOP
    FOR pol IN
      SELECT policyname, cmd FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl AND cmd <> 'SELECT'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;

    -- 3. Silence the legacy audit triggers (no writes can occur anyway) and
    --    mark the table as frozen.
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER audit_trigger', tbl);
    EXECUTE format(
      'COMMENT ON TABLE public.%I IS %L',
      tbl,
      'FROZEN ' || NOW()::date || ': superseded by revenue_entries (config-driven model). '
        || 'Read-only historical reference. Decommission per docs/migration-runbook.md §9.'
    );
  END LOOP;

  -- 4. Record the freeze moment for 017_rollback.sql reverse-sync.
  INSERT INTO public.app_settings (key, value)
  VALUES ('legacy_freeze', jsonb_build_object('frozen_at', NOW()))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
END $$;

-- ============ VERIFICATION (RAISE = rollback) ===============================
DO $$
DECLARE
  n INT;
  r RECORD;
  legacy_tables TEXT[] := ARRAY[
    'revenue_summary', 'ringtune', 'mpt', 'atom', 'eauc', 'combo', 'local',
    'sznb', 'flow_subscription', 'international', 'youtube', 'spotify', 'tiktok'
  ];
BEGIN
  SELECT COUNT(*) INTO n FROM pg_policies
  WHERE schemaname = 'public' AND tablename = ANY(legacy_tables) AND cmd <> 'SELECT';
  IF n <> 0 THEN
    RAISE EXCEPTION '017 verification failed: % write policies remain on legacy tables', n;
  END IF;

  SELECT COUNT(*) INTO n FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  WHERE NOT t.tgisinternal
    AND c.relname = ANY(legacy_tables)
    AND (t.tgname = 'forward_sync_to_entries' OR t.tgname LIKE '%sync%trigger');
  IF n <> 0 THEN
    RAISE EXCEPTION '017 verification failed: % lineage/sync triggers remain', n;
  END IF;

  -- Informational old-vs-new report (divergence AFTER the app deploy is
  -- expected — new writes only land in revenue_entries).
  FOR r IN
    SELECT c.month, ABS(c.total - COALESCE(o.total, 0)) AS diff
    FROM public.v_revenue_summary_compat c
    FULL JOIN public.revenue_summary o ON o.month = c.month
    WHERE ABS(COALESCE(c.total, 0) - COALESCE(o.total, 0)) > 0.01
  LOOP
    RAISE NOTICE '017 info: month % differs from frozen legacy total by % (expected if written after deploy)', r.month, r.diff;
  END LOOP;

  RAISE NOTICE '017 OK: 13 legacy tables frozen (read-only), lineage + forward-sync triggers removed.';
END $$;

COMMIT;
