-- ============================================================================
-- 048_declination_delete_guard.sql
--
-- Menutup LOW-5 (audit bekalan): useDeleteDeclination memadam fakta klinikal
-- ("pesakit menolak X pada tarikh Y") secara kekal, tanpa sebab, dan boleh
-- dilakukan oleh mana-mana peranan klinikal terhadap rekod sesiapa sahaja
-- (wr_clinical FOR ALL — 039 §5).
--
-- Selepas migrasi ini: SELECT/INSERT/UPDATE kekal untuk ketiga-tiga peranan
-- klinikal; DELETE dikhaskan untuk Pentadbir sahaja. Pemadaman cascade
-- (FK) tidak terjejas — ia berjalan di luar RLS.
-- ============================================================================

-- NOTA: satu polisi = satu arahan (FOR SELECT / INSERT / UPDATE / DELETE
-- tidak boleh digabung — ralat 42601 sebelum ini berpunca di sini).
-- Semua DROP memakai IF EXISTS supaya fail selamat dijalankan semula
-- selepas larian separuh (DROP yang berjaya + CREATE yang gagal).
DROP POLICY IF EXISTS "wr_clinical" ON public.supply_declinations;
DROP POLICY IF EXISTS "wr_clinical_no_delete" ON public.supply_declinations;
DROP POLICY IF EXISTS "wr_clinical_no_delete_select" ON public.supply_declinations;
DROP POLICY IF EXISTS "wr_clinical_no_delete_insert" ON public.supply_declinations;
DROP POLICY IF EXISTS "wr_clinical_no_delete_update" ON public.supply_declinations;
DROP POLICY IF EXISTS "del_admin_only" ON public.supply_declinations;

CREATE POLICY "wr_clinical_no_delete_select" ON public.supply_declinations
  FOR SELECT TO authenticated
  USING ((SELECT app_role()) IN ('Pentadbir','Penjaga Stor','Kakitangan Farmasi'));

CREATE POLICY "wr_clinical_no_delete_insert" ON public.supply_declinations
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT app_role()) IN ('Pentadbir','Penjaga Stor','Kakitangan Farmasi'));

CREATE POLICY "wr_clinical_no_delete_update" ON public.supply_declinations
  FOR UPDATE TO authenticated
  USING ((SELECT app_role()) IN ('Pentadbir','Penjaga Stor','Kakitangan Farmasi'))
  WITH CHECK ((SELECT app_role()) IN ('Pentadbir','Penjaga Stor','Kakitangan Farmasi'));

CREATE POLICY "del_admin_only" ON public.supply_declinations
  FOR DELETE TO authenticated
  USING ((SELECT app_role()) = 'Pentadbir');

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- PENGESAHAN SELEPAS MIGRASI (jalankan secara manual):
--   -- Sebagai Kakitangan Farmasi (sbToken): DELETE FROM supply_declinations …
--   --    → 42501. Sebagai Pentadbir → berjaya.
-- ============================================================================
