-- ============================================================================
-- 042_expired_stock_guards.sql
--
-- Menutup MEDIUM-1 (audit penambahan stok): kelompok luput boleh diterima
-- masuk dan — lebih senyap — dikira dalam semua jumlah stok, manakala
-- bekalan (FEFO) mengabaikannya. Akibat: jumlah memaparkan stok yang tidak
-- boleh dibekal, dan amaran stok rendah tidak berbunyi.
--
-- Nota teknikal: dua fungsi yang melebar (get_inventory_list,
-- get_report_inventory) mesti di-DROP dahulu — CREATE OR REPLACE tidak boleh
-- mengubah bentuk RETURNS TABLE (ralat 42P13). DROP memadam grant 038,
-- jadi GRANT dikembalikan sejurus selepas setiap CREATE. Semua kenyataan
-- idempoten: selamat dijalankan semula jika larian terdahulu gagal separuh
-- (cth. record_batch_addition biasanya telah berjaya sebelum kegagalan 42P13).
--
-- Selepas migrasi ini:
--   1. record_batch_addition menolak tarikh_luput < CURRENT_DATE.
--      (Kelompok luput yang perlu dilupuskan direkodkan melalui aliran
--      pelupusan, bukan penerimaan.)
--   2. Semua jumlah stok membezakan jumlah fizikal (total_stock — termasuk
--      luput, untuk penjejakan) daripada stok boleh dibekal
--      (dispensable_stock — bukan lupus + belum luput):
--        - get_inventory_list: lajur dispensable_stock baharu.
--        - get_report_inventory: lajur dispensable_stock baharu; is_low_stock
--          kini berdasarkan stok boleh dibekal (kuota = pesakit untuk
--          dibekal — unit luput tidak boleh menggenapkannya).
--        - get_report_low_stock: baki semasa mengabaikan kelompok luput.
--        - get_report_expiring_batches: turut menyenaraikan kelompok yang
--          TELAH luput (baki_hari negatif) supaya timbunan luput tidak
--          ghaib daripada laporan.
-- ============================================================================

-- ── 1. record_batch_addition (039 6i + pengawal tarikh luput) ────────────────
CREATE OR REPLACE FUNCTION record_batch_addition(
  p_item_id UUID,
  p_nombor_kelompok TEXT,
  p_tarikh_luput DATE,
  p_kuantiti INTEGER,
  p_added_by UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing RECORD;
  v_batch_id UUID;
  v_addition_id UUID;
  v_nama_uppercase TEXT;
BEGIN
  PERFORM app_require_role('Pentadbir','Penjaga Stor');

  IF p_kuantiti <= 0 THEN
    RAISE EXCEPTION 'Kuantiti mesti lebih daripada sifar.';
  END IF;

  -- MEDIUM-1: kelompok luput tidak boleh diterima masuk sebagai stok.
  IF p_tarikh_luput < CURRENT_DATE THEN
    RAISE EXCEPTION 'Tarikh luput (%) telah berlalu — kelompok luput tidak boleh diterima masuk.', p_tarikh_luput;
  END IF;

  PERFORM 1 FROM items WHERE id = p_item_id FOR UPDATE;

  v_nama_uppercase := UPPER(p_nombor_kelompok);

  SELECT * INTO v_existing
  FROM item_batches
  WHERE item_id = p_item_id AND UPPER(nombor_kelompok) = v_nama_uppercase
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.dilupuskan THEN
      RAISE EXCEPTION 'Kelompok ini telah dilupuskan dan tidak boleh digunakan semula.';
    END IF;
    v_batch_id := v_existing.id;
    UPDATE item_batches
    SET kuantiti = kuantiti + p_kuantiti, tarikh_luput = p_tarikh_luput, updated_at = now()
    WHERE id = v_batch_id;
  ELSE
    INSERT INTO item_batches(item_id, nombor_kelompok, tarikh_luput, kuantiti)
    VALUES (p_item_id, UPPER(p_nombor_kelompok), p_tarikh_luput, p_kuantiti)
    RETURNING id INTO v_batch_id;
  END IF;

  INSERT INTO batch_additions(batch_id, quantity, added_by)
  VALUES (v_batch_id, p_kuantiti, p_added_by)
  RETURNING id INTO v_addition_id;

  INSERT INTO inventory_transactions(
    item_id, batch_id, jenis, kuantiti, rujukan_id, rujukan_type, catatan, baki
  ) VALUES (
    p_item_id, v_batch_id, 'masuk', p_kuantiti,
    v_addition_id, 'batch_addition',
    CASE WHEN v_existing.id IS NOT NULL THEN 'Tambah stok ke kelompok sedia ada' ELSE 'Kelompok baharu' END,
    inventory_item_baki(p_item_id)
  );
END;
$$;

-- ── 2. get_inventory_list (030 + lajur dispensable_stock) ───────────────────
-- NOTA: RETURNS TABLE berubah bentuk → CREATE OR REPLACE tidak cukup
-- (ralat 42P13). DROP dahulu, kemudian GRANT semula (DROP memadam grant 038).
DROP FUNCTION IF EXISTS public.get_inventory_list(TEXT, TEXT, TEXT, BIGINT, BIGINT);
CREATE OR REPLACE FUNCTION get_inventory_list(
  p_search TEXT DEFAULT NULL,
  p_sort_key TEXT DEFAULT 'nama_item',
  p_sort_dir TEXT DEFAULT 'asc',
  p_offset BIGINT DEFAULT 0,
  p_limit BIGINT DEFAULT 50
)
RETURNS TABLE (
  id UUID, kod_item TEXT, nama_item TEXT, nama_dagangan TEXT,
  kekuatan TEXT, kuota INTEGER, id_bentuk UUID, bentuk TEXT,
  total_stock BIGINT, dispensable_stock BIGINT, bilangan_pesakit BIGINT,
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
            sub.total_stock, sub.dispensable_stock,
            sub.bilangan_pesakit, sub._total_count
     FROM (
       SELECT
         i.id, i.kod_item, i.nama_item, i.nama_dagangan,
         i.kekuatan, i.kuota, i.id_bentuk, f.nama AS bentuk,
         (SELECT COALESCE(SUM(ib.kuantiti) FILTER (WHERE NOT ib.dilupuskan), 0)
          FROM item_batches ib WHERE ib.item_id = i.id)::BIGINT AS total_stock,
         (SELECT COALESCE(SUM(ib.kuantiti) FILTER (
            WHERE NOT ib.dilupuskan AND ib.tarikh_luput >= CURRENT_DATE), 0)
          FROM item_batches ib WHERE ib.item_id = i.id)::BIGINT AS dispensable_stock,
         (SELECT COUNT(*) FROM patient_item_assignments pia
          WHERE pia.item_id = i.id AND pia.aktif = true)::BIGINT AS bilangan_pesakit,
         COUNT(*) OVER() AS _total_count
       FROM items i
       LEFT JOIN item_forms f ON f.id = i.id_bentuk
       WHERE i.aktif = true
         AND ($1 IS NULL OR $1 = ''''
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

REVOKE ALL ON FUNCTION public.get_inventory_list(TEXT, TEXT, TEXT, BIGINT, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_inventory_list(TEXT, TEXT, TEXT, BIGINT, BIGINT) TO authenticated, service_role;

-- ── 3. get_report_inventory (032 + dispensable; amaran atas stok boleh dibekal)
DROP FUNCTION IF EXISTS public.get_report_inventory();
CREATE OR REPLACE FUNCTION get_report_inventory()
RETURNS TABLE (
  id UUID, kod_item TEXT, nama_item TEXT, nama_dagangan TEXT,
  kekuatan TEXT, kuota INTEGER, bentuk TEXT,
  total_stock BIGINT, dispensable_stock BIGINT, is_low_stock BOOLEAN,
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
    (SELECT COALESCE(SUM(ib.kuantiti) FILTER (
       WHERE NOT ib.dilupuskan AND ib.tarikh_luput >= CURRENT_DATE), 0)
     FROM item_batches ib WHERE ib.item_id = i.id)::BIGINT AS dispensable_stock,
    (i.kuota IS NOT NULL AND
     (SELECT COALESCE(SUM(ib.kuantiti) FILTER (
        WHERE NOT ib.dilupuskan AND ib.tarikh_luput >= CURRENT_DATE), 0)
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

REVOKE ALL ON FUNCTION public.get_report_inventory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_report_inventory() TO authenticated, service_role;

-- ── 4. get_report_low_stock (035 — baki tidak termasuk kelompok luput) ──────
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
      AND ib.tarikh_luput >= CURRENT_DATE
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

-- ── 5. get_report_expiring_batches (034 — termasuk yang telah luput) ────────
-- Julat bawah dibuang: kelompok luput (baki_hari negatif) mesti kelihatan
-- untuk tindakan pelupusan, bukan ghaib daripada laporan.
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
    AND ib.tarikh_luput <= CURRENT_DATE + (p_days || ' days')::INTERVAL
  ORDER BY ib.tarikh_luput ASC;
$$;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- PENGESAHAN SELEPAS MIGRASI (jalankan secara manual):
--   -- 1. Penerimaan luput ditolak:
--   --    SELECT record_batch_addition('<item>', 'LOT1', CURRENT_DATE - 1, 10, NULL);
--   --    → ERROR: telah berlalu
--   -- 2. Jumlah membezakan: item dengan 100 unit luput + 20 unit sah →
--   --    total_stock=120, dispensable_stock=20; is_low_stock (kuota 50) = true.
--   -- 3. Laporan luput menyenaraikan kelompok luput (remaining_days negatif).
-- ============================================================================
