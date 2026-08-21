-- ============================================================================
-- 033_get_report_transactions.sql
-- Transaction log with resolved patient, item, batch, and staff names.
-- Replaces transactions tab query (ReportPage.tsx lines 381-407).
-- ============================================================================

CREATE OR REPLACE FUNCTION get_report_transactions(
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 500
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
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_report_transactions(TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO anon, authenticated;
