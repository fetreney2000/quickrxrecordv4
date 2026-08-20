ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS catatan_nyahaktif TEXT,
  ADD COLUMN IF NOT EXISTS tarikh_nyahaktif DATE,
  ADD COLUMN IF NOT EXISTS dinyahaktif_oleh UUID
    REFERENCES profiles(id) ON DELETE SET NULL;
