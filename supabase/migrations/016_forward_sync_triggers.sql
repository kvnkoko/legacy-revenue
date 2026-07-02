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
