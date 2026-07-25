-- ============================================================================
-- 001_initial_schema.sql
-- Skema teras QuickRxRecord v4
-- Tarikh: 26 Julai 2026
--
-- JADUAL YANG DICIPTA:
--   1. profiles
--   2. items
--   3. item_batches
--   4. patients
--   5. patient_item_assignments
--   6. supply_records
--   7. dose_history
--
-- FUNGSI YANG DICIPTA:
--   - update_updated_at() — trigger generik
--   - process_supply()    — bekalan atomik (versi awal, digantikan dalam 010)
--   - merge_patients()    — gabungkan pesakit pendua
--
-- ENUM:
--   - peranan_enum
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE peranan_enum AS ENUM (
    'Pentadbir',
    'Penjaga Stor',
    'Kakitangan Farmasi',
    'Kakitangan Klinik'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 1. PROFILES — Profil Pengguna/Staff
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nama TEXT NOT NULL,
  jawatan TEXT,
  nama_pengguna TEXT UNIQUE NOT NULL,
  peranan peranan_enum NOT NULL DEFAULT 'Kakitangan Farmasi',
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(nama_pengguna);
CREATE INDEX IF NOT EXISTS idx_profiles_peranan ON profiles(peranan);

-- ============================================================================
-- 2. ITEMS — Katalog Item/Ubat
-- ============================================================================

CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kod_item TEXT UNIQUE NOT NULL,
  nama_item TEXT NOT NULL,
  nama_dagangan TEXT,
  kekuatan TEXT,
  id_kategori UUID,
  id_bentuk UUID,
  quota INTEGER,
  catatan TEXT,
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_items_name ON items(nama_item);
CREATE INDEX IF NOT EXISTS idx_items_kod ON items(kod_item);
CREATE INDEX IF NOT EXISTS idx_items_aktif ON items(aktif);

-- ============================================================================
-- 3. ITEM_BATCHES — Kelompok Stok
-- ============================================================================

CREATE TABLE IF NOT EXISTS item_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  nombor_kelompok TEXT NOT NULL,
  tarikh_luput DATE NOT NULL,
  kuantiti INTEGER NOT NULL DEFAULT 0 CHECK (kuantiti >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_item_batches_item_id ON item_batches(item_id);
CREATE INDEX IF NOT EXISTS idx_item_batches_luput ON item_batches(tarikh_luput);

-- ============================================================================
-- 4. PATIENTS — Pesakit
-- ============================================================================

CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nama TEXT NOT NULL,
  nombor_kad_pengenalan TEXT,
  nombor_pendaftaran_hospital TEXT,
  dokumen_lain TEXT,
  nombor_telefon TEXT,
  alamat TEXT,
  catatan TEXT,
  aktif BOOLEAN NOT NULL DEFAULT true,
  merged_into UUID REFERENCES patients(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(nama);
CREATE INDEX IF NOT EXISTS idx_patients_kp ON patients(nombor_kad_pengenalan);
CREATE INDEX IF NOT EXISTS idx_patients_hospital ON patients(nombor_pendaftaran_hospital);
CREATE INDEX IF NOT EXISTS idx_patients_aktif ON patients(aktif);
CREATE INDEX IF NOT EXISTS idx_patients_merged_into ON patients(merged_into);

-- ============================================================================
-- 5. PATIENT_ITEM_ASSIGNMENTS — Penugasan Item kepada Pesakit
-- ============================================================================

CREATE TABLE IF NOT EXISTS patient_item_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  dos TEXT,
  tarikh_mula_guna DATE NOT NULL,
  dimulakan_oleh UUID REFERENCES profiles(id) ON DELETE SET NULL,
  tarikh_tamat_guna DATE,
  ditamatkan_oleh UUID REFERENCES profiles(id) ON DELETE SET NULL,
  kakitangan_farmasi_perekod UUID REFERENCES profiles(id) ON DELETE SET NULL,
  aktif BOOLEAN NOT NULL DEFAULT true,
  sebab_tamat TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_assignments_patient ON patient_item_assignments(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_assignments_item ON patient_item_assignments(item_id);
CREATE INDEX IF NOT EXISTS idx_patient_assignments_active ON patient_item_assignments(aktif) WHERE aktif = true;

-- ============================================================================
-- 6. SUPPLY_RECORDS — Rekod Pembekalan
-- ============================================================================

CREATE TABLE IF NOT EXISTS supply_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES patient_item_assignments(id) ON DELETE CASCADE,
  tarikh_dibekal TIMESTAMPTZ NOT NULL DEFAULT now(),
  dos TEXT NOT NULL,
  tempoh_dibekal TEXT,
  kuantiti INTEGER NOT NULL CHECK (kuantiti > 0),
  batch_id UUID REFERENCES item_batches(id) ON DELETE SET NULL,
  kakitangan_pembekal UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  catatan_bekalan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supply_assignment ON supply_records(assignment_id);
CREATE INDEX IF NOT EXISTS idx_supply_date ON supply_records(tarikh_dibekal);
CREATE INDEX IF NOT EXISTS idx_supply_batch ON supply_records(batch_id);

-- ============================================================================
-- 7. DOSE_HISTORY — Sejarah Perubahan Dos
-- ============================================================================

CREATE TABLE IF NOT EXISTS dose_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES patient_item_assignments(id) ON DELETE CASCADE,
  tarikh DATE NOT NULL,
  dos TEXT NOT NULL,
  aktif BOOLEAN NOT NULL DEFAULT true,
  catatan TEXT,
  -- Lajur ditambah kemudian oleh skrip pembetulan (lihat 011_fix_dose_history.sql)
  -- untuk konsistensi dengan kod aplikasi
  dikemaskini_oleh UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dose_assignment ON dose_history(assignment_id);

-- ============================================================================
-- FUNGSI: update_updated_at — Trigger generik
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Pasang trigger pada semua jadual yang mempunyai updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_items_updated_at ON items;
CREATE TRIGGER update_items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_item_batches_updated_at ON item_batches;
CREATE TRIGGER update_item_batches_updated_at
  BEFORE UPDATE ON item_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_patients_updated_at ON patients;
CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_assignments_updated_at ON patient_item_assignments;
CREATE TRIGGER update_assignments_updated_at
  BEFORE UPDATE ON patient_item_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- FUNGSI: merge_patients — Gabungkan pesakit pendua
-- ============================================================================

CREATE OR REPLACE FUNCTION merge_patients(
  p_primary_id UUID,
  p_secondary_ids UUID[]
)
RETURNS VOID AS $$
DECLARE
  v_secondary_id UUID;
BEGIN
  IF p_primary_id IS NULL THEN
    RAISE EXCEPTION 'Primary patient ID cannot be null';
  END IF;

  IF p_secondary_ids IS NULL OR array_length(p_secondary_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Secondary IDs cannot be null or empty';
  END IF;

  FOREACH v_secondary_id IN ARRAY p_secondary_ids LOOP
    IF v_secondary_id = p_primary_id THEN
      CONTINUE;
    END IF;

    -- Pindahkan semua tugasan ke pesakit utama
    UPDATE patient_item_assignments
    SET patient_id = p_primary_id,
        updated_at = now()
    WHERE patient_id = v_secondary_id;

    -- Tandakan pesakit sekunder sebagai digabung
    UPDATE patients
    SET merged_into = p_primary_id,
        aktif = false,
        updated_at = now()
    WHERE id = v_secondary_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNGSI: process_supply (VERSI AWAL — digantikan dalam 010)
-- Disediakan di sini untuk tujuan dokumentasi; versi muktamad di 010.
-- ============================================================================

-- Versi awal (akan ditimpa oleh 010_remove_dose_history_from_supply.sql):
CREATE OR REPLACE FUNCTION process_supply(
  p_assignment_id UUID,
  p_dos TEXT,
  p_tempoh_dibekal TEXT,
  p_kuantiti INTEGER,
  p_batch_id UUID,
  p_kakitangan_pembekal UUID,
  p_catatan_bekalan TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item_id UUID;
  v_current_stock INTEGER;
  v_supply_id UUID;
BEGIN
  -- 1. Dapatkan item_id dari tugasan
  SELECT item_id INTO v_item_id
  FROM patient_item_assignments
  WHERE id = p_assignment_id;

  IF v_item_id IS NULL THEN
    RAISE EXCEPTION 'Assignment % not found', p_assignment_id;
  END IF;

  -- 2. Kunci baris kelompok
  SELECT kuantiti INTO v_current_stock
  FROM item_batches
  WHERE id = p_batch_id
  FOR UPDATE;

  IF v_current_stock IS NULL THEN
    RAISE EXCEPTION 'Batch % not found', p_batch_id;
  END IF;

  -- 3. Sahkan stok mencukupi
  IF v_current_stock < p_kuantiti THEN
    RAISE EXCEPTION 'Stok tidak mencukupi. Baki: %, Diminta: %', v_current_stock, p_kuantiti;
  END IF;

  -- 4. Kurangkan stok
  UPDATE item_batches
  SET kuantiti = kuantiti - p_kuantiti,
      updated_at = now()
  WHERE id = p_batch_id;

  -- 5. Cipta rekod bekalan
  INSERT INTO supply_records (
    assignment_id, dos, tempoh_dibekal, kuantiti,
    batch_id, kakitangan_pembekal, catatan_bekalan
  ) VALUES (
    p_assignment_id, p_dos, p_tempoh_dibekal, p_kuantiti,
    p_batch_id, p_kakitangan_pembekal, p_catatan_bekalan
  )
  RETURNING id INTO v_supply_id;

  RETURN v_supply_id;
END;
$$;

-- ============================================================================
-- FUNGSI: count_active_assignments (RPC untuk statistik item)
-- ============================================================================

CREATE OR REPLACE FUNCTION count_active_assignments()
RETURNS TABLE(item_id UUID, active_count BIGINT)
LANGUAGE sql
STABLE
AS $$
  SELECT
    item_id,
    COUNT(*)::BIGINT AS active_count
  FROM patient_item_assignments
  WHERE aktif = true
  GROUP BY item_id;
$$;

-- ============================================================================
-- GRANT AKSES
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Tamat 001_initial_schema.sql
