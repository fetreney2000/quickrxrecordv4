-- ============================================================================
-- 062_dashboard_lowstock_expiry.sql
--
-- Menutup MEDIUM-3 (audit papan pemuka): current_balance dalam
-- get_dashboard_stats mengira kelompok lupus, manakala get_report_low_stock
-- (042) mengecualikannya — kad papan pemuka dan tab yang dipautnya boleh
-- memberi verdict berbeza untuk item yang sama.
--
-- Pembetulan: kiraan baki mengabaikan kelompok lupus (selari 042).
-- CREATE OR REPLACE memadai — tandatangan / jenis pulangan tidak berubah.
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
    FROM item_batches ib
    WHERE NOT ib.dilupuskan
    GROUP BY ib.item_id
  ),
  -- MEDIUM-3: baki BOLEH DIBEKAL (bukan lupus + belum luput) — hanya untuk
  -- verdict stok-rendah, selari dengan get_report_low_stock (042).
  -- total_stock kekal fizikal (selari dengan tab inventori).
  dispensable_balance AS (
    SELECT ib.item_id, SUM(ib.kuantiti)::BIGINT AS balance
    FROM item_batches ib, kl_today k
    WHERE NOT ib.dilupuskan
      AND ib.tarikh_luput >= k.today
    GROUP BY ib.item_id
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
      COALESCE(db.balance, 0) AS item_dispensable,
      COALESCE(u.total, 0) / 12 * 4 AS required_4w
    FROM items i
    LEFT JOIN current_balance cb ON cb.item_id = i.id
    LEFT JOIN dispensable_balance db ON db.item_id = i.id
    LEFT JOIN usage_12w u ON u.item_id = i.id
    WHERE i.aktif = true
  )
  SELECT
    (SELECT c FROM active_patients),
    (SELECT c FROM active_items),
    (SELECT c FROM today_supply),
    (SELECT c FROM expiring),
    (SELECT COALESCE(SUM(item_stock), 0) FROM stock_calc),
    (SELECT count(*)::BIGINT FROM stock_calc WHERE item_dispensable < required_4w);
$$;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- PENGESAHAN SELEPAS MIGRASI: bandingkan lowStockCount papan pemuka dengan
-- bilangan baris tab Stok Rendah bagi item yang mempunyai stok luput —
-- kedua-duanya kini sepadan.
-- ============================================================================
