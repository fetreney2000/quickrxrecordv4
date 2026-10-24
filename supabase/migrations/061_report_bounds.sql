-- ============================================================================
-- 061_report_bounds.sql
--
-- Audit laporan: dua pembetulan kecil tanpa perubahan tandatangan
-- (CREATE OR REPLACE memadai; grant sedia ada dikekalkan):
--
-- 1. MEDIUM-2 — sempadan tahun penggunaan tahunan: 024 mengotak mengikut
--    UTC sedangkan operasi klinik mengikut waktu Malaysia. Bekalan
--    00:00–08:00 MYT pada 1 Jan disalahkira ke tahun sebelumnya (dan
--    sebaliknya pada 31 Dis). Kedua-dua sempadan kini Asia/Kuala_Lumpur
--    (MY tidak mengamalkan DST, jadi sempadan stabil).
-- 2. MEDIUM-3 — p_limit get_report_transactions tidak bersempadan: UI
--    sentiasa menghantar 500, tetapi panggilan langsung boleh meminta
--    keseluruhan lejar dalam satu respons. Dikapit 1..2000.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_annual_usage(
  p_item_id UUID,
  p_year INTEGER
)
RETURNS TABLE (month INTEGER, total BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    EXTRACT(MONTH FROM sr.tarikh_dibekal)::INTEGER AS month,
    COALESCE(SUM(sr.kuantiti), 0)::BIGINT AS total
  FROM supply_records sr
  JOIN patient_item_assignments pia ON pia.id = sr.assignment_id
  WHERE pia.item_id = p_item_id
    AND sr.voided_at IS NULL
    AND sr.tarikh_dibekal >= make_timestamptz(p_year, 1, 1, 0, 0, 0, 'Asia/Kuala_Lumpur')
    AND sr.tarikh_dibekal < make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, 'Asia/Kuala_Lumpur')
  GROUP BY EXTRACT(MONTH FROM sr.tarikh_dibekal)::INTEGER;
$$;

CREATE OR REPLACE FUNCTION get_report_transactions(
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_limit BIGINT DEFAULT 500
)
RETURNS TABLE (
  id UUID, tarikh_dibekal TIMESTAMPTZ, dos TEXT, kuantiti INTEGER,
  patient_nama TEXT, item_nama TEXT, item_kekuatan TEXT, item_bentuk TEXT,
  batch_kelompok TEXT, staff_nama TEXT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    sr.id,
    sr.tarikh_dibekal,
    sr.dos,
    sr.kuantiti,
    pat.nama AS patient_nama,
    it.nama_item AS item_nama,
    it.kekuatan AS item_kekuatan,
    f.nama AS item_bentuk,
    ib.nombor_kelompok AS batch_kelompok,
    prof.nama AS staff_nama
  FROM supply_records sr
  LEFT JOIN patient_item_assignments pia ON pia.id = sr.assignment_id
  LEFT JOIN patients pat ON pat.id = pia.patient_id
  LEFT JOIN items it ON it.id = pia.item_id
  LEFT JOIN item_forms f ON f.id = it.id_bentuk
  LEFT JOIN item_batches ib ON ib.id = sr.batch_id
  LEFT JOIN profiles prof ON prof.id = sr.kakitangan_pembekal
  WHERE sr.voided_at IS NULL
    AND (p_date_from IS NULL OR sr.tarikh_dibekal >= p_date_from)
    AND (p_date_to IS NULL OR sr.tarikh_dibekal < p_date_to)
  ORDER BY sr.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 500), 1), 2000);
$$;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- PENGESAHAN SELEPAS MIGRASI (jalankan secara manual):
--   -- Had dikapit: SELECT COUNT(*) FROM get_report_transactions(NULL, NULL, 100000000);
--   --    → selewat-lewatnya 2000 baris.
-- ============================================================================
