-- ============================================================================
-- 032_get_report_inventory.sql
-- Full inventory report with batch JSONB for export.
-- Replaces inventory tab query (ReportPage.tsx lines 360-378).
-- ============================================================================

CREATE OR REPLACE FUNCTION get_report_inventory()
RETURNS TABLE (
  id UUID, kod_item TEXT, nama_item TEXT, nama_dagangan TEXT,
  kekuatan TEXT, kuota INTEGER, bentuk TEXT,
  total_stock BIGINT, is_low_stock BOOLEAN,
  item_batches JSONB
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id, i.kod_item, i.nama_item, i.nama_dagangan,
    i.kekuatan, i.kuota, f.nama AS bentuk,
    (SELECT COALESCE(SUM(ib.kuantiti) FILTER (WHERE NOT ib.dilupuskan), 0)
     FROM item_batches ib WHERE ib.item_id = i.id)::BIGINT AS total_stock,
    (i.kuota IS NOT NULL AND
     (SELECT COALESCE(SUM(ib.kuantiti) FILTER (WHERE NOT ib.dilupuskan), 0)
      FROM item_batches ib WHERE ib.item_id = i.id) < i.kuota) AS is_low_stock,
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'nombor_kelompok', ib2.nombor_kelompok,
          'tarikh_luput', ib2.tarikh_luput,
          'kuantiti', ib2.kuantiti
        ) ORDER BY ib2.tarikh_luput
      ) FROM item_batches ib2 WHERE ib2.item_id = i.id),
      '[]'::jsonb
    ) AS item_batches
  FROM items i
  LEFT JOIN item_forms f ON f.id = i.id_bentuk
  WHERE i.aktif = true
  ORDER BY i.nama_item;
END; $$;

GRANT EXECUTE ON FUNCTION get_report_inventory() TO anon, authenticated;
