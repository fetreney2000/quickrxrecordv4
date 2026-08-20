-- ============================================================================
-- 024_get_annual_usage.sql
-- Annual usage aggregation for an item by year. Single SQL query that joins
-- through patient_item_assignments and groups kuantiti by month server-side.
-- Far faster than fetching all the rows to the client.
-- Tarikh: 20 Ogos 2026
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
    AND sr.tarikh_dibekal >= make_timestamptz(p_year, 1, 1, 0, 0, 0, 'UTC')
    AND sr.tarikh_dibekal < make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, 'UTC')
  GROUP BY EXTRACT(MONTH FROM sr.tarikh_dibekal)::INTEGER;
$$;

GRANT ALL ON FUNCTION get_annual_usage(UUID, INTEGER) TO anon, authenticated;

-- Tamat 024_get_annual_usage.sql