-- ============================================================================
-- 019_soft_delete_halts_assignments_and_disposes.sql
-- Padam item selamat: hard-delete jika item TIDAK pernah ditugaskan,
-- soft-delete (aktif=false) jika item pernah dibekalkan/ditugaskan.
-- Plus: penyuaian (backfill) item legacy yang sudah aktif=false dari 017.
-- Tarikh: 14 Ogos 2026
--
-- FUNGSI:
--   delete_item(p_item_id UUID, p_deleted_by UUID DEFAULT NULL) RETURNS TEXT
--       'deactivated'  → aktif=false; tamatkan semua tugasan pesakit aktif
--                        (pokok sejarah), dan lupuskan semua stok yang belum
--                        dilupuskan (audit dikekalkan).
--       'deleted'      → dipadam secara kekal (tiada patient_item_assignments)
--
-- PERUBAHAN berbanding 017:
--   1. Parameter p_deleted_by utk merekod siapa yang memadam (ditamatkan_oleh).
--   2. Soft-delete kini menamatkan tugasan pesakit aktif bagi item tersebut.
--   3. Soft-delete kini melupuskan semua kelompok stok yang belum dilupuskan
--      (melalui process_batch_disposal dari 018 supaya audit kekal).
-- ============================================================================

DROP FUNCTION IF EXISTS delete_item(UUID);

CREATE OR REPLACE FUNCTION delete_item(p_item_id UUID, p_deleted_by UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_used INTEGER;
  cur_batch RECORD;
  v_sebab TEXT := 'Item dinyahaktifkan / dikeluarkan dari inventori';
BEGIN
  SELECT COUNT(*) INTO v_used
  FROM patient_item_assignments
  WHERE item_id = p_item_id;

  IF v_used > 0 THEN
    UPDATE items SET aktif = false WHERE id = p_item_id;

    -- 1) Tamatkan semua tugasan pesakit aktif, merekod siapa yang memadam
    UPDATE patient_item_assignments
    SET aktif = false,
        tarikh_tamat_guna = CURRENT_DATE,
        sebab_tamat = v_sebab,
        ditamatkan_oleh = p_deleted_by
    WHERE item_id = p_item_id
      AND aktif = true;

    -- 2) Lupuskan semua kelompok stok yang belum dilupuskan, audit dikekalkan.
    --    process_batch_disposal (018) zero-kan kuantiti, tandakan dilupuskan,
    --    serialize per item, dan cipta batch_adjustment + 'keluar'
    --    inventory_transaction dengan baki.
    FOR cur_batch IN
      SELECT id FROM item_batches
      WHERE item_id = p_item_id AND dilupuskan = false
    LOOP
      PERFORM process_batch_disposal(cur_batch.id, p_deleted_by, v_sebab);
    END LOOP;

    RETURN 'deactivated';
  ELSE
    DELETE FROM items WHERE id = p_item_id;
    RETURN 'deleted';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_item(UUID, UUID) TO anon, authenticated;

-- ============================================================================
-- PENYUAIAN (BACKFILL): item legacy yang sudah aktif=false dari 017.
-- Item tersebut disembunyikan dari inventori tetapi mungkin masih ada tugasan
-- pesakit aktif dan stok hidup yang belum dilupuskan. Terapkan semantik
-- soft-delete yang sama sekali sahaja semasa deploy. Idempotent.
-- ============================================================================

DO $$
DECLARE
  v_item RECORD;
  v_batch RECORD;
  v_sebab_legacy TEXT := 'Item dinyahaktifkan (penyuaian data lepas)';
BEGIN
  FOR v_item IN
    SELECT id FROM items WHERE aktif = false
  LOOP
    UPDATE patient_item_assignments
    SET aktif = false,
        tarikh_tamat_guna = CURRENT_DATE,
        sebab_tamat = v_sebab_legacy,
        ditamatkan_oleh = NULL
    WHERE item_id = v_item.id AND aktif = true;

    FOR v_batch IN
      SELECT id FROM item_batches
      WHERE item_id = v_item.id AND dilupuskan = false
    LOOP
      PERFORM process_batch_disposal(
        v_batch.id,
        NULL, -- p_adjusted_by: pelaku asal tidak diketahui utk baris legacy
        v_sebab_legacy
      );
    END LOOP;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- Tamat 019_soft_delete_halts_assignments_and_disposes.sql
