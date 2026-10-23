-- ============================================================================
-- 053_item_kuota_check.sql
--
-- Menutup MEDIUM-2 (audit pendaftaran item): kuota negatif diluluskan
-- parseInt tanpa semakan — item terkunci kekal (baki tidak pernah tercapai).
-- Pengesahan prod (23 Okt 2026): 0 baris negatif, maksimum 5000 — selamat
-- untuk menguatkuasakan.
--
-- CHECK ini penguatkuasa muktamad; dialog + mutasi mengesahkan dahulu
-- (termasuk had atas 999999) untuk maklum balas segera.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'items_kuota_nonnegatif'
  ) THEN
    ALTER TABLE public.items
      ADD CONSTRAINT items_kuota_nonnegatif
      CHECK (kuota IS NULL OR kuota >= 0);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- PENGESAHAN SELEPAS MIGRASI:
--   INSERT INTO items (kod_item, nama_item, kuota) VALUES ('UJI','Ujian',-1);
--   → ERROR: melanggar CHECK "items_kuota_nonnegatif" (tiada baris ditulis).
-- ============================================================================
