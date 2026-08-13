-- ============================================================================
-- 016_supply_declinations.sql
-- Rekod "Ubat Tidak Perlu Dibekalkan" (supply declination).
--
-- TUJUAN:
--   Apabila pesakit datang ke farmasi tetapi TIDAK perlu dibekalkan ubat
--   untuk sesuatu item (contoh: masih ada baki di rumah, tahan ubat buat
--   sementara, dsb.), kakitangan merekodkan "Ubat Tidak Perlu Dibekalkan".
--
--   Rekod ini TIDAK mengurangkan stok (item_batches.kuantiti tidak disentuh),
--   TIDAK mencipta supply_records, dan TIDAK mengubah patient_item_assignments.
--   Oleh itu kuota pesakit kekal, dan pesakit yang masih datang ke farmasi
--   tidak ditandakan sebagai "Tercicir" (defaulter).
--
-- Setiap rekod ini dianggap sebagai aktiviti/kehadiran untuk tujuan
-- pengiraan status "Aktif vs Tercicir".
-- ============================================================================

CREATE TABLE IF NOT EXISTS supply_declinations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES patient_item_assignments(id) ON DELETE CASCADE,
  tarikh        TIMESTAMPTZ NOT NULL DEFAULT now(),
  sebab         TEXT NOT NULL,               -- sebab "Ubat Tidak Perlu Dibekalkan"
  tempoh        TEXT,                        -- tempoh sepatutnya dibekal (cth: "30 Hari")
  catatan       TEXT,
  direkod_oleh  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pastikan lajur tempoh wujud walaupun jadual sedia ada (idempoten)
ALTER TABLE supply_declinations ADD COLUMN IF NOT EXISTS tempoh TEXT;

CREATE INDEX IF NOT EXISTS idx_supply_declinations_assignment ON supply_declinations(assignment_id);
CREATE INDEX IF NOT EXISTS idx_supply_declinations_tarikh ON supply_declinations(tarikh);
CREATE INDEX IF NOT EXISTS idx_supply_declinations_direkod_oleh ON supply_declinations(direkod_oleh);

-- RLS dinyahaktifkan (konsisten dengan jadual lain; pengesahan di peringkat aplikasi)
ALTER TABLE supply_declinations DISABLE ROW LEVEL SECURITY;
GRANT ALL ON supply_declinations TO anon, authenticated;

-- Tamat 016_supply_declinations.sql