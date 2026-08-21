-- ============================================================================
-- 035_get_report_low_stock.sql
-- Low stock items: current balance vs 4-week requirement extrapolated
-- from 12-week usage. Replaces low stock tab query (ReportPage.tsx lines 447-495).
-- ============================================================================

CREATE OR REPLACE FUNCTION get_report_low_stock()
RETURNS TABLE (
  id UUID, kod_item TEXT, nama_item TEXT, nama_dagangan TEXT,
  kekuatan TEXT, bentuk TEXT,
  required_four_weeks NUMERIC, current_balance BIGINT
)
LANGUAGE sql STABLE
AS $$
  WITH current_balance AS (
    SELECT ib.item_id, SUM(ib.kuantiti)::BIGINT AS balance
    FROM item_batches ib
    WHERE NOT ib.dilupuskan
    GROUP BY ib.item_id
  ),
  usage_12w AS (
    SELECT pia.item_id, SUM(sr.kuantiti)::NUMERIC AS total
    FROM supply_records sr
    JOIN patient_item_assignments pia ON pia.id = sr.assignment_id
    WHERE sr.voided_at IS NULL
      AND sr.tarikh_dibekal >= now() - INTERVAL '84 days'
    GROUP BY pia.item_id
  )
  SELECT
    i.id, i.kod_item, i.nama_item, i.nama_dagangan,
    i.kekuatan, f.nama AS bentuk,
    COALESCE(u.total, 0) / 12 * 4 AS required_four_weeks,
    COALESCE(cb.balance, 0) AS current_balance
  FROM items i
  LEFT JOIN current_balance cb ON cb.item_id = i.id
  LEFT JOIN usage_12w u ON u.item_id = i.id
  LEFT JOIN item_forms f ON f.id = i.id_bentuk
  WHERE i.aktif = true
    AND COALESCE(cb.balance, 0) < COALESCE(u.total, 0) / 12 * 4
  ORDER BY (COALESCE(u.total, 0) / 12 * 4 - COALESCE(cb.balance, 0)) DESC;
$$;

GRANT EXECUTE ON FUNCTION get_report_low_stock() TO anon, authenticated;
