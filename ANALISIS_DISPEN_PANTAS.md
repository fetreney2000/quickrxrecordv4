# Analisis Halaman Dispen Pantas (Quick Dispense) — QuickRxRecord

**Fail Dianalisis:**
- `quickrx-new/src/app/(dashboard)/pantas/page.tsx` — Halaman Dispen Pantas (958 baris)

**Tarikh Analisis:** 26 Julai 2026

---

## 1. Gambaran Keseluruhan

Halaman **Dispen Pantas** (`/pantas`) ialah aliran kerja pendispensan ubat yang dipermudahkan — direka untuk **kelajuan dan kecekapan maksimum**. Berbanding dengan halaman Butiran Pesakit yang mempunyai proses berbilang langkah (navigasi ke pesakit → kembangkan tugasan → klik bekal → isi borang → hantar), Dispen Pantas menggabungkan segala-galanya ke dalam **satu halaman, satu aliran linear**.

**Falsafah reka bentuk:** "Cari pesakit → Pilih ubat → Bekal" — tiga langkah dalam satu skrin.

**Ciri-ciri utama:**
- Carian pesakit dengan autofokus serta-merta
- Pemilihan item daripada senarai ubat yang telah didaftarkan untuk pesakit
- Bahagian "Item Kerap" — 10 item paling kerap dibekalkan
- Pendaftaran item baharu terus dari dialog (dengan semakan kuota)
- Pemilihan kelompok FEFO (First Expiry First Out) automatik
- Borang pendispensan dengan pengesahan medan
- Navigasi papan kekunci (Escape untuk undur, Enter untuk hantar)
- Maklum balas kejayaan dengan sepanduk (banner) animasi

---

## 2. Seni Bina Komponen

### 2.1 Hierarki Komponen

```
QuickDispensePage (default export)
├── Orb hiasan (oren, 300px)
├── Header (ikon Zap + tajuk + sarikata)
├── Sepanduk Kejayaan (AnimatePresence)
│   └── CheckCircle2 + mesej + auto-hilang 2.5s
├── Langkah 1: Carian Pesakit (ATAU)
│   ├── Medan carian dengan fokus automatik
│   ├── Ikon Search + Loader2
│   ├── Dropdown hasil (max 10)
│   └── Mesej "Tiada pesakit dijumpai"
│
└── Langkah 2: Pesakit Dipilih
    ├── Kad Pesakit (hijau, dengan butang "Butiran" & "Tukar")
    ├── Langkah 2a: Pemilihan Item (ATAU)
    │   ├── Pengepala "Pilih Ubat" + badge kiraan
    │   ├── Bahagian "Item Kerap" (butang pil biru)
    │   ├── Carian item didaftarkan
    │   ├── Senarai item didaftarkan (boleh skrol)
    │   ├── Kad "Daftar Item Baharu" (sempadan putus-putus hijau)
    │   │   └── Dialog: Daftar Item Baharu
    │   │       ├── Carian item (autofokus)
    │   │       ├── Senarai item dengan penunjuk kuota
    │   │       └── Keadaan memuatkan (Loader2 + "Menyemak kuota terkini...")
    │   └── Tiada padanan / tiada item
    │
    └── Langkah 2b: Borang Pendispensan
        ├── Pengepala Item (nama + kod, butang "Tukar Ubat")
        ├── Pemilih Kelompok FEFO (butang radio tersuai)
        │   ├── Auto-pilih kelompok pertama
        │   ├── Penunjuk dipilih (latar kuning, dot radio)
        │   └── Keadaan tiada kelompok (X merah)
        ├── Grid 2-lajur (4 medan):
        │   ├── Dos (baca-sahaja jika dari tugasan, auto-TOUPPERCASE)
        │   ├── Kuantiti (nombor)
        │   ├── Tempoh Dibekal (nilai + Select unit)
        │   └── Catatan (teks)
        └── Butang Hantar "Bekal (N)" (kecerunan biru, dilumpuhkan jika tidak lengkap)
```

### 2.2 Tiada Komponen Dalaman yang Dieksport

Semua komponen adalah sebaris (inline) dalam JSX — halaman adalah monolitik 958 baris. Tiada komponen berasingan seperti halaman Butiran Pesakit (`FoldableCard`, `SortableHeader`).

---

## 3. Pengurusan State (Keadaan)

### 3.1 State Tempatan (useState) — 16 Pembolehubah

| State | Jenis | Tujuan |
|-------|------|--------|
| `searchQuery` | `string` | Pertanyaan carian pesakit |
| `searchResults` | `Patient[]` | Hasil carian pesakit |
| `showResults` | `boolean` | Kawal keterlihatan dropdown carian |
| `searching` | `boolean` | Penunjuk carian sedang berjalan |
| `focused` | `boolean` | Keadaan fokus medan carian pesakit |
| `selectedPatient` | `Patient \| null` | Pesakit yang dipilih (null = langkah carian) |
| `selectedItem` | `any \| null` | Item yang dipilih (null = langkah pemilihan) |
| `itemSearch` | `string` | Pertanyaan carian item didaftarkan |
| `quantity` | `string` | Kuantiti untuk dibekalkan |
| `dose` | `string` | Dos untuk dibekalkan |
| `tempohNilai` | `string` | Nilai tempoh bekalan |
| `tempohUnit` | `string` | Unit tempoh bekalan (default: "Hari") |
| `catatan` | `string` | Catatan bekalan |
| `selectedBatchId` | `string` | ID kelompok yang dipilih |
| `submitting` | `boolean` | Penunjuk penghantaran sedang berjalan |
| `successPatient` | `string \| null` | Nama pesakit untuk sepanduk kejayaan |
| `showRegisterDialog` | `boolean` | Kawal dialog daftar item baharu |
| `registerItemSearch` | `string` | Pertanyaan carian dalam dialog daftar |
| `dialogItemsReady` | `boolean` | Penunjuk data item siap dalam dialog daftar |
| `isMobile` | `boolean` | Kesan peranti mudah alih (< 768px) |

### 3.2 Data Teringat (useMemo) — 6 Pengiraan

| Memo | Input | Output |
|------|-------|--------|
| `assignedItems` | `patientAssignments` | Item + assignment_id + assignment_dos |
| `assignedItemIds` | `assignedItems` | Set ID item yang telah didaftarkan |
| `formsMap` | `forms` | Peta `id_bentuk → nama` |
| `frequentItemData` | `frequentItems, items, assignedItemIds` | Item kerap yang ditapis (hanya item didaftarkan) |
| `filteredAssignedItems` | `assignedItems, itemSearch` | Item yang ditapis berdasarkan carian |
| `filteredRegisterItems` | `items, assignedItemIds, registerItemSearch` | Item tersedia untuk pendaftaran, ditapis |
| `selectedBatch` | `availableBatches, selectedBatchId` | Objek kelompok yang dipilih (atau null) |

### 3.3 Kesan Sampingan (useEffect) — 4

| Effect | Tujuan |
|--------|--------|
| Resize listener | Kesan peranti mudah alih (`window.innerWidth < 768`) |
| Keyboard Escape | Navigasi undur: Esc pada item → kosongkan borang; Esc pada pesakit → kosongkan pesakit; autofokus selepas kosongkan |
| Debounce carian pesakit | 300ms sebelum memanggil `searchPatients` |
| Auto-pilih kelompok pertama | Apabila `availableBatches` berubah, pilih kelompok pertama secara automatik |

### 3.4 useCallback — 2

| Callback | Tujuan |
|----------|--------|
| `searchPatients` | Fungsi carian pesakit yang distabilkan (bergantung pada `supabase`) |
| `getItemDisplayName` | Format nama paparan item (nama + kekuatan + bentuk) |

---

## 4. Pemerolehan Data (Data Fetching)

### 4.1 Kueri React Query

| Kunci Kueri | Jadual/RPC | Tujuan | Syarat |
|-------------|------------|--------|--------|
| `["items-active"]` | `items` + RPC `count_active_assignments` | Semua item aktif dengan statistik kuota | Sentiasa |
| `["patient-assignments", id]` | `patient_item_assignments` (join: items) | Tugasan aktif pesakit | `enabled: !!selectedPatient` |
| `["item_forms"]` | `item_forms` | Bentuk dos untuk paparan nama | Sentiasa |
| `["frequent-items"]` | `supply_records` → `patient_item_assignments` | 10 item paling kerap dibekalkan | Sentiasa |
| `["pantas-batches", id]` | `item_batches` (filter: item_id, kuantiti > 0, belum luput) | Kelompok tersedia untuk item dipilih | `enabled: !!selectedItem` |
| `["supply_durations"]` | `supply_durations` | Senarai tempoh bekalan | Sentiasa |

### 4.2 Pengiraan "Item Kerap"

Ini adalah algoritma yang menarik dan unik untuk halaman ini:

```
1. Ambil 500 rekod supply_records terbaru
2. Ekstrak assignment_id unik
3. Dapatkan item_id untuk setiap tugasan
4. Kira kekerapan setiap item_id
5. Isih mengikut kekerapan (menurun)
6. Ambil 10 teratas
7. Tapis: hanya item yang ada dalam assignedItemIds (didaftarkan untuk pesakit semasa)
8. Dapatkan data penuh item dari kueri items
```

**Rasional:** Ini menunjukkan item yang paling kerap dibekalkan secara global, tetapi hanya yang relevan untuk pesakit yang dipilih. Jika pesakit tidak mempunyai sebarang item dalam senarai kerap, bahagian ini akan kosong.

### 4.3 Pengiraan Kuota

Setiap item dalam `["items-active"]` mempunyai:
- `kuota` — Had maksimum pesakit aktif
- `patient_count` — Bilangan pesakit dengan tugasan aktif untuk item ini
- `baki_kuota` — Baki kuota (`max(0, kuota - patient_count)`)
- `kuota_penuh` — Boolean (`activeCount >= kuota`)

Ini digunakan dalam dialog "Daftar Item Baharu" untuk menyekat item yang telah mencapai kuota.

### 4.4 Invalidasi Kueri Selepas Bekalan Berjaya

```
queryClient.invalidateQueries({ queryKey: ["patient-assignments", selectedPatient.id] });
queryClient.invalidateQueries({ queryKey: ["frequent-items"] });
queryClient.invalidateQueries({ queryKey: ["batches"] });
queryClient.invalidateQueries({ queryKey: ["pantas-batches"] });
queryClient.invalidateQueries({ queryKey: ["items-active"] });
```

5 kueri diinvalidasikan untuk memastikan data segar selepas pendispensan.

---

## 5. Aliran UX (User Experience)

### 5.1 Gambar Rajah Aliran Penuh

```
┌─────────────────────────────────────────────────────────────────┐
│                       DISPEN PANTAS                              │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ LANGKAH 1: CARI PESAKIT                                  │   │
│  │                                                          │   │
│  │  [🔍 Cari pesakit...                                    ] │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │ 👤 Ahmad bin Ali          KP: 890101-01-1234  →  │   │   │
│  │  │ 👤 Siti binti Karim       Hosp: H001234      →   │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                           ↓ klik pesakit                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ LANGKAH 2: PESAKIT DIPILIH                               │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │ ✅ Ahmad bin Ali     KP: 890101-01-1234           │   │   │
│  │  │                      [Butiran]  [✕ Tukar]         │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │ 💊 Pilih Ubat                     [3 didaftarkan]  │   │   │
│  │  │                                                  │   │   │
│  │  │ ITEM KERAP                                       │   │   │
│  │  │ [Paracetamol 500mg] [Metformin 850mg]            │   │   │
│  │  │                                                  │   │   │
│  │  │ [🔍 Cari item...                              ]  │   │   │
│  │  │                                                  │   │   │
│  │  │ Paracetamol 500mg         Dos: 1x1              │   │   │
│  │  │ PRC-001                                          │   │   │
│  │  │ ─────────────────────────────────────────────── │   │   │
│  │  │ Metformin 850mg           Dos: 2x1              │   │   │
│  │  │ MET-001                                          │   │   │
│  │  │                                                  │   │   │
│  │  │ ┌──────────────────────────────────────────────┐ │   │   │
│  │  │ │ 🟢 Item tidak tersenarai?                    │ │   │   │
│  │  │ │ Daftar item baharu...       [Daftar Item]    │ │   │   │
│  │  │ └──────────────────────────────────────────────┘ │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                           ↓ pilih item                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ LANGKAH 3: BORANG BEKALAN                                 │   │
│  │                                                          │   │
│  │  💊 Paracetamol 500mg                    [✕ Tukar Ubat]  │   │
│  │     PRC-001                                               │   │
│  │                                                          │   │
│  │  PILIH KELOMPOK (FEFO)                                   │   │
│  │  ⭕ B2026-001  Luput: 15/08/2026 | Stok: 200             │   │
│  │  ⚪ B2026-002  Luput: 30/12/2026 | Stok: 500             │   │
│  │                                                          │   │
│  │  Dos:           Kuantiti:                                │   │
│  │  [1x1         ] [30        ]                             │   │
│  │                                                          │   │
│  │  Tempoh Dibekal:         Catatan:                        │   │
│  │  [30  ] [Hari ▼]         [                            ] │   │
│  │                                                          │   │
│  │  [⚡ Bekal (30)                                    ]     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                           ↓ hantar                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ✅ Bekalan direkodkan untuk Ahmad bin Ali                │   │
│  │    Sedia untuk pendispensan seterusnya.                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│  (auto-hilang selepas 2.5 saat, borang dikosongkan)            │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Keadaan-keadaan (States)

Halaman mempunyai **3 keadaan utama** yang dikawal oleh `selectedPatient` dan `selectedItem`:

| Keadaan | selectedPatient | selectedItem | Paparan |
|---------|----------------|--------------|---------|
| **Carian** | null | — | Medan carian pesakit dengan dropdown |
| **Pilih Item** | Patient | null | Kad pesakit + senarai item + butang daftar |
| **Borang Bekalan** | Patient | Item | Borang pendispensan penuh |

### 5.3 Sub-Keadaan

| Sub-Keadaan | Penerangan |
|-------------|------------|
| Carian — Fokus | Medan carian dengan gelung oren & latar putih |
| Carian — Mencari | Ikon `Loader2` berputar |
| Carian — Tiada hasil | Teks "Tiada pesakit dijumpai. Cuba ejaan lain." |
| Carian — Ada hasil | Dropdown dengan 1–10 pesakit |
| Pilih Item — Item kerap tersedia | Bahagian "Item Kerap" dengan butang pil biru |
| Pilih Item — Item kerap tiada | Bahagian "Item Kerap" disembunyikan |
| Pilih Item — Pesakit tiada item | "Pesakit ini belum mempunyai sebarang item didaftarkan." |
| Pilih Item — Carian tiada padanan | "Tiada padanan." |
| Dialog Daftar — Memuatkan | Loader2 + "Menyemak kuota terkini..." |
| Dialog Daftar — Item tersedia | Senarai item dengan penunjuk kuota |
| Dialog Daftar — Kuota penuh | Item dikelabukan (opacity 0.55), kursor "not-allowed" |
| Borang — Tiada kelompok | Mesej merah "Tiada kelompok tersedia untuk item ini." |
| Borang — Menghantar | Butang dengan Loader2 + "Membekal..." |
| Borang — Kejayaan | Sepanduk hijau animasi, auto-hilang 2.5s |

### 5.4 Navigasi Papan Kekunci

| Kekunci | Konteks | Tindakan |
|---------|---------|----------|
| **Enter** | Carian pesakit (dengan hasil) | Pilih hasil pertama |
| **Esc** | Carian pesakit | Kosongkan medan carian |
| **Esc** | Item dipilih (borang) | Kosongkan borang, kekal pada pesakit |
| **Esc** | Pesakit dipilih (tiada item) | Kosongkan pesakit, autofokus carian |
| **Enter** | Borang pendispensan | Hantar borang (dengan syarat bukan shift/ctrl/meta dan bukan pada butang/select) |
| **Tab** | Semua | Navigasi antara medan borang |

### 5.5 Kelakuan Autofokus

- Apabila halaman dimuatkan → fokus automatik pada medan carian pesakit (via `useRef` + `inputRef`)
- Apabila pesakit dikosongkan → fokus automatik pada medan carian pesakit selepas 50ms
- Apabila dialog "Daftar Item Baharu" dibuka → fokus automatik pada medan carian item dalam dialog

### 5.6 Kelakuan Auto-Isi

- Apabila item dipilih dari senarai didaftarkan → dos diisi secara automatik dari `assignment_dos`
- Dos menjadi **baca-sahaja** (readOnly + opacity 60%) jika berasal dari tugasan sedia ada
- Kelompok pertama diisi secara automatik dari `availableBatches` (FEFO — tarikh luput paling awal)

---

## 6. Reka Bentuk Visual

### 6.1 Palet Warna

| Elemen | Warna | Kegunaan |
|--------|-------|----------|
| Tema oren (Dispen Pantas) | `#f0932b` / `#e07a1f` | Ikon header, medan carian pesakit, dropdown, ikon hasil |
| Aksen biru | `#1877f2` / `#0d5bd4` | Butang item, butang hantar, item dipilih |
| Aksen hijau | `#10b981` / `#059669` / `#065f46` | Kad pesakit dipilih, sepanduk kejayaan, dialog daftar |
| Aksen kuning/amber | `#f59e0b` | Pemilih kelompok (FEFO), butang radio dipilih |
| Merah (ralat) | `#dc2626` / `#991b1b` | Tiada kelompok, kuota penuh |
| Kelabu | `#65676b` / `#9ca3af` / `#d1d5db` | Teks sekunder, ikon tidak aktif, sempadan |
| Putih | `#ffffff` | Latar kad, dropdown |
| Latar halaman | `#f0f2f5` (diwarisi) | Latar belakang |

### 6.2 Tema Warna — Oren untuk Dispen Pantas

Berbeza dengan halaman lain yang menggunakan biru sebagai aksen utama, Dispen Pantas menggunakan **oren** (`#f0932b`) sebagai warna tema. Ini memberikan pembezaan visual yang jelas dan menekankan fungsi "pantas" halaman ini. Semua elemen carian pesakit (medan, ikon, dropdown, butang hasil) menggunakan tema oren.

### 6.3 Tipografi

| Elemen | Saiz | Berat | Warna |
|--------|------|-------|-------|
| Tajuk halaman | 22px / 18px (mobile) | 700 | `#1c1e21` |
| Sarikata header | 12px | 400 | `#65676b` |
| Tajuk "Cari Pesakit" | 15px | 700 | `#1c1e21` |
| Input carian | 14px | 500 | `#1c1e21` |
| Nama pesakit (hasil) | 13px | 600 | `#1c1e21` |
| Meta pesakit (KP/Hosp) | 11px | 400 | `#65676b` |
| Nama pesakit (kad) | 14px | 700 | `#1c1e21` |
| Tajuk "Pilih Ubat" | 14px | 700 | `#1c1e21` |
| Nama item (senarai) | 13px | 500 | `#1c1e21` |
| Kod item | 11px | 400 | `#65676b` |
| Dos item | 11px | 500 | `#1877f2` |
| Item kerap (butang) | 12px | 500 | `#1877f2` |
| Tajuk "Item Kerap" | 11px | 600 | `#65676b` (huruf besar) |
| Nama item (borang) | 14px | 700 | `#1c1e21` |
| Label medan | 12px | 400 | `#65676b` |
| Input medan | 13px | 400 | `#1c1e21` |
| Butang hantar | 14px | 700 | Putih |
| Sepanduk kejayaan | 13px / 11px | 600 / 400 | `#065f46` / `#059669` |

### 6.4 Jejari Sempadan

| Elemen | Jejari |
|--------|--------|
| Kad carian pesakit | 16px |
| Medan carian | 14px |
| Dropdown hasil | 14px |
| Kad pesakit dipilih | 16px |
| Kad pemilihan item | 16px |
| Senarai item | 10px |
| Medan carian item | 12px |
| Butang item kerap | 10px |
| Kad daftar item baharu | 10px |
| Butang hantar | 12px |
| Sepanduk kejayaan | 12px |
| Ikon header | 12px |
| Ikon pesakit (hasil) | 10px |
| Ikon pesakit (kad) | 12px |
| Ikon item (borang) | 11px |
| Dialog | (default) |

### 6.5 Bayang

| Elemen | Bayang |
|--------|--------|
| Kad carian pesakit | `0 4px 16px rgba(240,147,43,0.06)` |
| Medan carian fokus | `0 0 0 4px rgba(240,147,43,0.08), 0 4px 16px rgba(240,147,43,0.06)` |
| Dropdown hasil | `0 12px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)` |
| Kad pesakit dipilih | `0 2px 8px rgba(16,185,129,0.06)` |
| Kad pemilihan item | `0 2px 8px rgba(0,0,0,0.04)` |
| Ikon header | `0 4px 12px rgba(240,147,43,0.3)` |
| Butang "Daftar Item" | `0 2px 8px rgba(16,185,129,0.25)` |
| Butang hantar | `0 4px 14px rgba(24,119,242,0.3)` |

### 6.6 Animasi

| Elemen | Animasi | Jenis |
|--------|---------|-------|
| Header | `opacity: 0, y: 5 → 1, 0` (0.15s) | Fade + slide |
| Sepanduk kejayaan | `opacity: 0, y: -10 → 1, 0` (0.2s) + exit | AnimatePresence |
| Hover hasil carian | Latar `rgba(240,147,43,0.06)` | Peralihan |
| Hover item kerap | Latar biru 10%, sempadan biru 30% | Peralihan |
| Hover senarai item | Latar biru 4% | Peralihan |
| Pemilih kelompok | Latar kuning 6% + dot radio | Peralihan |

### 6.7 Hiasan

- **Orb latar belakang:** 300×300px, oren 4%, blur 30px, di penjuru atas kanan (`top: -60px, right: -60px`)

---

## 7. Logik Pendispensan (handleSubmit)

### 7.1 Aliran Lengkap

```
handleSubmit:
  1. Sahkan: selectedPatient && selectedItem && quantity && selectedBatchId && dose
  2. setSubmitting(true)
  3. Tentukan assignment_id:
     a. Jika selectedItem.assignment_id wujud → gunakan ID sedia ada
     b. Jika tiada:
        i.  Cari tugasan aktif sedia ada untuk patient + item
        ii. Jika dijumpai → gunakan ID tersebut
        iii. Jika TIADA:
             - INSERT ke patient_item_assignments (patient_id, item_id, dos, tarikh_mula_guna, dimulakan_oleh, kakitangan_farmasi_perekod)
             - INSERT ke dose_history (assignment_id, tarikh, dos, aktif=true, dikemaskini_oleh, catatan="Bekalan kali pertama (Dispens Pantas)")
  4. POST /api/supply (transaksi atomik)
  5. Jika berjaya:
     → toast.success() dengan perincian item
     → setSuccessPatient(nama) — papar sepanduk
     → Invalidasi 5 kueri
     → clearForm() — kekalkan pesakit, kosongkan item/borang
     → setTimeout → setSuccessPatient(null) selepas 2.5s
  6. Jika gagal:
     → toast.error(mesej ralat)
  7. setSubmitting(false)
```

### 7.2 Pengendalian Kes Tepi (Edge Cases)

| Kes | Pengendalian |
|-----|-------------|
| Item sudah didaftarkan tetapi bukan dari senarai | Dicari secara automatik melalui kueri `patient_item_assignments` |
| Item tidak didaftarkan langsung | Cipta tugasan baharu + rekod dos pertama secara automatik |
| Tiada kelompok tersedia | Butang hantar dilumpuhkan (selectedBatchId diperlukan) |
| Kuantiti tidak diisi | Butang hantar dilumpuhkan (`!quantity.trim()`) |
| Dos tidak diisi | Butang hantar dilumpuhkan (`!dose.trim()`) |
| Kuota penuh | Item dikelabukan dalam dialog, toast.warning dipaparkan |

---

## 8. Model Kebenaran

Halaman ini memerlukan keizinan `manage_supply`. Pengguna tanpa keizinan ini akan melihat mesej "Akses Terhad" dan bukannya antara muka pendispensan.

| Peranan | Boleh Akses? |
|---------|-------------|
| Pentadbir | ✅ |
| Penjaga Stor | ✅ |
| Kakitangan Farmasi | ✅ |
| Kakitangan Klinik | ❌ ("Anda tiada kebenaran untuk mendispens.") |

---

## 9. Perbandingan dengan Aliran Pendispensan Biasa

| Aspek | Butiran Pesakit (Aliran Biasa) | Dispen Pantas |
|-------|-------------------------------|---------------|
| Langkah | 5–7 klik + navigasi | 3 langkah linear |
| Carian pesakit | Navigasi ke /pesakit → cari | Terus di halaman |
| Pemilihan item | Kembangkan tugasan → klik Bekal | Klik item dari senarai |
| Pendaftaran item baharu | Dialog berasingan dengan carian | Dialog sebaris dengan semakan kuota |
| Item kerap | Tiada | 10 item paling kerap, ditapis |
| Maklum balas | Toast sahaja | Toast + sepanduk animasi |
| Kekal pada pesakit? | Tidak (kembali ke senarai atau butiran) | Ya (terus boleh mendispens lagi) |
| Papan kekunci | Tiada pintasan khas | Esc untuk undur, Enter untuk hantar |

---

## 10. Responsif

| Elemen | Desktop (>768px) | Mudah Alih (<768px) |
|--------|-----------------|---------------------|
| Tajuk halaman | 22px | 18px |
| Padding kad carian | 32px 24px | 24px 16px |
| Padding kad pesakit | 18px 20px | 14px |
| Padding kad pemilihan item | 20px | 16px |
| Padding borang | 20px | 16px |
| Grid medan borang | 2 lajur (1fr 1fr) | 1 lajur |
| Lebar maksimum halaman | 800px | 800px (dengan padding 4px tambahan) |
| Sempadan | Normal | `.dispens-pantas { padding: 0 4px; }` |

---

## 11. Prestasi & Pengoptimuman

| Aspek | Pendekatan |
|-------|------------|
| Carian pesakit | Debounce 300ms, min 2 aksara, had 10 hasil |
| Lazy loading | Tugasan pesakit hanya diambil apabila pesakit dipilih (`enabled: !!selectedPatient`) |
| Lazy loading | Kelompok hanya diambil apabila item dipilih (`enabled: !!selectedItem`) |
| useMemo | 6 pengiraan diingati untuk mengelakkan pengiraan semula |
| useCallback | 2 fungsi distabilkan |
| Invalidasi | Hanya 5 kunci kueri yang berkaitan diinvalidasikan selepas bekalan |
| Auto-fokus | Medan menerima fokus secara programatik untuk aliran pantas |
| Pembersihan state | Fungsi `clearForm()` dan `clearPatient()` menetapkan semula semua state dengan cekap |

---

## 12. Model Data Berkaitan

```
Dispen Pantas menggunakan:
  patients (carian + pilih)
  items + count_active_assignments RPC (senarai item + kuota)
  patient_item_assignments + items (tugasan aktif pesakit)
  item_forms (nama bentuk dos)
  supply_records → patient_item_assignments (pengiraan item kerap)
  item_batches (pemilihan kelompok FEFO)
  supply_durations (tempoh bekalan)
  POST /api/supply (process_supply)
```

---

## 13. Kekuatan & Amalan Baik

1. **Aliran linear yang jelas:** 3 langkah yang tidak boleh disalahfahamkan — carian → pilih → bekal
2. **Direka untuk kelajuan:** Autofokus, auto-isi dos, auto-pilih kelompok, pintasan papan kekunci
3. **Item kerap:** Algoritma pintar yang menunjukkan item paling relevan berdasarkan sejarah global + konteks pesakit
4. **Maklum balas visual segera:** Sepanduk kejayaan animasi yang auto-hilang, membolehkan pendispensan seterusnya tanpa gangguan
5. **Semakan kuota:** Mencegah pendaftaran item yang telah mencapai had pesakit
6. **Pendaftaran item sebaris:** Tidak perlu meninggalkan halaman untuk mendaftar item baharu
7. **Navigasi papan kekunci:** Escape untuk undur, Enter untuk hantar — mempercepatkan aliran kerja
8. **Pengendalian ralat yang baik:** Mesej ralat deskriptif dari API, mesej "tiada kelompok", mesej "kuota penuh"
9. **Pengelompokan state yang kemas:** Semua state berkaitan dalam satu komponen dengan fungsi pembersihan yang jelas
10. **Konsistensi visual:** Tema oren yang tersendiri tetapi masih dalam bahasa reka bentuk keseluruhan aplikasi
11. **Pencegahan hantaran tidak sah:** Butang dilumpuhkan sehingga semua medan wajib diisi

---

## 14. Peluang Penambahbaikan

1. **958 baris monolitik:** Boleh dipecahkan kepada komponen berasingan (`PatientSearch`, `PatientCard`, `ItemSelector`, `DispenseForm`, `RegisterItemDialog`) untuk kebolehselenggaraan
2. **Tiada pengesahan kuantiti vs stok:** Pengguna boleh memasukkan kuantiti melebihi stok kelompok — pengesahan hanya berlaku di pelayan (API). Boleh ditambah pengesahan sisi klien
3. **Item kerap memerlukan 500 rekod:** Kueri `supply_records` tanpa had masa mungkin mengambil banyak data dari semasa ke semasa. Boleh dihadkan kepada 30/90 hari terakhir
4. **Pengiraan item kerap tidak diingati:** `staleTime: 0` — setiap kali halaman dimuatkan, pengiraan dijalankan semula. Boleh ditingkatkan ke 60 saat
5. **Tiada auto-lengkap dos:** Dos diisi dari tugasan, tetapi tiada cadangan dos pintar berdasarkan sejarah
6. **Pemilih kelompok tanpa penunjuk FEFO:** Walaupun diisih FEFO, tiada penanda visual "Guna Dahulu" pada kelompok yang paling awal luput
7. **Borang tidak boleh dikosongkan sebahagian:** Hanya boleh kosongkan sepenuhnya (clearForm) — tiada butang padam untuk medan individu
8. **Sepanduk kejayaan mengganggu aliran:** Walaupun auto-hilang, sepanduk menolak kandungan ke bawah. Boleh dijadikan toast overlay
9. **Tiada pengesahan "Adakah anda pasti?":** Tiada dialog pengesahan sebelum menghantar bekalan
10. **Tiada sejarah pendispensan pantas:** Tiada bahagian "Baru-baru ini Dibekalkan" untuk rujukan cepat
11. **Medan carian item tiada placeholder:** Medan carian item didaftarkan tidak mempunyai teks placeholder
12. **Saiz halaman 958 baris:** Boleh dikurangkan dengan mengekstrak gaya keStyles ke fail berasingan atau menggunakan Tailwind