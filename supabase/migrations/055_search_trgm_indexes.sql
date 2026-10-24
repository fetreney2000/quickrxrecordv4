-- ============================================================================
-- 055_search_trgm_indexes.sql
--
-- LOW-3 (audit carian inventori): padanan ILIKE '%…%' tidak boleh
-- menggunakan indeks btree sedia ada (carian imbuhan kiri). Pada katalog
-- semasa (ratusan item) imbasan berjujukan beberapa milisaat — migrasi ini
-- bersifat persediaan: GIN trigram menjadikan carian wildcard berskala
-- apabila katalog membesar 10x, dengan kos tulis yang boleh diabaikan
-- pada kadar tulis inventori (beberapa baris sesaat pun tidak).
--
-- Nota: jika peranan SQL anda tidak mempunyai skema extensions dalam
-- search_path, gantikan gin_trgm_ops dengan extensions.gin_trgm_ops.
-- Semakan: SELECT * FROM pg_extension WHERE extname = 'pg_trgm';
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS ix_items_kod_trgm
  ON public.items USING gin (kod_item gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_items_nama_trgm
  ON public.items USING gin (nama_item gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_items_dagangan_trgm
  ON public.items USING gin (nama_dagangan gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_items_kekuatan_trgm
  ON public.items USING gin (kekuatan gin_trgm_ops);

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- PENGESAHAN SELEPAS MIGRASI: EXPLAIN SELECT ... WHERE nama_item ILIKE '%10MG%'
-- seharusnya menunjukkan "Bitmap Heap Scan ... Bitmap Index Scan on
-- ix_items_nama_trgm" dan bukannya Seq Scan.
-- ============================================================================
