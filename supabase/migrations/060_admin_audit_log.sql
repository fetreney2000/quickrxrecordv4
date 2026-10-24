-- ============================================================================
-- 060_admin_audit_log.sql
--
-- Menutup MEDIUM-3 (audit pengguna): siapa mencipta / mengemas kini /
-- menyahaktif / menurunkan / menetapkan semula kata laluan siapa, sebelum
-- ini tidak direkodkan di mana-mana (profiles tiada lajur pelaku).
--
-- Jadual append-only: Pentadbir boleh BACA + SISIP sahaja; tiada UPDATE /
-- DELETE untuk mana-mana peranan klien (service_role kekal untuk
-- penyelenggaraan). Laluan pelayan (/api/create-user, /api/reset-password)
-- menulis sendiri melalui service_role (tidak boleh dipintas klien);
-- mutasi langsung klien (kemas kini, tukar status, selesai permintaan)
-- menulis sendiri dengan actor = sesi semasa.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  details JSONB NULL
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_audit_log FROM anon, PUBLIC, authenticated;
GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

DROP POLICY IF EXISTS "admin_audit_read" ON public.admin_audit_log;
CREATE POLICY "admin_audit_read" ON public.admin_audit_log
  FOR SELECT TO authenticated
  USING ((SELECT app_role()) = 'Pentadbir');

DROP POLICY IF EXISTS "admin_audit_write" ON public.admin_audit_log;
CREATE POLICY "admin_audit_write" ON public.admin_audit_log
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT app_role()) = 'Pentadbir');

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- PENGESAHAN SELEPAS MIGRASI:
--   -- Sebagai Pentadbir: SELECT/INSERT lulus; UPDATE/DELETE → 42501.
--   -- Sebagai Farmasi: SELECT/INSERT → 42501.
-- ============================================================================
