-- ============================================================================
-- verify_schema.sql
-- Skrip pengesahan skema QuickRxRecord v4
-- Tarikh: 26 Julai 2026
--
-- Jalankan skrip ini dalam Supabase SQL Editor untuk mengesahkan semua
-- jadual, indeks, fungsi, dan data benih telah dipasang dengan betul.
-- ============================================================================

-- ============================================================================
-- 1. SEMAK 14 JADUAL
-- ============================================================================
SELECT '1. JADUAL' AS bahagian, table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- ============================================================================
-- 2. SEMAK FUNGSI TERSIMPAN
-- ============================================================================
SELECT '2. FUNGSI' AS bahagian, routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- ============================================================================
-- 3. SEMAK TRIGGERS
-- ============================================================================
SELECT '3. TRIGGERS' AS bahagian, trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- 4. SEMAK INDEKS
-- ============================================================================
SELECT
  '4. INDEKS' AS bahagian,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname NOT LIKE '%_pkey'
ORDER BY tablename, indexname;

-- ============================================================================
-- 5. SEMAK DATA BENIH
-- ============================================================================
SELECT '5. KATEGORI' AS bahagian, id, nama FROM item_categories ORDER BY nama;
SELECT '5. BENTUK' AS bahagian, id, nama FROM item_forms ORDER BY nama;
SELECT '5. TEMPOH' AS bahagian, id, nama FROM supply_durations ORDER BY nama;

-- ============================================================================
-- 6. SEMAK ENUM
-- ============================================================================
SELECT '6. ENUM' AS bahagian, t.typname AS enum_name, e.enumlabel AS nilai
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname = 'peranan_enum'
ORDER BY e.enumsortorder;

-- ============================================================================
-- 7. SEMAK RLS (semuanya patut disabled)
-- ============================================================================
SELECT
  '7. RLS' AS bahagian,
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================================================
-- 8. SEMAK KOLOM dose_history.dikemaskini_oleh
-- ============================================================================
SELECT
  '8. DOSE_HISTORY' AS bahagian,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'dose_history'
ORDER BY ordinal_position;

-- ============================================================================
-- 9. KIRA JUMLAH REKOD
-- ============================================================================
SELECT 'profiles' AS jadual, COUNT(*) AS jumlah FROM profiles
UNION ALL SELECT 'items', COUNT(*) FROM items
UNION ALL SELECT 'item_batches', COUNT(*) FROM item_batches
UNION ALL SELECT 'patients', COUNT(*) FROM patients
UNION ALL SELECT 'patient_item_assignments', COUNT(*) FROM patient_item_assignments
UNION ALL SELECT 'supply_records', COUNT(*) FROM supply_records
UNION ALL SELECT 'dose_history', COUNT(*) FROM dose_history
UNION ALL SELECT 'password_reset_requests', COUNT(*) FROM password_reset_requests
UNION ALL SELECT 'batch_adjustments', COUNT(*) FROM batch_adjustments
UNION ALL SELECT 'item_categories', COUNT(*) FROM item_categories
UNION ALL SELECT 'item_forms', COUNT(*) FROM item_forms
UNION ALL SELECT 'supply_durations', COUNT(*) FROM supply_durations
UNION ALL SELECT 'staff_migration_lookup', COUNT(*) FROM staff_migration_lookup
UNION ALL SELECT 'inventory_transactions', COUNT(*) FROM inventory_transactions;

-- ============================================================================
-- 10. UJI FUNGSI count_active_assignments
-- ============================================================================
-- Seharusnya pulangkan jadual kosong jika tiada tugasan
SELECT * FROM count_active_assignments();

-- ============================================================================
-- RINGKASAN
-- ============================================================================
-- Dijangka selepas migrasi berjaya:
--   - 14 jadual
--   - 5 fungsi (process_supply, merge_patients, update_password_hash, count_active_assignments, update_updated_at)
--   - 8 triggers
--   - 22+ indeks
--   - 6 kategori, 11 bentuk, 3 tempoh
--   - Semua RLS disabled
--   - dose_history.mempunyai dikemaskini_oleh
-- ============================================================================
