-- ============================================================================
-- 005_disable_rls.sql
-- Nyahaktifkan Row Level Security pada semua jadual
-- Tarikh: 26 Julai 2026
--
-- SEBAB:
--   Sistem bertukar kepada pengesahan tersuai (kata_laluan_hash dalam
--   profiles). auth.uid() / auth.role() tidak lagi relevan, jadi RLS
--   yang bergantung padanya akan menyekat semua akses.
--   Pengesahan kini dikendalikan sepenuhnya di peringkat aplikasi.
-- ============================================================================

-- Profiles
DROP POLICY IF EXISTS "users_view_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
DROP POLICY IF EXISTS "admins_view_all_profiles" ON profiles;
DROP POLICY IF EXISTS "admins_manage_profiles" ON profiles;
DROP POLICY IF EXISTS "service_manage_profiles" ON profiles;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Items
DROP POLICY IF EXISTS "all_view_items" ON items;
DROP POLICY IF EXISTS "admins_manage_items" ON items;
DROP POLICY IF EXISTS "storekeepers_manage_items" ON items;
DROP POLICY IF EXISTS "service_manage_items" ON items;
ALTER TABLE items DISABLE ROW LEVEL SECURITY;

-- Item batches
DROP POLICY IF EXISTS "all_view_batches" ON item_batches;
DROP POLICY IF EXISTS "admins_manage_batches" ON item_batches;
DROP POLICY IF EXISTS "storekeepers_manage_batches" ON item_batches;
DROP POLICY IF EXISTS "service_manage_batches" ON item_batches;
ALTER TABLE item_batches DISABLE ROW LEVEL SECURITY;

-- Patients
DROP POLICY IF EXISTS "all_view_patients" ON patients;
DROP POLICY IF EXISTS "staff_manage_patients" ON patients;
DROP POLICY IF EXISTS "service_manage_patients" ON patients;
ALTER TABLE patients DISABLE ROW LEVEL SECURITY;

-- Patient item assignments
DROP POLICY IF EXISTS "all_view_assignments" ON patient_item_assignments;
DROP POLICY IF EXISTS "staff_manage_assignments" ON patient_item_assignments;
DROP POLICY IF EXISTS "service_manage_assignments" ON patient_item_assignments;
ALTER TABLE patient_item_assignments DISABLE ROW LEVEL SECURITY;

-- Supply records
DROP POLICY IF EXISTS "all_view_supply" ON supply_records;
DROP POLICY IF EXISTS "staff_manage_supply" ON supply_records;
DROP POLICY IF EXISTS "service_manage_supply" ON supply_records;
ALTER TABLE supply_records DISABLE ROW LEVEL SECURITY;

-- Dose history
DROP POLICY IF EXISTS "all_view_dose_history" ON dose_history;
DROP POLICY IF EXISTS "staff_manage_dose_history" ON dose_history;
DROP POLICY IF EXISTS "service_manage_dose_history" ON dose_history;
ALTER TABLE dose_history DISABLE ROW LEVEL SECURITY;

-- Password reset requests
DROP POLICY IF EXISTS "users_view_own_reset" ON password_reset_requests;
DROP POLICY IF EXISTS "users_create_reset" ON password_reset_requests;
DROP POLICY IF EXISTS "admins_manage_reset" ON password_reset_requests;
DROP POLICY IF EXISTS "service_manage_reset" ON password_reset_requests;
ALTER TABLE password_reset_requests DISABLE ROW LEVEL SECURITY;

-- Notifications (rujukan sahaja — jadual mungkin tidak wujud)
DO $$ BEGIN
  DROP POLICY IF EXISTS "users_view_notifications" ON notifications;
  DROP POLICY IF EXISTS "users_update_notifications" ON notifications;
  DROP POLICY IF EXISTS "service_insert_notifications" ON notifications;
  ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN undefined_table THEN null;
END $$;

-- Buang fungsi get_user_role() jika masih wujud
DROP FUNCTION IF EXISTS get_user_role();

-- Tamat 005_disable_rls.sql
