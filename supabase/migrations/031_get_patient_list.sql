-- ============================================================================
-- 031_get_patient_list.sql
-- Paginated patient list RPC with server-side assignment count and
-- deactivator name resolution. Replaces usePatients hook (use-patients.ts).
-- ============================================================================

CREATE OR REPLACE FUNCTION get_patient_list(
  p_search TEXT DEFAULT NULL,
  p_active BOOLEAN DEFAULT TRUE,
  p_sort_key TEXT DEFAULT 'nama',
  p_sort_dir TEXT DEFAULT 'asc',
  p_offset INTEGER DEFAULT 0,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID, nama TEXT, nombor_kad_pengenalan TEXT,
  nombor_pendaftaran_hospital TEXT, dokumen_lain TEXT,
  nombor_telefon TEXT, alamat TEXT, catatan TEXT,
  aktif BOOLEAN, merged_into UUID, tarikh_daftar DATE,
  catatan_nyahaktif TEXT, tarikh_nyahaktif DATE,
  dinyahaktif_oleh UUID, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  bilangan_item BIGINT, dinyahaktif_oleh_nama TEXT,
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
    WHEN 'nombor_kad_pengenalan' THEN v_sort_expr := 'sub.nombor_kad_pengenalan';
    WHEN 'nombor_pendaftaran_hospital' THEN v_sort_expr := 'sub.nombor_pendaftaran_hospital';
    WHEN 'dokumen_lain' THEN v_sort_expr := 'sub.dokumen_lain';
    WHEN 'tarikh_nyahaktif' THEN v_sort_expr := 'sub.tarikh_nyahaktif NULLS LAST';
    ELSE v_sort_expr := 'sub.nama';
  END CASE;

  v_sql := format(
    'SELECT sub.id, sub.nama, sub.nombor_kad_pengenalan,
            sub.nombor_pendaftaran_hospital, sub.dokumen_lain,
            sub.nombor_telefon, sub.alamat, sub.catatan,
            sub.aktif, sub.merged_into, sub.tarikh_daftar,
            sub.catatan_nyahaktif, sub.tarikh_nyahaktif,
            sub.dinyahaktif_oleh, sub.created_at, sub.updated_at,
            sub.bilangan_item, sub.dinyahaktif_oleh_nama, sub._total_count
     FROM (
       SELECT
         p.id, p.nama, p.nombor_kad_pengenalan,
         p.nombor_pendaftaran_hospital, p.dokumen_lain,
         p.nombor_telefon, p.alamat, p.catatan,
         p.aktif, p.merged_into, p.tarikh_daftar,
         p.catatan_nyahaktif, p.tarikh_nyahaktif,
         p.dinyahaktif_oleh, p.created_at, p.updated_at,
         (SELECT COUNT(*) FROM patient_item_assignments pia
          WHERE pia.patient_id = p.id AND pia.aktif = true)::BIGINT AS bilangan_item,
         prof.nama AS dinyahaktif_oleh_nama,
         COUNT(*) OVER() AS _total_count
       FROM patients p
       LEFT JOIN profiles prof ON prof.id = p.dinyahaktif_oleh
        WHERE p.aktif = $2
         AND p.merged_into IS NULL
         AND (
           $1 IS NULL OR $1 = ''''
           OR p.nama ILIKE ''%%'' || $1 || ''%%''
           OR p.nombor_kad_pengenalan ILIKE ''%%'' || $1 || ''%%''
           OR p.nombor_pendaftaran_hospital ILIKE ''%%'' || $1 || ''%%''
         )
     ) sub
     ORDER BY %s %s
     LIMIT %s OFFSET %s',
    v_sort_expr, v_dir, p_limit, p_offset
  );

  RETURN QUERY EXECUTE v_sql
  USING p_search, p_active;
END; $$;

GRANT EXECUTE ON FUNCTION get_patient_list(TEXT, BOOLEAN, TEXT, TEXT, INTEGER, INTEGER) TO anon, authenticated;
