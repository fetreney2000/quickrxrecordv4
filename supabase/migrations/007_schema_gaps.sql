-- ============================================================================
-- 007_schema_gaps.sql
-- Pengisian jurang skema: jadual carian + data benih + lajur tambahan
-- Tarikh: 26 Julai 2026
--
-- JADUAL BAHARU:
--   10. item_categories
--   11. item_forms
--   12. supply_durations
--   13. staff_migration_lookup
--
-- PERUBAHAN LAJUR:
--   - patients.tarikh_daftar
--   - patient_item_assignments.catatan_penggunaan
--
-- BENIH:
--   - 6 kategori ubat
--   - 11 bentuk dos
--   - 3 tempoh bekalan
-- ============================================================================

-- ============================================================================
-- 10. ITEM_CATEGORIES — Kategori Ubat
-- ============================================================================

CREATE TABLE IF NOT EXISTS item_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nama TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_item_categories_name ON item_categories(nama);

DROP TRIGGER IF EXISTS update_item_categories_updated_at ON item_categories;
CREATE TRIGGER update_item_categories_updated_at
  BEFORE UPDATE ON item_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 11. ITEM_FORMS — Bentuk Dos
-- ============================================================================

CREATE TABLE IF NOT EXISTS item_forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nama TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_item_forms_name ON item_forms(nama);

DROP TRIGGER IF EXISTS update_item_forms_updated_at ON item_forms;
CREATE TRIGGER update_item_forms_updated_at
  BEFORE UPDATE ON item_forms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 12. SUPPLY_DURATIONS — Tempoh Bekalan
-- ============================================================================

CREATE TABLE IF NOT EXISTS supply_durations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nama TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supply_durations_name ON supply_durations(nama);

DROP TRIGGER IF EXISTS update_supply_durations_updated_at ON supply_durations;
CREATE TRIGGER update_supply_durations_updated_at
  BEFORE UPDATE ON supply_durations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 13. STAFF_MIGRATION_LOOKUP — Pemetaan ID Staff Warisan
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff_migration_lookup (
  old_id INTEGER PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_migration_old ON staff_migration_lookup(old_id);
CREATE INDEX IF NOT EXISTS idx_staff_migration_profile ON staff_migration_lookup(profile_id);

-- ============================================================================
-- TAMBAH LAJUR KE JADUAL SEDIA ADA
-- ============================================================================

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS tarikh_daftar DATE;

CREATE INDEX IF NOT EXISTS idx_patients_tarikh_daftar ON patients(tarikh_daftar);

ALTER TABLE patient_item_assignments
  ADD COLUMN IF NOT EXISTS catatan_penggunaan TEXT;

-- ============================================================================
-- TAMBAH FK CONSTRAINTS (id_kategori, id_bentuk pada items)
-- ============================================================================

-- Tambah foreign key untuk id_kategori jika belum wujud
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_items_kategori'
      AND table_name = 'items'
  ) THEN
    ALTER TABLE items
      ADD CONSTRAINT fk_items_kategori
      FOREIGN KEY (id_kategori) REFERENCES item_categories(id)
      ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

-- Tambah foreign key untuk id_bentuk jika belum wujud
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_items_bentuk'
      AND table_name = 'items'
  ) THEN
    ALTER TABLE items
      ADD CONSTRAINT fk_items_bentuk
      FOREIGN KEY (id_bentuk) REFERENCES item_forms(id)
      ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_items_kategori ON items(id_kategori);
CREATE INDEX IF NOT EXISTS idx_items_bentuk ON items(id_bentuk);

-- ============================================================================
-- DATA BENIH — UUID Deterministic
-- Format: {prefix}0000000-0000-0000-0000-00000000000{n}
-- ============================================================================

-- 6 Kategori Ubat
INSERT INTO item_categories (id, nama) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Kategori A'),
  ('a0000000-0000-0000-0000-000000000002', 'Psikiatrik'),
  ('a0000000-0000-0000-0000-000000000003', 'KPK Item'),
  ('a0000000-0000-0000-0000-000000000004', 'Kategori B'),
  ('a0000000-0000-0000-0000-000000000005', 'Kategori A/KK (Ubat Terkawal)'),
  ('a0000000-0000-0000-0000-000000000006', 'Kategori A*')
ON CONFLICT (id) DO NOTHING;

-- 11 Bentuk Dos
INSERT INTO item_forms (id, nama) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Tablet'),
  ('b0000000-0000-0000-0000-000000000002', 'Kapsul'),
  ('b0000000-0000-0000-0000-000000000003', 'Sirap'),
  ('b0000000-0000-0000-0000-000000000004', 'Patch'),
  ('b0000000-0000-0000-0000-000000000005', 'Drops'),
  ('b0000000-0000-0000-0000-000000000006', 'Injection'),
  ('b0000000-0000-0000-0000-000000000007', 'Eye Drops'),
  ('b0000000-0000-0000-0000-000000000008', 'Nasal Spray'),
  ('b0000000-0000-0000-0000-000000000009', 'Inhaler'),
  ('b0000000-0000-0000-0000-00000000000a', 'Solution'),
  ('b0000000-0000-0000-0000-00000000000b', 'Serbuk')
ON CONFLICT (id) DO NOTHING;

-- 3 Tempoh Bekalan
INSERT INTO supply_durations (id, nama) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Hari'),
  ('c0000000-0000-0000-0000-000000000002', 'Minggu'),
  ('c0000000-0000-0000-0000-000000000003', 'Bulan')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- RLS — Disable seperti jadual teras lain
-- ============================================================================

ALTER TABLE item_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE item_forms DISABLE ROW LEVEL SECURITY;
ALTER TABLE supply_durations DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff_migration_lookup DISABLE ROW LEVEL SECURITY;

-- Grant akses
GRANT ALL ON item_categories TO anon, authenticated;
GRANT ALL ON item_forms TO anon, authenticated;
GRANT ALL ON supply_durations TO anon, authenticated;
GRANT ALL ON staff_migration_lookup TO anon, authenticated;

-- Tamat 007_schema_gaps.sql
