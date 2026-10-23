-- ============================================================================
-- seed_admin.sql
-- AMARAN: FAIL INI UNTUK PEMBANGUNAN TEMPATAN SAHAJA. JANGAN JALANKAN DI
-- PRODUKSI. Akaun di bawah dicipta BERKUNCI (kata_laluan_hash = NULL —
-- tiada siapa boleh log masuk) dan mesti diaktifkan melalui API pentadbir
-- (/api/create-user atau /api/reset-password, bcrypt cost 12) selepas semak.
--
-- Sebab: hash placeholder lama BUKAN hash bcrypt yang sah, dan kata laluan
-- terkenal ("admin123"/"password123") tidak boleh wujud dalam repo (audit).
-- ============================================================================

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
  -- UUID stabil untuk admin pembangunan — akaun BERKUNCI sehingga reset
  -- kata laluan melalui API.
  '00000000-0000-0000-0000-000000000001',
  'Pentadbir Sistem',
  'Pegawai Farmasi',
  'admin',
  'Pentadbir',
  false,
  NULL,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Akaun demo dikunci + dinyahaktifkan secara lalai (aktifkan + reset kata
-- laluan melalui API jika benar-benar diperlukan untuk ujian tempatan).
INSERT INTO profiles (id, nama, jawatan, nama_pengguna, peranan, aktif, kata_laluan_hash, created_at, updated_at) VALUES
  ('00000000-0000-0000-0000-000000000002', 'Penjaga Stor Demo', 'Penjaga Stor', 'storer', 'Penjaga Stor', false, NULL, now(), now()),
  ('00000000-0000-0000-0000-000000000003', 'Kakitangan Farmasi Demo', 'Pegawai Farmasi', 'pharmacist', 'Kakitangan Farmasi', false, NULL, now(), now()),
  ('00000000-0000-0000-0000-000000000004', 'Kakitangan Klinik Demo', 'Jururawat', 'nurse', 'Kakitangan Klinik', false, NULL, now(), now())
ON CONFLICT (id) DO NOTHING;

-- Tamat seed_admin.sql
