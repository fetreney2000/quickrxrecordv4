-- ============================================================================
-- 044_batch_identity_audit.sql
--
-- Menutup MEDIUM-3 (audit penambahan stok): useUpdateBatch menulis semula
-- nombor_kelompok / tarikh_luput secara langsung — tanpa jejak audit, tanpa
-- semakan pelanggaran, dan senyap memanjangkan tarikh luput stok.
--
-- Selepas migrasi ini:
--   1. record_batch_update(p_batch_id, p_nombor_kelompok, p_tarikh_luput,
--      p_reason, p_updated_by, p_catatan): satu-satunya laluan yang
--      disokong untuk menukar identiti kelompok —
--        - kunci baris + tolak kelompok lupus,
--        - sebab WAJIB (audit tanpa alasan ditolak),
--        - tarikh luput lampau ditolak (selari 042),
--        - pertindihan dengan kelompok lain ditolak dengan mesej mesra
--          (semakan SELECT dahulu; tiada indeks unik — ulangan nombor
--          kelompok adalah sah),
--        - menulis baris batch_adjustments (change=0, kuantiti tidak terusik)
--          dengan catatan lama → baharu. Tiada inventory_transactions
--          (tiada pergerakan stok).
-- ============================================================================

CREATE OR REPLACE FUNCTION record_batch_update(
  p_batch_id UUID,
  p_nombor_kelompok TEXT,
  p_tarikh_luput DATE,
  p_reason TEXT,
  p_updated_by UUID DEFAULT NULL,
  p_catatan TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch RECORD;
  v_other_id UUID;
  v_nama_uppercase TEXT;
BEGIN
  PERFORM app_require_role('Pentadbir','Penjaga Stor');

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Sebab perubahan diperlukan untuk mengemaskini maklumat kelompok.';
  END IF;

  IF p_tarikh_luput < CURRENT_DATE THEN
    RAISE EXCEPTION 'Tarikh luput (%) telah berlalu.', p_tarikh_luput;
  END IF;

  SELECT * INTO v_batch FROM item_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kelompok % tidak dijumpai.', p_batch_id;
  END IF;
  IF v_batch.dilupuskan THEN
    RAISE EXCEPTION 'Kelompok ini telah dilupuskan dan tidak boleh diubah.';
  END IF;

  v_nama_uppercase := UPPER(btrim(p_nombor_kelompok));
  IF v_nama_uppercase = '' OR v_nama_uppercase IS NULL THEN
    RAISE EXCEPTION 'Nombor kelompok diperlukan.';
  END IF;

  IF v_batch.nombor_kelompok = v_nama_uppercase
     AND v_batch.tarikh_luput = p_tarikh_luput THEN
    RAISE EXCEPTION 'Tiada perubahan pada maklumat kelompok.';
  END IF;

  SELECT id INTO v_other_id
  FROM item_batches
  WHERE item_id = v_batch.item_id
    AND UPPER(nombor_kelompok) = v_nama_uppercase
    AND id <> p_batch_id
  LIMIT 1;
  IF v_other_id IS NOT NULL THEN
    RAISE EXCEPTION 'Nombor kelompok % sudah wujud — tambah stok ke kelompok tersebut dan bukannya menamakan semula.', v_nama_uppercase;
  END IF;

  UPDATE item_batches
  SET nombor_kelompok = v_nama_uppercase,
      tarikh_luput = p_tarikh_luput,
      updated_at = now()
  WHERE id = p_batch_id;

  INSERT INTO batch_adjustments(
    batch_id, previous_kuantiti, new_kuantiti, change, reason, adjusted_by, catatan
  )
  VALUES (
    p_batch_id, v_batch.kuantiti, v_batch.kuantiti, 0, p_reason, p_updated_by,
    format('Maklumat kelompok: nombor %s → %s; luput %s → %s%s',
      v_batch.nombor_kelompok, v_nama_uppercase,
      v_batch.tarikh_luput, p_tarikh_luput,
      CASE WHEN p_catatan IS NOT NULL AND btrim(p_catatan) <> ''
           THEN '; ' || p_catatan ELSE '' END)
  );
END;
$$;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- PENGESAHAN SELEPAS MIGRASI (jalankan secara manual):
--   -- 1. Tanpa sebab ditolak:
--   --    SELECT record_batch_update('<batch>', 'LOTX', CURRENT_DATE + 30, '', NULL);
--   --    → ERROR: Sebab perubahan diperlukan
--   -- 2. Pertindihan ditolak mesra (bukan 23505 mentah).
--   -- 3. Berjaya → batch_adjustments mempunyai baris change=0 dengan catatan
--   --    lama → baharu; inventory_transactions tidak terusik.
-- ============================================================================
