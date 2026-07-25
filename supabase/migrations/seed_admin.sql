-- ============================================================================
-- seed_admin.sql
-- Data pentadbir awal (JANGAN gunakan dalam pengeluaran tanpa menukar kata laluan!)
-- Tarikh: 26 Julai 2026
--
-- UNTUK PEMBANGUNAN & PENGUJIAN SAHAJA.
-- Kata laluan lalai: "admin123" (bcrypt hash di bawah).
-- SEGERA TUKAR selepas log masuk pertama!
-- ============================================================================

-- Hash bcrypt untuk "admin123" (cost=10) — GANTI dalam produksi!
-- Hash ini dijana menggunakan bcrypt dengan salt raw 10.
-- Anda boleh menjana hash baharu dengan: bcrypt.hashSync('admin123', 10)
-- Nilai placeholder di bawah perlu diganti sebelum digunakan.

INSERT INTO profiles (
  id,
  nama,
  jawatan,
  nama_pengguna,
  peranan,
  aktif,
  kata_laluan_hash,
  created_at,
  updated_at
) VALUES (
  -- UUID stabil untuk admin pembangunan
  '00000000-0000-0000-0000-000000000001',
  'Pentadbir Sistem',
  'Pegawai Farmasi',
  'admin',
  'Pentadbir',
  true,
  -- Hash bcrypt untuk "admin123" — GANTI selepas log masuk pertama
  '$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUV',
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Tambah 3 pengguna ujian untuk setiap peranan lain
INSERT INTO profiles (id, nama, jawatan, nama_pengguna, peranan, aktif, kata_laluan_hash, created_at, updated_at) VALUES
  ('00000000-0000-0000-0000-000000000002', 'Penjaga Stor Demo', 'Penjaga Stor', 'storer', 'Penjaga Stor', true, '$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUV', now(), now()),
  ('00000000-0000-0000-0000-000000000003', 'Kakitangan Farmasi Demo', 'Pegawai Farmasi', 'pharmacist', 'Kakitangan Farmasi', true, '$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUV', now(), now()),
  ('00000000-0000-0000-0000-000000000004', 'Kakitangan Klinik Demo', 'Jururawat', 'nurse', 'Kakitangan Klinik', true, '$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUV', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Tamat seed_admin.sql
