-- ============================================================================
-- 056_batch_reason_required.sql
--
-- Menutup MEDIUM-1 (audit kelompok): record_batch_adjustment dan
-- process_batch_disposal menerima reason NULL/kosong melalui RPC langsung —
-- baris jurnal tanpa sebab melemahkan tujuan audit. UI sentiasa menghantar
-- label sebab, jadi penguatkuasaan ini hanya menjejaskan pemanggil langsung.
-- (Selari dengan 044 yang mewajibkan sebab untuk pertukaran identiti.)
-- ============================================================================

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
  PERFORM app_require_role('Pentadbir','Penjaga Stor');

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Sebab pelarasan diperlukan.';
  END IF;

  SELECT * INTO v_batch FROM item_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kelompok tidak dijumpai.'; END IF;
  IF v_batch.dilupuskan THEN
    RAISE EXCEPTION 'Kelompok ini telah dilupuskan dan tidak boleh diubah.';
  END IF;

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
  PERFORM app_require_role('Pentadbir','Penjaga Stor');

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Sebab pelupusan diperlukan.';
  END IF;

  SELECT * INTO v_batch FROM item_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Batch % not found', p_batch_id; END IF;
  IF v_batch.dilupuskan THEN RAISE EXCEPTION 'Kelompok telah dilupuskan.'; END IF;

  PERFORM 1 FROM items WHERE id = v_batch.item_id FOR UPDATE;

  UPDATE item_batches SET kuantiti = 0, dilupuskan = true, dilupuskan_at = now()
  WHERE id = p_batch_id;

  INSERT INTO batch_adjustments(
    batch_id, previous_kuantiti, new_kuantiti, change, reason, adjusted_by, catatan
  )
  VALUES (
    p_batch_id, v_batch.kuantiti, 0, -v_batch.kuantiti, p_reason, p_adjusted_by, p_catatan
  )
  RETURNING id INTO v_adjustment_id;

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

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- PENGESAHAN SELEPAS MIGRASI (jalankan secara manual):
--   -- Kedua-dua panggilan di bawah mesti ditolak (tiada tulisan):
--   -- SELECT record_batch_adjustment('<batch-aktif>', (SELECT kuantiti+1 FROM item_batches WHERE id='<batch-aktif>'), NULL, NULL);
--   -- SELECT process_batch_disposal('<batch-aktif>', NULL, '', NULL);
-- ============================================================================
