# Analisis Skema Pangkalan Data — QuickRxRecord

**Fail Dianalisis:**
- `quickrx-new/supabase/migrations/001_initial_schema.sql` (297 baris)
- `quickrx-new/supabase/migrations/002_password_reset_requests.sql` (33 baris)
- `quickrx-new/supabase/migrations/004_custom_auth.sql` (17 baris)
- `quickrx-new/supabase/migrations/005_disable_rls.sql` (55 baris)
- `quickrx-new/supabase/migrations/006_batch_adjustments.sql` (18 baris)
- `quickrx-new/supabase/migrations/007_schema_gaps.sql` (188 baris)
- `quickrx-new/supabase/migrations/008_inventory_transactions.sql` (83 baris)
- `quickrx-new/supabase/migrations/010_remove_dose_history_from_supply.sql` (72 baris)

**Fail Sokongan:**
- `quickrx-new/src/types/index.ts` — Jenis TypeScript (skema aplikasi)

**Tarikh Analisis:** 26 Julai 2026

---

## 1. Gambaran Keseluruhan

QuickRxRecord menggunakan **PostgreSQL melalui Supabase** sebagai pangkalan data utamanya. Skema mengandungi **14 jadual**, **2 fungsi tersimpan (stored functions)**, dan pada asalnya menggunakan **Row Level Security (RLS)** yang kemudiannya **dinyahaktifkan** (pengesahan kini dikendalikan di peringkat aplikasi).

Skema ini direka untuk menyokong aliran kerja farmasi/klinik:
- Pengurusan pengguna/staff (profiles)
- Katalog ubat (items) dengan kelompok (batches)
- Pendaftaran pesakit (patients)
- Penugasan ubat kepada pesakit (patient_item_assignments)
- Pembekalan ubat dari stok (supply_records)
- Penjejakan perubahan dos (dose_history)
- Jejak audit (batch_adjustments, inventory_transactions)

**Ciri-ciri utama:**
- UUID sebagai kunci primer untuk semua jadual
- Cap masa automatik (`created_at`, `updated_at` dengan trigger)
- Hubungan rujukan sendiri (self-referential) untuk penggabungan pesakit
- Transaksi atomik untuk pembekalan (fungsi `process_supply`)
- Jadual carian (lookup tables) dengan data benih (seed data) dari pangkalan data warisan SRQ.db3

---

## 2. Senarai Penuh Jadual

| # | Jadual | Migrasi | Baris SQL | Tujuan |
|---|--------|---------|-----------|--------|
| 1 | `profiles` | 001 | 7 | Pengguna sistem (staff) |
| 2 | `items` | 001 | 7 | Katalog ubat/item |
| 3 | `item_batches` | 001 | 6 | Kelompok stok dengan tarikh luput |
| 4 | `patients` | 001 | 10 | Pesakit berdaftar |
| 5 | `patient_item_assignments` | 001 | 10 | Penugasan item kepada pesakit |
| 6 | `supply_records` | 001 | 8 | Rekod setiap pembekalan |
| 7 | `dose_history` | 001 | 6 | Rekod perubahan dos |
| 8 | `password_reset_requests` | 002 | 4 | Permintaan reset kata laluan |
| 9 | `batch_adjustments` | 006 | 5 | Log audit pelarasan stok kelompok |
| 10 | `item_categories` | 007 | 3 | Kategori ubat (lookup) |
| 11 | `item_forms` | 007 | 3 | Bentuk dos (lookup) |
| 12 | `supply_durations` | 007 | 3 | Tempoh bekalan (lookup) |
| 13 | `staff_migration_lookup` | 007 | 3 | Pemetaan ID staff lama→baru |
| 14 | `inventory_transactions` | 008/010 | 6 | Jejak audit pergerakan stok |

---

## 3. Analisis Terperinci Setiap Jadual

### 3.1 `profiles` — Profil Pengguna/Staff

| Lajur | Jenis | Kekangan | Penerangan |
|-------|------|----------|------------|
| `id` | `UUID` | PK, FK→`auth.users(id)`, ON DELETE CASCADE | ID pengguna (dari Supabase Auth) |
| `nama` | `TEXT` | NOT NULL | Nama penuh |
| `jawatan` | `TEXT` | NULL | Jawatan (opsyenal) |
| `nama_pengguna` | `TEXT` | UNIQUE, NOT NULL | Nama pengguna untuk log masuk |
| `peranan` | `peranan_enum` | NOT NULL, DEFAULT 'Kakitangan Farmasi' | Peranan dalam sistem |
| `aktif` | `BOOLEAN` | NOT NULL, DEFAULT true | Status aktif |
| `kata_laluan_hash` | `TEXT` | NULL (ditambah dalam 004) | Hash kata laluan untuk pengesahan tersuai |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | Tarikh pendaftaran |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | Tarikh kemas kini terakhir (auto trigger) |

**Trigger:** `update_profiles_updated_at` (BEFORE UPDATE → auto `updated_at = now()`)

**Enum `peranan_enum`:**
- `Pentadbir` — Akses penuh
- `Penjaga Stor` — Urus inventori & pesakit
- `Kakitangan Farmasi` — Urus pesakit & bekalan
- `Kakitangan Klinik` — Lihat sahaja

**Catatan:** Jadual ini dulunya dirujuk dari `auth.users` (Supabase Auth), tetapi selepas migrasi 005 (nyahaktif RLS) dan 004 (pengesahan tersuai), pengesahan kini dikendalikan di peringkat aplikasi melalui `kata_laluan_hash`.

---

### 3.2 `items` — Katalog Item/Ubat

| Lajur | Jenis | Kekangan | Penerangan |
|-------|------|----------|------------|
| `id` | `UUID` | PK, DEFAULT uuid_generate_v4() | ID unik |
| `kod_item` | `TEXT` | UNIQUE, NOT NULL | Kod item (contoh: "PRC-001") |
| `nama_item` | `TEXT` | NOT NULL | Nama generik |
| `nama_dagangan` | `TEXT` | NULL | Nama dagangan/jenama |
| `kekuatan` | `TEXT` | NULL | Dos/kekuatan (contoh: "500mg") |
| `id_kategori` | `UUID` | FK→`item_categories(id)`, NULL | Kategori ubat |
| `id_bentuk` | `UUID` | FK→`item_forms(id)`, NULL | Bentuk dos (tablet, sirap, dll.) |
| `kuota` | `INTEGER` | NULL | Paras stok minimum (untuk amaran stok rendah) |
| `catatan` | `TEXT` | NULL | Catatan am |
| `aktif` | `BOOLEAN` | NOT NULL, DEFAULT true | Status aktif |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | Tarikh cipta |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | Tarikh kemas kini (auto trigger) |

**Kunci asing (FK):**
- `id_kategori` → `item_categories(id)` — Ditambah dalam migrasi 007 (NOT VALID constraint)
- `id_bentuk` → `item_forms(id)` — Ditambah dalam migrasi 007 (NOT VALID constraint)

**Indeks:**
- `idx_items_name` pada `nama_item`
- `idx_items_kod` pada `kod_item`

**Trigger:** `update_items_updated_at`

---

### 3.3 `item_batches` — Kelompok Stok

| Lajur | Jenis | Kekangan | Penerangan |
|-------|------|----------|------------|
| `id` | `UUID` | PK, DEFAULT uuid_generate_v4() | ID unik |
| `item_id` | `UUID` | FK→`items(id)`, ON DELETE CASCADE, NOT NULL | Item rujukan |
| `nombor_kelompok` | `TEXT` | NOT NULL | Nombor kelompok (contoh: "B2026-001") |
| `tarikh_luput` | `DATE` | NOT NULL | Tarikh luput |
| `kuantiti` | `INTEGER` | NOT NULL, DEFAULT 0, CHECK >= 0 | Kuantiti stok semasa |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | Tarikh cipta |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | Tarikh kemas kini (auto trigger) |

**Indeks:**
- `idx_item_batches_item_id` pada `item_id`
- `idx_item_batches_luput` pada `tarikh_luput`

**Trigger:** `update_item_batches_updated_at`

**Kekangan CHECK:** `kuantiti >= 0` — mencegah stok negatif di peringkat pangkalan data

---

### 3.4 `patients` — Pesakit

| Lajur | Jenis | Kekangan | Penerangan |
|-------|------|----------|------------|
| `id` | `UUID` | PK, DEFAULT uuid_generate_v4() | ID unik |
| `nama` | `TEXT` | NOT NULL | Nama penuh pesakit |
| `nombor_kad_pengenalan` | `TEXT` | NULL | No. KP (MyKad) |
| `nombor_pendaftaran_hospital` | `TEXT` | NULL | No. pendaftaran hospital |
| `dokumen_lain` | `TEXT` | NULL | Dokumen pengenalan lain |
| `nombor_telefon` | `TEXT` | NULL | No. telefon |
| `alamat` | `TEXT` | NULL | Alamat |
| `catatan` | `TEXT` | NULL | Catatan am |
| `aktif` | `BOOLEAN` | NOT NULL, DEFAULT true | Status aktif |
| `merged_into` | `UUID` | FK→`patients(id)`, NULL | ID pesakit utama selepas penggabungan |
| `tarikh_daftar` | `DATE` | NULL (ditambah dalam 007) | Tarikh pendaftaran pesakit |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | Tarikh cipta |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | Tarikh kemas kini (auto trigger) |

**Hubungan rujukan sendiri:** `merged_into REFERENCES patients(id)` — digunakan untuk penggabungan pesakit pendua. Apabila pesakit digabungkan, rekod asal ditandakan dengan `aktif = false` dan `merged_into` merujuk kepada pesakit utama.

**Indeks:**
- `idx_patients_name` pada `nama`
- `idx_patients_kp` pada `nombor_kad_pengenalan`
- `idx_patients_hospital` pada `nombor_pendaftaran_hospital`
- `idx_patients_tarikh_daftar` pada `tarikh_daftar` (ditambah dalam 007)

**Trigger:** `update_patients_updated_at`

---

### 3.5 `patient_item_assignments` — Penugasan Item kepada Pesakit

| Lajur | Jenis | Kekangan | Penerangan |
|-------|------|----------|------------|
| `id` | `UUID` | PK, DEFAULT uuid_generate_v4() | ID unik |
| `patient_id` | `UUID` | FK→`patients(id)`, NOT NULL | Pesakit |
| `item_id` | `UUID` | FK→`items(id)`, NOT NULL | Item/ubat |
| `dos` | `TEXT` | NULL | Arahan dos (contoh: "1x1") |
| `tarikh_mula_guna` | `DATE` | NOT NULL | Tarikh mula menggunakan ubat |
| `dimulakan_oleh` | `UUID` | FK→`profiles(id)`, NULL | Staff yang memulakan |
| `tarikh_tamat_guna` | `DATE` | NULL | Tarikh tamat (jika ditamatkan) |
| `ditamatkan_oleh` | `UUID` | FK→`profiles(id)`, NULL | Staff yang menamatkan |
| `kakitangan_farmasi_perekod` | `UUID` | FK→`profiles(id)`, NULL | Staff yang merekodkan |
| `aktif` | `BOOLEAN` | NOT NULL, DEFAULT true | Status tugasan aktif |
| `sebab_tamat` | `TEXT` | NULL | Sebab penamatan |
| `catatan_penggunaan` | `TEXT` | NULL (ditambah dalam 007) | Catatan penggunaan |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | Tarikh cipta |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | Tarikh kemas kini (auto trigger) |

**Tiga rujukan FK ke `profiles`:**
- `dimulakan_oleh` — Yang memulakan tugasan
- `ditamatkan_oleh` — Yang menamatkan tugasan
- `kakitangan_farmasi_perekod` — Yang merekodkan tugasan

**Indeks:**
- `idx_patient_assignments_patient` pada `patient_id`
- `idx_patient_assignments_item` pada `item_id`
- `idx_patient_assignments_active` pada `aktif WHERE aktif = true` (indeks separa)

**Trigger:** `update_assignments_updated_at`

---

### 3.6 `supply_records` — Rekod Pembekalan

| Lajur | Jenis | Kekangan | Penerangan |
|-------|------|----------|------------|
| `id` | `UUID` | PK, DEFAULT uuid_generate_v4() | ID unik |
| `assignment_id` | `UUID` | FK→`patient_item_assignments(id)`, NOT NULL | Tugasan dirujuk |
| `tarikh_dibekal` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | Tarikh pembekalan |
| `dos` | `TEXT` | NOT NULL | Dos yang dibekalkan |
| `tempoh_dibekal` | `TEXT` | NULL | Tempoh bekalan (contoh: "30 Hari") |
| `kuantiti` | `INTEGER` | NOT NULL, CHECK > 0 | Kuantiti dibekalkan |
| `batch_id` | `UUID` | FK→`item_batches(id)`, NULL | Kelompok sumber |
| `kakitangan_pembekal` | `UUID` | FK→`profiles(id)`, NOT NULL | Staff yang membekal |
| `catatan_bekalan` | `TEXT` | NULL | Catatan bekalan |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | Tarikh cipta |

**Kekangan CHECK:** `kuantiti > 0` — mencegah rekod bekalan dengan kuantiti sifar/negatif

**Indeks:**
- `idx_supply_assignment` pada `assignment_id`
- `idx_supply_date` pada `tarikh_dibekal`

**Nota:** Tiada `updated_at` atau trigger — rekod bekalan adalah tidak boleh ubah (append-only) selepas dicipta.

---

### 3.7 `dose_history` — Sejarah Perubahan Dos

| Lajur | Jenis | Kekangan | Penerangan |
|-------|------|----------|------------|
| `id` | `UUID` | PK, DEFAULT uuid_generate_v4() | ID unik |
| `assignment_id` | `UUID` | FK→`patient_item_assignments(id)`, NOT NULL | Tugasan dirujuk |
| `tarikh` | `DATE` | NOT NULL | Tarikh perubahan dos |
| `dos` | `TEXT` | NOT NULL | Nilai dos |
| `aktif` | `BOOLEAN` | NOT NULL, DEFAULT true | Status rekod aktif |
| `catatan` | `TEXT` | NULL | Catatan perubahan |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | Tarikh cipta |

**Indeks:**
- `idx_dose_assignment` pada `assignment_id`

**Catatan penting:** Kod aplikasi merujuk kepada lajur `dikemaskini_oleh` (FK ke profiles) dalam jadual ini, dan melakukan JOIN dengan `profiles!dikemaskini_oleh(nama)`. Walau bagaimanapun, **lajur ini TIDAK wujud dalam skema SQL semasa**. Ini adalah ketidakselarasan antara skema pangkalan data dan kod aplikasi.

---

### 3.8 `password_reset_requests` — Permintaan Reset Kata Laluan

| Lajur | Jenis | Kekangan | Penerangan |
|-------|------|----------|------------|
| `id` | `UUID` | PK, DEFAULT uuid_generate_v4() | ID unik |
| `user_id` | `UUID` | FK→`profiles(id)`, ON DELETE CASCADE, NOT NULL | Pengguna yang memohon |
| `requested_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | Tarikh permintaan |
| `status` | `TEXT` | NOT NULL, DEFAULT 'pending', CHECK IN ('pending','approved','rejected') | Status permintaan |
| `resolved_by` | `UUID` | FK→`profiles(id)`, NULL | Pentadbir yang menyelesaikan |
| `resolved_at` | `TIMESTAMPTZ` | NULL | Tarikh penyelesaian |
| `notes` | `TEXT` | NULL | Nota tambahan |

**Indeks:**
- `idx_reset_requests_status` pada `status`
- `idx_reset_requests_user` pada `user_id`

**Aliran proses:**
1. Pengguna menghantar permintaan (INSERT, status='pending')
2. Pentadbir meluluskan/menolak (UPDATE, tukar status)
3. Kod aplikasi menyemak status 409 untuk mengelakkan spam permintaan

---

### 3.9 `batch_adjustments` — Audit Pelarasan Kelompok

| Lajur | Jenis | Kekangan | Penerangan |
|-------|------|----------|------------|
| `id` | `UUID` | PK, DEFAULT uuid_generate_v4() | ID unik |
| `batch_id` | `UUID` | FK→`item_batches(id)`, ON DELETE CASCADE, NOT NULL | Kelompok dirujuk |
| `previous_kuantiti` | `INTEGER` | NOT NULL | Kuantiti sebelum pelarasan |
| `new_kuantiti` | `INTEGER` | NOT NULL | Kuantiti selepas pelarasan |
| `change` | `INTEGER` | NOT NULL | Perubahan (positif=tambah, negatif=kurang) |
| `reason` | `TEXT` | NULL | Sebab pelarasan |
| `adjusted_by` | `UUID` | FK→`profiles(id)`, NULL | Staff yang melaras |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | Tarikh pelarasan |

**Indeks:**
- `idx_batch_adjustments_batch` pada `batch_id`
- `idx_batch_adjustments_created` pada `created_at DESC`

**Kegunaan:** Jejak audit untuk sebarang perubahan manual pada kuantiti kelompok (cth. pembetulan stok, pelupusan, penemuan stok).

---

### 3.10 `item_categories` — Kategori Ubat (Lookup)

| Lajur | Jenis | Kekangan | Penerangan |
|-------|------|----------|------------|
| `id` | `UUID` | PK, DEFAULT uuid_generate_v4() | ID unik |
| `nama` | `TEXT` | NOT NULL | Nama kategori |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | Tarikh cipta |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | Tarikh kemas kini (auto trigger) |

**Indeks:** `idx_item_categories_name` pada `nama`

**Data benih (seed data) dari SRQ.db3:**

| ID | Nama |
|----|------|
| `a0000000-...0001` | Kategori A |
| `a0000000-...0002` | Psikiatrik |
| `a0000000-...0003` | KPK Item |
| `a0000000-...0004` | Kategori B |
| `a0000000-...0005` | Kategori A/KK (Ubat Terkawal) |
| `a0000000-...0006` | Kategori A* |

**Trigger:** `update_item_categories_updated_at`

---

### 3.11 `item_forms` — Bentuk Dos (Lookup)

| Lajur | Jenis | Kekangan | Penerangan |
|-------|------|----------|------------|
| `id` | `UUID` | PK, DEFAULT uuid_generate_v4() | ID unik |
| `nama` | `TEXT` | NOT NULL | Nama bentuk dos |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | Tarikh cipta |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | Tarikh kemas kini (auto trigger) |

**Indeks:** `idx_item_forms_name` pada `nama`

**Data benih (11 bentuk dos):**
Tablet, Kapsul, Sirap, Patch, Drops, Injection, Eye Drops, Nasal Spray, Inhaler, Solution, Serbuk

**Trigger:** `update_item_forms_updated_at`

---

### 3.12 `supply_durations` — Tempoh Bekalan (Lookup)

| Lajur | Jenis | Kekangan | Penerangan |
|-------|------|----------|------------|
| `id` | `UUID` | PK, DEFAULT uuid_generate_v4() | ID unik |
| `nama` | `TEXT` | NOT NULL | Nama tempoh |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | Tarikh cipta |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | Tarikh kemas kini (auto trigger) |

**Indeks:** `idx_supply_durations_name` pada `nama`

**Data benih:** Hari, Minggu, Bulan

**Trigger:** `update_supply_durations_updated_at`

---

### 3.13 `staff_migration_lookup` — Pemetaan ID Staff (Migrasi Warisan)

| Lajur | Jenis | Kekangan | Penerangan |
|-------|------|----------|------------|
| `old_id` | `INTEGER` | PK | ID staff dari SRQ.db3 |
| `profile_id` | `UUID` | FK→`profiles(id)`, NOT NULL | ID profil baharu |
| `migrated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | Tarikh migrasi |

**Indeks:**
- `idx_staff_migration_old` pada `old_id`
- `idx_staff_migration_profile` pada `profile_id`

**Kegunaan:** Jadual jambatan untuk menjejak pemetaan antara ID integer lama (dari pangkalan data Access/SQLite warisan SRQ.db3) dan UUID baharu.

---

### 3.14 `inventory_transactions` — Jejak Audit Pergerakan Stok

| Lajur | Jenis | Kekangan | Penerangan |
|-------|------|----------|------------|
| `id` | `UUID` | PK, DEFAULT uuid_generate_v4() | ID unik |
| `item_id` | `UUID` | FK→`items(id)`, NOT NULL | Item terlibat |
| `batch_id` | `UUID` | FK→`item_batches(id)`, NULL | Kelompok terlibat |
| `jenis` | `TEXT` | NOT NULL, CHECK IN ('masuk', 'keluar') | Arah pergerakan |
| `kuantiti` | `INTEGER` | NOT NULL, CHECK > 0 | Kuantiti |
| `rujukan_id` | `UUID` | NULL | ID rujukan (cth. supply ID) |
| `rujukan_type` | `TEXT` | NULL | Jenis rujukan (cth. 'supply') |
| `catatan` | `TEXT` | NULL | Catatan transaksi |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | Tarikh transaksi |

**Indeks:**
- `idx_inv_trans_item` pada `item_id`
- `idx_inv_trans_batch` pada `batch_id`
- `idx_inv_trans_created` pada `created_at DESC`

**Kegunaan:** Setiap kali `process_supply` dipanggil, satu rekod `jenis='keluar'` dicipta secara automatik dengan `rujukan_type='supply'`. Rekod `jenis='masuk'` dijangkakan untuk penerimaan stok baharu.

---

## 4. Indeks Pangkalan Data

### 4.1 Indeks Kunci Asing (FK) — Prestasi JOIN

| Indeks | Jadual | Lajur |
|--------|--------|-------|
| `idx_item_batches_item_id` | `item_batches` | `item_id` |
| `idx_batch_adjustments_batch` | `batch_adjustments` | `batch_id` |
| `idx_patient_assignments_patient` | `patient_item_assignments` | `patient_id` |
| `idx_patient_assignments_item` | `patient_item_assignments` | `item_id` |
| `idx_supply_assignment` | `supply_records` | `assignment_id` |
| `idx_dose_assignment` | `dose_history` | `assignment_id` |
| `idx_inv_trans_item` | `inventory_transactions` | `item_id` |
| `idx_inv_trans_batch` | `inventory_transactions` | `batch_id` |

### 4.2 Indeks Carian — Prestasi Kueri WHERE

| Indeks | Jadual | Lajur |
|--------|--------|-------|
| `idx_item_batches_luput` | `item_batches` | `tarikh_luput` |
| `idx_patients_name` | `patients` | `nama` |
| `idx_patients_kp` | `patients` | `nombor_kad_pengenalan` |
| `idx_patients_hospital` | `patients` | `nombor_pendaftaran_hospital` |
| `idx_patients_tarikh_daftar` | `patients` | `tarikh_daftar` |
| `idx_items_name` | `items` | `nama_item` |
| `idx_items_kod` | `items` | `kod_item` |
| `idx_supply_date` | `supply_records` | `tarikh_dibekal` |
| `idx_reset_requests_status` | `password_reset_requests` | `status` |
| `idx_reset_requests_user` | `password_reset_requests` | `user_id` |
| `idx_item_categories_name` | `item_categories` | `nama` |
| `idx_item_forms_name` | `item_forms` | `nama` |
| `idx_supply_durations_name` | `supply_durations` | `nama` |

### 4.3 Indeks Separa

| Indeks | Jadual | Syarat |
|--------|--------|--------|
| `idx_patient_assignments_active` | `patient_item_assignments` | `WHERE aktif = true` |

Indeks separa ini sangat cekap kerana hanya mengindeks tugasan yang aktif — mengurangkan saiz indeks dan mempercepatkan kueri yang menapis tugasan aktif.

### 4.4 Indeks Kronologi (DESC)

| Indeks | Jadual | Lajur |
|--------|--------|-------|
| `idx_batch_adjustments_created` | `batch_adjustments` | `created_at DESC` |
| `idx_inv_trans_created` | `inventory_transactions` | `created_at DESC` |

---

## 5. Fungsi Tersimpan (Stored Functions)

### 5.1 `process_supply` — Transaksi Pembekalan Atomik

**Versi terkini:** Migrasi 010 (menggantikan versi dari 001 dan 008)

**Signature:**
```sql
process_supply(
  p_assignment_id UUID,
  p_dos TEXT,
  p_tempoh_dibekal TEXT,
  p_kuantiti INTEGER,
  p_batch_id UUID,
  p_kakitangan_pembekal UUID,
  p_catatan_bekalan TEXT DEFAULT NULL
) RETURNS UUID
```

**Aliran:**
1. Dapatkan `item_id` dari tugasan (`patient_item_assignments`)
2. Kunci baris kelompok (`FOR UPDATE`) — mencegah race condition
3. Sahkan kelompok wujud
4. Sahkan stok mencukupi (`v_current_stock < p_kuantiti`)
5. Kurangkan stok kelompok (`kuantiti = kuantiti - p_kuantiti`)
6. Cipta rekod `supply_records`
7. Cipta rekod `inventory_transactions` (jenis='keluar', rujukan_type='supply')
8. Kembalikan `v_supply_id`

**Nota evolusi:** Versi 001 asal menyertakan `dose_history` INSERT dan `patient_item_assignments` UPDATE — ini telah dialih keluar dalam versi 010 kerana:
- Menyebabkan entri pendua dalam sejarah dos
- Menukar dos preskripsi secara tidak sengaja pada setiap pembekalan
- Pengemaskinian dos kini dikendalikan sepenuhnya di sisi klien (aplikasi)

**Ciri-ciri:**
- `SECURITY DEFINER` — Berjalan dengan keizinan pemilik fungsi, bukan pemanggil
- Bahasa: `plpgsql` (PostgreSQL procedural language)
- Kembalian: UUID rekod bekalan yang dicipta

### 5.2 `merge_patients` — Penggabungan Pesakit Pendua

**Signature:**
```sql
merge_patients(
  p_primary_id UUID,
  p_secondary_ids UUID[]
) RETURNS VOID
```

**Aliran:**
1. Gelung melalui setiap `p_secondary_id`
2. Pindahkan semua tugasan ke pesakit utama (`UPDATE patient_item_assignments SET patient_id = p_primary_id`)
3. Tandakan pesakit sekunder sebagai digabung (`merged_into = p_primary_id, aktif = false`)

**Nota:** Fungsi ini digunakan oleh komponen `MergeDialog` untuk penggabungan sisi pelayan. Walau bagaimanapun, kod aplikasi (`merge-dialog.tsx`) juga mempunyai logik penggabungan sisi klien yang lebih kompleks (mengendalikan item pendua antara pesakit). Mungkin terdapat pertindihan atau ketidakselarasan antara kedua-dua pendekatan.

### 5.3 `update_password_hash` — Kemas Kini Hash Kata Laluan (Admin)

**Signature:**
```sql
update_password_hash(
  p_user_id UUID,
  p_new_hash TEXT
) RETURNS VOID
```

**Fungsi:** Mengemaskini `kata_laluan_hash` untuk pengguna tertentu. Digunakan oleh pentadbir untuk menetapkan semula kata laluan.

### 5.4 `update_updated_at` — Trigger Auto Cap Masa

**Fungsi trigger generik** yang menetapkan `NEW.updated_at = now()` sebelum sebarang operasi UPDATE. Dipasang pada 8 jadual:
`profiles`, `items`, `item_batches`, `patients`, `patient_item_assignments`, `item_categories`, `item_forms`, `supply_durations`

### 5.5 Fungsi Yang Dirujuk Tetapi Tidak Ditakrifkan

**`count_active_assignments`** — Fungsi RPC (Remote Procedure Call) yang digunakan oleh aplikasi untuk mengira tugasan aktif setiap item. Digunakan dalam kueri `["items-with-stats"]` pada halaman butiran pesakit. **Tidak dijumpai dalam mana-mana fail migrasi** — mungkin dicipta secara manual melalui Supabase SQL Editor.

---

## 6. Kekangan Pangkalan Data (Constraints)

### 6.1 Kunci Primer (Primary Keys)

Semua jadual menggunakan `UUID PRIMARY KEY DEFAULT uuid_generate_v4()`, kecuali:
- `profiles.id` — Merujuk kepada `auth.users(id)` (UUID)
- `staff_migration_lookup.old_id` — INTEGER (dari pangkalan data warisan)

### 6.2 Kunci Asing (Foreign Keys)

```
profiles.id ──────────────────────────────────────────────────────────────┐
  ├─── items ───< item_batches ───< batch_adjustments                     │
  │       ├──< patient_item_assignments ──< supply_records                │
  │       │       ├──< dose_history                                       │
  │       │       └──< supply_records ──── inventory_transactions         │
  │       ├──< inventory_transactions                                     │
  │       └──< item_categories (FK id_kategori)                           │
  │            item_forms (FK id_bentuk)                                  │
  ├─── patients ──< patient_item_assignments (lihat atas)                 │
  │       └── merged_into ──> patients (rujukan sendiri)                  │
  ├─── password_reset_requests                                            │
  │       └── resolved_by ──> profiles                                    │
  ├─── batch_adjustments.adjusted_by                                      │
  └─── staff_migration_lookup.profile_id                                  │
```

### 6.3 Kekangan CHECK

| Jadual | Kekangan | Penerangan |
|--------|----------|------------|
| `item_batches` | `kuantiti >= 0` | Stok tidak boleh negatif |
| `supply_records` | `kuantiti > 0` | Bekalan mesti positif |
| `inventory_transactions` | `kuantiti > 0` | Transaksi mesti positif |
| `inventory_transactions` | `jenis IN ('masuk', 'keluar')` | Hanya dua arah dibenarkan |
| `password_reset_requests` | `status IN ('pending', 'approved', 'rejected')` | Hanya tiga status sah |

### 6.4 Kekangan UNIQUE

| Jadual | Lajur |
|--------|-------|
| `profiles` | `nama_pengguna` |
| `items` | `kod_item` |

### 6.5 Polisi ON DELETE

| FK | Polisi |
|----|--------|
| `profiles` → `auth.users` | CASCADE (padam pengguna = padam profil) |
| `item_batches` → `items` | CASCADE (padam item = padam semua kelompok) |
| `batch_adjustments` → `item_batches` | CASCADE (padam kelompok = padam log) |
| `password_reset_requests` → `profiles` | CASCADE (padam pengguna = padam permintaan) |
| Semua FK lain | NO ACTION (default) — mencegah pemadaman jika dirujuk |

---

## 7. Row Level Security (RLS) — Sejarah

### 7.1 Fasa 1: RLS Diaktifkan (Migrasi 001 & 002)

Pada asalnya, RLS diaktifkan pada **9 jadual** dengan polisi berasaskan peranan:

| Peranan | Profil | Item | Kelompok | Pesakit | Tugasan | Bekalan | Dos |
|---------|--------|------|----------|---------|---------|---------|-----|
| Pentadbir | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD |
| Penjaga Stor | Baca | CRUD | CRUD | CRUD | CRUD | CRUD* | CRUD* |
| Kakitangan Farmasi | Baca | Baca | Baca | CRUD | CRUD | CRUD* | CRUD* |
| Kakitangan Klinik | Baca | Baca | Baca | Baca | Baca | Baca | Baca |

*Nota: INSERT dan SELECT sahaja (bukan UPDATE/DELETE untuk bekalan dan dos)

Fungsi `get_user_role()` (SECURITY DEFINER) digunakan untuk mendapatkan peranan pengguna dalam polisi RLS.

### 7.2 Fasa 2: RLS Dinyahaktifkan (Migrasi 005)

**Sebab:** Sistem bertukar kepada pengesahan tersuai (kata laluan dalam `profiles.kata_laluan_hash`) dan tidak lagi menggunakan `auth.uid()` dan `auth.role()`. Polisi RLS yang bergantung pada fungsi `auth.*` akan menyekat semua akses data.

**Tindakan:**
1. Semua polisi RLS digugurkan (`DROP POLICY IF EXISTS`) — 43 polisi
2. RLS dinyahaktifkan pada semua jadual (`DISABLE ROW LEVEL SECURITY`)
3. Fungsi `get_user_role()` digugurkan

**Implikasi keselamatan:** Semua pengesahan kini dikendalikan di peringkat aplikasi melalui `lib/auth-context.tsx`. Ini bermakna kunci API Supabase (anon key) mesti dilindungi dengan ketat kerana sesiapa yang mempunyai kunci tersebut boleh mengakses semua data.

### 7.3 Fasa 3: RLS Dipermudahkan (Migrasi 006–007)

Jadual baharu (`batch_adjustments`, `item_categories`, `item_forms`, `supply_durations`) mempunyai polisi RLS ringkas yang membenarkan semua akses:
```sql
CREATE POLICY "all_select" ON table FOR SELECT USING (true);
CREATE POLICY "all_insert" ON table FOR INSERT WITH CHECK (true);
```

Ini pada dasarnya tidak menguatkuasakan sebarang sekatan — akses penuh untuk sesiapa yang mempunyai kunci API.

### 7.4 Fasa 4: RLS Dinyahaktifkan Lagi (Migrasi 010)

`inventory_transactions` juga dinyahaktifkan RLS (`DISABLE ROW LEVEL SECURITY`), konsisten dengan jadual teras lain.

---

## 8. Pencetus (Triggers) Automatik

| Trigger | Jadual | Peristiwa | Tindakan |
|---------|--------|-----------|----------|
| `update_profiles_updated_at` | `profiles` | BEFORE UPDATE | `updated_at = now()` |
| `update_items_updated_at` | `items` | BEFORE UPDATE | `updated_at = now()` |
| `update_item_batches_updated_at` | `item_batches` | BEFORE UPDATE | `updated_at = now()` |
| `update_patients_updated_at` | `patients` | BEFORE UPDATE | `updated_at = now()` |
| `update_assignments_updated_at` | `patient_item_assignments` | BEFORE UPDATE | `updated_at = now()` |
| `update_item_categories_updated_at` | `item_categories` | BEFORE UPDATE | `updated_at = now()` |
| `update_item_forms_updated_at` | `item_forms` | BEFORE UPDATE | `updated_at = now()` |
| `update_supply_durations_updated_at` | `supply_durations` | BEFORE UPDATE | `updated_at = now()` |

**Jadual TANPA trigger:**
- `supply_records` — Rekod dianggap tidak boleh ubah (tidak pernah dikemas kini selepas dicipta)
- `dose_history` — Sama, tidak boleh ubah (walaupun kod cuba mengemas kini melalui `UPDATE`)
- `password_reset_requests` — Dikemas kini secara manual tanpa auto cap masa
- `batch_adjustments` — Rekod audit tidak boleh ubah
- `inventory_transactions` — Rekod audit tidak boleh ubah
- `staff_migration_lookup` — Data statik

---

## 9. Sambungan & Kebergantungan

### 9.1 Sambungan PostgreSQL

| Sambungan | Kegunaan |
|-----------|----------|
| `uuid-ossp` | Penjanaan UUID (`uuid_generate_v4()`) |

### 9.2 Kebergantungan Antara Migrasi

```
001 (Skema teras)
├── 002 (password_reset_requests)
├── 004 (kata_laluan_hash + update_password_hash)
├── 005 (NYAKTIFKAN SEMUA RLS)
├── 006 (batch_adjustments)
├── 007 (item_categories, item_forms, supply_durations + benih)
├── 008 (inventory_transactions + process_supply v2)
└── 010 (process_supply v3 — versi muktamad)
```

**Nota:** Migrasi 003 dan 009 tiada dalam direktori — mungkin telah digugurkan atau dinamakan semula.

---

## 10. Data Benih (Seed Data)

### 10.1 Kategori Ubat (6 rekod)

| UUID | Nama |
|------|------|
| `a0000000-...0001` | Kategori A |
| `a0000000-...0002` | Psikiatrik |
| `a0000000-...0003` | KPK Item |
| `a0000000-...0004` | Kategori B |
| `a0000000-...0005` | Kategori A/KK (Ubat Terkawal) |
| `a0000000-...0006` | Kategori A* |

### 10.2 Bentuk Dos (11 rekod)

Tablet, Kapsul, Sirap, Patch, Drops, Injection, Eye Drops, Nasal Spray, Inhaler, Solution, Serbuk

### 10.3 Tempoh Bekalan (3 rekod)

Hari, Minggu, Bulan

### 10.4 Catatan

UUID untuk data benih menggunakan format `{prefix}0000000-0000-0000-0000-00000000000{n}` — ini adalah UUID deterministik yang boleh dirujuk secara konsisten merentasi persekitaran (pembangunan, pementasan, pengeluaran).

---

## 11. Ketidakselarasan Skema vs Aplikasi

### 11.1 Lajur `dikemaskini_oleh` pada `dose_history`

**Isu:** Kod aplikasi (halaman Butiran Pesakit) melakukan JOIN dengan `profiles!dikemaskini_oleh(nama)` apabila mengambil sejarah dos. Walau bagaimanapun, jadual `dose_history` dalam skema **TIDAK** mempunyai lajur `dikemaskini_oleh`. Ini akan menyebabkan ralat pada masa larian jika kueri tersebut dilaksanakan.

**Pembetulan diperlukan:** Tambah lajur `dikemaskini_oleh UUID REFERENCES profiles(id)` pada jadual `dose_history`.

### 11.2 Jadual `notifications` Dirujuk Tetapi Tidak Wujud

**Isu:** Migrasi 005 (nyahaktif RLS) mengandungi:
```sql
DROP POLICY IF EXISTS "users_view_notifications" ON notifications;
DROP POLICY IF EXISTS "users_update_notifications" ON notifications;
DROP POLICY IF EXISTS "service_insert_notifications" ON notifications;
```
Dan:
```sql
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
```
Tetapi jadual `notifications` **tidak dicipta dalam mana-mana fail migrasi**. Ini mungkin rujukan kepada jadual yang wujud sebelum migrasi direkodkan, atau ciri yang dirancang tetapi tidak dilaksanakan.

### 11.3 Fungsi `count_active_assignments` Tidak Ditakrifkan

**Isu:** Aplikasi menggunakan `supabase.rpc("count_active_assignments")` dalam kueri `["items-with-stats"]` tetapi fungsi ini tidak dijumpai dalam mana-mana migrasi. Ia mungkin dicipta melalui Supabase SQL Editor tanpa direkodkan dalam fail migrasi.

---

## 12. Migrasi Pangkalan Data Warisan (SRQ.db3)

### 12.1 Jadual Jambatan

`staff_migration_lookup` menyediakan pemetaan antara:
- ID integer dari pangkalan data warisan (SRQ.db3 — kemungkinan SQLite atau Microsoft Access)
- UUID dari sistem baharu

### 12.2 Penyesuaian Skema

Migrasi 007 menambah lajur untuk menyokong data warisan:
- `patients.tarikh_daftar` — Tarikh pendaftaran dari sistem lama
- `patient_item_assignments.catatan_penggunaan` — Catatan penggunaan dari sistem lama

---

## 13. Ringkasan Statistik Skema

| Metrik | Nilai |
|--------|-------|
| Jumlah jadual | 14 |
| Jumlah lajur | ~120 |
| Jumlah indeks | 22 |
| Jumlah trigger | 8 |
| Jumlah fungsi tersimpan | 3 (+ 2 yang dirujuk tetapi tidak ditakrifkan) |
| Jumlah polisi RLS | 0 aktif (semua dinyahaktifkan) |
| Jumlah data benih | 20 rekod (6 kategori + 11 bentuk + 3 tempoh) |
| Jumlah kekangan CHECK | 5 |
| Jumlah kekangan UNIQUE | 2 |
| Jumlah FK dengan CASCADE | 3 |
| Enums | 1 (`peranan_enum`) |
| Sambungan PostgreSQL | 1 (`uuid-ossp`) |

---

## 14. Kekuatan & Amalan Baik

1. **UUID untuk kunci primer:** Elakkan perlanggaran ID, sesuai untuk sistem teragih dan migrasi data
2. **Indeks menyeluruh:** 22 indeks meliputi semua FK, lajur carian utama, dan lajur isihan (DESC)
3. **Indeks separa:** `idx_patient_assignments_active WHERE aktif = true` — pengoptimuman prestasi yang bijak
4. **Transaksi atomik:** `process_supply` memastikan integriti data dengan `FOR UPDATE` lock dan operasi berbilang jadual dalam satu transaksi
5. **Auto cap masa:** Trigger `update_updated_at` pada 8 jadual memastikan audit trail yang konsisten
6. **Kekangan pangkalan data:** CHECK constraints pada kuantiti menghalang data tidak sah di peringkat terendah
7. **Data benih deterministik:** UUID yang boleh diramal untuk data rujukan memudahkan rujukan rentas persekitaran
8. **Jadual audit:** `batch_adjustments` dan `inventory_transactions` menyediakan jejak audit yang jelas
9. **Hubungan rujukan sendiri:** `patients.merged_into` membolehkan penggabungan pesakit tanpa kehilangan data
10. **Skema ternormal:** Jadual carian berasingan (`item_categories`, `item_forms`, `supply_durations`) mengelakkan pertindihan data

---

## 15. Peluang Penambahbaikan

1. **Lajur `dikemaskini_oleh` hilang:** Perlu ditambah pada jadual `dose_history` atau kod aplikasi perlu dibetulkan
2. **Jadual `notifications` hilang:** Sama ada perlu dicipta dengan migrasi, atau rujukan dalam migrasi 005 perlu dialih keluar
3. **Fungsi `count_active_assignments` perlu diformalkan:** Perlu ditambah ke dalam fail migrasi untuk kebolehhasilan semula
4. **Tiada RLS aktif:** Semua pengesahan di peringkat aplikasi — kunci API yang terdedah boleh membawa kepada kebocoran data. RLS harus dipertimbangkan semula
5. **Logik `merge_patients` tidak selaras:** Fungsi SQL adalah versi ringkas; kod aplikasi (`merge-dialog.tsx`) mempunyai logik yang lebih kompleks. Fungsi SQL tidak digunakan oleh kod
6. **Tiada indeks pada `dose_history.dikemaskini_oleh`:** Jika lajur ditambah, indeks diperlukan
7. **Tiada jadual `notifications`:** Ciri pemberitahuan yang dirancang tetapi tidak dilaksanakan
8. **Nombor migrasi tidak berjujukan:** Migrasi 003 dan 009 hilang — mungkin perlu didokumentasikan atau diisi
9. **`supply_records` tanpa `updated_at`:** Jika rekod bekalan perlu dikemas kini (seperti yang dilakukan oleh kod melalui `saveEditSupplyMutation`), lajur `updated_at` diperlukan
10. **`inventory_transactions` tanpa trigger audit:** Tiada `updated_at` dan tiada rujukan kepada `profiles` untuk menjejak siapa yang melakukan transaksi
11. **Tiada migrasi untuk `dose_history.dikemaskini_oleh`:** Ketidakselarasan kritikal antara skema dan aplikasi