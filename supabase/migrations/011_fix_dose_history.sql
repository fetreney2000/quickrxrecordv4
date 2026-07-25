-- ============================================================================
-- 011_fix_dose_history.sql
-- Skrip pembetulan untuk ketidakselarasan aplikasi vs skema
-- Tarikh: 26 Julai 2026
--
-- ISU:
--   Kod aplikasi melakukan JOIN dengan profiles!dikemaskini_oleh(nama)
--   tetapi lajur ini tiada dalam dose_history.
--
-- PEMBETULAN:
--   Tambah lajur dikemaskini_oleh (FK ke profiles)
-- ============================================================================

-- Tambah lajur dikemaskini_oleh jika belum wujud
ALTER TABLE dose_history
  ADD COLUMN IF NOT EXISTS dikemaskini_oleh UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Tambah indeks untuk prestasi JOIN
CREATE INDEX IF NOT EXISTS idx_dose_history_dikemaskini_oleh
  ON dose_history(dikemaskini_oleh);

COMMENT ON COLUMN dose_history.dikemaskini_oleh IS
  'ID staff yang mengemas kini rekod dose_history ini';

-- Tamat 011_fix_dose_history.sql
