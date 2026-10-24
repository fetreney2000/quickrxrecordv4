-- ============================================================================
-- 063_supply_expiry_guard.sql
--
-- Menutup MEDIUM-1 (audit Dispen Pantas): process_supply dan
-- process_supply_multi menyemak kelompok dilupuskan tetapi TIDAK PERNAH
-- menyemak tarikh_luput — stok luput boleh dibekalkan melalui panggilan
-- RPC langsung (atau mana-mana klien yang terlupa menapis), walaupun
-- seluruh UI dibina atas disiplin FEFO + luput.
--
-- Selepas migrasi ini: kedua-dua fungsi menolak kelompok yang tarikh_luput
-- < CURRENT_DATE (selari dengan penapis klien tarikh_luput >= hari ini dan
-- semakan 042 yang mengecualikan stok luput daripada stok boleh dibekal).
-- Kelompok yang luput *hari ini* masih boleh dibekalkan (sama seperti UI).
-- ============================================================================

-- ── 1. process_supply (tunggal + semakan luput) ──────────────────────────────
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
  v_patient_id UUID;
  v_assignment_aktif BOOLEAN;
  v_patient_aktif BOOLEAN;
  v_merged_into UUID;
  v_current_stock INTEGER;
  v_tarikh_luput DATE;
  v_supply_id UUID;
  v_baki INTEGER;
BEGIN
  PERFORM app_require_role('Pentadbir','Penjaga Stor','Kakitangan Farmasi');

  SELECT pia.item_id, pia.patient_id, pia.aktif
    INTO v_item_id, v_patient_id, v_assignment_aktif
  FROM patient_item_assignments pia
  WHERE pia.id = p_assignment_id;
  IF v_item_id IS NULL THEN
    RAISE EXCEPTION 'Assignment % not found', p_assignment_id;
  END IF;

  -- HIGH-1: tolak tugasan yang telah ditamatkan.
  IF NOT COALESCE(v_assignment_aktif, false) THEN
    RAISE EXCEPTION 'Tugasan % telah ditamatkan — bekalan tidak dibenarkan.', p_assignment_id;
  END IF;

  -- HIGH-1: tolak bekalan kepada pesakit tidak aktif / digabungkan.
  -- Kunci baris pesakit: bekalan dan nyahaktif serentak tidak boleh melepasi
  -- semakan ini (tutup jurang TOCTOU).
  SELECT p.aktif, p.merged_into
    INTO v_patient_aktif, v_merged_into
  FROM patients p
  WHERE p.id = v_patient_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pesakit bagi tugasan % tidak dijumpai.', p_assignment_id;
  END IF;
  IF NOT COALESCE(v_patient_aktif, false) OR v_merged_into IS NOT NULL THEN
    RAISE EXCEPTION 'Pesakit tidak aktif — bekalan tidak dibenarkan.';
  END IF;

  PERFORM 1 FROM items WHERE id = v_item_id FOR UPDATE;

  SELECT kuantiti, tarikh_luput INTO v_current_stock, v_tarikh_luput
  FROM item_batches
  WHERE id = p_batch_id AND item_id = v_item_id
  FOR UPDATE;
  IF v_current_stock IS NULL THEN
    RAISE EXCEPTION 'Kelompok % tidak dijumpai atau bukan milik item tugasan ini.', p_batch_id;
  END IF;

  -- 063: tolak kelompok luput (tarikh_luput < hari ini, ikut zon pelayan —
  -- selari dengan semakan stok boleh dibekal 042).
  IF v_tarikh_luput < CURRENT_DATE THEN
    RAISE EXCEPTION 'Kelompok % telah luput pada % — bekalan dari kelompok luput tidak dibenarkan.', p_batch_id, v_tarikh_luput;
  END IF;

  IF v_current_stock < p_kuantiti THEN
    RAISE EXCEPTION 'Stok tidak mencukupi. Baki: %, Diminta: %', v_current_stock, p_kuantiti;
  END IF;

  UPDATE item_batches
  SET kuantiti = kuantiti - p_kuantiti, updated_at = now()
  WHERE id = p_batch_id;

  SELECT COALESCE(SUM(kuantiti), 0)::INTEGER INTO v_baki
  FROM item_batches WHERE item_id = v_item_id;

  INSERT INTO supply_records (
    assignment_id, dos, tempoh_dibekal, kuantiti,
    batch_id, kakitangan_pembekal, catatan_bekalan
  ) VALUES (
    p_assignment_id, p_dos, p_tempoh_dibekal, p_kuantiti,
    p_batch_id, p_kakitangan_pembekal, p_catatan_bekalan
  )
  RETURNING id INTO v_supply_id;

  INSERT INTO inventory_transactions (
    item_id, batch_id, jenis, kuantiti,
    rujukan_id, rujukan_type, catatan, baki
  ) VALUES (
    v_item_id, p_batch_id, 'keluar', p_kuantiti,
    v_supply_id, 'supply', p_catatan_bekalan, v_baki
  );

  RETURN v_supply_id;
END;
$$;

-- ── 2. process_supply_multi (atomik + semakan luput per kelompok) ────────────
CREATE OR REPLACE FUNCTION process_supply_multi(
  p_assignment_id UUID,
  p_dos TEXT,
  p_tempoh_dibekal TEXT,
  p_allocations JSONB,
  p_kakitangan_pembekal UUID,
  p_catatan_bekalan TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item_id UUID;
  v_patient_id UUID;
  v_assignment_aktif BOOLEAN;
  v_patient_aktif BOOLEAN;
  v_merged_into UUID;
  v_supply_id UUID;
  v_first_supply_id UUID := NULL;
  v_elem JSONB;
  v_batch_id UUID;
  v_batch_qty INTEGER;
  v_current_stock INTEGER;
  v_tarikh_luput DATE;
  v_baki INTEGER;
BEGIN
  PERFORM app_require_role('Pentadbir','Penjaga Stor','Kakitangan Farmasi');

  SELECT pia.item_id, pia.patient_id, pia.aktif
    INTO v_item_id, v_patient_id, v_assignment_aktif
  FROM patient_item_assignments pia
  WHERE pia.id = p_assignment_id;
  IF v_item_id IS NULL THEN
    RAISE EXCEPTION 'Assignment % not found', p_assignment_id;
  END IF;

  -- HIGH-1: tolak tugasan yang telah ditamatkan.
  IF NOT COALESCE(v_assignment_aktif, false) THEN
    RAISE EXCEPTION 'Tugasan % telah ditamatkan — bekalan tidak dibenarkan.', p_assignment_id;
  END IF;

  -- HIGH-1: tolak bekalan kepada pesakit tidak aktif / digabungkan
  -- (kunci baris pesakit — tutup jurang TOCTOU dengan nyahaktif).
  SELECT p.aktif, p.merged_into
    INTO v_patient_aktif, v_merged_into
  FROM patients p
  WHERE p.id = v_patient_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pesakit bagi tugasan % tidak dijumpai.', p_assignment_id;
  END IF;
  IF NOT COALESCE(v_patient_aktif, false) OR v_merged_into IS NOT NULL THEN
    RAISE EXCEPTION 'Pesakit tidak aktif — bekalan tidak dibenarkan.';
  END IF;

  PERFORM 1 FROM items WHERE id = v_item_id FOR UPDATE;

  FOR v_elem IN SELECT jsonb_array_elements(p_allocations)
  LOOP
    v_batch_id := (v_elem->>'batch_id')::UUID;
    v_batch_qty := (v_elem->>'kuantiti')::INTEGER;

    IF v_batch_qty <= 0 THEN
      RAISE EXCEPTION 'Kuantiti mestilah lebih daripada sifar untuk kelompok %', v_batch_id;
    END IF;

    SELECT kuantiti, tarikh_luput INTO v_current_stock, v_tarikh_luput
    FROM item_batches
    WHERE id = v_batch_id AND item_id = v_item_id
    FOR UPDATE;
    IF v_current_stock IS NULL THEN
      RAISE EXCEPTION 'Kelompok % tidak dijumpai atau bukan milik item tugasan ini.', v_batch_id;
    END IF;

    IF EXISTS (SELECT 1 FROM item_batches WHERE id = v_batch_id AND dilupuskan = true) THEN
      RAISE EXCEPTION 'Kelompok % telah dilupuskan.', v_batch_id;
    END IF;

    -- 063: tolak kelompok luput (tarikh_luput < hari ini).
    IF v_tarikh_luput < CURRENT_DATE THEN
      RAISE EXCEPTION 'Kelompok % telah luput pada % — bekalan dari kelompok luput tidak dibenarkan.', v_batch_id, v_tarikh_luput;
    END IF;

    IF v_current_stock < v_batch_qty THEN
      RAISE EXCEPTION 'Stok tidak mencukupi untuk kelompok %. Baki: %, Diminta: %', v_batch_id, v_current_stock, v_batch_qty;
    END IF;

    UPDATE item_batches
    SET kuantiti = kuantiti - v_batch_qty, updated_at = now()
    WHERE id = v_batch_id;

    SELECT COALESCE(SUM(kuantiti), 0)::INTEGER INTO v_baki
    FROM item_batches WHERE item_id = v_item_id;

    INSERT INTO supply_records (
      assignment_id, dos, tempoh_dibekal, kuantiti,
      batch_id, kakitangan_pembekal, catatan_bekalan
    ) VALUES (
      p_assignment_id, p_dos, p_tempoh_dibekal, v_batch_qty,
      v_batch_id, p_kakitangan_pembekal, p_catatan_bekalan
    )
    RETURNING id INTO v_supply_id;

    IF v_first_supply_id IS NULL THEN
      v_first_supply_id := v_supply_id;
    END IF;

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

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- PENGESAHAN SELEPAS MIGRASI (jalankan secara manual):
--   -- Cuba bekalkan dari kelompok luput (tarikh_luput < CURRENT_DATE):
--   --    SELECT process_supply('<assignment-aktif>', '1x1', '30 Hari', 1,
--   --      '<batch-luput>', '<staf>', null);
--   --    → ERROR: Kelompok ... telah luput ...
--   -- Bekalan biasa dari kelompok sah tidak terjejas.
-- ============================================================================
