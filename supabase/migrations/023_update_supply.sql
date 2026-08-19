-- ============================================================================
-- 023_update_supply.sql
-- Update a supply record's quantity (and optionally dos/tempoh/catatan),
-- adjusting batch stock and creating an inventory transaction for the
-- difference. All atomically.
-- Tarikh: 20 Ogos 2026
-- ============================================================================

CREATE OR REPLACE FUNCTION update_supply(
  p_supply_id UUID,
  p_dos TEXT,
  p_kuantiti INTEGER,
  p_tempoh_dibekal TEXT,
  p_catatan_bekalan TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supply RECORD;
  v_item_id UUID;
  v_diff INTEGER;
  v_baki INTEGER;
BEGIN
  -- 1. Dapatkan rekod bekalan semasa (skip jika voided)
  SELECT sr.*, pia.item_id INTO v_supply
  FROM supply_records sr
  JOIN patient_item_assignments pia ON pia.id = sr.assignment_id
  WHERE sr.id = p_supply_id AND sr.voided_at IS NULL;

  IF v_supply IS NULL THEN
    RAISE EXCEPTION 'Rekod bekalan % tidak dijumpai atau telah dibatalkan.', p_supply_id;
  END IF;

  v_item_id := v_supply.item_id;
  v_diff := p_kuantiti - v_supply.kuantiti;

  -- Tiada perubahan kuantiti — just update metadata
  IF v_diff = 0 THEN
    UPDATE supply_records
    SET dos = p_dos,
        tempoh_dibekal = p_tempoh_dibekal,
        catatan_bekalan = p_catatan_bekalan
    WHERE id = p_supply_id;
    RETURN;
  END IF;

  -- 2. Kunci baris item utk serialisasi per item
  PERFORM 1 FROM items WHERE id = v_item_id FOR UPDATE;

  -- 3. Kunci baris kelompok
  PERFORM 1 FROM item_batches WHERE id = v_supply.batch_id FOR UPDATE;

  -- 4. Jika kuantiti bertambah, pastikan stok mencukupi
  IF v_diff > 0 THEN
    IF (SELECT kuantiti FROM item_batches WHERE id = v_supply.batch_id) < v_diff THEN
      RAISE EXCEPTION 'Stok tidak mencukupi untuk menambah % unit.', v_diff;
    END IF;
  END IF;

  -- 5. Laraskan stok kelompok
  UPDATE item_batches
  SET kuantiti = kuantiti - v_diff,
      updated_at = now()
  WHERE id = v_supply.batch_id;

  -- 6. Kira baki item selepas pelarasan
  SELECT COALESCE(SUM(kuantiti), 0)::INTEGER INTO v_baki
  FROM item_batches WHERE item_id = v_item_id;

  -- 7. Cipta jurnal pelarasan
  --    Jika v_diff < 0 (kuantiti dikurangkan) → stok bertambah → 'masuk'
  --    Jika v_diff > 0 (kuantiti ditambah) → stok berkurang → 'keluar'
  INSERT INTO inventory_transactions (
    item_id, batch_id, jenis, kuantiti,
    rujukan_id, rujukan_type, catatan, baki
  ) VALUES (
    v_item_id, v_supply.batch_id,
    CASE WHEN v_diff < 0 THEN 'masuk' ELSE 'keluar' END,
    ABS(v_diff),
    p_supply_id, 'supply_adjustment',
    COALESCE(p_catatan_bekalan, 'Pelarasan kuantiti bekalan'),
    v_baki
  );

  -- 8. Kemaskini rekod bekalan
  UPDATE supply_records
  SET dos = p_dos,
      kuantiti = p_kuantiti,
      tempoh_dibekal = p_tempoh_dibekal,
      catatan_bekalan = p_catatan_bekalan
  WHERE id = p_supply_id;
END;
$$;

GRANT ALL ON FUNCTION update_supply(UUID, TEXT, INTEGER, TEXT, TEXT) TO anon, authenticated;

-- Tamat 023_update_supply.sql
