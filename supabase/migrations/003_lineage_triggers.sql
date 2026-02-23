-- Parent-child lineage enforcement and summary propagation.

CREATE OR REPLACE FUNCTION sync_revenue_summary_month(p_month DATE)
RETURNS VOID AS $$
DECLARE
  ringtune_total NUMERIC(18,2);
  eauc_total NUMERIC(18,2);
  combo_total NUMERIC(18,2);
  sznb_total NUMERIC(18,2);
  flow_total NUMERIC(18,2);
  youtube_total NUMERIC(18,2);
  spotify_total NUMERIC(18,2);
  tiktok_total NUMERIC(18,2);
BEGIN
  SELECT COALESCE(total, 0) INTO ringtune_total FROM ringtune WHERE month = p_month;
  SELECT COALESCE(total, 0) INTO eauc_total FROM eauc WHERE month = p_month;
  SELECT COALESCE(total, 0) INTO combo_total FROM combo WHERE month = p_month;
  SELECT COALESCE(total, 0) INTO sznb_total FROM sznb WHERE month = p_month;
  SELECT COALESCE(total, 0) INTO flow_total FROM flow_subscription WHERE month = p_month;
  SELECT COALESCE(total, 0) INTO youtube_total FROM youtube WHERE month = p_month;
  SELECT COALESCE(total, 0) INTO spotify_total FROM spotify WHERE month = p_month;
  SELECT COALESCE(total, 0) INTO tiktok_total FROM tiktok WHERE month = p_month;

  INSERT INTO revenue_summary (
    month,
    ringtune,
    eauc,
    combo,
    sznb,
    flow_music_zone,
    flow_subscription,
    flow_data_pack,
    youtube,
    spotify,
    tiktok
  )
  VALUES (
    p_month,
    ringtune_total,
    eauc_total,
    combo_total,
    sznb_total,
    0,
    flow_total,
    0,
    youtube_total,
    spotify_total,
    tiktok_total
  )
  ON CONFLICT (month) DO UPDATE SET
    ringtune = EXCLUDED.ringtune,
    eauc = EXCLUDED.eauc,
    combo = EXCLUDED.combo,
    sznb = EXCLUDED.sznb,
    flow_music_zone = EXCLUDED.flow_music_zone,
    flow_subscription = EXCLUDED.flow_subscription,
    flow_data_pack = EXCLUDED.flow_data_pack,
    youtube = EXCLUDED.youtube,
    spotify = EXCLUDED.spotify,
    tiktok = EXCLUDED.tiktok;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_telecom_from_mpt()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO ringtune (month, mpt)
  VALUES (
    NEW.month,
    COALESCE(NEW.legacy_ringtune, 0)
      + COALESCE(NEW.etrade_ringtune, 0)
      + COALESCE(NEW.fortune_ringtune, 0)
      + COALESCE(NEW.unico_ringtune, 0)
  )
  ON CONFLICT (month) DO UPDATE SET
    mpt = EXCLUDED.mpt;

  INSERT INTO eauc (month, mpt)
  VALUES (
    NEW.month,
    COALESCE(NEW.legacy_eauc, 0)
      + COALESCE(NEW.etrade_eauc, 0)
      + COALESCE(NEW.fortune_eauc, 0)
      + COALESCE(NEW.unico_eauc, 0)
  )
  ON CONFLICT (month) DO UPDATE SET
    mpt = EXCLUDED.mpt;

  INSERT INTO combo (month, mpt)
  VALUES (
    NEW.month,
    COALESCE(NEW.legacy_combo, 0)
      + COALESCE(NEW.etrade_combo, 0)
      + COALESCE(NEW.fortune_combo, 0)
      + COALESCE(NEW.unico_combo, 0)
  )
  ON CONFLICT (month) DO UPDATE SET
    mpt = EXCLUDED.mpt;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_telecom_from_atom()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO ringtune (month, atom)
  VALUES (NEW.month, COALESCE(NEW.ringtune, 0))
  ON CONFLICT (month) DO UPDATE SET
    atom = EXCLUDED.atom;

  INSERT INTO eauc (month, atom)
  VALUES (NEW.month, COALESCE(NEW.eauc, 0))
  ON CONFLICT (month) DO UPDATE SET
    atom = EXCLUDED.atom;

  INSERT INTO combo (month, atom)
  VALUES (NEW.month, COALESCE(NEW.combo, 0))
  ON CONFLICT (month) DO UPDATE SET
    atom = EXCLUDED.atom;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_revenue_summary_from_children()
RETURNS TRIGGER AS $$
DECLARE
  changed_month DATE;
BEGIN
  changed_month := COALESCE(NEW.month, OLD.month);
  PERFORM sync_revenue_summary_month(changed_month);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mpt_sync_telecom_trigger ON mpt;
DROP TRIGGER IF EXISTS atom_sync_telecom_trigger ON atom;
DROP TRIGGER IF EXISTS ringtune_sync_revenue_trigger ON ringtune;
DROP TRIGGER IF EXISTS eauc_sync_revenue_trigger ON eauc;
DROP TRIGGER IF EXISTS combo_sync_revenue_trigger ON combo;
DROP TRIGGER IF EXISTS sznb_sync_revenue_trigger ON sznb;
DROP TRIGGER IF EXISTS flow_subscription_sync_revenue_trigger ON flow_subscription;
DROP TRIGGER IF EXISTS youtube_sync_revenue_trigger ON youtube;
DROP TRIGGER IF EXISTS spotify_sync_revenue_trigger ON spotify;
DROP TRIGGER IF EXISTS tiktok_sync_revenue_trigger ON tiktok;

CREATE TRIGGER mpt_sync_telecom_trigger
AFTER INSERT OR UPDATE ON mpt
FOR EACH ROW
EXECUTE FUNCTION sync_telecom_from_mpt();

CREATE TRIGGER atom_sync_telecom_trigger
AFTER INSERT OR UPDATE ON atom
FOR EACH ROW
EXECUTE FUNCTION sync_telecom_from_atom();

CREATE TRIGGER ringtune_sync_revenue_trigger
AFTER INSERT OR UPDATE OR DELETE ON ringtune
FOR EACH ROW
EXECUTE FUNCTION sync_revenue_summary_from_children();

CREATE TRIGGER eauc_sync_revenue_trigger
AFTER INSERT OR UPDATE OR DELETE ON eauc
FOR EACH ROW
EXECUTE FUNCTION sync_revenue_summary_from_children();

CREATE TRIGGER combo_sync_revenue_trigger
AFTER INSERT OR UPDATE OR DELETE ON combo
FOR EACH ROW
EXECUTE FUNCTION sync_revenue_summary_from_children();

CREATE TRIGGER sznb_sync_revenue_trigger
AFTER INSERT OR UPDATE OR DELETE ON sznb
FOR EACH ROW
EXECUTE FUNCTION sync_revenue_summary_from_children();

CREATE TRIGGER flow_subscription_sync_revenue_trigger
AFTER INSERT OR UPDATE OR DELETE ON flow_subscription
FOR EACH ROW
EXECUTE FUNCTION sync_revenue_summary_from_children();

CREATE TRIGGER youtube_sync_revenue_trigger
AFTER INSERT OR UPDATE OR DELETE ON youtube
FOR EACH ROW
EXECUTE FUNCTION sync_revenue_summary_from_children();

CREATE TRIGGER spotify_sync_revenue_trigger
AFTER INSERT OR UPDATE OR DELETE ON spotify
FOR EACH ROW
EXECUTE FUNCTION sync_revenue_summary_from_children();

CREATE TRIGGER tiktok_sync_revenue_trigger
AFTER INSERT OR UPDATE OR DELETE ON tiktok
FOR EACH ROW
EXECUTE FUNCTION sync_revenue_summary_from_children();

CREATE INDEX IF NOT EXISTS idx_revenue_summary_month_desc
ON revenue_summary (month DESC);
