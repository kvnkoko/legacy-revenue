-- =============================================================================
-- 017_rollback.sql — Unfreeze legacy tables and reverse-sync new entries
-- =============================================================================
-- Restores the pre-017 state so the PREVIOUS app build works again:
--   1. recreates the 003 lineage triggers and 016 forward-sync triggers
--      (their functions were kept by 017),
--   2. reverse-syncs every revenue_entries value updated after the freeze back
--      into the legacy tables — with lineage triggers live, so derived tables
--      and revenue_summary are re-derived automatically,
--   3. recreates the 006-style write policies,
--   4. re-enables the legacy audit triggers.
-- Rehearse before relying on it. Idempotent. Transactional.
-- =============================================================================

BEGIN;

-- ============ 1. Recreate lineage triggers (003 functions still exist) ======
DO $$
BEGIN
  IF to_regprocedure('public.sync_telecom_from_mpt()') IS NULL
     OR to_regprocedure('public.sync_revenue_summary_from_children()') IS NULL
     OR to_regprocedure('public.sync_legacy_to_entries()') IS NULL THEN
    RAISE EXCEPTION '017_rollback failed: lineage/sync functions missing — re-run 003 and 016 first';
  END IF;
END $$;

DROP TRIGGER IF EXISTS mpt_sync_telecom_trigger ON public.mpt;
CREATE TRIGGER mpt_sync_telecom_trigger AFTER INSERT OR UPDATE ON public.mpt
FOR EACH ROW EXECUTE FUNCTION sync_telecom_from_mpt();
DROP TRIGGER IF EXISTS atom_sync_telecom_trigger ON public.atom;
CREATE TRIGGER atom_sync_telecom_trigger AFTER INSERT OR UPDATE ON public.atom
FOR EACH ROW EXECUTE FUNCTION sync_telecom_from_atom();
DROP TRIGGER IF EXISTS ringtune_sync_revenue_trigger ON public.ringtune;
CREATE TRIGGER ringtune_sync_revenue_trigger AFTER INSERT OR UPDATE OR DELETE ON public.ringtune
FOR EACH ROW EXECUTE FUNCTION sync_revenue_summary_from_children();
DROP TRIGGER IF EXISTS eauc_sync_revenue_trigger ON public.eauc;
CREATE TRIGGER eauc_sync_revenue_trigger AFTER INSERT OR UPDATE OR DELETE ON public.eauc
FOR EACH ROW EXECUTE FUNCTION sync_revenue_summary_from_children();
DROP TRIGGER IF EXISTS combo_sync_revenue_trigger ON public.combo;
CREATE TRIGGER combo_sync_revenue_trigger AFTER INSERT OR UPDATE OR DELETE ON public.combo
FOR EACH ROW EXECUTE FUNCTION sync_revenue_summary_from_children();
DROP TRIGGER IF EXISTS sznb_sync_revenue_trigger ON public.sznb;
CREATE TRIGGER sznb_sync_revenue_trigger AFTER INSERT OR UPDATE OR DELETE ON public.sznb
FOR EACH ROW EXECUTE FUNCTION sync_revenue_summary_from_children();
DROP TRIGGER IF EXISTS flow_subscription_sync_revenue_trigger ON public.flow_subscription;
CREATE TRIGGER flow_subscription_sync_revenue_trigger AFTER INSERT OR UPDATE OR DELETE ON public.flow_subscription
FOR EACH ROW EXECUTE FUNCTION sync_revenue_summary_from_children();
DROP TRIGGER IF EXISTS youtube_sync_revenue_trigger ON public.youtube;
CREATE TRIGGER youtube_sync_revenue_trigger AFTER INSERT OR UPDATE OR DELETE ON public.youtube
FOR EACH ROW EXECUTE FUNCTION sync_revenue_summary_from_children();
DROP TRIGGER IF EXISTS spotify_sync_revenue_trigger ON public.spotify;
CREATE TRIGGER spotify_sync_revenue_trigger AFTER INSERT OR UPDATE OR DELETE ON public.spotify
FOR EACH ROW EXECUTE FUNCTION sync_revenue_summary_from_children();
DROP TRIGGER IF EXISTS tiktok_sync_revenue_trigger ON public.tiktok;
CREATE TRIGGER tiktok_sync_revenue_trigger AFTER INSERT OR UPDATE OR DELETE ON public.tiktok
FOR EACH ROW EXECUTE FUNCTION sync_revenue_summary_from_children();

-- ============ 2. Recreate forward-sync triggers (016) =======================
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

-- ============ 3. Reverse-sync post-freeze entries → legacy tables ===========
DO $$
DECLARE
  frozen_at TIMESTAMPTZ;
  f RECORD;
  synced INT := 0;
BEGIN
  SELECT (value->>'frozen_at')::timestamptz INTO frozen_at
  FROM public.app_settings WHERE key = 'legacy_freeze';
  IF frozen_at IS NULL THEN
    RAISE NOTICE '017_rollback: no legacy_freeze marker found; skipping reverse-sync.';
    RETURN;
  END IF;

  -- Legacy audit triggers are still disabled at this point, so the reverse
  -- sync itself does not double-log (entries changes were already audited).
  -- Lineage triggers are live again, so upserting base tables re-derives
  -- ringtune/eauc/combo/revenue_summary. revenue_summary-mapped fields
  -- (flow_music_zone/flow_data_pack) go LAST because the child-table syncs
  -- zero those columns on every derivation.
  FOR f IN
    SELECT sf.id AS field_id,
           sf.attributes->'legacy'->>'table' AS tbl,
           sf.attributes->'legacy'->>'column' AS col
    FROM public.stream_fields sf
    JOIN public.revenue_streams s ON s.id = sf.stream_id
    WHERE s.kind = 'entry' AND sf.attributes->'legacy'->>'table' IS NOT NULL
    ORDER BY (sf.attributes->'legacy'->>'table' = 'revenue_summary')  -- summary last
  LOOP
    EXECUTE format(
      'INSERT INTO public.%I (month, %I)
       SELECT e.month, e.amount FROM public.revenue_entries e
       WHERE e.field_id = %L::uuid AND e.updated_at > %L
       ON CONFLICT (month) DO UPDATE SET %I = EXCLUDED.%I',
      f.tbl, f.col, f.field_id, frozen_at, f.col, f.col
    );
    synced := synced + 1;
  END LOOP;
  RAISE NOTICE '017_rollback: reverse-synced post-freeze values for % fields (freeze was %).', synced, frozen_at;

  DELETE FROM public.app_settings WHERE key = 'legacy_freeze';
END $$;

-- ============ 4. Write policies + audit triggers back on ====================
DO $$
DECLARE
  tbl TEXT;
  legacy_tables TEXT[] := ARRAY[
    'revenue_summary', 'ringtune', 'mpt', 'atom', 'eauc', 'combo', 'local',
    'sznb', 'flow_subscription', 'international', 'youtube', 'spotify', 'tiktok'
  ];
BEGIN
  FOREACH tbl IN ARRAY legacy_tables LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can(''can_enter_data'', auth.uid()) OR public.auth_user_can(''can_import_excel'', auth.uid()))',
      'rbac_' || tbl || '_insert', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can(''can_edit_data'', auth.uid()) OR public.auth_user_can(''can_import_excel'', auth.uid())) WITH CHECK (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can(''can_edit_data'', auth.uid()) OR public.auth_user_can(''can_import_excel'', auth.uid()))',
      'rbac_' || tbl || '_update', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can(''can_delete_data'', auth.uid()))',
      'rbac_' || tbl || '_delete', tbl);
    EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER audit_trigger', tbl);
    EXECUTE format('COMMENT ON TABLE public.%I IS NULL', tbl);
  END LOOP;
END $$;

-- ============ VERIFICATION ==================================================
DO $$
DECLARE
  n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM pg_policies
  WHERE schemaname = 'public' AND cmd <> 'SELECT'
    AND tablename IN ('revenue_summary','ringtune','mpt','atom','eauc','combo','local','sznb','flow_subscription','international','youtube','spotify','tiktok');
  IF n <> 39 THEN
    RAISE EXCEPTION '017_rollback verification failed: expected 39 write policies, found %', n;
  END IF;
  SELECT COUNT(*) INTO n FROM pg_trigger WHERE tgname = 'forward_sync_to_entries';
  IF n <> 9 THEN
    RAISE EXCEPTION '017_rollback verification failed: expected 9 forward-sync triggers, found %', n;
  END IF;
  RAISE NOTICE '017_rollback OK: legacy tables writable again, lineage + forward-sync restored.';
END $$;

COMMIT;
