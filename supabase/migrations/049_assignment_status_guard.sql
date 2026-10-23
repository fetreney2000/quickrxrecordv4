-- ============================================================================
-- 049_assignment_status_guard.sql
--
-- Menutup HIGH-1 (audit pemberhentian bekalan): useStopAssignment hanyalah
-- UPDATE klien tanpa pengawal pangkalan data — mana-mana peranan klinikal
-- boleh mengaktifkan semula tugasan yang ditamatkan (membuka bekalan
-- semula tanpa jejak), memberhentikan tanpa sebab, atau menulis ganti
-- sejarah dengan pemberhentian berganda.
--
-- Selepas migrasi ini (cermin 040 untuk pesakit):
--   1. aktif true→false WAJIB disertakan sebab_tamat + tarikh_tamat_guna.
--   2. aktif false→true DITOLAK (tugasan mati tidak boleh dihidupkan semula;
--      daftar tugasan baharu jika rawatan disambung).
--
-- Keserasian disemak: merge (sebab 'Digabungkan…'), trigger 041
-- (sebab 'Pesakit dinyahaktifkan'), dan soft-delete item semuanya menulis
-- kedua-dua lajur; kemas kini dos tidak menyentuh `aktif`.
-- ============================================================================

CREATE OR REPLACE FUNCTION assignments_protect_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Tamatkan: wajib tinggalkan jejak audit.
  IF OLD.aktif IS TRUE AND NEW.aktif IS FALSE THEN
    IF NEW.sebab_tamat IS NULL OR btrim(NEW.sebab_tamat) = ''
       OR NEW.tarikh_tamat_guna IS NULL THEN
      RAISE EXCEPTION
        'Menamatkan tugasan memerlukan sebab_tamat dan tarikh_tamat_guna.';
    END IF;
    RETURN NEW;
  END IF;

  -- Aktif semula: dilarang oleh dasar aplikasi.
  IF OLD.aktif IS FALSE AND NEW.aktif IS TRUE THEN
    RAISE EXCEPTION
      'Tugasan yang ditamatkan tidak boleh diaktifkan semula — daftar tugasan baharu.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assignments_protect_status ON public.patient_item_assignments;
CREATE TRIGGER trg_assignments_protect_status
  BEFORE UPDATE OF aktif, sebab_tamat, tarikh_tamat_guna ON public.patient_item_assignments
  FOR EACH ROW
  EXECUTE FUNCTION assignments_protect_status();

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- PENGESAHAN SELEPAS MIGRASI (jalankan secara manual):
--   -- 1. Henti tanpa sebab ditolak:
--   --    UPDATE patient_item_assignments SET aktif=false WHERE id='<tugasan-aktif>';
--   --    → ERROR: memerlukan sebab_tamat dan tarikh_tamat_guna
--   -- 2. Aktif semula ditolak:
--   --    UPDATE patient_item_assignments SET aktif=true WHERE id='<tugasan-tamat>';
--   --    → ERROR: tidak boleh diaktifkan semula
--   -- 3. Aliran sah (UI henti dengan sebab, merge, nyahaktif pesakit,
--   --    soft-delete item) masih lulus — semuanya menulis kedua-dua lajur.
-- ============================================================================
