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
  ALLOWED_DRIFT_MONTHS CONSTANT DATE[] := ARRAY[]::DATE[];

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
