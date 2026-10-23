-- ============================================================================
-- 052_patient_registered_by.sql
--
-- Menutup MEDIUM-4 (audit pendaftaran): patients ialah satu-satunya jadual
-- aliran kerja utama tanpa jejak pelaku — semua jadual lain merekodkan
-- siapa (dinyahaktif_oleh, ditamatkan_oleh, added_by, …).
--
-- Selepas migrasi ini: lajur didaftar_oleh (NULL-able, SET NULL jika profil
-- dipadam — selari 025) diisi oleh useAddPatient dengan sesi semasa.
-- Rekod lama kekal NULL ("tidak direkodkan" — jujur tentang sejarah).
-- ============================================================================

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS didaftar_oleh UUID
    REFERENCES profiles(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- PENGESAHAN SELEPAS MIGRASI: pendaftaran baharu mengisi didaftar_oleh.
-- ============================================================================
