-- ============================================================================
-- 034_get_report_expiring_batches.sql
-- Expiring batches within N days with item details and remaining days.
-- Replaces expiry tab query (ReportPage.tsx lines 410-445).
-- ============================================================================

CREATE OR REPLACE FUNCTION get_report_expiring_batches(p_days BIGINT DEFAULT 30)
RETURNS TABLE (
  id UUID, nombor_kelompok TEXT, tarikh_luput DATE, kuantiti INTEGER,
  kod_item TEXT, nama_item TEXT, nama_dagangan TEXT, kekuatan TEXT,
  bentuk TEXT, remaining_days INTEGER
)
LANGUAGE sql STABLE
AS $$
  SELECT
    ib.id,
    ib.nombor_kelompok,
    ib.tarikh_luput,
    ib.kuantiti,
    i.kod_item,
    i.nama_item,
    i.nama_dagangan,
    i.kekuatan,
    f.nama AS bentuk,
    (ib.tarikh_luput - CURRENT_DATE)::INTEGER AS remaining_days
  FROM item_batches ib
  JOIN items i ON i.id = ib.item_id
  LEFT JOIN item_forms f ON f.id = i.id_bentuk
  WHERE ib.dilupuskan = false
    AND ib.kuantiti > 0
    AND ib.tarikh_luput BETWEEN CURRENT_DATE AND CURRENT_DATE + (p_days || ' days')::INTERVAL
  ORDER BY ib.tarikh_luput ASC;
$$;

GRANT EXECUTE ON FUNCTION get_report_expiring_batches(BIGINT) TO anon, authenticated;
