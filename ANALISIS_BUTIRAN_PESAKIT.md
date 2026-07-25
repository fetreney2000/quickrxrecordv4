# Analisis Halaman Butiran Pesakit (Patient Detail Page)

**Fail:** `quickrx-new/src/app/(dashboard)/pesakit/[id]/page.tsx`  
**Komponen Sokongan:** `quickrx-new/src/components/pesakit/merge-dialog.tsx`  
**Jenis Data:** `quickrx-new/src/types/index.ts`  
**Utiliti:** `quickrx-new/src/lib/utils.ts`  
**Tarikh Analisis:** 26 Julai 2026

---

## 1. Gambaran Keseluruhan

Halaman **Butiran Pesakit** ialah halaman perincian untuk memaparkan dan mengurus maklumat seorang pesakit secara komprehensif dalam sistem QuickRxRecord. Halaman ini dibina sebagai komponen klien Next.js (`"use client"`) dengan corak laluan dinamik `[id]` — setiap pesakit mempunyai halaman butiran tersendiri berdasarkan ID unik mereka.

Ini merupakan halaman yang paling kompleks dalam keseluruhan aplikasi, menggabungkan **paparan data**, **pengeditan sebaris**, **pengurusan item pesakit**, **rekod bekalan**, **sejarah dos**, dan **penggabungan pesakit pendua** — semuanya dalam satu antara muka yang koheren.

**URL laluan:** `/pesakit/[id]`

---

## 2. Seni Bina Komponen

### 2.1 Hierarki Komponen

```
PatientDetailPage (default export)
├── Breadcrumb
├── Header (tajuk + butang kembali)
├── FoldableCard: Maklumat Pesakit
│   ├── Mod Lihat (paparan grid 3-kol)
│   └── Mod Edit (borang sebaris)
├── Dialog: Nyahaktifkan Pesakit
├── FoldableCard: Item Didaftarkan
│   ├── Header: Badge Aktif/Tidak Aktif + Butang Tambah Item
│   │   └── Dialog: Tambah Item (carian + pilih + dos)
│   ├── Senarai Item (pagination 50/item)
│   │   └── Setiap Item (boleh dikembangkan):
│   │       ├── Butiran Tugasan (grid 4-kol)
│   │       ├── Bar Tindakan: Bekal | Kemaskini Dos | Tamatkan
│   │       ├── FoldableCard: Sejarah Dos
│   │       │   └── Table dengan SortableHeader
│   │       └── FoldableCard: Sejarah Bekalan
│   │           └── Table dengan SortableHeader + Tindakan Edit/Padam
│   └── Navigasi Halaman
├── Dialog: Tamatkan Item
├── Dialog: Padam Rekod Bekalan
├── Dialog: Edit Rekod Bekalan
├── Dialog: Kemaskini Dos
├── Dialog: Bekal Ubat
└── MergeDialog
```

### 2.2 Komponen Dalaman (Private Components)

#### `SortableHeader`
Komponen kecil yang memaparkan pengepala jadual dengan keupayaan isih. Menunjukkan ikon anak panah atas/bawah (ChevronUp/ChevronDown) apabila lajur tersebut adalah isihan aktif.

**Props:**
- `label` — Teks pengepala
- `sortKey` — Kunci untuk isihan
- `currentSort` — Objek `{ key, dir }` semasa
- `onSort` — Callback apabila diklik

**Reka bentuk visual:** Kursor `pointer`, kesan hover `bg-muted/50`, teks `select-none`.

#### `FoldableCard`
Komponen yang membalut `Card` dengan keupayaan lipat/buka (collapsible). Digunakan secara meluas di seluruh halaman untuk menguruskan kepadatan maklumat.

**Props:**
- `title` — ReactNode untuk tajuk kad
- `defaultOpen` — Boolean mengawal keadaan awal (default: true)
- `children` — Kandungan kad
- `headerExtra` — Elemen tambahan di pengepala (cth. butang Edit, badge status)

**Ciri-ciri:**
- Menggunakan Framer Motion `AnimatePresence` untuk animasi buka/tutup yang licin
- Ikon ChevronDown berputar 180° apabila dibuka
- Keseluruhan pengepala adalah boleh klik untuk membuka/menutup
- `headerExtra` menerima `e.stopPropagation()` untuk mengelakkan konflik klik

### 2.3 Komponen Luaran

#### `MergeDialog`
Terletak di `quickrx-new/src/components/pesakit/merge-dialog.tsx`, dialog ini mengendalikan proses penggabungan pesakit pendua. Mengandungi dua langkah:

1. **Langkah Carian (search):**
   - Input carian dengan ikon Search
   - Carian melalui API Supabase menggunakan `ilike` pada `nama`, `nombor_kad_pengenalan`, dan `nombor_pendaftaran_hospital`
   - Paparan jadual dengan checkbox untuk memilih pesakit pendua
   - Badge menunjukkan pesakit yang telah dipilih

2. **Langkah Pengesahan (confirm):**
   - Amaran kuning dengan ikon `AlertTriangle`
   - Jadual ringkasan pesakit yang akan digabungkan
   - Butang kembali dan butang "Gabungkan Sekarang" (destructive)

**Logik penggabungan:**
- Jika item pendua wujud di kedua-dua pesakit: rekod bekalan dan sejarah dos dipindahkan ke tugasan pesakit utama, tugasan pendua ditamatkan
- Jika item unik: tugasan dipindahkan ke pesakit utama
- Pesakit pendua ditandakan `merged_into` dan dinyahaktifkan

---

## 3. Pengurusan State (Keadaan)

### 3.1 State Tempatan (useState)

| State | Jenis | Tujuan |
|-------|------|--------|
| `editMode` | `boolean` | Kawal mod lihat vs mod edit maklumat pesakit |
| `editData` | `Partial<Patient>` | Data borang edit pesakit |
| `openAddAssignment` | `boolean` | Kawal dialog tambah item |
| `newAssignment` | `object` | Data borang tugasan baharu |
| `itemSearch` | `string` | Carian item dalam dialog tambah |
| `selectedItemId` | `string \| null` | Item yang dipilih dalam dialog carian |
| `openSupply` | `string \| null` | ID tugasan untuk dialog bekal (null = tutup) |
| `supplyData` | `object` | Data borang bekalan |
| `openMerge` | `boolean` | Kawal dialog gabung pesakit |
| `expandedAssignment` | `string \| null` | ID tugasan yang sedang dikembangkan |
| `openUpdateDose` | `string \| null` | ID tugasan untuk dialog kemaskini dos |
| `doseUpdate` | `object` | Data borang kemaskini dos |
| `editSupplyRecord` | `any \| null` | Rekod bekalan yang sedang diedit |
| `openStopAssign` | `string \| null` | ID tugasan untuk dialog tamatkan |
| `stopReason` | `string` | Sebab penamatan tugasan |
| `openDeleteSupply` | `any \| null` | Rekod bekalan untuk dipadam |
| `openDeactivate` | `boolean` | Kawal dialog nyahaktifkan pesakit |
| `assignmentSort` | `{ key, dir } \| null` | Isihan untuk jadual tugasan |
| `doseSort` | `{ key, dir } \| null` | Isihan untuk jadual sejarah dos |
| `supplySort` | `{ key, dir } \| null` | Isihan untuk jadual sejarah bekalan |
| `assignmentPage` | `number` | Halaman semasa untuk pagination tugasan |
| `isMobile` | `boolean` | Kesan peranti mudah alih |

### 3.2 Data Teringat (useMemo)

- `formsMap` — Peta `id_bentuk → nama` untuk carian pantas
- `activeItemIds` — Set ID item yang mempunyai tugasan aktif
- `getItemDisplayName` — Callback untuk format nama paparan item (nama + kekuatan + bentuk)
- `sortedAssignments` — Tugasan diisih, dengan yang aktif diutamakan
- `pagedAssignments` — Tugasan selepas pagination
- `sortedDoseHistory` — Sejarah dos diisih
- `sortedSupplyHistory` — Sejarah bekalan diisih
- `filteredItems` — Item yang ditapis berdasarkan carian
- `totalCount`, `activeCount`, `inactiveCount` — Kiraan statistik

### 3.3 Kesan Sampingan (useEffect)

1. **Resize Listener** — Mengesan lebar tetingkap untuk mengesan peranti mudah alih (< 768px)
2. **Auto-select Batch** — Apabila `availableBatches` tersedia dan tiada batch dipilih, auto-pilih batch pertama (FEFO — First Expiry First Out)

---

## 4. Pemerolehan Data (Data Fetching)

Menggunakan **React Query** (`@tanstack/react-query`) dengan klien **Supabase**.

### 4.1 Kueri Utama

| Kunci Kueri | Jadual Supabase | Tujuan |
|-------------|-----------------|--------|
| `["patient", id]` | `patients` | Dapatkan data pesakit tunggal |
| `["assignments", id]` | `patient_item_assignments` (join: items, profiles×3) | Semua tugasan item pesakit dengan item dan profil kakitangan |
| `["item_forms"]` | `item_forms` | Senarai bentuk dos item |
| `["items-with-stats"]` | `items` + RPC `count_active_assignments` | Item dengan kiraan pesakit aktif dan baki kuota |
| `["dose-history", aid]` | `dose_history` (join: profiles) | Sejarah dos untuk tugasan dikembangkan (enabled: !!expandedAssignment) |
| `["supply-history", aid]` | `supply_records` (join: item_batches, profiles) | Sejarah bekalan (enabled: !!expandedAssignment) |
| `["supply_durations"]` | `supply_durations` | Senarai tempoh bekalan (Hari, Minggu, Bulan) |
| `["batches", openSupply]` | `item_batches` (filter: item_id, kuantiti > 0, belum luput) | Kelompok tersedia untuk item semasa |

### 4.2 Corak Prefetch

Rekod sejarah dos dan bekalan HANYA diambil apabila tugasan dikembangkan (`expandedAssignment` tidak null), menggunakan pilihan `enabled`. Ini mengoptimumkan prestasi dengan mengelakkan pengambilan data yang tidak diperlukan.

### 4.3 Mutasi

| Mutasi | Operasi | Kunci Invalidasi |
|--------|---------|------------------|
| `updatePatientMutation` | UPDATE patients | `["patient", id]`, `["assignments", id]` |
| `toggleActiveMutation` | UPDATE patients (aktif) | Sama seperti di atas |
| `addAssignmentMutation` | INSERT patient_item_assignments + dose_history | `["assignments", id]`, `["items-with-stats"]` |
| `stopAssignmentMutation` | UPDATE patient_item_assignments (tamat) | `["assignments", id]`, `["items-with-stats"]`, `["patient", id]` |
| `updateDoseMutation` | UPDATE + INSERT dose_history | `["assignments", id]`, `["dose-history", aid]` |
| `supplyMutation` | POST /api/supply (transaksi atomik) | `["assignments", id]`, `["supply-history", aid]`, `["batches"]` |
| `deleteSupplyMutation` | DELETE supply_records | `["supply-history", aid]` |
| `saveEditSupplyMutation` | UPDATE supply_records | `["supply-history", aid]` |

### 4.4 Pengendalian Ralat

Setiap mutasi mempunyai pengendali `onError` yang memaparkan mesej ralat melalui `toast.error()`. Ralat dari API bekalan diparsing dari respons JSON. Mesej ralat umum mengembalikan teks deskriptif dalam Bahasa Melayu.

---

## 5. Aliran UX (User Experience)

### 5.1 Keadaan Memuatkan (Loading State)

Apabila data pesakit sedang dimuatkan (`patientLoading`), halaman memaparkan pemutar (spinner) yang dibina khas dengan CSS — bulatan dengan sempadan berputar dan teks "Memuatkan..." berwarna kelabu. Tiada skeleton loader yang kompleks; reka bentuk ini sengaja minimalis.

### 5.2 Keadaan Tidak Dijumpai (Not Found / Error)

Jika `patient` adalah null/missing, paparan ringkas "Pesakit tidak dijumpai." dipaparkan di tengah skrin.

### 5.3 Mod Lihat Maklumat Pesakit

Paparan lalai menunjukkan:
- **Grid 3-lajur:** No. Kad Pengenalan, No. Pendaftaran Hospital, No. Telefon
- **Grid 1-lajur penuh:** Tarikh Daftar, Alamat, Catatan
- **Bar statistik 4-lajur:** Kad kecil dengan ikon bulatan berwarna — Jumlah Item (biru), Item Aktif (hijau), Status (ungu), Tarikh Daftar (amber)

### 5.4 Mod Edit Maklumat Pesakit

Apabila butang "Edit" diklik:
- Grid bertukar kepada borang dengan Input dan Textarea
- Pemformatan automatik semasa `onBlur`:
  - Nama dan Alamat → `toTitleCase()`
  - No. Kad Pengenalan → `formatMyKad()` (format ######-##-####)
  - No. Telefon → `formatPhone()`
  - No. Pendaftaran Hospital → `toUpperCase()`
- Butang "Simpan" dan "Batal"
- Proses simpan melalui `updatePatientMutation`

### 5.5 Menambah Item (Add Assignment)

Dialog berbilang langkah:
1. Klik butang "Tambah Item" (hanya untuk pesakit aktif + kebenaran `manage_patients`)
2. Cari item dalam senarai
3. Pilih item (highlight biru, item yang sudah aktif ditunjukkan dengan kelegapan 50%)
4. Isi Dos dan Catatan
5. Simpan — secara automatik juga mencipta rekod dos pertama (dose_history) dengan catatan "Bekalan kali pertama"

**Pintasan Papan Kekunci:** Tekan Enter dalam dialog untuk simpan (dengan syarat item dipilih dan bukan item yang sudah aktif).

### 5.6 Membekal Ubat (Supply)

Dialog bekalan mengandungi:
- Dos semasa (baca-sahaja)
- Input kuantiti (nombor)
- Tempoh dibekal (nilai + unit dari jadual `supply_durations`)
- Pemilih kelompok dengan sistem FEFO (First Expiry First Out) — dipaparkan dengan butang radio tersuai
- Catatan bekalan
- Auto-pilih kelompok pertama secara lalai
- Panggilan ke API `/api/supply` untuk transaksi atomik

### 5.7 Kemaskini Dos

Dialog ringkas untuk menukar dos:
- Input dos baharu (auto `toUpperCase()`)
- Catatan (opsyenal)
- Menyimpan akan mengemaskini dos di `patient_item_assignments` DAN menyisipkan rekod baharu di `dose_history`

### 5.8 Menamatkan Item (Stop Assignment)

Dialog pengesahan dengan:
- Amaran merah bahawa tindakan tidak boleh dibatalkan
- Input "Sebab Tamat" (wajib diisi — butang simpan dilumpuhkan sehingga diisi)
- Butang "Ya, Tamatkan" berwarna destructive

### 5.9 Nyahaktifkan Pesakit

Dialog dengan amaran amber:
- "Pesakit yang dinyahaktifkan tidak akan dapat menerima bekalan baharu"
- Semua rekod sedia ada kekal dalam sistem
- Pesakit boleh diaktifkan semula

### 5.10 Sejarah Dos & Bekalan

Setiap tugasan yang dikembangkan menunjukkan dua sub-kad boleh lipat:
- **Sejarah Dos:** Jadual dengan isihan pada Tarikh, Dos, Dikemaskini Oleh, Catatan
- **Sejarah Bekalan:** Jadual dengan isihan pada Tarikh, Kuantiti, Dos, Tempoh, Kakitangan, Catatan, dan lajur Tindakan (Edit/Padam)

### 5.11 Penggabungan Pesakit (Merge)

Komponen `MergeDialog` menyediakan:
- Carian mengikut nama, no. KP, atau no. pendaftaran hospital
- Pemilihan berbilang pesakit pendua
- Langkah pengesahan dengan amaran
- Logik pemindahan tugasan dan rekod yang kompleks
- Pesakit pendua dinyahaktifkan dan ditandakan `merged_into`

---

## 6. Reka Bentuk Visual

### 6.1 Palet Warna

| Elemen | Warna | Kegunaan |
|--------|-------|----------|
| Latar belakang halaman | Putih / `bg-background` | Latar utama |
| Aksen biru | `#1877f2` (Facebook Blue) | Butang, pautan, pengepala, ikon aktif |
| Aksen hijau | `emerald` | Item Aktif, status aktif, badge success |
| Aksen ungu | `purple` | Kad Status |
| Aksen amber | `amber` | Kad Tarikh Daftar, amaran nyahaktif |
| Aksen merah | `destructive` | Butang tamat, padam, amaran bahaya |
| Aksen kelabu | `muted` / `#65676b` | Teks sekunder, ikon tidak aktif |
| Latar dialog | `bg-muted/30` | Latar sub-kandungan dalam kad dikembangkan |

### 6.2 Tipografi

- **Saiz fon utama:** 13-14px untuk teks biasa, 10px untuk badge kecil
- **Berat fon:** 700 untuk tajuk dan nombor statistik, 500 (medium) untuk sub-tajuk
- **Saiz tajuk halaman:** 22px (desktop), 18px (mudah alih)
- **Saiz fon statistik:** 18px (desktop), 14px (mudah alih)
- **Jarak huruf:** `-0.01em` pada tajuk utama

### 6.3 Animasi (Framer Motion)

| Animasi | Penerangan |
|----------|------------|
| `initial={{ opacity: 0, y: 5 }}` + `animate={{ opacity: 1, y: 0 }}` | Kemunculan bertahap dengan offset `delay` (stagger effect) |
| `AnimatePresence` pada FoldableCard | Transisi buka/tutup dengan `height: 0 → auto` dan `opacity` |
| Rotasi ikon Chevron | Putaran 180° pada buka/tutup |
| `duration: 0.15` | Semua animasi menggunakan tempoh 0.15s yang pantas |

### 6.4 Reka Bentuk Responsif

Penggunaan meluas `isMobile` untuk menyesuaikan susun atur:

| Elemen | Desktop | Mudah Alih |
|--------|---------|------------|
| Tajuk halaman | 22px | 18px |
| Grid maklumat pesakit | 3 lajur | 1 lajur |
| Grid butiran tugasan | 4 lajur | 2 lajur |
| Kad statistik | 4 lajur | 2 lajur |
| Saiz ikon statistik | 40×40px / 20px | 36×36px / 16px |
| _Gap_ antara elemen | 16px / 12px | 8px / 6px |

CSS tersuai disuntik melalui `<style>` tag untuk:
- `max-width: calc(100vw - 32px)` untuk dialog pada mudah alih
- `padding-bottom: 100px` untuk memberi ruang pada bar navigasi bawah mudah alih
- `overflow-y: auto` dan `max-height` untuk dialog pada skrin kecil

### 6.5 Element Hiasan

- **Gelung latar belakang:** Div bulat 300×300px dengan `radial-gradient` biru yang kabur (blur 30px) di penjuru kanan atas halaman, memberikan kesan _soft glow_

### 6.6 Ikon

Menggunakan pustaka **Lucide React** secara menyeluruh:
- `ArrowLeft` — Butang kembali
- `Pill` — Ikon item/ubat
- `Activity` — Status aktif
- `Users` — Status pesakit
- `Calendar` — Tarikh daftar
- `Plus` — Tambah item
- `Edit` — Edit/kemaskini
- `XCircle` — Tamatkan
- `Package` — Bekal
- `Merge` — Gabung pesakit
- `Trash2` — Padam
- `ChevronDown` / `ChevronUp` — Isih dan kembang/kuncup
- `ChevronLeft` / `ChevronRight` — Navigasi halaman
- `Search` — Carian
- `Sparkles` — Dialog tambah item
- `ShieldAlert` — Dialog nyahaktif
- `AlertTriangle` — Amaran penggabungan

---

## 7. Model Kebenaran (Permission Model)

Menggunakan fungsi `hasPermission()` dari konteks pengesahan:

| Keizinan | Peranan |
|----------|---------|
| `manage_patients` | `Pentadbir`, `Kakitangan Farmasi` |
| `manage_supply` | `Pentadbir`, `Penjaga Stor`, `Kakitangan Farmasi` |

**Kesan pada UI:**

- **Boleh edit** (`canEdit = true`): Butang Edit, Gabung, dan Nyahaktif/Aktifkan muncul di kad pesakit
- **Tidak boleh edit** (`canEdit = false`): Hanya butang ini disembunyikan; data masih boleh dilihat
- **Boleh bekal** (`canSupply`): Tidak digunakan secara langsung dalam UI semasa — tetapi butang Bekal sentiasa kelihatan untuk tugasan aktif (mungkin perlu disemak)
- **Tambah item** hanya jika `canEdit = true` DAN pesakit aktif
- **Tamatkan item** hanya jika `canEdit = true`

---

## 8. Pengoptimuman Prestasi

### 8.1 Strategi Ambilan Data

- **staleTime: 0** pada hampir semua kueri — memastikan data sentiasa segar
- **Pagination** — Tugasan dihadkan kepada 50 setiap halaman (`PAGE_SIZE = 50`)
- **Lazy loading** — Sejarah dos dan bekalan hanya diambil apabila tugasan dikembangkan (`enabled: !!expandedAssignment`)
- **useMemo** — Digunakan untuk pengiraan yang kerap (bentuk peta, set ID aktif, data diisih)
- **useCallback** — Digunakan untuk `getItemDisplayName` bagi mengelakkan penciptaan semula fungsi

### 8.2 Strategi Invalidasi Kueri

Selepas setiap mutasi, hanya kunci kueri yang berkaitan diinvalidasikan:
- Mutasi pesakit → `["patient", id]`, `["assignments", id]`
- Mutasi tugasan → `["assignments", id]`, `["items-with-stats"]`
- Mutasi bekalan/dos → Kueri sejarah spesifik

### 8.3 Pengendalian Rendering

- Tiada _waterfall_ yang tidak perlu — kueri bebas berjalan selari
- Komponen `FoldableCard` menggunakan `AnimatePresence` untuk unmount kandungan tersembunyi, mengurangkan nod DOM

---

## 9. Keselamatan & Integriti Data

### 9.1 Pengesahan Sisi Klien

- Butang Simpan dilumpuhkan sehingga semua medan wajib diisi (cth. item terpilih, sebab tamat, kuantiti, batch)
- Amaran untuk item yang sudah aktif — mencegah penduaan
- Pengesahan format MyKad (12 digit) dan nombor telefon

### 9.2 Pengesahan Sisi Pelayan

- API `/api/supply` mengendalikan transaksi atomik (mengurangkan stok batch, merekod bekalan, mengemaskini transaksi inventori)
- Mutasi menggunakan Supabase RLS (Row Level Security)
- Ralat dari pelayan dipaparkan kepada pengguna melalui toast

### 9.3 Pencegahan Kehilangan Data

- Dialog pengesahan untuk tindakan yang tidak boleh dibatalkan (tamatkan item, padam rekod, nyahaktifkan pesakit, gabung pesakit)
- Amaran eksplisit tentang ketidakbolehbalikan

---

## 10. Kebergantungan (Dependencies)

| Pakej | Kegunaan |
|--------|---------|
| `next` (Next.js 15) | Rangka kerja, App Router, `useParams`, `useRouter` |
| `@tanstack/react-query` | Pengurusan state pelayan, caching, invalidasi |
| `@supabase/supabase-js` | Klien pangkalan data |
| `framer-motion` | Animasi (AnimatePresence, motion.div) |
| `sonner` | Notifikasi toast |
| `lucide-react` | Set ikon |
| `tailwindcss` + `clsx` + `tailwind-merge` | Utiliti CSS dan penggayaan |

---

## 11. Model Data Berkaitan

```
Patient (1) ──────< PatientItemAssignment (N) ──> Item
                            │
                            ├──< SupplyRecord (N) ──> ItemBatch
                            │
                            └──< DoseHistory (N)
                            
Patient ──> merged_into ──> Patient (self-referential)
```

**Jadual yang dirujuk:**
- `patients` — Data pesakit
- `patient_item_assignments` — Tugasan item kepada pesakit
- `items` — Katalog item/ubat
- `item_forms` — Bentuk dos (tablet, kapsul, sirap, dll.)
- `item_batches` — Kelompok/item dengan kuantiti dan tarikh luput
- `supply_records` — Rekod bekalan
- `dose_history` — Sejarah perubahan dos
- `supply_durations` — Tempoh bekalan (Hari, Minggu, Bulan)
- `profiles` — Profil kakitangan (dimulakan, ditamatkan, direkod, dikemaskini, pembekal)

---

## 12. Kekuatan & Amalan Baik

1. **Seni bina bersih** — Pemisahan yang jelas antara UI, state, dan logik data
2. **Corak React Query** — Penggunaan `useQuery` + `useMutation` yang konsisten dengan strategi invalidasi yang tepat
3. **Reka bentuk responsif** — Penggunaan `isMobile` state dan media query CSS untuk pengalaman yang baik di semua saiz skrin
4. **Maklum balas segera** — Setiap tindakan mempunyai toast kejayaan/gagal, butang dilumpuhkan semasa mutasi berjalan
5. **Pencegahan ralat** — Pengesahan medan wajib, amaran pendua, dialog pengesahan untuk tindakan berbahaya
6. **Animasi bermakna** — Bukan sekadar hiasan; transisi memberi maklum balas visual tentang perubahan state
7. **Pengoptimuman prestasi** — Lazy loading sejarah, pagination, `useMemo`/`useCallback` yang wajar
8. **Reka bentuk berasaskan kebenaran** — UI menyesuaikan diri berdasarkan peranan pengguna
9. **Format automatik** — Pemformatan data automatik pada `onBlur` (MyKad, telefon, title case)
10. **Konsistensi visual** — Palet warna, saiz fon, jarak, dan komponen yang seragam

---

## 13. Peluang Penambahbaikan

1. **Pemisahan komponen** — Halaman 652 baris boleh dipecahkan kepada komponen yang lebih kecil (cth. `PatientInfoCard`, `AssignmentList`, `SupplyDialog`, dll.) untuk kebolehselenggaraan yang lebih baik
2. **Ujian** — Tiada ujian unit atau integrasi untuk halaman serumit ini
3. **Pengurusan ralat yang lebih mantap** — `ErrorBoundary` React boleh ditambah untuk mengendalikan kegagalan yang tidak dijangka
4. **Skeleton loading** — Boleh menggantikan spinner CSS ringkas dengan skeleton yang lebih informatif
5. **`canSupply` tidak digunakan** — Pemboleh ubah ini dinyatakan di baris 73 tetapi tidak digunakan dalam UI — mungkin perlu digunakan untuk mengawal keterlihatan butang Bekal
6. **Penggunaan `any`** — Beberapa type cast menggunakan `any` (cth. `any[]`, `any` untuk rekod bekalan); boleh ditakrifkan dengan jenis yang lebih spesifik
7. **Pengendalian offline** — Tiada pengendalian untuk keadaan offline
8. **Aksesibiliti** — Boleh ditambah baik dengan atribut ARIA, pengurusan fokus untuk dialog, dan navigasi papan kekunci yang lebih baik