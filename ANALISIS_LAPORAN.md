# Analisis Halaman Laporan — QuickRxRecord

**Fail Dianalisis:**
- `quickrx-new/src/app/(dashboard)/laporan/page.tsx` — Halaman Laporan (323 baris)

**Tarikh Analisis:** 26 Julai 2026

---

## 1. Gambaran Keseluruhan

Halaman **Laporan** (`/laporan`) ialah pusat pelaporan ringkas yang menyediakan **dua laporan utama** dalam format jadual dengan keupayaan eksport Excel dan PDF. Halaman ini direka untuk memberikan pandangan menyeluruh (overview) tentang status inventori dan log transaksi bekalan — sesuai untuk audit, pemantauan, dan perkongsian data.

Berbanding dengan halaman lain yang fokus kepada operasi harian (CRUD), halaman ini adalah **bacaan sahaja** — tiada dialog, tiada mutasi, tiada pengeditan. Ia adalah halaman paling ringkas dari segi interaktiviti tetapi kaya dari segi keupayaan eksport data.

**Ciri-ciri utama:**
- Dua tab: "Inventori" dan "Transaksi"
- Jadual paras stok inventori (semua item dengan jumlah stok)
- Jadual log transaksi bekalan (500 rekod terbaru, 100 dipaparkan)
- Eksport Excel (exceljs) dan PDF (jspdf) untuk setiap laporan
- Fungsi eksport generik (`exportToExcel`, `exportToPDF`) yang menerima data dan label lajur
- Reka bentuk minimalis dengan tema merah (`#f43f5e`)

---

## 2. Seni Bina Komponen

### 2.1 Hierarki Komponen

```
LaporanPage (default export)
├── Orb hiasan (merah, 300px)
├── Breadcrumb ("Laporan")
├── Header (ikon BarChart3 + tajuk + sarikata)
├── Penukar Tab (segmented control)
│   ├── Tab "Inventori" (Package icon)
│   └── Tab "Transaksi" (Activity icon)
└── Kandungan Tab (key={activeTab} untuk animasi)
    ├── Tab Inventori:
    │   ├── Kad kaca dengan sempadan kecerunan merah
    │   ├── Bar aksen (merah-biru-ungu-merah, 4s)
    │   ├── Pengepala (ikon + "Paras Stok Inventori" + butang Excel/PDF)
    │   ├── Keadaan memuatkan (spinner)
    │   └── Jadual (6 lajur): Kod, Nama Item, Kekuatan, Kuota, Jumlah Stok, Status
    │       └── Badge "Stok Rendah" (merah) jika stok < kuota
    └── Tab Transaksi:
        ├── Kad kaca dengan sempadan kecerunan ungu
        ├── Bar aksen (ungu-biru-cyan-ungu, 4s)
        ├── Pengepala (ikon + "Log Transaksi Bekalan" + butang Excel/PDF)
        ├── Keadaan memuatkan (spinner)
        └── Jadual (7 lajur): Tarikh, Pesakit, Item, Dos, Kuantiti, Kelompok, Kakitangan
            └── 100 rekod pertama dipaparkan
```

### 2.2 Tiada Komponen Dalaman Tersuai

Halaman ini tidak mempunyai komponen dalaman tersuai — menggunakan komponen UI standard (`Table`, `Badge`, `Breadcrumb`) dan elemen HTML asli. Ini menjadikannya lebih ringkas berbanding halaman seperti Butiran Pesakit atau Butiran Item.

---

## 3. Pengurusan State (Keadaan)

### 3.1 State Tempatan — 1 Pembolehubah

| State | Jenis | Tujuan |
|-------|------|--------|
| `activeTab` | `"inventory" \| "transactions"` | Tab yang sedang aktif (default: "inventory") |

Ini adalah halaman dengan state paling minimum dalam keseluruhan aplikasi. Satu pembolehubah mengawal keseluruhan UI.

### 3.2 Tiada Data Teringat (useMemo)

Tiada `useMemo` — data diproses terus dalam render kerana transformasi adalah ringkas (pengiraan stok, pemotongan tatasusunan).

### 3.3 Tiada Kesan Sampingan (useEffect)

Halaman ini tidak menggunakan `useEffect` langsung. Segala-galanya adalah derivasi langsung dari data kueri.

---

## 4. Pemerolehan Data (Data Fetching)

### 4.1 Kueri Inventori: `["report-inventory"]`

```typescript
supabase.from("items")
  .select("*, item_batches(*)")
  .eq("aktif", true)
  .order("nama_item")
```

**Data:** Semua item aktif + semua kelompok (batches) berkaitan. **Tiada had rekod** — berpotensi mengambil jumlah data yang besar untuk inventori dengan ribuan item.

**Pemprosesan:**
- `totalStock` dikira di klien: `item_batches.reduce((s, b) => s + b.kuantiti, 0)`
- Badge "Stok Rendah" dipaparkan jika `kuota != null && totalStock < kuota`

### 4.2 Kueri Transaksi: `["report-transactions"]`

```typescript
supabase.from("supply_records")
  .select("*, assignment:patient_item_assignments(patient:patients(nama), item:items(nama_item, kekuatan)), batch:item_batches(nombor_kelompok), staff:profiles!kakitangan_pembekal(nama)")
  .order("created_at", { ascending: false })
  .limit(500)
```

**Data:** 500 rekod bekalan terbaru dengan JOIN ke:
- Pesakit (nama)
- Item (nama, kekuatan)
- Kelompok (nombor_kelompok)
- Kakitangan (nama)

**Paparan:** Hanya 100 rekod pertama dipaparkan dalam jadual (`.slice(0, 100)`) — tetapi semua 500 rekod tersedia untuk eksport.

### 4.3 Corak Data

- Kedua-dua kueri dijalankan serentak (React Query berbilang `useQuery`)
- Tiada `staleTime` dinyatakan — menggunakan default React Query
- Tiada pagination — jadual adalah skrol penuh
- Tiada penapis interaktif — data adalah statik

---

## 5. Aliran UX (User Experience)

### 5.1 Keadaan Halaman

| Keadaan | Penerangan |
|---------|------------|
| **Tab Inventori — Memuatkan** | Spinner merah + "Memuatkan laporan..." |
| **Tab Inventori — Data** | Jadual 6 lajur semua item aktif |
| **Tab Inventori — Stok Rendah** | Badge merah "Stok Rendah" pada item di bawah kuota |
| **Tab Transaksi — Memuatkan** | Spinner ungu + "Memuatkan transaksi..." |
| **Tab Transaksi — Data** | Jadual 7 lajur 100 transaksi terbaru |
| **Klik Eksport** | Dynamic import pustaka → muat turun fail → toast kejayaan |
| **Eksport Gagal** | Toast ralat |

### 5.2 Penukar Tab (Segmented Control)

Penukar tab menggunakan corak `segmented control` ala iOS:

```
┌──────────────────────────────────┐
│  [📦 Inventori]  [📊 Transaksi]  │
└──────────────────────────────────┘
```

- Tab aktif: latar putih, teks hitam, bayang halus
- Tab tidak aktif: latar telus, teks kelabu
- Animasi: `motion.div` dengan `key={activeTab}` — komponen dimount semula apabila tab berubah, mencetuskan animasi `opacity: 0, y: 5 → 1, 0`
- Peralihan CSS: `all 0.2s ease` pada butang

### 5.3 Aliran Eksport

```
Pengguna klik butang "Excel" atau "PDF"
  → Dynamic import pustaka (exceljs atau jspdf + jspdf-autotable)
  → Data ditransformasi (flatMap untuk inventori, map untuk transaksi)
  → Untuk inventori: data diratakan — setiap kelompok menjadi baris berasingan
  → Untuk transaksi: data dipetakan dengan label lajur Bahasa Melayu
  → Fail dijana dalam memori
  → Blob dicipta dan dimuat turun melalui klik pautan programatik
  → URL blob dibersihkan
  → Toast kejayaan
```

### 5.4 Transformasi Data untuk Eksport

**Laporan Inventori:**
```typescript
// Data asal: items[] dengan item_batches[]
// Data eksport: setiap kelompok diratakan ke baris berasingan
inventoryData.flatMap(item =>
  item.item_batches.map(batch => ({
    kod_item, nama_item, kekuatan, kuota,
    nombor_kelompok, tarikh_luput, kuantiti
  }))
)
```
Ini bermakna jika satu item mempunyai 3 kelompok, ia akan menghasilkan 3 baris dalam fail Excel/PDF.

**Laporan Transaksi:**
```typescript
// Data asal: supply_records[] dengan JOIN bersarang
// Data eksport: diratakan dengan nama instead of ID
transactions.map(t => ({
  tarikh: t.tarikh_dibekal,
  pesakit: t.assignment?.patient?.nama,
  item: t.assignment?.item?.nama_item,
  dos: t.dos,
  kuantiti: t.kuantiti,
  kelompok: t.batch?.nombor_kelompok,
  kakitangan: t.staff?.nama
}))
```

---

## 6. Reka Bentuk Visual

### 6.1 Palet Warna — Tema Merah

Tidak seperti halaman lain yang menggunakan warna tema tersendiri, Laporan menggunakan **merah** (`#f43f5e`) sebagai warna aksen utama — ini adalah warna yang sama dengan ikon sidebar "Laporan".

| Elemen | Warna | Kegunaan |
|--------|-------|----------|
| Aksen merah | `#f43f5e` / `#e11d48` | Ikon header, orb, sempadan kecerunan (tab inventori), bar aksen |
| Aksen ungu | `#7c3aed` | Sempadan kecerunan (tab transaksi), ikon tab transaksi |
| Aksen biru | `#1877f2` | Sempadan kecerunan, bar aksen |
| Aksen cyan | `#06b6d4` | Bar aksen (tab transaksi) |
| Merah (stok rendah) | `destructive` | Badge "Stok Rendah" |
| Kelabu | `#65676b` / `#9ca3af` | Teks sekunder, pengepala jadual |
| Putih | `#ffffff` | Latar kad, tab aktif |
| Latar tab | `rgba(240,242,245,0.8)` | Latar penukar tab |
| Kad kaca | `rgba(255,255,255,0.85)` + `blur(12px)` | Kedua-dua kad laporan |

### 6.2 Dua Kad — Dua Skema Warna

| Tab | Sempadan Kecerunan Kad | Bar Aksen | Ikon Header | Spinner |
|-----|----------------------|-----------|-------------|---------|
| Inventori | Merah → Biru → Ungu | Merah→Biru→Ungu→Merah | `Package` (merah) | Merah |
| Transaksi | Ungu → Biru → Cyan | Ungu→Biru→Cyan→Ungu | `Activity` (ungu) | Ungu |

### 6.3 Tipografi

| Elemen | Saiz | Berat | Warna |
|--------|------|-------|-------|
| Tajuk halaman | 22px | 700 | `#1c1e21` |
| Sarikata header | 13px | 500 | `#65676b` |
| Label tab | 13px | 600 | `#1c1e21` (aktif) / `#65676b` (tidak aktif) |
| Tajuk bahagian | 15px | 700 | `#1c1e21` |
| Pengepala jadual | 11px | 600 | `#65676b` (huruf besar, jarak huruf 0.05em) |
| Sel jadual | 13px | 400–600 | `#1c1e21` |
| Kod item | 13px | 400 | (default, monospace) |
| Kuantiti | 13px | 600 | `#1c1e21` |
| Badge "Stok Rendah" | 10px | — | Merah |
| Butang eksport | 12px | 600 | `#374151` |

### 6.4 Jejari Sempadan

| Elemen | Jejari |
|--------|--------|
| Kad laporan | 16px |
| Penukar tab (kontena) | 14px |
| Butang tab | 10px |
| Butang eksport | 10px |
| Ikon header | 14px |

### 6.5 Bayang

| Elemen | Bayang |
|--------|--------|
| Kad laporan | `0 4px 16px rgba(0,0,0,0.06)` |
| Ikon header | `0 4px 12px rgba(244,63,94,0.3)` |
| Tab aktif | `0 1px 4px rgba(0,0,0,0.08)` |

### 6.6 Animasi

| Elemen | Animasi |
|--------|---------|
| Breadcrumb | `opacity: 0 → 1` (0.12s) |
| Header | `opacity: 0, y: 5 → 1, 0` (0.15s, delay 0.02s) |
| Penukar tab | `opacity: 0, y: 5 → 1, 0` (0.15s, delay 0.01s) |
| Kandungan tab | `opacity: 0, y: 5 → 1, 0` (0.12s) — kemasukan semula apabila tab berubah |
| Bar aksen | `gradientShift` 4s kitaran |
| Spinner | `spin` 1s linear infinite |

### 6.7 Hiasan

- **Orb latar belakang:** 300×300px, merah 3%, blur 30px (`top: -60px, right: -60px`)

---

## 7. Fungsi Eksport Generik

Halaman ini mentakrifkan dua fungsi eksport yang boleh diguna semula:

### 7.1 `exportToExcel(data, filename, columnLabels?)`

| Parameter | Jenis | Penerangan |
|-----------|------|------------|
| `data` | `any[]` | Tatasusunan objek untuk dieksport |
| `filename` | `string` | Nama fail (tanpa sambungan) |
| `columnLabels` | `Record<string, string>` (opsyenal) | Peta kunci → label paparan |

**Ciri-ciri:**
- Tajuk baris (digabungkan, biru, teks putih)
- Baris tarikh penjanaan (italic, kelabu)
- Pengepala lajur (kelabu gelap, teks putih, sempadan)
- Data dengan baris berselang warna
- Auto lebar lajur (min 12, maks 40 aksara)
- Baris pengaki: "Jumlah rekod: N"
- Label lajur dijana secara automatik dari kunci objek jika `columnLabels` tidak diberikan
- Label diformat: ganti `_` dengan ruang, huruf besar setiap perkataan

### 7.2 `exportToPDF(data, filename, columnLabels?)`

Parameter sama seperti `exportToExcel`.

**Ciri-ciri:**
- Dokumen landscape
- Bar pengepala biru dengan "QuickRxRecord" + nama laporan
- Tarikh penjanaan + kiraan rekod
- Jadual autoTable dengan pengepala kelabu gelap, baris berselang
- Pengaki setiap halaman: "QuickRxRecord - Nama Laporan" + "Halaman N / M"
- Saiz fon jadual: 8px (padat untuk data banyak)

### 7.3 Perbandingan dengan Eksport di Butiran Item

| Aspek | Butiran Item | Halaman Laporan |
|-------|-------------|-----------------|
| Fungsi | Khusus untuk item tunggal | Generik, boleh guna semula |
| Label lajur | Keras (hardcoded) | Parameter `columnLabels` |
| Data | Dari `filteredTransactions` | Dari parameter `data` |
| Excel — lajur perubahan | Warna hijau/merah | Tiada (semua sel sama) |
| Excel — lebar lajur | Min 12, Maks 45 | Min 12, Maks 40 |
| Pengaki Excel | Tiada | "Jumlah rekod: N" |
| Penjanaan label | Hardcoded | Automatik dari kunci objek |

---

## 8. Laporan Inventori — Jadual 6 Lajur

| Lajur | Data | Format |
|-------|------|--------|
| Kod | `item.kod_item` | Monospace, 13px |
| Nama Item | `item.nama_item` | Berat 500, 13px |
| Kekuatan | `item.kekuatan` atau "-" | 13px |
| Kuota | `item.kuota` atau "-" | 13px |
| Jumlah Stok | `totalStock` (dikira) | Berat 600, 13px |
| Status | Badge "Stok Rendah" jika `kuota && stok < kuota` | Merah, 10px |

**Ciri-ciri:**
- Stok dikira di klien dengan menjumlahkan semua `item_batches[].kuantiti`
- Badge hanya muncul jika item mempunyai kuota DAN stok di bawah kuota
- Tiada isihan — data mengikut turutan `nama_item ASC` dari kueri
- Tiada penapis — semua item aktif dipaparkan
- Tiada pagination — jadual memaparkan semua item (berpotensi panjang)

---

## 9. Laporan Transaksi — Jadual 7 Lajur

| Lajur | Data | Format |
|-------|------|--------|
| Tarikh | `t.tarikh_dibekal` | Diformat (formatDate), nowrap |
| Pesakit | `t.assignment?.patient?.nama` atau "-" | 13px |
| Item | `t.assignment?.item?.nama_item` atau "-" | 13px |
| Dos | `t.dos` | 13px |
| Kuantiti | `t.kuantiti` | Berat 600, 13px |
| Kelompok | `t.batch?.nombor_kelompok` atau "-" | Monospace, 13px |
| Kakitangan | `t.staff?.nama` atau "-" | 13px |

**Ciri-ciri:**
- 500 rekod diambil dari pangkalan data
- Hanya 100 rekod pertama dipaparkan dalam UI (`.slice(0, 100)`)
- Semua 500 rekod tersedia untuk eksport
- Tiada isihan interaktif — data mengikut `created_at DESC` dari kueri
- Tiada penapis
- Tiada pagination — jadual memaparkan 100 rekod

---

## 10. Model Kebenaran

Halaman ini memerlukan keizinan `view_reports` (berdasarkan definisi `navItems` di sidebar):

| Peranan | Boleh Akses? |
|---------|-------------|
| Pentadbir | ✅ |
| Penjaga Stor | ✅ |
| Kakitangan Farmasi | ✅ |
| Kakitangan Klinik | ❌ (item navigasi disembunyikan) |

Walau bagaimanapun, tiada semakan kebenaran eksplisit dalam kod halaman — ia bergantung sepenuhnya pada penyembunyian item navigasi di sidebar. Jika pengguna menavigasi terus ke `/laporan`, mereka akan dapat melihat data.

---

## 11. Perbandingan dengan Halaman Lain

| Aspek | Laporan | Butiran Item | Senarai Pesakit |
|-------|---------|-------------|-----------------|
| State | 1 pembolehubah | 25+ | 8 |
| Dialog | 0 | 4 | 1 |
| Mutasi | 0 | 4 | 1 |
| Kueri | 2 | 6 | 1 |
| Isihan | Tiada | 3 jadual | 4 lajur |
| Pagination | Tiada | 3 jadual (50/hal) | 50/hal |
| Carian | Tiada | 3 carian | 1 carian |
| Penapis | Tiada | 5 penapis | 0 |
| Eksport | Excel + PDF (generik) | Excel + PDF (khusus) | Tiada |
| Tema | Merah | Ungu | Biru |
| Baris kod | 323 | 1058 | 382 |

---

## 12. Prestasi & Pengoptimuman

| Aspek | Pendekatan |
|-------|------------|
| Dynamic import | `exceljs` dan `jspdf` hanya dimuatkan apabila butang eksport diklik |
| Tiada useMemo | Data ringkas — pengiraan terus dalam render adalah mencukupi |
| Had data transaksi | 500 rekod maksimum dari pangkalan data |
| Paparan terhad | Hanya 100 rekod dipaparkan dalam UI |
| Eksport penuh | Semua 500 rekod tersedia untuk eksport |
| Tanpa pagination | Data inventori mungkin besar — boleh menyebabkan isu prestasi untuk ribuan item |

### 12.1 Potensi Isu Prestasi

1. **Inventori tanpa had:** Kueri mengambil SEMUA item + SEMUA kelompok tanpa had — untuk pangkalan data dengan ribuan item dan puluhan ribu kelompok, ini boleh menjadi sangat perlahan
2. **Tiada indeks pada kueri transaksi:** JOIN 4 peringkat (supply → assignment → patient + item; supply → batch; supply → staff) tanpa penapis tambahan

---

## 13. Model Data Berkaitan

```
Laporan Inventori:
  items (aktif=true, isih: nama_item)
    └── item_batches (semua)

Laporan Transaksi:
  supply_records (500 terbaru, isih: created_at DESC)
    ├── patient_item_assignments
    │     ├── patients (nama)
    │     └── items (nama_item, kekuatan)
    ├── item_batches (nombor_kelompok)
    └── profiles!kakitangan_pembekal (nama)
```

---

## 14. Kekuatan & Amalan Baik

1. **Fungsi eksport generik:** `exportToExcel` dan `exportToPDF` direka untuk digunakan semula — menerima data, nama fail, dan label lajur sebagai parameter
2. **Dynamic import:** Pustaka eksport yang besar tidak dimuatkan dalam bundel utama
3. **Simplicity:** Halaman paling ringkas dalam aplikasi — satu state, tiada mutasi, kod yang mudah difahami
4. **Dua tema berbeza:** Setiap tab mempunyai skema warna tersendiri (merah vs ungu) untuk pembezaan visual
5. **Penjanaan label automatik:** Jika `columnLabels` tidak diberikan, label dijana dari kunci objek (ganti `_`, huruf besar)
6. **Data eksport berbeza dari data paparan:** Inventori diratakan untuk eksport, transaksi dipetakan dengan label Bahasa Melayu
7. **Eksport Excel profesional:** Tajuk, tarikh, pengepala, baris berselang, auto lebar, pengaki
8. **Eksport PDF profesional:** Pengepala biru, pengaki setiap halaman dengan nombor halaman
9. **Konsistensi visual:** Kad kaca, sempadan kecerunan, bar aksen, dan orb yang sama dengan halaman lain

---

## 15. Peluang Penambahbaikan

1. **Tiada had pada kueri inventori:** Boleh ditambah pagination atau had untuk mengelakkan isu prestasi
2. **Tiada penapis tarikh untuk transaksi:** Tidak boleh menapis mengikut julat tarikh — semua 500 transaksi terbaru diambil
3. **Tiada isihan interaktif:** Kedua-dua jadual tidak boleh diisih oleh pengguna
4. **Tiada carian:** Tidak boleh mencari item atau transaksi tertentu
5. **Tiada ringkasan/agregat:** Laporan inventori tidak menunjukkan jumlah keseluruhan stok atau bilangan item
6. **Laporan terhad kepada 2 jenis:** Tiada laporan pesakit, laporan dos, atau laporan agregat bulanan
7. **Tiada pemilihan lajur untuk eksport:** Semua lajur dieksport — pengguna tidak boleh memilih lajur tertentu
8. **Tiada eksport CSV:** Hanya Excel dan PDF — CSV lebih ringan dan serasi universal
9. **Kebergantungan pada `exceljs` dan `jspdf`:** Kedua-dua pustaka adalah besar (~500KB + ~300KB) — boleh dipertimbangkan untuk menggunakan pustaka yang lebih ringan
10. **Tiada cache untuk data eksport:** Setiap klik eksport menjana semula fail dari data yang sama