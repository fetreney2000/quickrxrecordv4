-- ============================================================================
-- 036_get_dashboard_stats.sql
-- Aggregated dashboard statistics: patient count, item count, today's supply,
-- expiring soon (30d), total stock, and low-stock item count.
-- Replaces useDashboardStats() hook (use-dashboard-stats.ts lines 18-101).
-- ============================================================================

CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS TABLE (
  total_patients BIGINT,
  total_items BIGINT,
  supply_today BIGINT,
  expiring_soon BIGINT,
  total_stock BIGINT,
  low_stock_count BIGINT
)
LANGUAGE sql STABLE
AS $$
  WITH kl_today AS (
    SELECT (now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date AS today
  ),
  active_patients AS (
    SELECT count(*)::BIGINT AS c FROM patients
    WHERE aktif = true AND merged_into IS NULL
  ),
  active_items AS (
    SELECT count(*)::BIGINT AS c FROM items WHERE aktif = true
  ),
  today_supply AS (
    SELECT count(*)::BIGINT AS c FROM supply_records, kl_today k
    WHERE voided_at IS NULL
      AND tarikh_dibekal >= (k.today::timestamp AT TIME ZONE 'Asia/Kuala_Lumpur')
      AND tarikh_dibekal <  ((k.today::timestamp + INTERVAL '1 day') AT TIME ZONE 'Asia/Kuala_Lumpur')
  ),
  expiring AS (
    SELECT count(*)::BIGINT AS c FROM item_batches ib, kl_today k
    WHERE ib.kuantiti > 0 AND NOT ib.dilupuskan
      AND ib.tarikh_luput >= k.today
      AND ib.tarikh_luput <= k.today + INTERVAL '30 days'
  ),
  current_balance AS (
    SELECT ib.item_id, SUM(ib.kuantiti)::BIGINT AS balance
    FROM item_batches ib WHERE NOT ib.dilupuskan GROUP BY ib.item_id
  ),
  usage_12w AS (
    SELECT pia.item_id, SUM(sr.kuantiti)::NUMERIC AS total
    FROM supply_records sr
    JOIN patient_item_assignments pia ON pia.id = sr.assignment_id
    CROSS JOIN kl_today k
    WHERE sr.voided_at IS NULL
      AND sr.tarikh_dibekal >= ((k.today - 84)::timestamp AT TIME ZONE 'Asia/Kuala_Lumpur')
      AND sr.tarikh_dibekal < ((k.today + 1)::timestamp AT TIME ZONE 'Asia/Kuala_Lumpur')
    GROUP BY pia.item_id
  ),
  stock_calc AS (
    SELECT
      i.id,
      COALESCE(cb.balance, 0) AS item_stock,
      COALESCE(u.total, 0) / 12 * 4 AS required_4w
    FROM items i
    LEFT JOIN current_balance cb ON cb.item_id = i.id
    LEFT JOIN usage_12w u ON u.item_id = i.id
    WHERE i.aktif = true
  )
  SELECT
    (SELECT c FROM active_patients),
    (SELECT c FROM active_items),
    (SELECT c FROM today_supply),
    (SELECT c FROM expiring),
    (SELECT COALESCE(SUM(item_stock), 0) FROM stock_calc),
    (SELECT count(*)::BIGINT FROM stock_calc WHERE item_stock < required_4w);
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO anon, authenticated;
