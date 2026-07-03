-- =============================================================================
-- 000_drift_audit.sql — READ-ONLY drift audit (safe to run any time, no writes)
-- =============================================================================
-- Purpose: the legacy lineage triggers (003) keep derived tables in sync with
-- base tables, BUT the Excel importer and older code paths could write directly
-- into derived tables (ringtune, eauc, combo, local, international,
-- revenue_summary). Before we migrate to the config-driven model — where base
-- facts become the single source of truth — every stored derived value must be
-- compared against its recomputation from base data.
--
-- Output: one row per (check, month) where the stored value differs from the
-- recomputed value by more than 0.01, plus rows flagging months that exist on
-- one side of a lineage relationship but not the other, and any non-zero
-- flow_music_zone / flow_data_pack values in revenue_summary.
--
-- AN EMPTY RESULT SET MEANS NO DRIFT — safe to proceed to migration 015.
--
-- For every row returned, decide and record in docs/migration-runbook.md:
--   (a) fix the base data through the app (audited), then re-run this audit; or
--   (b) sign off the recomputed value as correct and add the month to the
--       drift allowlist at the top of 015_backfill_and_views.sql.
-- =============================================================================

WITH months AS (
  SELECT month FROM revenue_summary
  UNION SELECT month FROM ringtune
  UNION SELECT month FROM mpt
  UNION SELECT month FROM atom
  UNION SELECT month FROM eauc
  UNION SELECT month FROM combo
  UNION SELECT month FROM local
  UNION SELECT month FROM sznb
  UNION SELECT month FROM flow_subscription
  UNION SELECT month FROM international
  UNION SELECT month FROM youtube
  UNION SELECT month FROM spotify
  UNION SELECT month FROM tiktok
),
-- Recomputed contributions from base tables
mpt_calc AS (
  SELECT month,
    COALESCE(legacy_ringtune,0)+COALESCE(etrade_ringtune,0)+COALESCE(fortune_ringtune,0)+COALESCE(unico_ringtune,0) AS ringtune,
    COALESCE(legacy_eauc,0)+COALESCE(etrade_eauc,0)+COALESCE(fortune_eauc,0)+COALESCE(unico_eauc,0) AS eauc,
    COALESCE(legacy_combo,0)+COALESCE(etrade_combo,0)+COALESCE(fortune_combo,0)+COALESCE(unico_combo,0) AS combo,
    COALESCE(total,0) AS total
  FROM mpt
),
checks AS (

  -- ========== ringtune (derived cols: mpt, atom; ooredoo is a base fact) =====
  SELECT 'ringtune.mpt vs SUM(mpt.*_ringtune)' AS check_name, m.month,
         COALESCE(mc.ringtune,0) AS recomputed, COALESCE(r.mpt,0) AS stored
  FROM months m
  LEFT JOIN mpt_calc mc ON mc.month = m.month
  LEFT JOIN ringtune r ON r.month = m.month
  WHERE mc.month IS NOT NULL OR r.mpt IS NOT NULL

  UNION ALL
  SELECT 'ringtune.atom vs atom.ringtune', m.month,
         COALESCE(a.ringtune,0), COALESCE(r.atom,0)
  FROM months m
  LEFT JOIN atom a ON a.month = m.month
  LEFT JOIN ringtune r ON r.month = m.month
  WHERE a.month IS NOT NULL OR r.atom IS NOT NULL

  -- ========== eauc ==========================================================
  UNION ALL
  SELECT 'eauc.mpt vs SUM(mpt.*_eauc)', m.month,
         COALESCE(mc.eauc,0), COALESCE(e.mpt,0)
  FROM months m
  LEFT JOIN mpt_calc mc ON mc.month = m.month
  LEFT JOIN eauc e ON e.month = m.month
  WHERE mc.month IS NOT NULL OR e.mpt IS NOT NULL

  UNION ALL
  SELECT 'eauc.atom vs atom.eauc', m.month,
         COALESCE(a.eauc,0), COALESCE(e.atom,0)
  FROM months m
  LEFT JOIN atom a ON a.month = m.month
  LEFT JOIN eauc e ON e.month = m.month
  WHERE a.month IS NOT NULL OR e.atom IS NOT NULL

  -- ========== combo =========================================================
  UNION ALL
  SELECT 'combo.mpt vs SUM(mpt.*_combo)', m.month,
         COALESCE(mc.combo,0), COALESCE(c.mpt,0)
  FROM months m
  LEFT JOIN mpt_calc mc ON mc.month = m.month
  LEFT JOIN combo c ON c.month = m.month
  WHERE mc.month IS NOT NULL OR c.mpt IS NOT NULL

  UNION ALL
  SELECT 'combo.atom vs atom.combo', m.month,
         COALESCE(a.combo,0), COALESCE(c.atom,0)
  FROM months m
  LEFT JOIN atom a ON a.month = m.month
  LEFT JOIN combo c ON c.month = m.month
  WHERE a.month IS NOT NULL OR c.atom IS NOT NULL

  -- ========== local (mpt total, atom total, ooredoo passthrough) ============
  UNION ALL
  SELECT 'local.mpt vs mpt.total', m.month,
         COALESCE(mc.total,0), COALESCE(l.mpt,0)
  FROM months m
  LEFT JOIN mpt_calc mc ON mc.month = m.month
  LEFT JOIN local l ON l.month = m.month
  WHERE mc.month IS NOT NULL OR l.mpt IS NOT NULL

  UNION ALL
  SELECT 'local.atom vs atom.total', m.month,
         COALESCE(a.total,0), COALESCE(l.atom,0)
  FROM months m
  LEFT JOIN atom a ON a.month = m.month
  LEFT JOIN local l ON l.month = m.month
  WHERE a.month IS NOT NULL OR l.atom IS NOT NULL

  UNION ALL
  SELECT 'local.ooredoo vs ringtune.ooredoo', m.month,
         COALESCE(r.ooredoo,0), COALESCE(l.ooredoo,0)
  FROM months m
  LEFT JOIN ringtune r ON r.month = m.month
  LEFT JOIN local l ON l.month = m.month
  WHERE r.ooredoo IS NOT NULL OR l.ooredoo IS NOT NULL

  -- ========== international (from youtube/spotify/tiktok) ===================
  UNION ALL
  SELECT 'international.solution_one vs youtube.solution_one', m.month,
         COALESCE(y.solution_one,0), COALESCE(i.solution_one,0)
  FROM months m
  LEFT JOIN youtube y ON y.month = m.month
  LEFT JOIN international i ON i.month = m.month
  WHERE y.month IS NOT NULL OR i.month IS NOT NULL

  UNION ALL
  SELECT 'international.fuga vs yt+sp+tt fuga', m.month,
         COALESCE(y.fuga,0)+COALESCE(s.fuga,0)+COALESCE(t.fuga,0), COALESCE(i.fuga,0)
  FROM months m
  LEFT JOIN youtube y ON y.month = m.month
  LEFT JOIN spotify s ON s.month = m.month
  LEFT JOIN tiktok t ON t.month = m.month
  LEFT JOIN international i ON i.month = m.month
  WHERE y.month IS NOT NULL OR s.month IS NOT NULL OR t.month IS NOT NULL OR i.month IS NOT NULL

  UNION ALL
  SELECT 'international.believe vs yt+sp+tt believe', m.month,
         COALESCE(y.believe,0)+COALESCE(s.believe,0)+COALESCE(t.believe,0), COALESCE(i.believe,0)
  FROM months m
  LEFT JOIN youtube y ON y.month = m.month
  LEFT JOIN spotify s ON s.month = m.month
  LEFT JOIN tiktok t ON t.month = m.month
  LEFT JOIN international i ON i.month = m.month
  WHERE y.month IS NOT NULL OR s.month IS NOT NULL OR t.month IS NOT NULL OR i.month IS NOT NULL

  -- ========== revenue_summary columns vs child stream totals ================
  UNION ALL
  SELECT 'revenue_summary.ringtune vs ringtune.total', m.month,
         COALESCE(r.total,0), COALESCE(rs.ringtune,0)
  FROM months m
  LEFT JOIN ringtune r ON r.month = m.month
  LEFT JOIN revenue_summary rs ON rs.month = m.month
  WHERE r.month IS NOT NULL OR rs.month IS NOT NULL

  UNION ALL
  SELECT 'revenue_summary.eauc vs eauc.total', m.month,
         COALESCE(e.total,0), COALESCE(rs.eauc,0)
  FROM months m
  LEFT JOIN eauc e ON e.month = m.month
  LEFT JOIN revenue_summary rs ON rs.month = m.month
  WHERE e.month IS NOT NULL OR rs.month IS NOT NULL

  UNION ALL
  SELECT 'revenue_summary.combo vs combo.total', m.month,
         COALESCE(c.total,0), COALESCE(rs.combo,0)
  FROM months m
  LEFT JOIN combo c ON c.month = m.month
  LEFT JOIN revenue_summary rs ON rs.month = m.month
  WHERE c.month IS NOT NULL OR rs.month IS NOT NULL

  UNION ALL
  SELECT 'revenue_summary.sznb vs sznb.total', m.month,
         COALESCE(z.total,0), COALESCE(rs.sznb,0)
  FROM months m
  LEFT JOIN sznb z ON z.month = m.month
  LEFT JOIN revenue_summary rs ON rs.month = m.month
  WHERE z.month IS NOT NULL OR rs.month IS NOT NULL

  UNION ALL
  SELECT 'revenue_summary.flow_subscription vs flow_subscription.total', m.month,
         COALESCE(f.total,0), COALESCE(rs.flow_subscription,0)
  FROM months m
  LEFT JOIN flow_subscription f ON f.month = m.month
  LEFT JOIN revenue_summary rs ON rs.month = m.month
  WHERE f.month IS NOT NULL OR rs.month IS NOT NULL

  UNION ALL
  SELECT 'revenue_summary.youtube vs youtube.total', m.month,
         COALESCE(y.total,0), COALESCE(rs.youtube,0)
  FROM months m
  LEFT JOIN youtube y ON y.month = m.month
  LEFT JOIN revenue_summary rs ON rs.month = m.month
  WHERE y.month IS NOT NULL OR rs.month IS NOT NULL

  UNION ALL
  SELECT 'revenue_summary.spotify vs spotify.total', m.month,
         COALESCE(s.total,0), COALESCE(rs.spotify,0)
  FROM months m
  LEFT JOIN spotify s ON s.month = m.month
  LEFT JOIN revenue_summary rs ON rs.month = m.month
  WHERE s.month IS NOT NULL OR rs.month IS NOT NULL

  UNION ALL
  SELECT 'revenue_summary.tiktok vs tiktok.total', m.month,
         COALESCE(t.total,0), COALESCE(rs.tiktok,0)
  FROM months m
  LEFT JOIN tiktok t ON t.month = m.month
  LEFT JOIN revenue_summary rs ON rs.month = m.month
  WHERE t.month IS NOT NULL OR rs.month IS NOT NULL

  -- ========== flow_music_zone / flow_data_pack ==============================
  -- The 003 sync trigger zeroes these on every child-table change, so any
  -- non-zero value here is data that survives only until the next sync and
  -- must be captured as base facts (flow_music_zone / flow_data_pack entry
  -- streams) during migration. Reported as recomputed=0 vs stored=value.
  UNION ALL
  SELECT 'revenue_summary.flow_music_zone (non-zero → must migrate as base fact)', month,
         0::numeric, COALESCE(flow_music_zone,0)
  FROM revenue_summary
  WHERE COALESCE(flow_music_zone,0) <> 0

  UNION ALL
  SELECT 'revenue_summary.flow_data_pack (non-zero → must migrate as base fact)', month,
         0::numeric, COALESCE(flow_data_pack,0)
  FROM revenue_summary
  WHERE COALESCE(flow_data_pack,0) <> 0
)
SELECT
  check_name,
  month,
  recomputed,
  stored,
  stored - recomputed AS diff
FROM checks
WHERE ABS(stored - recomputed) > 0.01
ORDER BY month, check_name;
