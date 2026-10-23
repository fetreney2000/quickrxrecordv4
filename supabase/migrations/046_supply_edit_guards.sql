-- ============================================================================
-- 046_supply_edit_guards.sql
--
-- Menutup HIGH-1 (audit bekalan): update_supply menerima sebarang p_kuantiti.
-- Nilai negatif mencipta stok daripada tiada — cth. rekod 30 unit disunting
-- kepada -5 menghasilkan v_diff = -35, jadi kelompok BERTAMBAH 35 unit
-- dengan jurnal 'masuk'. Dialog mengehadkan minima 1 di klien, tetapi
-- pelayan tidak boleh mempercayainya.
--
-- Selepas migrasi ini:
--   1. update_supply menolak p_kuantiti < 1. Penyuntingan kepada sifar bukan
--      kes yang sah — gunakan pembatalan (reverse_supply).
--   2. update_supply DAN reverse_supply menolak kelompok yang telah
--      dilupuskan — tanpa ini, pengurangan kuantiti atau pembatalan
--      membangkitkan semula stok senyap di dalam kelompok lupus (tidak
--      kelihatan dalam jumlah, tetapi mengembungkan baki lejar).
--   3. update_dose_with_history menolak tugasan/pesakit tidak aktif —
--      tiada fakta klinikal baharu pada rekod mati (selari dengan HIGH-1;
--      pembetulan/pembatalan kekal dibenarkan).
-- (Salinan 039 6c/6d/6f + pengawal; logik lain tidak berubah.)
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
  PERFORM app_require_role('Pentadbir','Penjaga Stor','Kakitangan Farmasi');

  -- HIGH-1: kuantiti mestilah positif. Tanpa ini, nilai negatif menterbalikkan
  -- arah pelarasan dan MENCIPTA stok (batch += |v_diff| dengan jurnal 'masuk').
  IF p_kuantiti IS NULL OR p_kuantiti < 1 THEN
    RAISE EXCEPTION 'Kuantiti mestilah sekurang-kurangnya 1 (gunakan pembatalan untuk membuang rekod).';
  END IF;

  SELECT sr.*, pia.item_id INTO v_supply
  FROM supply_records sr
  JOIN patient_item_assignments pia ON pia.id = sr.assignment_id
  WHERE sr.id = p_supply_id AND sr.voided_at IS NULL;

  IF v_supply IS NULL THEN
    RAISE EXCEPTION 'Rekod bekalan % tidak dijumpai atau telah dibatalkan.', p_supply_id;
  END IF;

  v_item_id := v_supply.item_id;
  v_diff := p_kuantiti - v_supply.kuantiti;

  IF v_diff = 0 THEN
    UPDATE supply_records
    SET dos = p_dos,
        tempoh_dibekal = p_tempoh_dibekal,
        catatan_bekalan = p_catatan_bekalan
    WHERE id = p_supply_id;
    RETURN;
  END IF;

  PERFORM 1 FROM items WHERE id = v_item_id FOR UPDATE;
  -- MEDIUM-2: jangan sentuh kelompok lupus — penambahan gagal kuat melalui
  -- CHECK, tetapi pengurangan/pembatalan akan membangkitkan stok senyap.
  PERFORM 1 FROM item_batches
  WHERE id = v_supply.batch_id AND dilupuskan = false FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kelompok tidak dijumpai atau telah dilupuskan — rekod bekalan ini tidak boleh diubah.';
  END IF;

  IF v_diff > 0 THEN
    IF (SELECT kuantiti FROM item_batches WHERE id = v_supply.batch_id) < v_diff THEN
      RAISE EXCEPTION 'Stok tidak mencukupi untuk menambah % unit.', v_diff;
    END IF;
  END IF;

  UPDATE item_batches
  SET kuantiti = kuantiti - v_diff, updated_at = now()
  WHERE id = v_supply.batch_id;

  SELECT COALESCE(SUM(kuantiti), 0)::INTEGER INTO v_baki
  FROM item_batches WHERE item_id = v_item_id;

  INSERT INTO inventory_transactions (
    item_id, batch_id, jenis, kuantiti, rujukan_id, rujukan_type, catatan, baki
  ) VALUES (
    v_item_id, v_supply.batch_id,
    CASE WHEN v_diff < 0 THEN 'masuk' ELSE 'keluar' END,
    ABS(v_diff),
    p_supply_id, 'supply_adjustment',
    COALESCE(p_catatan_bekalan, 'Pelarasan kuantiti bekalan'),
    v_baki
  );

  UPDATE supply_records
  SET dos = p_dos,
      kuantiti = p_kuantiti,
      tempoh_dibekal = p_tempoh_dibekal,
      catatan_bekalan = p_catatan_bekalan
  WHERE id = p_supply_id;
END;
$$;

-- ── reverse_supply (039 6d + pengawal kelompok lupus) ────────────────────────
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
  PERFORM app_require_role('Pentadbir','Penjaga Stor','Kakitangan Farmasi');

  SELECT sr.*, pia.item_id INTO v_supply
  FROM supply_records sr
  JOIN patient_item_assignments pia ON pia.id = sr.assignment_id
  WHERE sr.id = p_supply_id AND sr.voided_at IS NULL;

  IF v_supply IS NULL THEN
    RAISE EXCEPTION 'Rekod bekalan % tidak dijumpai atau telah dibatalkan.', p_supply_id;
  END IF;

  v_item_id := v_supply.item_id;

  PERFORM 1 FROM items WHERE id = v_item_id FOR UPDATE;

  -- MEDIUM-2: pemulangan stok ke kelompok lupus akan terperangkap (tidak
  -- kelihatan dalam jumlah fizikal, tetapi mengembungkan baki lejar).
  -- Batalkan pelupusan dahulu, atau lupuskan baki melalui aliran yang betul.
  PERFORM 1 FROM item_batches
  WHERE id = v_supply.batch_id AND dilupuskan = false FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kelompok telah dilupuskan — pembatalan akan memerangkap stok. Batalkan pelupusan dahulu atau hubungi pentadbir.';
  END IF;

  UPDATE item_batches
  SET kuantiti = kuantiti + v_supply.kuantiti, updated_at = now()
  WHERE id = v_supply.batch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kelompok % tidak dijumpai.', v_supply.batch_id;
  END IF;

  SELECT COALESCE(SUM(kuantiti), 0)::INTEGER INTO v_baki
  FROM item_batches WHERE item_id = v_item_id;

  INSERT INTO inventory_transactions (
    item_id, batch_id, jenis, kuantiti, rujukan_id, rujukan_type, catatan, baki
  ) VALUES (
    v_item_id, v_supply.batch_id, 'masuk', v_supply.kuantiti,
    p_supply_id, 'supply_reversal',
    COALESCE(p_catatan, 'Pembatalan bekalan'),
    v_baki
  );

  UPDATE supply_records SET voided_at = now() WHERE id = p_supply_id;
END;
$$;

-- ── update_dose_with_history (039 6f + pengawal tugasan/pesakit) ─────────────
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
  v_assign_aktif BOOLEAN;
  v_patient_aktif BOOLEAN;
  v_merged_into UUID;
BEGIN
  PERFORM app_require_role('Pentadbir','Penjaga Stor','Kakitangan Farmasi');

  -- LOW-6: tugasan mati tidak menerima fakta dos baharu. (Koreksi dos pada
  -- rekod sejarah tidak terjejas — ia tidak melalui fungsi ini.)
  SELECT pia.aktif, p.aktif, p.merged_into
    INTO v_assign_aktif, v_patient_aktif, v_merged_into
  FROM patient_item_assignments pia
  JOIN patients p ON p.id = pia.patient_id
  WHERE pia.id = p_assignment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tugasan % tidak dijumpai.', p_assignment_id;
  END IF;
  IF NOT COALESCE(v_assign_aktif, false)
     OR NOT COALESCE(v_patient_aktif, false)
     OR v_merged_into IS NOT NULL THEN
    RAISE EXCEPTION 'Tugasan tidak aktif — kemas kini dos tidak dibenarkan.';
  END IF;

  UPDATE patient_item_assignments SET dos = p_dos WHERE id = p_assignment_id;
  INSERT INTO dose_history (assignment_id, tarikh, dos, aktif, catatan, dikemaskini_oleh)
  VALUES (p_assignment_id, now(), p_dos, true, p_catatan, p_dikemaskini_oleh);
END; $$;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- PENGESAHAN SELEPAS MIGRASI (jalankan secara manual):
--   -- Kuantiti negatif/sifar ditolak (tiada perubahan stok):
--   --    SELECT update_supply('<id-bekalan-sah>', '1x1', -5, '30 Hari', null);
--   --    → ERROR: sekurang-kurangnya 1
--   --    SELECT update_supply('<id-bekalan-sah>', '1x1', 0, '30 Hari', null);
--   --    → ERROR: sekurang-kurangnya 1
--   -- Suntingan/pembatalan ke atas kelompok lupus ditolak:
--   --    SELECT update_supply('<id-bekalan-kelompok-lupus>', '1x1', 5, '30 Hari', null);
--   --    → ERROR: tidak boleh diubah
--   --    SELECT reverse_supply('<id-bekalan-kelompok-lupus>', null);
--   --    → ERROR: telah dilupuskan
-- ============================================================================
