-- ============================================================================
-- 038_reenable_rls.sql
-- Aktifkan semula RLS + tutup akses anon pada semua jadual/fungsi
--
-- SEBAB (audit keselamatan):
--   001 memberikan GRANT ALL ... TO anon dan 005 menyahaktifkan RLS, jadi
--   sesiapa yang memegang anon key (dibina ke dalam bundle pelanggan) boleh
--   membaca/menulis SELURUH pangkalan data tanpa log masuk — termasuk PHI
--   pesakit dan hash kata laluan.
--
-- STRATEGI:
--   - Anon: revoked sepenuhnya (schema, jadual, sekuens, fungsi)
--   - Authenticated: dikekalkan akses penuh (policies USING (true)) supaya
--     tingkah laku aplikasi untuk pengguna log masuk tidak berubah
--   - Klien menghantar JWT tersuai (ditandatangani dengan SUPABASE_JWT_SECRET
--     oleh /api/login) supaya PostgREST menetapkan peranan "authenticated"
--   - service_role (server functions) bypass RLS — tidak terjejas
--   - update_password_hash + backfill_inventory_ledger: tiada pemanggil
--     pelanggan (grep disahkan) — authenticated turut ditarik balik
--
-- JALAN PELANCARAN (penting):
--   1. Deploy kod dahulu (login mula mengeluarkan sbToken) — RLS masih mati,
--      tiada gangguan
--   2. Jalankan migrasi ini dalam SQL Editor
--   3. Semak senarai pengesahan dalam rancangan
-- ============================================================================

-- ── 1. Tarik balik anon: schema ─────────────────────────────────────────────
REVOKE USAGE ON SCHEMA public FROM anon;

-- ── 2. Tarik balik anon: jadual + sekuens ───────────────────────────────────
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- ── 3. Tarik balik anon + PUBLIC: fungsi (execute) ──────────────────────────
--   REVOKE daripada PUBLIC juga: fungsi mempunyai EXECUTE default kepada PUBLIC,
--   jadi tarik balik anon sahaja tidak mencukupi.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- ── 4. Kekalkan akses authenticated (pelanggan log masuk) ───────────────────
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ── 5. Kekalkan akses service_role (api/*.ts serverless) ────────────────────
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ── 6. Fungsi berisiko: authenticated juga ditarik balik ────────────────────
--   Tiada pemanggil pelanggan (disahkan oleh grep); laluan pentadbir
--   mengemas kini profiles secara langsung melalui service_role.
REVOKE EXECUTE ON FUNCTION update_password_hash(UUID, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION backfill_inventory_ledger() FROM authenticated;

-- ── 7. Default privileges: jadual/fungsi baharu tidak membuka anon semula ───
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- ── 8. Aktifkan RLS + policy authenticated pada semua jadual awam ───────────
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_all" ON public.%I', t.tablename);
    EXECUTE format(
      'CREATE POLICY "authenticated_all" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t.tablename
    );
  END LOOP;
END $$;

-- ── 9. Policy untuk authenticated pada fungsi RPC (tiada; fungsi tidak RLS) ─
--   Dibiarkan kosong — EXECUTE grant sahaja mengawal akses fungsi.

-- ── 10. Pengesahan selepas migrasi (jalankan secara manual) ─────────────────
--   -- anon mesti GAGAL:
--   SET ROLE anon; SELECT count(*) FROM patients; RESET ROLE;
--   -- authenticated mesti BERJAYA:
--   SET ROLE authenticated; SELECT count(*) FROM patients; RESET ROLE;

-- Tamat 038_reenable_rls.sql
