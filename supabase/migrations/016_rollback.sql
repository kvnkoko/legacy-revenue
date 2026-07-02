-- =============================================================================
-- 016_rollback.sql — Remove the legacy→entries forward-sync triggers
-- =============================================================================
-- Use only if Phase 1 must be reverted before write-cutover (017 removes the
-- same triggers as part of the normal path). Leaves revenue_entries and the
-- config tables in place; to fully unwind Phase 1 afterwards:
--   TRUNCATE public.revenue_entries;
--   DROP VIEW  public.v_revenue_summary_compat, public.v_stream_month_totals,
--              public.v_derived_bucket_totals;
--   -- and optionally DROP the config tables from 013.
-- =============================================================================

BEGIN;

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
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.sync_legacy_to_entries();

DO $$
DECLARE
  n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM pg_trigger WHERE tgname = 'forward_sync_to_entries';
  IF n <> 0 THEN
    RAISE EXCEPTION '016_rollback failed: % forward_sync_to_entries triggers remain', n;
  END IF;
  RAISE NOTICE '016_rollback OK: forward-sync triggers removed.';
END $$;

COMMIT;
