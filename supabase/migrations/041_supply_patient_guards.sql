-- ============================================================================
-- 041_supply_patient_guards.sql
--
-- Menutup jurang HIGH-1 (audit nyahaktif pesakit): janji "tidak akan dapat
-- menerima bekalan ubat baharu" sebelum ini hanya dikuatkuasakan di UI.
-- process_supply / process_supply_multi (039) tidak menyemak assignment.aktif
-- atau patient.aktif, jadi assignment_id yang dirakam sebelum nyahaktif boleh
-- dibekalkan semula melalui panggilan RPC langsung; laluan fallback klien
-- (runManualFallback) juga tidak menyemak.
--
-- Selepas migrasi ini:
--   1. process_supply + process_supply_multi menolak bekalan jika tugasan
--      tidak aktif, atau pesakit tidak aktif / telah digabungkan. Pesakit
--      dikunci (FOR UPDATE) untuk menutup jurang TOCTOU dengan nyahaktif.
--   2. add_assignment_with_dose menolak tugasan baharu untuk pesakit tidak
--      aktif / digabungkan.
--   3. Trigger trg_patients_halt_assignments menamatkan semua tugasan aktif
--      (sebab 'Pesakit dinyahaktifkan', ditamatkan_oleh = perekod nyahaktif)
--      sebaik sahaja patients.aktif true→false — selari dengan duluan
--      019 (item dinyahaktifkan menamatkan tugasan).
--
-- Selamat untuk data sedia ada: hanya laluan tulis disentuh; rekod sejarah
-- (supply_records, dose_history) tidak diubah. update_supply/reverse_supply
-- SENGAJA tidak disekat — pembetulan/pembatalan rekod sejarah mesti kekal
-- boleh dilakukan (pembatalan memulangkan stok).
-- ============================================================================

-- ── 1. process_supply (039 6a + pengawal pesakit/tugasan) ───────────────────
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

  SELECT kuantiti INTO v_current_stock
  FROM item_batches
  WHERE id = p_batch_id AND item_id = v_item_id
  FOR UPDATE;
  IF v_current_stock IS NULL THEN
    RAISE EXCEPTION 'Kelompok % tidak dijumpai atau bukan milik item tugasan ini.', p_batch_id;
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

-- ── 2. process_supply_multi (039 6b + pengawal pesakit/tugasan) ─────────────
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

    SELECT kuantiti INTO v_current_stock
    FROM item_batches
    WHERE id = v_batch_id AND item_id = v_item_id
    FOR UPDATE;
    IF v_current_stock IS NULL THEN
      RAISE EXCEPTION 'Kelompok % tidak dijumpai atau bukan milik item tugasan ini.', v_batch_id;
    END IF;

    IF EXISTS (SELECT 1 FROM item_batches WHERE id = v_batch_id AND dilupuskan = true) THEN
      RAISE EXCEPTION 'Kelompok % telah dilupuskan.', v_batch_id;
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

-- ── 3. add_assignment_with_dose (039 6e + pengawal pesakit + kuota) ──────────
-- (SECURITY INVOKER dikekalkan — RLS klinikal turut terpakai.)
CREATE OR REPLACE FUNCTION add_assignment_with_dose(
  p_patient_id UUID,
  p_item_id UUID,
  p_dos TEXT,
  p_catatan_penggunaan TEXT DEFAULT NULL,
  p_dimulakan_oleh UUID DEFAULT NULL,
  p_kakitangan_farmasi_perekod UUID DEFAULT NULL,
  p_dose_catatan TEXT DEFAULT 'Bekalan kali pertama',
  p_tarikh_dose TIMESTAMPTZ DEFAULT now()
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
  v_patient_aktif BOOLEAN;
  v_merged_into UUID;
  v_kuota INTEGER;
  v_item_aktif BOOLEAN;
  v_active_count INTEGER;
BEGIN
  PERFORM app_require_role('Pentadbir','Penjaga Stor','Kakitangan Farmasi');

  -- HIGH-1: jangan cipta tugasan untuk pesakit tidak aktif / digabungkan.
  SELECT p.aktif, p.merged_into
    INTO v_patient_aktif, v_merged_into
  FROM patients p
  WHERE p.id = p_patient_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pesakit % tidak dijumpai.', p_patient_id;
  END IF;
  IF NOT COALESCE(v_patient_aktif, false) OR v_merged_into IS NOT NULL THEN
    RAISE EXCEPTION 'Pesakit tidak aktif — tugasan baharu tidak dibenarkan.';
  END IF;

  -- HIGH-2 (audit pemberhentian): kuota dikuatkuasakan di pelayan, bukan
  -- sekadar butang UI. Kunci baris item supaya dua penambahan serentak
  -- tidak melepasi semakan yang sama. Kuota NULL = tanpa had.
  SELECT i.kuota, i.aktif INTO v_kuota, v_item_aktif
  FROM items i
  WHERE i.id = p_item_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item % tidak dijumpai.', p_item_id;
  END IF;
  IF NOT COALESCE(v_item_aktif, false) THEN
    RAISE EXCEPTION 'Item % tidak aktif — tugasan baharu tidak dibenarkan.', p_item_id;
  END IF;
  IF v_kuota IS NOT NULL AND v_kuota > 0 THEN
    SELECT COUNT(*)::INTEGER INTO v_active_count
    FROM patient_item_assignments
    WHERE item_id = p_item_id AND aktif = true;
    IF v_active_count >= v_kuota THEN
      RAISE EXCEPTION 'Kuota item telah penuh (%/%) — tamatkan tugasan sedia ada dahulu.', v_active_count, v_kuota;
    END IF;
  END IF;
  IF NOT COALESCE(v_patient_aktif, false) OR v_merged_into IS NOT NULL THEN
    RAISE EXCEPTION 'Pesakit tidak aktif — tugasan baharu tidak dibenarkan.';
  END IF;

  INSERT INTO patient_item_assignments (
    patient_id, item_id, dos, catatan_penggunaan,
    tarikh_mula_guna, aktif, dimulakan_oleh, kakitangan_farmasi_perekod
  ) VALUES (
    p_patient_id, p_item_id, p_dos, p_catatan_penggunaan,
    CURRENT_DATE, true, p_dimulakan_oleh, p_kakitangan_farmasi_perekod
  ) RETURNING id INTO v_id;

  IF p_dos IS NOT NULL AND p_dos != '' THEN
    INSERT INTO dose_history (assignment_id, tarikh, dos, aktif, catatan, dikemaskini_oleh)
    VALUES (v_id, p_tarikh_dose, p_dos, true, p_dose_catatan, p_dimulakan_oleh);
  END IF;

  RETURN v_id;
END; $$;

-- ── 4. Trigger: nyahaktif pesakit menamatkan tugasan aktif ───────────────────
CREATE OR REPLACE FUNCTION patients_halt_assignments()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE patient_item_assignments
  SET aktif = false,
      tarikh_tamat_guna = COALESCE(tarikh_tamat_guna, CURRENT_DATE),
      sebab_tamat = COALESCE(sebab_tamat, 'Pesakit dinyahaktifkan'),
      ditamatkan_oleh = COALESCE(ditamatkan_oleh, NEW.dinyahaktif_oleh),
      updated_at = now()
  WHERE patient_id = NEW.id
    AND aktif = true;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_patients_halt_assignments ON public.patients;
CREATE TRIGGER trg_patients_halt_assignments
  AFTER UPDATE OF aktif ON public.patients
  FOR EACH ROW
  WHEN (OLD.aktif IS TRUE AND NEW.aktif IS FALSE)
  EXECUTE FUNCTION patients_halt_assignments();

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- PENGESAHAN SELEPAS MIGRASI (jalankan secara manual):
--   -- 1. Bekalan kepada pesakit nyahaktif ditolak:
--   --    SELECT process_supply_multi('<assignment-aktif-milik-pesakit-nyahaktif>',
--   --      '1x1', '30 hari', '[{"batch_id":"<id>","kuantiti":1}]', '<staf>', null);
--   --    → ERROR: Pesakit tidak aktif
--   -- 2. Tugasan baharu kepada pesakit nyahaktif ditolak:
--   --    SELECT add_assignment_with_dose('<pesakit-nyahaktif>', '<item>', '1x1');
--   --    → ERROR: tidak dibenarkan
--   -- 3. Nyahaktif menamatkan tugasan: selepas UPDATE patients SET aktif=false
--   --    (+ audit, per 040), semua patient_item_assignments pesakit tersebut
--   --    aktif=false dengan sebab_tamat='Pesakit dinyahaktifkan'.
--   -- 4. Aliran normal (pesakit aktif) tidak terjejas — bekal seperti biasa.
-- ============================================================================
