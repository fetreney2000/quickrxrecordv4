-- ============================================================================
-- 064_supply_actor_attribution.sql
--
-- Menutup MEDIUM-4 (audit Dispen Pantas): kakitangan_pembekal,
-- dimulakan_oleh, kakitangan_farmasi_perekod dan dikemaskini_oleh
-- sebelum ini diambil bulat-bulat daripada parameter klien — mana-mana
-- pengguna yang disahkan boleh mengatribusikan bekalan/tugasan/dos kepada
-- staf LAIN, mencemarkan jejak audit.
--
-- Selepas migrasi ini, setiap fungsi menyelesaikan identiti perekod daripada
-- JWT pemanggil (auth.uid()) dan MENGABAIKAN nilai yang dihantar klien
-- apabila JWT wujud. Parameter asal hanya digunakan sebagai sandaran untuk
-- konteks tanpa JWT (SQL editor / service_role), supaya aliran pentadbir
-- sedia ada tidak terjejas.
-- ============================================================================

-- ── 1. process_supply (tunggal + atribusi disahkan) ─────────────────────────
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
  v_perekod UUID;
BEGIN
  PERFORM app_require_role('Pentadbir','Penjaga Stor','Kakitangan Farmasi');

  -- 064: abaikan kakitangan_pembekal dari klien jika JWT wujud.
  v_perekod := COALESCE(auth.uid(), p_kakitangan_pembekal);

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
    p_batch_id, v_perekod, p_catatan_bekalan
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

-- ── 2. process_supply_multi (atomik + atribusi disahkan) ────────────────────
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
  v_perekod UUID;
BEGIN
  PERFORM app_require_role('Pentadbir','Penjaga Stor','Kakitangan Farmasi');

  -- 064: abaikan kakitangan_pembekal dari klien jika JWT wujud.
  v_perekod := COALESCE(auth.uid(), p_kakitangan_pembekal);

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
      v_batch_id, v_perekod, p_catatan_bekalan
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

-- ── 3. add_assignment_with_dose (atribusi disahkan; kekal INVOKER) ───────────
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
  v_dimulakan UUID;
  v_perekod UUID;
BEGIN
  PERFORM app_require_role('Pentadbir','Penjaga Stor','Kakitangan Farmasi');

  -- 064: abaikan identiti dimulakan/perekod dari klien jika JWT wujud.
  v_dimulakan := COALESCE(auth.uid(), p_dimulakan_oleh);
  v_perekod := COALESCE(auth.uid(), p_kakitangan_farmasi_perekod);

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

  -- Semakan kewujudan/aktif item: SELECT biasa (kelihatan melalui sel_active
  -- untuk SEMUA peranan yang disahkan — tidak seperti FOR UPDATE yang
  -- senyap ghaib untuk Farmasi; lihat 058).
  SELECT i.kuota, i.aktif INTO v_kuota, v_item_aktif
  FROM items i
  WHERE i.id = p_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item % tidak dijumpai.', p_item_id;
  END IF;
  IF NOT COALESCE(v_item_aktif, false) THEN
    RAISE EXCEPTION 'Item % tidak aktif — tugasan baharu tidak dibenarkan.', p_item_id;
  END IF;

  -- Pensirian kuota: kunci nasihat transaksi per item (tiada kaitan RLS).
  -- Dua penambahan serentak untuk item sama disisirkan di sini; kiraan
  -- di bawah sentiasa melihat tulisan komit lawan yang mendahului.
  PERFORM pg_advisory_xact_lock(hashtext('add_assignment_item:' || p_item_id::text));

  -- Sahkan semula selepas kunci (tutup jurang TOCTOU tanpa FOR UPDATE).
  SELECT i.aktif INTO v_item_aktif FROM items i WHERE i.id = p_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item % tidak dijumpai.', p_item_id;
  ELSIF NOT COALESCE(v_item_aktif, false) THEN
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

  INSERT INTO patient_item_assignments (
    patient_id, item_id, dos, catatan_penggunaan,
    tarikh_mula_guna, aktif, dimulakan_oleh, kakitangan_farmasi_perekod
  ) VALUES (
    p_patient_id, p_item_id, p_dos, p_catatan_penggunaan,
    CURRENT_DATE, true, v_dimulakan, v_perekod
  ) RETURNING id INTO v_id;

  IF p_dos IS NOT NULL AND p_dos != '' THEN
    INSERT INTO dose_history (assignment_id, tarikh, dos, aktif, catatan, dikemaskini_oleh)
    VALUES (v_id, p_tarikh_dose, p_dos, true, p_dose_catatan, v_dimulakan);
  END IF;

  RETURN v_id;
END;
$$;

-- ── 4. update_dose_with_history (atribusi disahkan) ──────────────────────────
-- Fungsi ini sengaja ringkas (tiada semakan peranan/aktif — RLS + UI
-- mengawalnya); 064 hanya menggantikan identiti penulis yang dipercayai.
CREATE OR REPLACE FUNCTION update_dose_with_history(
  p_assignment_id UUID,
  p_dos TEXT,
  p_catatan TEXT DEFAULT NULL,
  p_dikemaskini_oleh UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_perekod UUID;
BEGIN
  -- 064: abaikan dikemaskini_oleh dari klien jika JWT wujud.
  v_perekod := COALESCE(auth.uid(), p_dikemaskini_oleh);

  UPDATE patient_item_assignments SET dos = p_dos WHERE id = p_assignment_id;
  INSERT INTO dose_history (assignment_id, tarikh, dos, aktif, catatan, dikemaskini_oleh)
  VALUES (p_assignment_id, now(), p_dos, true, p_catatan, v_perekod);
END;
$$;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- PENGESAHAN SELEPAS MIGRASI (jalankan sebagai Kakitangan Farmasi):
--   -- Atribusi dipaksa kepada pemanggil walaupun klien menghantar id lain.
--   -- Tiada perubahan pada logik perniagaan sedia ada (041/058/063 dikekalkan).
-- ============================================================================
