-- ============================================================================
-- 015_dose_history_timestamp.sql
-- Jadikan dose_history.tarikh mencatat masa (bukan hanya tarikh).
--
-- ISU:
--   dose_history.tarikh adalah jenis DATE, jadi sejarah dos hanya merekod
--   tarikh tanpa masa. Aplikasi kini perlu memaparkan masa dalam sejarah dos.
--
-- PEMBETULAN:
--   Tukar jenis lajur tarikh kepada TIMESTAMPTZ supaya aplikasi boleh
--   merekod dan memaparkan masa yang tepat.
-- ============================================================================

-- Tukar lajur tarikh daripada DATE kepada TIMESTAMPTZ.
-- Nilai sedia ada (DATE) ditukar kepada tengah malam waktu Kuala Lumpur.
ALTER TABLE dose_history
  ALTER COLUMN tarikh DROP NOT NULL;

ALTER TABLE dose_history
  ALTER COLUMN tarikh TYPE TIMESTAMPTZ
    USING (tarikh::timestamp AT TIME ZONE 'Asia/Kuala_Lumpur');

ALTER TABLE dose_history
  ALTER COLUMN tarikh SET NOT NULL;

-- Tamat 015_dose_history_timestamp.sql