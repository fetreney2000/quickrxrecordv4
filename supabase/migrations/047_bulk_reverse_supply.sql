-- ============================================================================
-- 047_bulk_reverse_supply.sql
--
-- Menutup LOW-4 (audit bekalan): baris bekalan bergabung (multi-kelompok)
-- dibatalkan melalui N mutasi berasingan — tidak atomik (separa batal
-- mungkin) dengan N toast yang mengelirukan.
--
-- reverse_supplies(p_supply_ids, p_catatan): membatalkan semua dalam SATU
-- transaksi — semuanya berjaya atau semuanya diimbau balik — dengan satu
-- jurnal pembalikan setiap rekod (tidak digabungkan; setiap baris kekal
-- diaudit secara individu). Dihadkan 100 ID setiap panggilan.
-- ============================================================================

CREATE OR REPLACE FUNCTION reverse_supplies(
  p_supply_ids UUID[],
  p_catatan TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
  v_n INTEGER := 0;
BEGIN
  PERFORM app_require_role('Pentadbir','Penjaga Stor','Kakitangan Farmasi');

  IF p_supply_ids IS NULL OR cardinality(p_supply_ids) = 0 THEN
    RAISE EXCEPTION 'Tiada rekod bekalan diberikan.';
  END IF;
  IF cardinality(p_supply_ids) > 100 THEN
    RAISE EXCEPTION 'Terlalu banyak rekod sekali gus (maksimum 100).';
  END IF;

  FOREACH v_id IN ARRAY p_supply_ids LOOP
    PERFORM reverse_supply(v_id, p_catatan);
    v_n := v_n + 1;
  END LOOP;

  RETURN v_n;
END;
$$;

-- Hak capaian selari dengan fungsi RPC lain (039 §7).
DO $$
DECLARE
  f RECORD;
BEGIN
  FOR f IN
    SELECT p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'reverse_supplies'
    ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s(%s) FROM PUBLIC, anon', f.proname, f.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s(%s) TO authenticated, service_role', f.proname, f.args);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- PENGESAHAN SELEPAS MIGRASI (jalankan secara manual):
--   -- Batalkan dua rekod sekali gus (atomik):
--   --    SELECT reverse_supplies(ARRAY['<id1>', '<id2>']::uuid[], 'uji pukal');
--   --    → 2; kedua-dua voided_at terisi + dua jurnal 'supply_reversal'.
--   --    Salah satu ID tidak sah → ERROR dan TIADA satu pun dibatalkan.
-- ============================================================================
