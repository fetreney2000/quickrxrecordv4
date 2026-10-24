-- ============================================================================
-- 058_assignment_advisory_lock.sql
--
-- Pepijat kritikal (Farmasi tidak boleh menambah tugasan — "Item tidak
-- dijumpai" walaupun item wujud dan aktif):
--
-- add_assignment_with_dose ialah SECURITY INVOKER, jadi RLS terpakai.
-- Semakan item menggunakan SELECT ... FOR UPDATE. Di bawah RLS, baris yang
-- dikunci mesti melalui polisi UPDATE/ALL yang berkenaan — dan satu-satunya
-- polisi sedemikian ke atas items ialah wr_inventory (Pentadbir + Stor
-- sahaja). Akibatnya baris item GHAIB untuk Kakitangan Farmasi tepat pada
-- semakan tersebut (NOT FOUND palsu), manakala semakan pesakit sebelumnya
-- lulus kerana wr_clinical merangkumi ketiga-tiga peranan. Pentadbir/Stor
-- tidak pernah terjejas — pepijat ini khusus peranan.
--
-- Pembaikan: semakan kewujudan/aktif kekal SELECT biasa (kelihatan melalui
-- sel_active untuk semua sesi sah), manakala pensirian anti-perlumbaan
-- kuota beralih ke kunci nasihat transaksi (pg_advisory_xact_lock) — tidak
-- menyentuh RLS atau keistimewaan jadual langsung. Kunci diambil SEBELUM
-- kiraan kuota dalam susunan yang sama setiap panggilan (nasihat item
-- tunggal; kunci pesakit kekal FOR UPDATE kerana wr_clinical melindunginya
-- untuk semua peranan yang dibenarkan).
-- ============================================================================

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

  -- Semakan kewujudan/aktif item: SELECT biasa (kelihatan melalui sel_active
  -- untuk SEMUA peranan yang disahkan — tidak seperti FOR UPDATE yang
  -- memerlukan polisi UPDATE/ALL dan senyap ghaib untuk Farmasi).
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
  -- di bawah sentiasa melihat tulisan komited lawan yang mendahului.
  PERFORM pg_advisory_xact_lock(hashtext('add_assignment_item:' || p_item_id::text));

  -- Sahkan semula selepas kunci (tutup jurang TOCTOU tanpa FOR UPDATE —
  -- kemas kini item tidak mengambil kunci nasihat yang sama).
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
    CURRENT_DATE, true, p_dimulakan_oleh, p_kakitangan_farmasi_perekod
  ) RETURNING id INTO v_id;

  IF p_dos IS NOT NULL AND p_dos != '' THEN
    INSERT INTO dose_history (assignment_id, tarikh, dos, aktif, catatan, dikemaskini_oleh)
    VALUES (v_id, p_tarikh_dose, p_dos, true, p_dose_catatan, p_dimulakan_oleh);
  END IF;

  RETURN v_id;
END;
$$;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- PENGESAHAN SELEPAS MIGRASI (jalankan sebagai Farmasi — peranan yang terjejas):
--   -- Sebelum ini gagal dengan "Item ... tidak dijumpai":
--   -- SELECT add_assignment_with_dose('<pesakit-aktif>', '<item-aktif-tanpa-kuota-penuh>', '1x1');
--   --    → mengembalikan UUID tugasan baharu (padam baris ujian selepas itu
--   --      melalui UI/selepas pengesahan, atau gunakan pesakit ujian).
-- ============================================================================
