-- ============================================================================
-- 045_batch_additions_rename.sql
--
-- LOW-6 (audit penambahan stok): selaraskan nama lajur kuantiti —
-- batch_additions.quantity (peninggalan 012) vs batch_adjustments.*_kuantiti
-- dan inventory_transactions.kuantiti di tempat lain.
--
--   ALTER TABLE … RENAME COLUMN adalah operasi metadata sahaja (tiada tulis
--   semula jadual, selamat untuk jadual besar). Semua penulis/definisi
--   fungsi dikemas kini dalam migrasi dan kod yang sama (lihat 042 → versi
--   di bawah, _migrate_sqlite_to_supabase.cjs, useAddBatch fallback).
-- ============================================================================

ALTER TABLE IF EXISTS public.batch_additions
  RENAME COLUMN quantity TO kuantiti;

-- Definisi semula record_batch_addition (042 + nama lajur baharu).
-- NOTA: tanpa indeks unik (keputusan: ulangan nombor kelompok adalah sah),
-- top-up kekal sebagai SELECT-kemudian-INSERT/UPDATE. Perlumbaan serentak
-- pada nombor baharu yang sama boleh mencipta dua baris — diterima sebagai
-- risiko kecil (jumlah fizikal kekal betul; gabungkan secara manual jika
-- berlaku).
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
  v_nama_uppercase TEXT;
  v_addition_id UUID;
BEGIN
  PERFORM app_require_role('Pentadbir','Penjaga Stor');

  IF p_kuantiti <= 0 THEN
    RAISE EXCEPTION 'Kuantiti mesti lebih daripada sifar.';
  END IF;

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
    VALUES (p_item_id, v_nama_uppercase, p_tarikh_luput, p_kuantiti)
    RETURNING id INTO v_batch_id;
  END IF;

  INSERT INTO batch_additions(batch_id, kuantiti, added_by)
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

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- PENGESAHAN SELEPAS MIGRASI:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'batch_additions';  -- mesti ada 'kuantiti', tiada 'quantity'
-- ============================================================================
