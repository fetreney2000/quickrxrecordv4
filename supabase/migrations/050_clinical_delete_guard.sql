-- ============================================================================
-- 050_clinical_delete_guard.sql
--
-- Menutup HIGH-1 (audit pendaftaran): wr_clinical ialah FOR ALL ke atas
-- lima jadual klinikal — sebarang sesi Pentadbir/Penjaga Stor/Farmasi boleh
-- DELETE rekod pesakit (atau tugasan/bekalan/dos) melalui API langsung,
-- dan CASCADE (001:131,155,176) memadam seluruh sejarah klinikal tanpa
-- jejak. Tiada aliran UI yang memadam baris ini (nyahaktif / batal /
-- tamat digunakan sebagai ganti).
--
-- Selepas migrasi ini: SELECT/INSERT/UPDATE kekal untuk ketiga-tiga peranan
-- klinikal; DELETE dikhaskan untuk Pentadbir (termasuk supply_declinations
-- yang dipecahkan dalam 048 — diselaraskan semula di sini supaya takrifan
-- seragam). Pemadaman CASCADE (FK) tidak terjejas — ia berjalan di luar RLS.
-- ============================================================================

DO $$
DECLARE
  tables TEXT[] := ARRAY[
    'patients','patient_item_assignments','supply_records','dose_history',
    'supply_declinations'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- NOTA: satu polisi = satu arahan (FOR SELECT / INSERT / UPDATE /
    -- DELETE tidak boleh digabung — ralat 42601).
    EXECUTE format('DROP POLICY IF EXISTS "wr_clinical" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "wr_clinical_no_delete" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "wr_clinical_no_delete_select" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "wr_clinical_no_delete_insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "wr_clinical_no_delete_update" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "del_admin_only" ON public.%I', t);
    EXECUTE format($p$
      CREATE POLICY "wr_clinical_no_delete_select" ON public.%I
      FOR SELECT TO authenticated
      USING ((SELECT app_role()) IN ('Pentadbir','Penjaga Stor','Kakitangan Farmasi'))$p$,
      t);
    EXECUTE format($p$
      CREATE POLICY "wr_clinical_no_delete_insert" ON public.%I
      FOR INSERT TO authenticated
      WITH CHECK ((SELECT app_role()) IN ('Pentadbir','Penjaga Stor','Kakitangan Farmasi'))$p$,
      t);
    EXECUTE format($p$
      CREATE POLICY "wr_clinical_no_delete_update" ON public.%I
      FOR UPDATE TO authenticated
      USING ((SELECT app_role()) IN ('Pentadbir','Penjaga Stor','Kakitangan Farmasi'))
      WITH CHECK ((SELECT app_role()) IN ('Pentadbir','Penjaga Stor','Kakitangan Farmasi'))$p$,
      t);
    EXECUTE format($p$
      CREATE POLICY "del_admin_only" ON public.%I
      FOR DELETE TO authenticated
      USING ((SELECT app_role()) = 'Pentadbir')$p$,
      t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- PENGESAHAN SELEPAS MIGRASI (jalankan secara manual):
--   -- Sebagai Kakitangan Farmasi (sbToken): DELETE FROM dose_history … LIMIT 1
--   --    → 42501. Sebagai Pentadbir → berjaya (atau 0 baris jika tiada).
--   -- Aliran aplikasi tidak terjejas: tiada UI yang memadam baris klinikal
--   -- (nyahaktif / batal / tamat / luput digunakan sebagai ganti).
-- ============================================================================
