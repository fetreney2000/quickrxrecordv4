-- ============================================================================
-- 040_patients_status_guard.sql
--
-- Menutup jurang HIGH-2 (audit nyahaktif pesakit): dasar "tidak boleh
-- diaktifkan semula" sebelum ini hanya dikuatkuasakan di UI, manakala RLS
-- wr_clinical (039) ialah FOR ALL — mana-mana sesi Pentadbir/Penjaga Stor/
-- Farmasi boleh UPDATE patients SET aktif=true secara langsung, malah tanpa
-- menyentuh lajur audit (semuanya nullable, tiada trigger).
--
-- Selepas migrasi ini:
--   1. aktif true→false WAJIB disertakan catatan_nyahaktif + tarikh_nyahaktif
--      (dinyahaktif_oleh kekal nullable — merge 2-arg dan sesi tamat).
--   2. aktif false→true DITOLAK serta-merta (dasar aplikasi).
--   3. merge_patients menulis jejak audit pada rekod sekunder (sebelum ini
--      kosong), supaya tiada jalan nyahaktif tanpa rekod.
--   4. merge_patients menolak primer yang tidak aktif / digabungkan — rekod
--      mati tidak boleh menjadi penerima penggabungan (MEDIUM-3: elak data
--      terdampar dalam pesakit yang tidak boleh menerima bekalan).
--
-- Selamat untuk data sedia ada: trigger hanya menyentuh UPDATE pada lajur
-- status/audit; baris legasi (aktif=false tanpa audit) tidak diubah dan
-- kemas kini lajur lain (nama, telefon, …) tidak terjejas.
-- ============================================================================

-- ── 1. Fungsi pengawal status ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION patients_protect_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Nyahaktif: wajib tinggalkan jejak audit.
  IF OLD.aktif IS TRUE AND NEW.aktif IS FALSE THEN
    IF NEW.catatan_nyahaktif IS NULL OR NEW.tarikh_nyahaktif IS NULL THEN
      RAISE EXCEPTION
        'Nyahaktif pesakit memerlukan catatan_nyahaktif dan tarikh_nyahaktif.';
    END IF;
    RETURN NEW;
  END IF;

  -- Aktif semula: dilarang oleh dasar aplikasi.
  IF OLD.aktif IS FALSE AND NEW.aktif IS TRUE THEN
    RAISE EXCEPTION
      'Pesakit yang dinyahaktifkan tidak boleh diaktifkan semula.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_patients_protect_status ON public.patients;
CREATE TRIGGER trg_patients_protect_status
  BEFORE UPDATE OF aktif, catatan_nyahaktif, tarikh_nyahaktif ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION patients_protect_status();

-- ── 2. merge_patients: tulis jejak audit pada sekunder ─────────────────────
-- (Salinan 039 6k + guard dikekalkan; satu-satunya perubahan ialah SET
-- tambahan di bawah. COALESCE mengekalkan jejak asal jika sekunder sudah
-- dinyahaktifkan sebelum digabungkan.)
CREATE OR REPLACE FUNCTION merge_patients(
  p_primary_id UUID,
  p_secondary_ids UUID[],
  p_merge_date DATE DEFAULT CURRENT_DATE,
  p_merged_by UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secondary_id UUID;
  v_duplicate_assignment RECORD;
  v_primary_assignment_id UUID;
BEGIN
  PERFORM app_require_role('Pentadbir','Penjaga Stor','Kakitangan Farmasi');

  IF p_primary_id IS NULL THEN
    RAISE EXCEPTION 'Primary patient ID cannot be null';
  END IF;
  IF p_secondary_ids IS NULL OR cardinality(p_secondary_ids) = 0 THEN
    RAISE EXCEPTION 'Secondary IDs cannot be null or empty';
  END IF;
  -- LOW-4: had saiz kelompok — setiap sekunder memanjangkan transaksi yang
  -- memegang kunci baris pesakit/tugasan (menyekat bekalan serentak).
  IF cardinality(p_secondary_ids) > 10 THEN
    RAISE EXCEPTION 'Too many secondary patients (maximum 10 per merge)';
  END IF;
  -- MEDIUM-3: primer mestilah hidup dan belum digabungkan. Rekod yang
  -- dinyahaktifkan tidak boleh menerima penggabungan — tugasan yang
  -- dipindahkan ke dalamnya akan terdampar (tidak boleh dibekalkan, kerana
  -- 041 menolak bekalan kepada pesakit tidak aktif).
  IF NOT EXISTS (
    SELECT 1 FROM patients
    WHERE id = p_primary_id AND merged_into IS NULL AND aktif = true
  ) THEN
    RAISE EXCEPTION 'Primary patient % not found, inactive, or already merged', p_primary_id;
  END IF;

  PERFORM 1 FROM patients WHERE id = p_primary_id FOR UPDATE;

  FOREACH v_secondary_id IN ARRAY p_secondary_ids LOOP
    IF v_secondary_id IS NULL OR v_secondary_id = p_primary_id THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM patients
      WHERE id = v_secondary_id AND merged_into IS NULL
    ) THEN
      RAISE EXCEPTION 'Secondary patient % not found or already merged', v_secondary_id;
    END IF;

    PERFORM 1 FROM patients WHERE id = v_secondary_id FOR UPDATE;

    FOR v_duplicate_assignment IN
      SELECT *
      FROM patient_item_assignments
      WHERE patient_id = v_secondary_id
      ORDER BY created_at, id
      FOR UPDATE
    LOOP
      SELECT id INTO v_primary_assignment_id
      FROM patient_item_assignments
      WHERE patient_id = p_primary_id
        AND item_id = v_duplicate_assignment.item_id
        AND aktif = true
      ORDER BY created_at, id
      LIMIT 1
      FOR UPDATE;

      IF v_primary_assignment_id IS NOT NULL THEN
        UPDATE dose_history
        SET assignment_id = v_primary_assignment_id
        WHERE assignment_id = v_duplicate_assignment.id;

        UPDATE supply_records
        SET assignment_id = v_primary_assignment_id
        WHERE assignment_id = v_duplicate_assignment.id;

        -- LOW-5 (audit gabungan): rekod penolakan mengikut sejarah ke
        -- tugasan utama yang hidup — selari dengan dose_history dan
        -- supply_records di atas. (Cawangan ELSE tidak perlu: assignment_id
        -- kekal sama, jadi penolakan mengikut secara automatik.)
        UPDATE supply_declinations
        SET assignment_id = v_primary_assignment_id
        WHERE assignment_id = v_duplicate_assignment.id;

        UPDATE patient_item_assignments
        SET aktif = false,
            tarikh_tamat_guna = COALESCE(p_merge_date, CURRENT_DATE),
            sebab_tamat = 'Digabungkan ke pesakit lain',
            ditamatkan_oleh = p_merged_by
        WHERE id = v_duplicate_assignment.id;
      ELSE
        UPDATE patient_item_assignments
        SET patient_id = p_primary_id
        WHERE id = v_duplicate_assignment.id;
      END IF;
    END LOOP;

    UPDATE patients
    SET merged_into = p_primary_id,
        aktif = false,
        catatan_nyahaktif = COALESCE(
          catatan_nyahaktif, 'Digabungkan ke pesakit lain'),
        tarikh_nyahaktif = COALESCE(
          tarikh_nyahaktif, COALESCE(p_merge_date, CURRENT_DATE)),
        dinyahaktif_oleh = COALESCE(dinyahaktif_oleh, p_merged_by),
        updated_at = now()
    WHERE id = v_secondary_id;
  END LOOP;

  -- LOW-5 (audit gabungan): sentuh cap masa primer supaya penyatuan
  -- terserlah dalam susunan senarai dan jelas baru berlaku.
  UPDATE patients SET updated_at = now() WHERE id = p_primary_id;
END;
$$;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- PENGESAHAN SELEPAS MIGRASI (jalankan secara manual):
--   -- 1. Nyahaktif tanpa sebab ditolak:
--   --    UPDATE patients SET aktif=false WHERE id='<uuid-aktif>';
--   --    → ERROR: memerlukan catatan_nyahaktif dan tarikh_nyahaktif
--   -- 2. Aktif semula ditolak:
--   --    UPDATE patients SET aktif=true WHERE id='<uuid-tidak-aktif>';
--   --    → ERROR: tidak boleh diaktifkan semula
--   -- 3. Nyahaktif sah (aplikasi) masih lulus — UI menghantar ketiga-tiga
--   --    lajur (lihat useDeactivatePatient).
--   -- 4. Merge masih lulus — sekunder menerima jejak 'Digabungkan…'.
--   -- 5. Primer tidak aktif ditolak:
--   --    SELECT merge_patients('<uuid-nyahaktif>', ARRAY['<uuid-lain>'], CURRENT_DATE, NULL);
--   --    → ERROR: not found, inactive, or already merged
-- ============================================================================
