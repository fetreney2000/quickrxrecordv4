-- ============================================================================
-- 037_get_dashboard_expiry.sql
-- All non-disposed batches sorted by expiry, with item details and bentuk.
-- Replaces useExpiryDashboard() hook (use-dashboard-stats.ts lines 149-196).
-- ============================================================================

CREATE OR REPLACE FUNCTION get_dashboard_expiry(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  batch_id UUID, nombor_kelompok TEXT, tarikh_luput DATE, kuantiti INTEGER,
  item_id UUID, kod_item TEXT, nama_item TEXT, kekuatan TEXT, bentuk TEXT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    ib.id AS batch_id, ib.nombor_kelompok, ib.tarikh_luput, ib.kuantiti,
    i.id AS item_id, i.kod_item, i.nama_item, i.kekuatan, f.nama AS bentuk
  FROM item_batches ib
  JOIN items i ON i.id = ib.item_id
  LEFT JOIN item_forms f ON f.id = i.id_bentuk
  WHERE ib.dilupuskan = false AND ib.kuantiti > 0
  ORDER BY ib.tarikh_luput ASC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_expiry(INTEGER) TO anon, authenticated;
