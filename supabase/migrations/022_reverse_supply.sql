-- ============================================================================
-- 022_reverse_supply.sql
-- Reverse a supply record: restore batch stock + create reversal inventory
-- transaction + delete the supply record, all atomically.
-- Tarikh: 20 Ogos 2026
-- ============================================================================

CREATE OR REPLACE FUNCTION reverse_supply(
  p_supply_id UUID,
  p_catatan TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supply RECORD;
  v_item_id UUID;
  v_baki INTEGER;
BEGIN
  -- 1. Dapatkan rekod bekalan
  SELECT sr.*, pia.item_id INTO v_supply
  FROM supply_records sr
  JOIN patient_item_assignments pia ON pia.id = sr.assignment_id
  WHERE sr.id = p_supply_id;

  IF v_supply IS NULL THEN
    RAISE EXCEPTION 'Rekod bekalan % tidak dijumpai.', p_supply_id;
  END IF;

  v_item_id := v_supply.item_id;

  -- 2. Kunci baris item utk serialisasi per item
  PERFORM 1 FROM items WHERE id = v_item_id FOR UPDATE;

  -- 3. Kunci baris kelompok dan kembalikan stok
  UPDATE item_batches
  SET kuantiti = kuantiti + v_supply.kuantiti,
      updated_at = now()
  WHERE id = v_supply.batch_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kelompok % tidak dijumpai.', v_supply.batch_id;
  END IF;

  -- 4. Kira baki item selepas pengembalian
  SELECT COALESCE(SUM(kuantiti), 0)::INTEGER INTO v_baki
  FROM item_batches WHERE item_id = v_item_id;

  -- 5. Cipta jurnal pembalikan (masuk)
  INSERT INTO inventory_transactions (
    item_id, batch_id, jenis, kuantiti,
    rujukan_id, rujukan_type, catatan, baki
  ) VALUES (
    v_item_id, v_supply.batch_id, 'masuk', v_supply.kuantiti,
    p_supply_id, 'supply_reversal',
    COALESCE(p_catatan, 'Pembatalan bekalan'),
    v_baki
  );

  -- 6. Padam rekod bekalan
  DELETE FROM supply_records WHERE id = p_supply_id;
END;
$$;

GRANT ALL ON FUNCTION reverse_supply(UUID, TEXT) TO anon, authenticated;

-- Tamat 022_reverse_supply.sql
