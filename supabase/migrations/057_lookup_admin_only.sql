-- ============================================================================
-- 057_lookup_admin_only.sql
--
-- Dasar capaian (arahan produk): jadual rujukan (kategori/bentuk/durasi)
-- diurus melalui tab Rujukan di /pengurusan — Pentadbir sahaja. Penjaga
-- Stor dibenarkan SEMUA kecuali Pengurusan, jadi tulisannya mesti ditarik;
-- baca kekal untuk semua (dropdown di seluruh aplikasi).
--
-- Keadaan sebelum: ketiga-tiga jadual berada dalam wr_inventory (039 §5),
-- iaitu Stor boleh INSERT/UPDATE/DELETE melalui API langsung walaupun UI
-- Pengurusan disembunyikan. Farmasi tidak pernah boleh (tiada dalam
-- wr_inventory) — tidak berubah.
--
-- Selepas migrasi ini:
--   wr_inventory  → items, item_batches, batch_adjustments,
--                   batch_additions, inventory_transactions (Stor kekal)
--   sel_active    → kekal (baca untuk semua sesi sah)
--   Pentadbir sahaja: INSERT / UPDATE / DELETE ke atas ketiga-tiga jadual
--   rujukan (satu polisi setiap arahan — polisi FOR tidak boleh digabung).
--   staff_migration_lookup tidak disentuh (baca-sahaja sedia ada).
-- ============================================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  -- 1. Bina semula wr_inventory TANPA jadual rujukan.
  FOREACH t IN ARRAY ARRAY[
    'items','item_batches','batch_adjustments','batch_additions',
    'inventory_transactions'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "wr_inventory" ON public.%I', t);
    EXECUTE format($p$
      CREATE POLICY "wr_inventory" ON public.%I FOR ALL TO authenticated
      USING ((SELECT app_role()) IN ('Pentadbir','Penjaga Stor'))
      WITH CHECK ((SELECT app_role()) IN ('Pentadbir','Penjaga Stor'))$p$,
      t);
  END LOOP;

  -- 2. Tulis jadual rujukan: Pentadbir sahaja (satu polisi setiap arahan).
  FOREACH t IN ARRAY ARRAY['item_categories','item_forms','supply_durations'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "wr_inventory" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "wr_lookup_admin_ins" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "wr_lookup_admin_upd" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "wr_lookup_admin_del" ON public.%I', t);
    EXECUTE format($p$
      CREATE POLICY "wr_lookup_admin_ins" ON public.%I FOR INSERT TO authenticated
      WITH CHECK ((SELECT app_role()) = 'Pentadbir')$p$,
      t);
    EXECUTE format($p$
      CREATE POLICY "wr_lookup_admin_upd" ON public.%I FOR UPDATE TO authenticated
      USING ((SELECT app_role()) = 'Pentadbir')
      WITH CHECK ((SELECT app_role()) = 'Pentadbir')$p$,
      t);
    EXECUTE format($p$
      CREATE POLICY "wr_lookup_admin_del" ON public.%I FOR DELETE TO authenticated
      USING ((SELECT app_role()) = 'Pentadbir')$p$,
      t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- PENGESAHAN SELEPAS MIGRASI (jalankan secara manual):
--   -- Sebagai Penjaga Stor (sbToken): INSERT INTO item_categories (nama)
--   -- VALUES ('Ujian'); → 42501. Sebagai Pentadbir → berjaya (padam semula).
--   -- Stok/batch/pelarasan oleh Stor tidak terjejas (masih dalam wr_inventory).
-- ============================================================================
