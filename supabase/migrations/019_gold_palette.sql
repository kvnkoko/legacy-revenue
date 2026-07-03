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
