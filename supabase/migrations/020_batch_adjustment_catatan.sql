-- ============================================================================
-- 020_batch_adjustment_catatan.sql
-- Tambah lajur `catatan` (sebab terperinci bebas) pada batch_adjustments.
-- Tarikh: 15 Ogos 2026
--
-- PERUBAHAN:
--   1. Tambah lajur `catatan TEXT` pada batch_adjustments (sebab terperinci
--      yang dimasukkan pengguna untuk pelarasan/pelupusan stok).
--   2. Kemas kini RPC supaya menerima `p_catatan` dan simpannya dalam
--      batch_adjustments.catatan:
--        - process_batch_disposal   (pelupusan)
--        - record_batch_adjustment  (pelarasan bukan pelupusan)
--
-- NOTA: inventory_transactions.catatan dikekalkan sebagai reason (tingkah laku
-- sedia ada). Semantik lejar/backfill tidak diubah.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Lajur catatan
-- ----------------------------------------------------------------------------
ALTER TABLE batch_adjustments ADD COLUMN IF NOT EXISTS catatan TEXT;

-- ============================================================================
-- 2. RPC — proses & rekod catatan
-- ============================================================================

-- ----------------------------------------------------------------------------
-- process_batch_disposal (pelupusan atomik + baki; sentiasa jurnal)
-- Menyokong pelupusan kelompok kosong (kuantiti 0) utk rekod audit penuh.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION process_batch_disposal(
  p_batch_id UUID,
  p_adjusted_by UUID DEFAULT NULL,
  p_reason TEXT DEFAULT 'Pelupusan Stok',
  p_catatan TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch item_batches%ROWTYPE;
  v_adjustment_id UUID;
  v_baki INTEGER;
BEGIN
  SELECT * INTO v_batch FROM item_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Batch % not found', p_batch_id; END IF;
  IF v_batch.dilupuskan THEN RAISE EXCEPTION 'Kelompok telah dilupuskan.'; END IF;

  -- Serialisasi per item
  PERFORM 1 FROM items WHERE id = v_batch.item_id FOR UPDATE;

  -- Set stok kepada kosong & tandakan dilupuskan
  UPDATE item_batches SET kuantiti = 0, dilupuskan = true, dilupuskan_at = now()
  WHERE id = p_batch_id;

  -- Detail pelarasan (sentiasa, termasuk kuantiti 0)
  INSERT INTO batch_adjustments(
    batch_id, previous_kuantiti, new_kuantiti, change, reason, adjusted_by, catatan
  )
  VALUES (
    p_batch_id, v_batch.kuantiti, 0, -v_batch.kuantiti, p_reason, p_adjusted_by, p_catatan
  )
  RETURNING id INTO v_adjustment_id;

  -- Jurnal (sentiasa, termasuk kuantiti 0)
  SELECT COALESCE(SUM(kuantiti), 0)::INTEGER INTO v_baki
  FROM item_batches WHERE item_id = v_batch.item_id;

  INSERT INTO inventory_transactions(
    item_id, batch_id, jenis, kuantiti, rujukan_id, rujukan_type, catatan, baki
  ) VALUES (
    v_batch.item_id, p_batch_id, 'keluar', v_batch.kuantiti,
    v_adjustment_id, 'batch_disposal', p_reason, v_baki
  );
END;
$$;

GRANT ALL ON FUNCTION process_batch_disposal(UUID, UUID, TEXT, TEXT) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- record_batch_adjustment (pelarasan bukan pelupusan, atomik)
-- Menyokong pelarasan naik/turun ke kuantiti tertentu.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_batch_adjustment(
  p_batch_id UUID,
  p_new_kuantiti INTEGER,
  p_reason TEXT DEFAULT NULL,
  p_adjusted_by UUID DEFAULT NULL,
  p_catatan TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch item_batches%ROWTYPE;
  v_adjustment_id UUID;
  v_change INTEGER;
  v_jenis TEXT;
  v_abs_change INTEGER;
BEGIN
  SELECT * INTO v_batch FROM item_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kelompok tidak dijumpai.'; END IF;
  IF v_batch.dilupuskan THEN
    RAISE EXCEPTION 'Kelompok ini telah dilupuskan dan tidak boleh diubah.';
  END IF;

  -- Serialisasi per item
  PERFORM 1 FROM items WHERE id = v_batch.item_id FOR UPDATE;

  IF p_new_kuantiti < 0 THEN
    RAISE EXCEPTION 'Kuantiti tidak boleh negatif.';
  END IF;

  v_change := p_new_kuantiti - v_batch.kuantiti;
  IF v_change = 0 THEN
    RAISE EXCEPTION 'Tiada perubahan pada kuantiti.';
  END IF;

  UPDATE item_batches SET kuantiti = p_new_kuantiti, updated_at = now() WHERE id = p_batch_id;

  v_abs_change := ABS(v_change);
  v_jenis := CASE WHEN v_change > 0 THEN 'masuk' ELSE 'keluar' END;

  INSERT INTO batch_adjustments(
    batch_id, previous_kuantiti, new_kuantiti, change, reason, adjusted_by, catatan
  )
  VALUES (
    p_batch_id, v_batch.kuantiti, p_new_kuantiti, v_change, p_reason, p_adjusted_by, p_catatan
  )
  RETURNING id INTO v_adjustment_id;

  INSERT INTO inventory_transactions(
    item_id, batch_id, jenis, kuantiti, rujukan_id, rujukan_type, catatan, baki
  ) VALUES (
    v_batch.item_id, p_batch_id, v_jenis, v_abs_change,
    v_adjustment_id, 'adjustment', p_reason, inventory_item_baki(v_batch.item_id)
  );
END;
$$;

GRANT ALL ON FUNCTION record_batch_adjustment(UUID, INTEGER, TEXT, UUID, TEXT) TO anon, authenticated;

-- Tamat 020_batch_adjustment_catatan.sql