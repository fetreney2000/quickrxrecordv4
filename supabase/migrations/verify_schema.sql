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
-- 7. SEMAK RLS (mesti ENABLED selepas 038/039 — skrip lama yang menjangka
--    disabled adalah LAPUK dan mesti gagal selepas pengerasan keselamatan)
-- ============================================================================
SELECT
  '7. RLS' AS bahagian,
  schemaname,
  tablename,
  rowsecurity AS rls_enabled,
  CASE WHEN rowsecurity THEN 'OK' ELSE 'FAIL: jalankan 038_reenable_rls.sql' END AS status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 7b. Anon mesti TIADA akses (revoked dalam 038); authenticated mesti ada.
SELECT '7b. ANON_GRANTS' AS bahagian, grantee, privilege_type, COUNT(*) AS jumlah
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee = 'anon'
GROUP BY grantee, privilege_type;

-- 7c. Senarai polisi per jadual (jangka: sel_active/wr_*/admin_only, BUKAN authenticated_all)
SELECT '7c. POLICIES' AS bahagian, tablename, policyname, roles::text, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 7d. Pengawal status pesakit (040): trigger mesti wujud, jika tidak
--     aktif=false→true masih boleh dilakukan dari klien (HIGH-2).
SELECT '7d. STATUS_GUARD' AS bahagian,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_schema = 'public'
      AND event_object_table = 'patients'
      AND trigger_name = 'trg_patients_protect_status'
  ) THEN 'OK' ELSE 'FAIL: jalankan 040_patients_status_guard.sql' END AS status;

-- 7e. Pengawal bekalan pesakit (041): nyahaktif mesti menamatkan tugasan,
--     jika tidak bekalan boleh direkod semula melalui RPC langsung (HIGH-1).
SELECT '7e. HALT_GUARD' AS bahagian,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_schema = 'public'
      AND event_object_table = 'patients'
      AND trigger_name = 'trg_patients_halt_assignments'
  ) THEN 'OK' ELSE 'FAIL: jalankan 041_supply_patient_guards.sql' END AS status;

-- 7f. Pengawal stok luput (042): jumlah mesti membezakan stok boleh dibekal.
SELECT '7f. DISPENSABLE' AS bahagian,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_inventory_list'
      AND 'dispensable_stock' = ANY (p.proargnames)
  ) THEN 'OK' ELSE 'FAIL: jalankan 042_expired_stock_guards.sql' END AS status;

-- 7g. (Ditarik balik: tiada indeks unik kelompok — ulangan nombor kelompok
--     merentas sesi pesanan adalah sah; top-up bergabung secara logik.)

-- 7h. Audit identiti kelompok (044): pertukaran nombor/tarikh luput mesti
--     berjejak dengan sebab, bukan UPDATE senyap.
SELECT '7h. IDENTITY' AS bahagian,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'record_batch_update'
  ) THEN 'OK' ELSE 'FAIL: jalankan 044_batch_identity_audit.sql' END AS status;

-- 7i. Nama lajur konsisten (045): batch_additions.quantity → kuantiti.
SELECT '7i. RENAME' AS bahagian,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'batch_additions'
      AND column_name = 'kuantiti'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'batch_additions'
      AND column_name = 'quantity'
  ) THEN 'OK' ELSE 'FAIL: jalankan 045_batch_additions_rename.sql' END AS status;

-- 7j. Pengawal suntingan bekalan (046): kuantiti < 1 mesti ditolak di
--     pelayan (nilai negatif mencipta stok daripada tiada).
SELECT '7j. EDIT_FLOOR' AS bahagian,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_supply'
      AND p.prosrc LIKE '%sekurang-kurangnya 1%'
  ) THEN 'OK' ELSE 'FAIL: jalankan 046_supply_edit_guards.sql' END AS status;

-- 7k. Pengawal kelompok lupus (046): suntingan/pembatalan bekalan tidak
--     boleh membangkitkan stok dalam kelompok lupus.
SELECT '7k. EDIT_DISPOSED' AS bahagian,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_supply'
      AND p.prosrc LIKE '%dilupuskan = false%'
  ) AND EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'reverse_supply'
      AND p.prosrc LIKE '%dilupuskan = false%'
  ) THEN 'OK' ELSE 'FAIL: jalankan 046_supply_edit_guards.sql' END AS status;

-- 7l. Pembatalan pukal atomik (047): baris bergabung dibatalkan dalam satu
--     transaksi dengan satu toast ringkasan.
SELECT '7l. BULK_VOID' AS bahagian,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'reverse_supplies'
  ) THEN 'OK' ELSE 'FAIL: jalankan 047_bulk_reverse_supply.sql' END AS status;

-- 7m. Padam penolakan Pentadbir sahaja (048): fakta klinikal tidak boleh
--     dipadam oleh sebarangan peranan klinikal.
SELECT '7m. DECL_DEL' AS bahagian,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'supply_declinations'
      AND policyname = 'del_admin_only'
  ) THEN 'OK' ELSE 'FAIL: jalankan 048_declination_delete_guard.sql' END AS status;

-- 7n. Dos tidak ditulis pada tugasan mati (046): tiada fakta klinikal baharu
--     pada rekod yang ditamatkan/digabungkan.
SELECT '7n. DOSE_DEAD' AS bahagian,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_dose_with_history'
      AND p.prosrc LIKE '%kemas kini dos tidak dibenarkan%'
  ) THEN 'OK' ELSE 'FAIL: jalankan 046_supply_edit_guards.sql' END AS status;

-- 7o. Pengawal status tugasan (049): henti mesti berjejak; aktif semula
--     dilarang (cermin 040 untuk pesakit).
SELECT '7o. ASSIGN_GUARD' AS bahagian,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_schema = 'public'
      AND event_object_table = 'patient_item_assignments'
      AND trigger_name = 'trg_assignments_protect_status'
  ) THEN 'OK' ELSE 'FAIL: jalankan 049_assignment_status_guard.sql' END AS status;

-- 7p. Kuota dikuatkuasakan pelayan (041) + kunci nasihat (058, bukan FOR UPDATE
--     yang menyekat Farmasi di bawah RLS).
SELECT '7p. QUOTA' AS bahagian,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'add_assignment_with_dose'
      AND p.prosrc LIKE '%Kuota item telah penuh%'
      AND p.prosrc LIKE '%pg_advisory_xact_lock%'
  ) THEN 'OK' ELSE 'FAIL: jalankan 058_assignment_advisory_lock.sql' END AS status;

-- 7q. Padam klinikal Pentadbir sahaja (050): tiada DELETE senyap sejarah
--     klinikal oleh sebarangan peranan.
SELECT '7q. NO_DELETE' AS bahagian,
  CASE WHEN (
    SELECT COUNT(*) FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('patients','patient_item_assignments','supply_records',
                        'dose_history','supply_declinations')
      AND policyname = 'del_admin_only'
  ) = 5 THEN 'OK' ELSE 'FAIL: jalankan 050_clinical_delete_guard.sql' END AS status;

-- 7r. (Ditarik balik: tiada indeks unik KP/hospital — pendaftaran semula
--     dan varian data sedia ada tidak boleh disekat di DB; semakan pendua
--     klien + normalisasi kanonik kekal sebagai perlindungan.)

-- 7s. Jejak pendaftar (052): setiap pendaftaran baharu merekodkan pelaku.
SELECT '7s. REG_BY' AS bahagian,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'patients'
      AND column_name = 'didaftar_oleh'
  ) THEN 'OK' ELSE 'FAIL: jalankan 052_patient_registered_by.sql' END AS status;

-- 7t. Kuota tidak negatif (053): lantai integriti untuk had pesakit.
SELECT '7t. QUOTA_FLOOR' AS bahagian,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'items_kuota_nonnegatif'
  ) THEN 'OK' ELSE 'FAIL: jalankan 053_item_kuota_check.sql' END AS status;

-- 7u. Indeks trigram carian (055): padanan '%…%' berskala tanpa imbasan penuh.
SELECT '7u. TRGM' AS bahagian,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'
  ) AND (
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'items'
      AND indexname LIKE 'ix_items_%_trgm'
  ) = 4 THEN 'OK' ELSE 'FAIL: jalankan 055_search_trgm_indexes.sql' END AS status;

-- 7v. Sebab pelarasan/pelupusan wajib (056): jurnal tanpa sebab ditolak.
SELECT '7v. REASON_REQ' AS bahagian,
  CASE WHEN (
    SELECT COUNT(*) FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('record_batch_adjustment','process_batch_disposal')
      AND p.prosrc LIKE '%Sebab pel%'
  ) = 2 THEN 'OK' ELSE 'FAIL: jalankan 056_batch_reason_required.sql' END AS status;

-- 7w. Jadual rujukan Pentadbir sahaja (057): Stor/Farmasi baca sahaja.
SELECT '7w. LOOKUP_ADMIN' AS bahagian,
  CASE WHEN (
    SELECT COUNT(*) FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('item_categories','item_forms','supply_durations')
      AND policyname IN ('wr_lookup_admin_ins','wr_lookup_admin_upd','wr_lookup_admin_del')
  ) = 9 AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('item_categories','item_forms','supply_durations')
      AND policyname = 'wr_inventory'
  ) THEN 'OK' ELSE 'FAIL: jalankan 057_lookup_admin_only.sql' END AS status;

-- 7x. Pentadbir terakhir dilindungi (059): nyahaktif/turunkan yang
--     menghapuskan Pentadbir aktif terakhir ditolak (service_role kekal
--     sebagai jalan kecemasan).
SELECT '7x. LAST_ADMIN' AS bahagian,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'profiles_protect_privileged'
      AND p.prosrc LIKE '%sekurang-kurangnya seorang Pentadbir aktif%'
  ) THEN 'OK' ELSE 'FAIL: jalankan 059_protect_last_admin.sql' END AS status;

-- 7y. Jejak audit pentadbir (060): jadual append-only wujud dengan RLS
--     Pentadbir-sahaja (baca+tulis) dan tiada laluan UPDATE/DELETE klien.
SELECT '7y. AUDIT_LOG' AS bahagian,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admin_audit_log'
  ) AND (
    SELECT COUNT(*) FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_audit_log'
      AND policyname IN ('admin_audit_read','admin_audit_write')
  ) = 2 THEN 'OK' ELSE 'FAIL: jalankan 060_admin_audit_log.sql' END AS status;

-- 7aa. Verdict stok-rendah papan pemuka (062): berdasarkan stok boleh dibekal.
SELECT '7aa. DASHBOARD_LS' AS bahagian,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_dashboard_stats'
      AND p.prosrc LIKE '%dispensable_balance%'
  ) THEN 'OK' ELSE 'FAIL: jalankan 062_dashboard_lowstock_expiry.sql' END AS status;

-- 7z. Batas laporan (061): tahun mengikut Asia/Kuala_Lumpur; p_limit
--     get_report_transactions dikapit 1..2000.
SELECT '7z. RPT_BOUNDS' AS bahagian,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_annual_usage'
      AND p.prosrc LIKE '%Asia/Kuala_Lumpur%'
  ) AND EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_report_transactions'
      AND p.prosrc LIKE '%LEAST(GREATEST(COALESCE(p_limit, 500), 1), 2000)%'
  ) THEN 'OK' ELSE 'FAIL: jalankan 061_report_bounds.sql' END AS status;

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
-- Dijangka selepas migrasi berjaya (termasuk 038 + 039):
--   - 14+ jadual (termasuk auth_attempts)
--   - Semua jadual public: RLS ENABLED (status OK di bahagian 7)
--   - 0 grants kepada anon (bahagian 7b kosong)
--   - Polisi RBAC: sel_active / wr_clinical / wr_inventory / upd_own_or_admin
--     / admin_only (bahagian 7c) — TIADA authenticated_all
--   - 6 kategori, 11 bentuk, 3 tempoh
--   - dose_history mempunyai dikemaskini_oleh
-- ============================================================================
