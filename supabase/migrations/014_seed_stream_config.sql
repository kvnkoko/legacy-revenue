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
  ('ringtune',          'Ringtune',          '#00d4c8', 200, 'derived', NULL, '{"in_summary": true, "summary_column": "ringtune"}'),
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
