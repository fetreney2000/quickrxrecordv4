-- ============================================================================
-- 030_get_inventory_list.sql
-- Paginated inventory list RPC with server-side stock/quota computation.
-- Replaces the client-side queries in useItems hook (use-inventory.ts).
-- ============================================================================

CREATE OR REPLACE FUNCTION get_inventory_list(
  p_search TEXT DEFAULT NULL,
  p_sort_key TEXT DEFAULT 'nama_item',
  p_sort_dir TEXT DEFAULT 'asc',
  p_offset INTEGER DEFAULT 0,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID, kod_item TEXT, nama_item TEXT, nama_dagangan TEXT,
  kekuatan TEXT, kuota INTEGER, id_bentuk UUID, bentuk TEXT,
  total_stock BIGINT, bilangan_pesakit BIGINT,
  _total_count BIGINT
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_sql TEXT;
  v_sort_expr TEXT;
  v_dir TEXT;
BEGIN
  IF lower(p_sort_dir) = 'desc' THEN
    v_dir := 'DESC';
  ELSE
    v_dir := 'ASC';
  END IF;

  CASE p_sort_key
    WHEN 'kod_item' THEN v_sort_expr := 'sub.kod_item';
    WHEN 'nama_item' THEN v_sort_expr := 'sub.nama_item';
    WHEN 'quota' THEN v_sort_expr := 'sub.kuota NULLS LAST';
    WHEN 'stock' THEN v_sort_expr := 'sub.total_stock';
    WHEN 'remaining' THEN
      v_sort_expr := 'COALESCE(sub.kuota, 2147483647) - sub.bilangan_pesakit';
    ELSE v_sort_expr := 'sub.nama_item';
  END CASE;

  v_sql := format(
    'SELECT sub.id, sub.kod_item, sub.nama_item, sub.nama_dagangan,
            sub.kekuatan, sub.kuota, sub.id_bentuk, sub.bentuk,
            sub.total_stock, sub.bilangan_pesakit, sub._total_count
     FROM (
       SELECT
         i.id, i.kod_item, i.nama_item, i.nama_dagangan,
         i.kekuatan, i.kuota, i.id_bentuk, f.nama AS bentuk,
         (SELECT COALESCE(SUM(ib.kuantiti) FILTER (WHERE NOT ib.dilupuskan), 0)
          FROM item_batches ib WHERE ib.item_id = i.id)::BIGINT AS total_stock,
         (SELECT COUNT(*) FROM patient_item_assignments pia
          WHERE pia.item_id = i.id AND pia.aktif = true)::BIGINT AS bilangan_pesakit,
         COUNT(*) OVER() AS _total_count
       FROM items i
       LEFT JOIN item_forms f ON f.id = i.id_bentuk
       WHERE i.aktif = true
         AND ($1 IS NULL OR $1 = ''
           OR i.kod_item ILIKE ''%%'' || $1 || ''%%''
           OR i.nama_item ILIKE ''%%'' || $1 || ''%%''
           OR i.nama_dagangan ILIKE ''%%'' || $1 || ''%%'')
     ) sub
     ORDER BY %s %s
     LIMIT %s OFFSET %s',
    v_sort_expr, v_dir, p_limit, p_offset
  );

  RETURN QUERY EXECUTE v_sql
  USING p_search;
END; $$;

GRANT EXECUTE ON FUNCTION get_inventory_list(TEXT, TEXT, TEXT, INTEGER, INTEGER) TO anon, authenticated;
