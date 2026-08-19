-- ============================================================================
-- 021_process_supply_multi.sql
-- Multi-batch FEFO supply RPC — bekalan merentasi beberapa kelompok dalam
-- satu transaksi atomik.
-- Tarikh: 19 Ogos 2026
--
-- PERUBAHAN:
--   1. Tambah fungsi process_supply_multi — menerima array alokasi JSONB
--      dan memproses setiap kelompok dalam satu transaksi.
-- ============================================================================

CREATE OR REPLACE FUNCTION process_supply_multi(
  p_assignment_id UUID,
  p_dos TEXT,
  p_tempoh_dibekal TEXT,
  p_allocations JSONB,        -- [{"batch_id":"uuid","kuantiti":30}, ...]
  p_kakitangan_pembekal UUID,
  p_catatan_bekalan TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item_id UUID;
  v_supply_id UUID;
  v_first_supply_id UUID := NULL;
  v_elem JSONB;
  v_batch_id UUID;
  v_batch_qty INTEGER;
  v_current_stock INTEGER;
  v_baki INTEGER;
BEGIN
  -- 1. Dapatkan item_id dari tugasan
  SELECT item_id INTO v_item_id
  FROM patient_item_assignments
  WHERE id = p_assignment_id;

  IF v_item_id IS NULL THEN
    RAISE EXCEPTION 'Assignment % not found', p_assignment_id;
  END IF;

  -- 2. Kunci baris item utk serialisasi per item
  PERFORM 1 FROM items WHERE id = v_item_id FOR UPDATE;

  -- 3. Proses setiap alokasi
  FOR v_elem IN SELECT jsonb_array_elements(p_allocations)
  LOOP
    v_batch_id := (v_elem->>'batch_id')::UUID;
    v_batch_qty := (v_elem->>'kuantiti')::INTEGER;

    IF v_batch_qty <= 0 THEN
      RAISE EXCEPTION 'Kuantiti mestilah lebih daripada sifar untuk kelompok %', v_batch_id;
    END IF;

    -- 3a. Kunci baris kelompok
    SELECT kuantiti INTO v_current_stock
    FROM item_batches
    WHERE id = v_batch_id
    FOR UPDATE;

    IF v_current_stock IS NULL THEN
      RAISE EXCEPTION 'Batch % not found', v_batch_id;
    END IF;

    -- 3b. Sahkan kelompok belum dilupuskan
    IF EXISTS (SELECT 1 FROM item_batches WHERE id = v_batch_id AND dilupuskan = true) THEN
      RAISE EXCEPTION 'Kelompok % telah dilupuskan.', v_batch_id;
    END IF;

    -- 3c. Sahkan stok mencukupi
    IF v_current_stock < v_batch_qty THEN
      RAISE EXCEPTION 'Stok tidak mencukupi untuk kelompok %. Baki: %, Diminta: %', v_batch_id, v_current_stock, v_batch_qty;
    END IF;

    -- 3d. Kurangkan stok
    UPDATE item_batches
    SET kuantiti = kuantiti - v_batch_qty,
        updated_at = now()
    WHERE id = v_batch_id;

    -- 3e. Kira baki item selepas pergerakan
    SELECT COALESCE(SUM(kuantiti), 0)::INTEGER INTO v_baki
    FROM item_batches WHERE item_id = v_item_id;

    -- 3f. Cipta rekod bekalan
    INSERT INTO supply_records (
      assignment_id, dos, tempoh_dibekal, kuantiti,
      batch_id, kakitangan_pembekal, catatan_bekalan
    ) VALUES (
      p_assignment_id, p_dos, p_tempoh_dibekal, v_batch_qty,
      v_batch_id, p_kakitangan_pembekal, p_catatan_bekalan
    )
    RETURNING id INTO v_supply_id;

    -- Simpan id pertama utk dikembalikan
    IF v_first_supply_id IS NULL THEN
      v_first_supply_id := v_supply_id;
    END IF;

    -- 3g. Cipta jurnal inventory_transactions (keluar) dengan baki
    INSERT INTO inventory_transactions (
      item_id, batch_id, jenis, kuantiti,
      rujukan_id, rujukan_type, catatan, baki
    ) VALUES (
      v_item_id, v_batch_id, 'keluar', v_batch_qty,
      v_supply_id, 'supply', p_catatan_bekalan, v_baki
    );
  END LOOP;

  IF v_first_supply_id IS NULL THEN
    RAISE EXCEPTION 'Tiada alokasi diproses.';
  END IF;

  RETURN v_first_supply_id;
END;
$$;

GRANT ALL ON FUNCTION process_supply_multi(
  UUID, TEXT, TEXT, JSONB, UUID, TEXT
) TO anon, authenticated;

-- Tamat 021_process_supply_multi.sql
