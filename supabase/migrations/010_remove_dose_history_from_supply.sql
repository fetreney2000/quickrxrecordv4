-- ============================================================================
-- 010_remove_dose_history_from_supply.sql
-- Versi muktamad process_supply
-- Tarikh: 26 Julai 2026
--
-- PERUBAHAN:
--   - Versi 001 asal menyelitkan dose_history INSERT dan assignment UPDATE
--     yang menyebabkan entri pendua dan pertukaran dos tak sengaja.
--   - Versi 010 membuang logik tersebut — pengemaskinian dos kini
--     dikendalikan sepenuhnya di sisi klien.
-- ============================================================================

-- ============================================================================
-- FUNGSI: process_supply (VERSI MUKTAMAD)
-- 1. Dapatkan item_id dari tugasan
-- 2. Kunci baris kelompok (FOR UPDATE)
-- 3. Sahkan kelompok wujud
-- 4. Sahkan stok mencukupi
-- 5. Kurangkan stok
-- 6. Cipta rekod supply_records
-- 7. Cipta rekod inventory_transactions (keluar)
-- 8. Kembalikan supply_id
-- ============================================================================

CREATE OR REPLACE FUNCTION process_supply(
  p_assignment_id UUID,
  p_dos TEXT,
  p_tempoh_dibekal TEXT,
  p_kuantiti INTEGER,
  p_batch_id UUID,
  p_kakitangan_pembekal UUID,
  p_catatan_bekalan TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item_id UUID;
  v_current_stock INTEGER;
  v_supply_id UUID;
BEGIN
  -- 1. Dapatkan item_id dari tugasan
  SELECT item_id INTO v_item_id
  FROM patient_item_assignments
  WHERE id = p_assignment_id;

  IF v_item_id IS NULL THEN
    RAISE EXCEPTION 'Assignment % not found', p_assignment_id;
  END IF;

  -- 2. Kunci baris kelompok untuk transaksi atomik
  SELECT kuantiti INTO v_current_stock
  FROM item_batches
  WHERE id = p_batch_id
  FOR UPDATE;

  IF v_current_stock IS NULL THEN
    RAISE EXCEPTION 'Batch % not found', p_batch_id;
  END IF;

  -- 3. Sahkan stok mencukupi
  IF v_current_stock < p_kuantiti THEN
    RAISE EXCEPTION 'Stok tidak mencukupi. Baki: %, Diminta: %', v_current_stock, p_kuantiti;
  END IF;

  -- 4. Kurangkan stok kelompok
  UPDATE item_batches
  SET kuantiti = kuantiti - p_kuantiti,
      updated_at = now()
  WHERE id = p_batch_id;

  -- 5. Cipta rekod bekalan
  INSERT INTO supply_records (
    assignment_id, dos, tempoh_dibekal, kuantiti,
    batch_id, kakitangan_pembekal, catatan_bekalan
  ) VALUES (
    p_assignment_id, p_dos, p_tempoh_dibekal, p_kuantiti,
    p_batch_id, p_kakitangan_pembekal, p_catatan_bekalan
  )
  RETURNING id INTO v_supply_id;

  -- 6. Cipta rekod inventory_transactions (jenis='keluar')
  INSERT INTO inventory_transactions (
    item_id, batch_id, jenis, kuantiti,
    rujukan_id, rujukan_type, catatan
  ) VALUES (
    v_item_id, p_batch_id, 'keluar', p_kuantiti,
    v_supply_id, 'supply', p_catatan_bekalan
  );

  -- TIDAK LAGI menyelitkan dose_history atau mengemas kini assignment.dos
  -- — pengendalian dos kini di sisi klien/aplikasi

  RETURN v_supply_id;
END;
$$;

-- Tamat 010_remove_dose_history_from_supply.sql
