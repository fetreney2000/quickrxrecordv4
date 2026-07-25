# Supabase Setup untuk QuickRxRecord v4

Dokumen ini menerangkan cara menyediakan pangkalan data Supabase untuk aplikasi QuickRxRecord v4.

## 📋 Senarai Migrasi

Migrasi **wajib** dijalankan dalam susunan berikut (mengikut nombor):

| # | Fail | Tujuan |
|---|------|--------|
| 1 | `001_initial_schema.sql` | Skema teras (7 jadual + fungsi) |
| 2 | `002_password_reset_requests.sql` | Permintaan reset kata laluan |
| 3 | `004_custom_auth.sql` | `kata_laluan_hash` + `update_password_hash` |
| 4 | `005_disable_rls.sql` | Nyahaktifkan Row Level Security |
| 5 | `006_batch_adjustments.sql` | Audit log pelarasan stok |
| 6 | `007_schema_gaps.sql` | Lookup tables + data benih |
| 7 | `008_inventory_transactions.sql` | Jejak audit inventori |
| 8 | `010_remove_dose_history_from_supply.sql` | Versi muktamad `process_supply` |
| 9 | `011_fix_dose_history.sql` | Pembetulan `dikemaskini_oleh` lajur |

**Pilihan (hanya untuk pembangunan/pengujian):**
- `seed_admin.sql` — Pentadbir + 3 pengguna demo

> **Nota:** Nombor 003 dan 009 sengaja dilangkau — ia pernah wujud tetapi telah digugurkan/dinamakan semula dalam sistem asal.

## 🚀 Langkah Persediaan

### 1. Cipta Projek Supabase
1. Pergi ke [https://app.supabase.com](https://app.supabase.com)
2. Klik **"New Project"**
3. Pilih organisasi atau cipta baharu
4. Beri nama projek (cth: `quickrxrecord`)
5. Tetapkan kata laluan pangkalan data (RAHSIA — simpan dengan selamat!)
6. Pilih rantau terdekat (cth: `Singapore` untuk Malaysia)
7. Klik **"Create new project"**

### 2. Dapatkan Kunci API
1. Pergi ke **Settings → API** dalam projek Supabase
2. Salin nilai berikut:
   - **Project URL** (cth: `https://abcdefgh.supabase.co`)
   - **anon public** key
3. Buat fail `.env` dalam direktori root projek:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

### 3. Jalankan Migrasi
1. Pergi ke **SQL Editor** dalam dashboard Supabase
2. Jalankan setiap fail migrasi **mengikut urutan**:
   - Buka `001_initial_schema.sql` → Salin semua SQL → Tampal di editor → **Run**
   - Ulang untuk setiap fail seterusnya
3. **ATAU** gunakan Supabase CLI:
   ```bash
   # Pasang CLI
   npm install -g supabase

   # Login
   supabase login

   # Paut projek
   supabase link --project-ref your-project-ref

   # Jalankan migrasi
   supabase db push
   ```

### 4. (Pilihan) Tambah Data Pentadbir
Untuk persekitaran pembangunan/pengujian sahaja:

1. Jana hash bcrypt untuk kata laluan:
   ```javascript
   // Dalam node.js dengan bcrypt:
   const bcrypt = require('bcrypt');
   const hash = bcrypt.hashSync('admin123', 10);
   console.log(hash);
   ```

2. Kemas kini `seed_admin.sql` dengan hash sebenar

3. Jalankan `seed_admin.sql` dalam SQL Editor

4. **Log masuk** dengan `admin` / `admin123` dan **SEGERA TUKAR** kata laluan!

## 🔐 Persediaan Edge Functions (Fasa Seterusnya)

Fasa akan datang akan menambah Supabase Edge Functions untuk:
- `POST /api/login` — Pengesahan tersuai
- `GET /api/session` — Dapatkan sesi semasa
- `DELETE /api/session` — Log keluar
- `POST /api/reset-request` — Permintaan reset kata laluan
- `POST /api/supply` — Wrapper untuk `process_supply` RPC

## 📊 Senarai 14 Jadual

| # | Jadual | Tujuan |
|---|--------|--------|
| 1 | `profiles` | Pengguna sistem (staff) |
| 2 | `items` | Katalog ubat/item |
| 3 | `item_batches` | Kelompok stok dengan tarikh luput |
| 4 | `patients` | Pesakit berdaftar |
| 5 | `patient_item_assignments` | Penugasan item kepada pesakit |
| 6 | `supply_records` | Rekod setiap pembekalan |
| 7 | `dose_history` | Rekod perubahan dos |
| 8 | `password_reset_requests` | Permintaan reset kata laluan |
| 9 | `batch_adjustments` | Log audit pelarasan stok kelompok |
| 10 | `item_categories` | Kategori ubat (lookup) |
| 11 | `item_forms` | Bentuk dos (lookup) |
| 12 | `supply_durations` | Tempoh bekalan (lookup) |
| 13 | `staff_migration_lookup` | Pemetaan ID staff warisan |
| 14 | `inventory_transactions` | Jejak audit pergerakan stok |

## ⚙️ Fungsi Tersimpan (RPC)

| Fungsi | Kembalian | Tujuan |
|--------|-----------|--------|
| `process_supply(...)` | UUID | Transaksi pembekalan atomik |
| `merge_patients(...)` | VOID | Gabungkan pesakit pendua |
| `update_password_hash(...)` | VOID | Kemas kini hash kata laluan |
| `count_active_assignments()` | TABLE | Kira tugasan aktif setiap item |
| `update_updated_at()` | TRIGGER | Auto cap masa `updated_at` |

## 🔍 Pengesahan Skema

Jalankan SQL berikut dalam SQL Editor untuk mengesahkan semua 14 jadual wujud:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Anda akan nampak 14 jadual dalam susunan abjad.

## 📝 UUID Deterministic untuk Data Benih

UUID untuk data carian menggunakan format deterministik:
- Kategori: `a0000000-0000-0000-0000-00000000000{n}`
- Bentuk: `b0000000-0000-0000-0000-00000000000{n}`
- Tempoh: `c0000000-0000-0000-0000-00000000000{n}`

Ini membolehkan rujukan konsisten merentasi persekitaran pembangunan dan pengeluaran.

## ⚠️ Nota Keselamatan

- **RLS dinyahaktifkan** pada semua jadual. Pengesahan dan kebenaran dikendalikan sepenuhnya di peringkat aplikasi.
- **Kunci API Supabase (anon key) mesti dilindungi** — sesiapa yang mempunyai kunci ini boleh membaca/menulis semua data.
- Untuk pengeluaran, pertimbangkan untuk **mengaktifkan semula RLS** dengan dasar yang sesuai.

## 🆘 Penyelesaian Masalah

### Ralat: "permission denied for table profiles"
- Pastikan GRANT statements dalam `001_initial_schema.sql` berjaya dijalankan
- Cuba jalankan manual: `GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;`

### Ralat: "function count_active_assignments() does not exist"
- Fungsi ini dicipta dalam `001_initial_schema.sql`. Jika tiada, jalankan manual:
  ```sql
  CREATE OR REPLACE FUNCTION count_active_assignments()
  RETURNS TABLE(item_id UUID, active_count BIGINT) AS $$
    SELECT item_id, COUNT(*)::BIGINT
    FROM patient_item_assignments
    WHERE aktif = true
    GROUP BY item_id;
  $$ LANGUAGE sql STABLE;
  ```

### Ralat: "column dose_history.dikemaskini_oleh does not exist"
- Jalankan `011_fix_dose_history.sql` untuk menambah lajur yang hilang
