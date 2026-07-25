# Analisis Halaman Pengurusan Inventori — QuickRxRecord

**Fail Dianalisis:**
- `quickrx-new/src/app/(dashboard)/stok/page.tsx` — Senarai Inventori (321 baris)
- `quickrx-new/src/app/(dashboard)/stok/[id]/page.tsx` — Butiran Item (1058 baris)

**Tarikh Analisis:** 26 Julai 2026

---

## 1. Gambaran Keseluruhan

Modul **Pengurusan Inventori** terdiri daripada dua halaman yang saling melengkapi:

1. **Senarai Inventori** (`/stok`) — Jadual indeks untuk menyemak imbas, mencari, dan menambah item ubat baharu
2. **Butiran Item** (`/stok/[id]`) — Halaman komprehensif untuk mengurus item tunggal dengan **empat bahagian utama**: maklumat item, pesakit yang menggunakan, senarai kelompok (batches), dan sejarah transaksi

Kedua-dua halaman berkongsi bahasa reka bentuk yang konsisten tetapi dengan **tema ungu** (`#7c3aed`) sebagai warna aksen — membezakannya daripada halaman pesakit (biru), papan pemuka (pelbagai), dan dispen pantas (oren).

**Jumlah baris kod:** 1,379 baris (321 + 1058) — modul terbesar dalam aplikasi dari segi kuantiti kod.

---

## 2. Halaman Senarai Inventori (`/stok`)

### 2.1 Struktur Halaman

Susun atur yang hampir sama dengan halaman Senarai Pesakit:
- Orb hiasan (ungu)
- Breadcrumb ("Inventori")
- Header (ikon Pill + tajuk + butang "Tambah Item")
- Kad utama kaca dengan sempadan kecerunan ungu
- Bar aksen animasi (ungu-biru-cyan-ungu, 4s kitaran `gradientShift`)
- Bar carian + lencana kiraan "N item"
- Jadual dengan 5 lajur (Kod, Nama Item, Kuota, Stok, Tindakan)
- Pagination 50 rekod/halaman + tetingkap gelongsor 7

### 2.2 Ciri-ciri Tersendiri

| Ciri | Perincian |
|------|-----------|
| **Tema warna** | Ungu (`#7c3aed`) — ikon, butang, fokus carian, hover baris, bar aksen |
| **Stok setiap baris** | Dikira dari `item_batches` (JOIN dalam kueri) — dipaparkan sebagai lencana hijau/merah |
| **Lencana stok** | Hijau (`#16a34a`) jika stok > 0, Merah (`#e41e3f`) jika stok = 0 |
| **Paparan nama** | `nama_item + kekuatan + bentuk_dos` — sama seperti halaman lain |
| **Nama dagangan** | Dipaparkan di bawah nama utama (11px, kelabu) jika wujud |
| **Kod item** | Fon monospace, warna ungu, berat 600 |
| **Isihan** | 3 lajur boleh isih: Kod, Nama Item, Kuota |
| **Stok tidak boleh isih** | Lajur stok dikira di klien — tidak boleh diisih di pelayan |

### 2.3 Dialog Tambah Item

Dialog pendaftaran item baharu dengan **8 medan**:

| Medan | Jenis | Auto-Format |
|-------|-------|-------------|
| Kod Item * | Teks | `toUpperCase` onBlur |
| Kekuatan | Teks | `toUpperCase` onBlur |
| Nama Item * | Teks | `toTitleCaseKeepAcronyms` onBlur |
| Nama Dagangan | Teks | `toTitleCaseKeepAcronyms` onBlur |
| Kategori | Select | (dari `item_categories`) |
| Bentuk Dos | Select | (dari `item_forms`) |
| Jumlah Kuota | Nombor | — |
| Catatan | Textarea | — |

**Pengesahan:** Kod Item dan Nama Item wajib diisi — butang Simpan dilumpuhkan sehingga kedua-duanya diisi.

**Selepas berjaya:** Navigasi terus ke halaman butiran item baharu (`/stok/${inserted.id}`) — sama seperti corak Senarai Pesakit.

### 2.4 Kueri Data

**Kueri utama:** `["items", search, page, sort]`
- JOIN dengan `item_batches(kuantiti)` untuk pengiraan stok
- Penapis: `aktif = true`
- Carian: `nama_item.ilike OR kod_item.ilike OR nama_dagangan.ilike`
- Isihan lalai: `nama_item ASC`

**Kueri sokongan:**
- `["item_forms"]` — Bentuk dos (staleTime: 60000)
- `["item_categories"]` — Kategori (staleTime: 60000)

### 2.5 Reka Bentuk Responsif

Pada mudah alih (<768px), jadual bertukar kepada paparan 1 lajur:
```css
.stok-table-header, .stok-row { grid-template-columns: 1fr !important; }
.stok-row > div:nth-child(1) { font-size: 11px; }
.stok-row > div:nth-child(3), .stok-row > div:nth-child(4), .stok-row > div:nth-child(5) { display: none !important; }
```
Hanya lajur Kod dan Nama kekal kelihatan pada mudah alih — Kuota, Stok, dan Tindakan disembunyikan.

---

## 3. Halaman Butiran Item (`/stok/[id]`)

### 3.1 Seni Bina Komponen

```
ItemDetailPage (default export)
├── Orb hiasan (ungu, 300px)
├── Breadcrumb (Inventori > Nama Item)
├── Header (butang kembali + tajuk)
├── 1. FoldableCard: Maklumat Item
│   ├── Mod Lihat (grid 4-lajur + 4 kad statistik)
│   │   ├── Grid maklumat: Kod, Nama Dagangan, Kekuatan, Kategori, Bentuk Dos, Catatan
│   │   └── Kad: Jumlah Stok (biru), Kuota (ungu), Jumlah Pesakit (hijau), Baki Kuota (amber)
│   └── Mod Edit (borang 8 medan + Select)
├── 2. FoldableCard: Pesakit Yang Menggunakan
│   ├── Carian pesakit + Penapis Tercicir (defaulter)
│   ├── Table: Nama, No. KP, Dos, Bekalan Terakhir, Status
│   │   └── Status: Aktif (hijau) / Tercicir N bln (merah)
│   └── Pagination 50/halaman
├── 3. FoldableCard: Senarai Kelompok
│   ├── Table: Nombor Kelompok, Tarikh Luput, Kuantiti, Status, Tindakan
│   │   ├── Edit kuantiti sebaris (input + ✓/✕)
│   │   └── Butang pelupusan (Trash2)
│   ├── Dialog: Tambah Kelompok Baharu
│   │   └── Nombor Kelompok* + Tarikh Luput* + Kuantiti*
│   ├── Dialog: Pengesahan Pelarasan/Pelupusan
│   │   ├── Maklumat kelompok (grid 2-lajur)
│   │   ├── Kod Sebab (Select: Pelarasan Stok/Rosak/Luput/Hilang/Dijumpai/Pelupusan)
│   │   ├── Amaran kesan (kotak merah/hijau)
│   │   └── Butang "Saya Faham, Teruskan"
│   └── Pagination 50/halaman
└── 4. FoldableCard: Sejarah Transaksi Item
    ├── Penapis: Tarikh Dari/Hingga, Pesakit (Select), Kakitangan (Select), Reset
    ├── Kad statistik: Jumlah Transaksi, Item Masuk (hijau), Item Keluar (merah), Pesakit Menerima
    ├── Table (7 lajur): Tarikh, Jenis, Kelompok, Perubahan, Keterangan, Kakitangan, Pesakit
    │   └── Perubahan: Badge hijau (+N) atau merah (-N)
    ├── Butang Export: Excel (exceljs) + PDF (jspdf + jspdf-autotable)
    └── Pagination 50/halaman
```

### 3.2 Komponen Dalaman

#### `SortableHeader` (sama dengan Butiran Pesakit)
Pengepala jadual boleh isih dengan ChevronUp/ChevronDown.

#### `FoldableCard` (sama dengan Butiran Pesakit)
Kad boleh lipat dengan animasi Framer Motion. Mempunyai prop tambahan `count` untuk memaparkan Badge kiraan.

### 3.3 Pengurusan State — 25+ Pembolehubah

| State | Tujuan |
|-------|--------|
| `filterDateFrom` / `filterDateTo` | Penapis julat tarikh transaksi |
| `filterPatient` / `filterStaff` | Penapis pesakit/kakitangan transaksi |
| `patientSearch` | Carian dalam senarai pesakit |
| `defaulterFilter` | Penapis pesakit tercicir (3/6/9/12/24 bulan) |
| `batchSort` / `txSort` / `patientSort` | Isihan untuk 3 jadual |
| `patientPage` / `batchPage` / `txPage` | Halaman untuk 3 jadual (50/halaman) |
| `editMode` / `editData` | Mod edit maklumat item |
| `openAddBatch` / `newBatch` | Dialog tambah kelompok |
| `editBatchId` / `editBatchData` | Edit kuantiti sebaris |
| `pendingBatchAction` | Dialog pengesahan (type, batch, newKuantiti) |
| `adjustmentReason` | Kod sebab pelarasan/pelupusan |

### 3.4 Pemerolehan Data — 6 Kueri

| Kunci Kueri | Tujuan | Kompleksiti |
|-------------|--------|-------------|
| `["item", id]` | Data item tunggal | Rendah |
| `["item_forms"]` | Bentuk dos | Rendah |
| `["item_categories"]` | Kategori | Rendah |
| `["batches", id]` | Semua kelompok untuk item | Rendah |
| `["item-patients", id]` | Pesakit + tugasan + bekalan terakhir | **Sangat Tinggi** |
| `["transaction-history", id]` | Sejarah transaksi (bekalan + pelarasan) | **Tinggi** |

#### Kueri `["item-patients", id]` — Paling Kompleks

Kueri ini adalah yang paling kompleks dalam keseluruhan aplikasi:

```
1. Dapatkan tugasan aktif (patient_item_assignments WHERE item_id = id AND aktif = true)
2. Dapatkan butiran pesakit secara berkelompok (BATCH_SIZE = 200)
   → Elakkan had .in() Supabase
3. Dapatkan SEMUA tugasan (aktif + tidak aktif) untuk ID tugasan
4. Dapatkan bekalan terbaru untuk setiap pesakit secara berkelompok
   → Gunakan Map untuk deduplikasi (hanya bekalan pertama/terbaru)
5. Gabungkan: tugasan + pesakit + tarikh bekalan terakhir
```

Kueri ini perlu kompleks kerana ia menyokong ciri **penapis pesakit tercicir (defaulter)** — memerlukan tarikh bekalan terakhir untuk setiap pesakit.

#### Kueri `["transaction-history", id]` — Sumber Bergabung

Menggabungkan dua sumber data menjadi satu jadual:

**Sumber 1 — Bekalan:**
- Dari `supply_records` (JOIN: item_batches, patient_item_assignments, patients, profiles)
- Jenis: "Bekalan Kepada Pesakit"
- Perubahan: negatif (kuantiti keluar)

**Sumber 2 — Pelarasan:**
- Dari `batch_adjustments` (JOIN: profiles, item_batches)
- Jenis: "Kelompok Baharu" atau "Larasan Stok"
- Perubahan: positif (masuk) atau negatif (keluar)

Kedua-dua sumber digabungkan dan diisih mengikut tarikh (menurun) — dihadkan kepada 200 rekod setiap sumber.

### 3.5 Ciri Penapis Pesakit Tercicir (Defaulter)

Ciri unik yang tidak wujud di halaman lain:

```
Penapis Tercicir:
  "Semua Pesakit" — Tiada penapis
  "Tercicir 3 bulan" — Bekalan terakhir > 3 bulan lalu ATAU tiada bekalan
  "Tercicir 6 bulan"
  "Tercicir 9 bulan"
  "Tercicir 1 tahun"
  "Tercicir > 1 tahun" — 24 bulan

Logik:
  if (!a.last_supply) → dikira tercicir (tiada bekalan langsung)
  if (new Date(a.last_supply) < cutoff) → dikira tercicir
```

Setiap pesakit dalam senarai juga mempunyai lencana status:
- **Aktif** (hijau) — Bekalan terakhir < 3 bulan
- **Tercicir N bln** (merah) — Bekalan terakhir ≥ 3 bulan

### 3.6 Ciri Eksport (Excel & PDF)

Halaman Butiran Item adalah **satu-satunya halaman dalam aplikasi** yang mempunyai keupayaan eksport data:

#### Eksport Excel (`exceljs`)

```
1. Import dynamic: await import("exceljs")
2. Cipta Workbook dengan creator & created date
3. Tajuk baris (digabungkan, biru, teks putih)
4. Baris tarikh (dijana pada, jumlah rekod)
5. Pengepala (kelabu gelap, teks putih, sempadan)
6. Baris data dengan:
   - Baris berselang warna (kelabu sangat muda)
   - Lajur "Perubahan": hijau (positif) / merah (negatif)
7. Auto lebar lajur (min 12, maks 45 aksara)
8. Muat turun sebagai .xlsx
```

#### Eksport PDF (`jspdf` + `jspdf-autotable`)

```
1. Import dynamic kedua-dua pustaka
2. Cipta dokumen landscape
3. Bar pengepala biru dengan tajuk
4. Tarikh & kiraan rekod
5. Jadual autoTable dengan:
   - Pengepala kelabu gelap
   - Baris berselang warna
   - Lajur "Perubahan": hijau (positif) / merah (negatif) — melalui didParseCell
6. Pengaki (footer) setiap halaman: nama app + nombor halaman
7. Muat turun sebagai .pdf
```

Kedua-dua pustaka diimport secara **dynamic import** — tidak dimuatkan dalam bundel awal, hanya apabila pengguna klik butang eksport.

### 3.7 Dialog Pelarasan & Pelupusan Stok

Dialog pengesahan yang sangat terperinci dengan **5 kod sebab**:

| Kod | Label | Kesan |
|-----|-------|-------|
| `pelarasan_stok` | Pelarasan Stok | +N atau -N unit |
| `rosak` | Rosak | -N unit |
| `luput` | Pelupusan Luput | -N unit |
| `hilang` | Hilang | -N unit |
| `dijumpai` | Dijumpai | +N unit |
| `pelupusan` | Pelupusan Stok | Semua ke 0 |

**Dialog memaparkan:**
- Maklumat kelompok (grid 2-lajur: Kelompok, Tarikh Luput, Stok Semasa, Stok Baharu)
- Kod Sebab (Select)
- Kotak amaran berkod warna:
  - **Pelupusan:** Merah — "Semua stok N unit akan dilupuskan"
  - **Pelarasan (+):** Hijau — "Stok bertambah daripada X kepada Y"
  - **Pelarasan (-):** Merah — "Stok berkurang daripada X kepada Y"
- Butang: Batal + "Saya Faham, Teruskan" (destructive untuk pelupusan)

### 3.8 Pengurusan Kelompok (Batch Management)

**Tambah Kelompok:**
- Jika nombor kelompok sudah wujud → **tambah kuantiti** ke kelompok sedia ada (bukan cipta baharu)
- Rekod `batch_adjustments` dengan reason "Penambahan stok"
- Jika nombor kelompok baharu → cipta kelompok baharu dengan reason "Stok awal kelompok baharu"

**Edit Kuantiti Sebaris:**
- Klik ikon Edit → input nombor muncul dalam baris jadual
- Butang ✓ untuk sahkan, ✕ untuk batal
- Jika tiada perubahan → toast "Tiada perubahan pada kuantiti."
- Jika ada perubahan → buka dialog pengesahan dengan kod sebab

**Pelupusan:**
- Klik ikon Trash2 → dialog pengesahan
- Setkan kuantiti ke 0 (bukan DELETE baris)
- Rekod `batch_adjustments` dengan perubahan negatif penuh

---

## 4. Perbandingan Kedua-dua Halaman

| Aspek | Senarai Inventori (`/stok`) | Butiran Item (`/stok/[id]`) |
|-------|---------------------------|---------------------------|
| Baris kod | 321 | 1058 |
| Tujuan | Indeks + pendaftaran | Pengurusan komprehensif |
| Bahagian | 1 (jadual) | 4 (info, pesakit, kelompok, transaksi) |
| Dialog | 1 (Tambah Item) | 4 (Edit Item, Tambah Kelompok, Pelarasan, Pelupusan) |
| Kueri | 3 (items, forms, categories) | 6 (item, forms, categories, batches, patients, transactions) |
| State | 7 | 25+ |
| Ciri unik | Lencana stok hijau/merah | Penapis defaulter, eksport Excel/PDF, pelarasan kelompok |
| Tema | Ungu | Ungu |
| Pagination | 50/halaman | 50/halaman (3 jadual berasingan) |
| Navigasi keluar | Klik baris → butiran | Butang kembali → senarai |

---

## 5. Reka Bentuk Visual

### 5.1 Palet Warna (Tema Ungu)

| Elemen | Warna | Kegunaan |
|--------|-------|----------|
| Aksen ungu | `#7c3aed` / `#6d28d9` | Ikon, butang, fokus, bar aksen, hover, kod item |
| Aksen biru | `#1877f2` | Kad statistik (Jumlah Stok, Pesakit Menerima) |
| Aksen cyan | `#06b6d4` | Sempadan kecerunan, bar aksen |
| Aksen hijau | `#16a34a` / `#22c55e` | Stok positif, item masuk, status aktif |
| Aksen merah | `#e41e3f` / `#dc2626` | Stok kosong, item keluar, luput, tercicir, pelupusan |
| Aksen amber | `#d97706` | Kad Baki Kuota |
| Aksen kelabu | `#9ca3af` / `#65676b` | Teks sekunder, placeholder |
| Putih | `#ffffff` | Latar kad, butang |
| Kad kaca | `rgba(255,255,255,0.85)` + `blur(12px)` | Kad utama |

### 5.2 Kad Statistik (Butiran Item)

Kedua-dua bahagian Info Item dan Sejarah Transaksi mempunyai kad statistik kecil:

**Info Item (4 kad):**
| Kad | Ikon | Warna Ikon |
|-----|------|------------|
| Jumlah Stok | `Package` | Biru |
| Kuota | `BarChart3` | Ungu |
| Jumlah Pesakit | `Users` | Hijau |
| Baki Kuota | `Activity` | Amber |

**Sejarah Transaksi (4 kad):**
| Kad | Ikon | Warna Ikon |
|-----|------|------------|
| Jumlah Transaksi | `BarChart3` | Kelabu |
| Item Masuk | `TrendingUp` | Hijau |
| Item Keluar | `TrendingDown` | Merah |
| Pesakit Menerima | `Users` | Biru |

### 5.3 Tipografi (Butiran Item)

| Elemen | Saiz | Berat | Warna |
|--------|------|-------|-------|
| Tajuk halaman | 22px | 700 | `#1c1e21` |
| Tajuk kad (FoldableCard) | 16px (base) | — | — |
| Grid maklumat | 14px | 400 | `#1c1e21` |
| Nilai kad statistik | 18px (text-lg) | 700 | (pelbagai) |
| Label kad statistik | 12px (text-xs) | 400 | `#65676b` |
| Pengepala jadual | 11px | 600 | `#65676b` |
| Sel jadual | 12px (text-xs) | 400 | `#1c1e21` |
| Kod item | 13px | 600 | `#7c3aed` (monospace) |
| Badge kiraan | 10px | — | — |
| Label penapis | 12px (text-xs) | — | — |

### 5.4 Ikon (Butiran Item sahaja — 20+ ikon)

`ArrowLeft, Plus, Edit, Trash2, History, Download, FileSpreadsheet, FileText, Search, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Package, Users, Activity, TrendingUp, TrendingDown, BarChart3`

### 5.5 Animasi

| Elemen | Animasi |
|--------|---------|
| Header | `opacity: 0, y: 5 → 1, 0` (0.15s) |
| FoldableCard | AnimatePresence — height + opacity (0.15s) |
| Chevron pada FoldableCard | Putaran 180° (0.1s) |
| Bar aksen | `gradientShift` 4s kitaran |

---

## 6. UX: Aliran Kerja Utama

### 6.1 Aliran Tambah Item & Stok

```
Senarai Inventori
  → Klik "Tambah Item"
  → Isi dialog (8 medan)
  → Simpan
  → Navigasi ke Butiran Item
  → Klik "Tambah Stok" (pada kad Senarai Kelompok)
  → Isi Nombor Kelompok, Tarikh Luput, Kuantiti
  → Simpan
  → Stok bertambah, rekod pelarasan dicipta
```

### 6.2 Aliran Pelarasan Stok

```
Butiran Item → Senarai Kelompok
  → Klik ikon Edit pada baris kelompok
  → Input kuantiti baharu muncul sebaris
  → Masukkan nilai baharu
  → Klik ✓
  → Dialog pengesahan dibuka
  → Pilih Kod Sebab (Pelarasan Stok/Rosak/Luput/Hilang/Dijumpai)
  → Semak kotak amaran (hijau jika +, merah jika -)
  → Klik "Saya Faham, Teruskan"
  → Kuantiti dikemas kini, rekod pelarasan dicipta
```

### 6.3 Aliran Pelupusan Stok

```
Butiran Item → Senarai Kelompok
  → Klik ikon Trash2 pada baris kelompok
  → Dialog pengesahan dibuka
  → Pilih Kod Sebab (Pelupusan Stok disyorkan)
  → Semak kotak amaran merah
  → Klik "Saya Faham, Teruskan"
  → Kuantiti = 0, rekod pelupusan dicipta
```

### 6.4 Aliran Eksport Data

```
Butiran Item → Sejarah Transaksi Item
  → Tetapkan penapis (tarikh, pesakit, kakitangan) — pilihan
  → Klik "Excel" atau "PDF"
  → Dynamic import pustaka
  → Fail dimuat turun secara automatik
  → Toast kejayaan
```

---

## 7. Model Kebenaran

| Keizinan | Peranan | Kesan |
|----------|---------|-------|
| `manage_items` | Pentadbir, Penjaga Stor | Butang Tambah Item, Edit Item, Edit Kuantiti, Pelupusan |
| `manage_batches` | Pentadbir, Penjaga Stor | Butang Tambah Stok (pada kad Senarai Kelompok) |

Tanpa keizinan, pengguna hanya boleh **melihat** — semua butang tindakan disembunyikan.

---

## 8. Prestasi & Pengoptimuman

| Aspek | Pendekatan |
|-------|------------|
| Kueri berkelompok | Pesakit dan bekalan diambil dalam kelompok 200 untuk elakkan had `.in()` |
| Dynamic import | `exceljs` (≈500KB) dan `jspdf` (≈300KB) hanya dimuatkan apabila diperlukan |
| Pagination | 3 jadual berasingan (pesakit, kelompok, transaksi) — 50 rekod/halaman |
| useMemo | 12+ pengiraan diingati (isihan, penapisan, pagination, statistik) |
| Kunci kueri spesifik | Setiap kueri mempunyai kunci unik untuk caching tepat |
| StaleTime | Kebanyakan kueri menggunakan `staleTime: 0` (data sentiasa segar) |
| Font monospace | Hanya pada kod item dan nombor kelompok — bukan seluruh jadual |

---

## 9. Kekuatan & Amalan Baik

1. **Jejak audit lengkap:** Setiap perubahan stok direkodkan dalam `batch_adjustments` dengan sebelum/ selepas/sebab/staff
2. **Dialog pengesahan terperinci:** Sebelum pelarasan/pelupusan, pengguna melihat kesan penuh tindakan dengan kotak amaran berkod warna
3. **5+ kod sebab:** Pelarasan Stok, Rosak, Luput, Hilang, Dijumpai, Pelupusan Stok — membolehkan analisis kemudian
4. **Penapis pesakit tercicir:** Ciri unik untuk mengenal pasti pesakit yang tidak menerima bekalan — penting untuk susulan kesihatan
5. **Eksport data:** Excel & PDF dengan pemformatan profesional — tajuk, pengepala, baris berselang, warna perubahan
6. **Dynamic import:** Pustaka eksport yang berat tidak dimuatkan sehingga diperlukan
7. **Kueri berkelompok:** Mengelakkan had `.in()` Supabase dengan memecahkan kepada kelompok 200
8. **Edit sebaris:** Kuantiti kelompok boleh diedit terus dalam jadual tanpa membuka dialog berasingan
9. **Penggabungan kelompok:** Menambah stok ke kelompok sedia ada secara automatik jika nombor kelompok sepadan
10. **Konsistensi visual:** Tema ungu tersendiri yang konsisten di kedua-dua halaman

---

## 10. Peluang Penambahbaikan

1. **Saiz halaman Butiran Item (1058 baris):** Halaman kedua terbesar selepas Butiran Pesakit (652 baris). Boleh dipecahkan kepada komponen berasingan.
2. **Kueri `["item-patients"]` sangat kompleks:** 5 langkah dengan gelung bersarang — boleh dipermudahkan dengan RPC Supabase atau view pangkalan data
3. **Lajur Stok tidak boleh diisih di pelayan:** Dikira di klien dari `item_batches` — tidak boleh diisih dalam kueri
4. **Tiada penapis luput pada senarai inventori:** Tiada cara untuk menapis item yang mempunyai kelompok hampir luput dari halaman indeks
5. **Eksport hanya dari Sejarah Transaksi:** Tiada eksport untuk senarai pesakit atau senarai kelompok
6. **Tiada pengesahan tarikh luput:** Boleh menambah kelompok dengan tarikh luput pada masa lalu
7. **Tiada butang kembali ke senarai selepas simpan edit:** Selepas menyimpan edit item, pengguna kekal pada halaman butiran — perlu klik butang kembali secara manual
8. **Tiada penapis jenis transaksi:** Tidak boleh menapis hanya "Bekalan" atau hanya "Larasan" dalam Sejarah Transaksi
9. **Tiada graf/carta:** Data transaksi hanya dalam bentuk jadual — carta garis/bar akan membantu visualisasi tren
10. **Responsif jadual:** Jadual pada mudah alih menggunakan overflow-x: auto — kesemua 7 lajur boleh diskrol mendatar, yang mungkin menyusahkan