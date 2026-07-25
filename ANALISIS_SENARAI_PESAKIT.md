# Analisis Halaman Senarai Pesakit (Patient List) — QuickRxRecord

**Fail Dianalisis:**
- `quickrx-new/src/app/(dashboard)/pesakit/page.tsx` — Halaman Senarai Pesakit (382 baris)

**Tarikh Analisis:** 26 Julai 2026

---

## 1. Gambaran Keseluruhan

Halaman **Senarai Pesakit** (`/pesakit`) ialah halaman indeks untuk mengurus senarai pesakit berdaftar. Ia berfungsi sebagai **direktori utama** yang membolehkan staf mencari, menyemak imbas, dan mendaftar pesakit baharu. Halaman ini direka sebagai jadual data klasik dengan keupayaan carian, isihan, dan pagination — sesuai untuk set data besar.

**Ciri-ciri utama:**
- Jadual pesakit dengan 4 lajur (nama, KP, hospital, telefon) + tindakan
- Carian teks penuh merentasi nama, No. KP, dan No. Pendaftaran Hospital
- Isihan pada semua lajur (asc/desc)
- Pagination dengan 100 rekod setiap halaman + tetingkap gelongsor (sliding window) 7 butang
- Dialog pendaftaran pesakit baharu dengan pengesanan pendua
- Pemformatan automatik (MyKad, telefon, title case) pada onBlur
- Reka bentuk dwi-mod: jadual pada desktop (≥640px), kad senarai pada mudah alih (<640px)
- Navigasi terus ke butiran pesakit dengan satu klik

---

## 2. Seni Bina Komponen

### 2.1 Hierarki Komponen

```
PesakitPage (default export)
├── Orb hiasan (biru, 300px)
├── Breadcrumb ("Senarai Pesakit")
├── Header
│   ├── Ikon Users + Tajuk "Senarai Pesakit" + Sarikata
│   └── Butang "Daftar Pesakit" (jika canEdit)
│       └── Dialog: Daftar Pesakit Baharu
│           ├── Header dialog (ikon Activity + tajuk)
│           ├── 6 medan borang:
│           │   ├── Nama * (wajib, auto-toTitleCase)
│           │   ├── Grid 2-lajur: No. KP + No. Pendaftaran Hospital
│           │   ├── No. Telefon (auto-formatPhone)
│           │   ├── Alamat (textarea, auto-toTitleCase)
│           │   └── Catatan (textarea)
│           ├── Amaran pendua (jika dikesan) — ambar
│           └── Footer: Butang Batal + Simpan
├── Kad Utama (glass card dengan sempadan kecerunan)
│   ├── Bar aksen (kecerunan biru-ungu-cyan, 3px)
│   ├── Bar carian + Kiraan pesakit
│   │   ├── Medan carian dengan ikon Search
│   │   └── Lencana kiraan "N pesakit"
│   ├── Jadual / Senarai
│   │   ├── Keadaan memuatkan (spinner)
│   │   ├── Keadaan kosong (mesej kontekstual)
│   │   ├── Pengepala jadual (desktop: 5 lajur boleh isih)
│   │   │   └── SortIcon (ArrowUpDown / ChevronUp / ChevronDown)
│   │   ├── Baris desktop (5 lajur, hover biru)
│   │   ├── Kad mudah alih (2 baris, ikon + nama + meta)
│   │   └── Navigasi halaman (apabila >1 halaman)
│   │       ├── "Halaman X daripada Y (Z pesakit)"
│   │       └── Butang halaman (tetingkap gelongsor 7)
└── CSS sebaris untuk animasi & responsif
```

### 2.2 Komponen Dalaman

#### `SortIcon`
Komponen kecil yang dipaparkan dalam pengepala jadual. Menggunakan `useCallback` untuk kestabilan.

**Props:** `{ columnKey: string }`

**Gelagat:**
- Tidak aktif: `ArrowUpDown` (12px, kelegapan 0.3)
- Aktif (asc): `ChevronUp` (12px, `#1877f2`)
- Aktif (desc): `ChevronDown` (12px, `#1877f2`)

---

## 3. Pengurusan State (Keadaan)

### 3.1 State Tempatan (useState) — 8 Pembolehubah

| State | Jenis | Tujuan |
|-------|------|--------|
| `search` | `string` | Pertanyaan carian pesakit |
| `page` | `number` | Halaman semasa (berasaskan 0) |
| `openAdd` | `boolean` | Kawal dialog daftar pesakit |
| `sort` | `{ key: string; dir: SortDir } \| null` | Isihan semasa (lajur + arah) |
| `newPatient` | `object` (6 medan) | Data borang pendaftaran pesakit baharu |
| `searchFocused` | `boolean` | Keadaan fokus medan carian |
| `duplicateWarning` | `{ type: string; patient: Patient } \| null` | Amaran pendua dari carian latar belakang |
| `lookupTimer` | `useRef<Timeout>` | Pemasa debounce untuk carian pendua |

### 3.2 Data Teringat (Derived)

| Pembolehubah | Pengiraan |
|-------------|-----------|
| `totalPages` | `Math.ceil((data?.total \|\| 0) / PAGE_SIZE)` (PAGE_SIZE = 100) |
| `canEdit` | `hasPermission(profile?.peranan, "manage_patients")` |
| `inputStyle` | Objek gaya CSS yang dikongsi untuk input dalam dialog |

### 3.3 Kesan Sampingan (useEffect) — 1

**Pengesanan Pendua (Debounced):**
```typescript
useEffect(() => {
  // Clear timer sebelumnya
  // Jika tiada KP dan tiada hospital → kosongkan amaran
  // Debounce 600ms:
  //   Cari di Supabase: nombor_kad_pengenalan ATAU nombor_pendaftaran_hospital
  //   Jika dijumpai → setDuplicateWarning({ type, patient })
  //   Jika tidak → setDuplicateWarning(null)
}, [newPatient.nombor_kad_pengenalan, newPatient.nombor_pendaftaran_hospital]);
```

Ini berjalan secara automatik semasa pengguna menaip No. KP atau No. Pendaftaran Hospital dalam dialog pendaftaran. Selepas 600ms tanpa perubahan, kueri carian pendua dihantar ke Supabase.

### 3.4 useCallback — 2

| Callback | Tujuan |
|----------|--------|
| `toggleSort` | Togol isihan — jika lajur sama, terbalikkan arah; jika berbeza, tetapkan asc. Reset halaman ke 0. |
| `SortIcon` | Komponen ikon isihan yang distabilkan |

---

## 4. Pemerolehan Data (Data Fetching)

### 4.1 Kueri Utama: `["patients", search, page, sort]`

**Strategi:** Dua kueri selari dengan `Promise.all`:

| Kueri | Tujuan |
|-------|--------|
| `countQuery` | Kiraan tepat (`count: "exact", head: true`) — hanya metadata, tiada baris data |
| `dataQuery` | Data sebenar dengan isihan + julat halaman |

**Kedua-dua kueri berkongsi penapis yang sama:**
- `aktif = true` — Hanya pesakit aktif
- `merged_into IS NULL` — Kecualikan pesakit yang telah digabungkan
- Carian (jika `search` tidak kosong): `or(nama.ilike, nombor_kad_pengenalan.ilike, nombor_pendaftaran_hospital.ilike)`

**Isihan lalai:** `nama ASC`

**Pagination:** `range(page * 100, (page + 1) * 100 - 1)` — 100 rekod setiap halaman

**Output:**
```typescript
{ patients: Patient[], total: number }
```

### 4.2 Mutasi: `addPatientMutation`

**Operasi:** INSERT ke `patients`
- Medan pilihan (KP, hospital, telefon, alamat, catatan) ditetapkan ke `null` jika kosong
- Mengembalikan ID rekod yang dimasukkan

**Semasa kejayaan:**
1. `toast.success("Pesakit berjaya ditambah.")`
2. Tutup dialog
3. Set semula borang ke nilai lalai
4. Invalidasi kueri `["patients"]`
5. **Navigasi terus ke halaman butiran pesakit baharu** — `router.push(/pesakit/${inserted.id})`

**Pendekatan navigasi ini adalah UX yang sangat baik:** Selepas mendaftar pesakit, staf serta-merta dibawa ke halaman butiran di mana mereka boleh mendaftarkan item/ubat.

### 4.3 Prestasi Kueri

- Kunci kueri termasuk `search`, `page`, dan `sort` — perubahan pada mana-mana parameter ini akan mengambil semula data
- Menukar halaman mengekalkan penapis carian dan isihan
- Menukar isihan menetapkan semula halaman ke 0 (`setPage(0)`)
- Carian menetapkan semula halaman ke 0
- Kiraan dan data diambil selari dengan `Promise.all`

---

## 5. Aliran UX (User Experience)

### 5.1 Keadaan Halaman

| Keadaan | Penerangan |
|---------|------------|
| **Memuatkan** | Spinner CSS + "Memuatkan pesakit..." |
| **Kosong (dengan carian)** | Ikon Search + "Tiada pesakit dijumpai." + "Cuba tukar kata kunci carian anda." |
| **Kosong (tanpa carian)** | Ikon Users + "Tiada pesakit berdaftar." + "Klik Daftar Pesakit untuk mendaftarkan pesakit baru." |
| **Data dipaparkan** | Jadual/senarai dengan pagination |
| **Dialog daftar terbuka** | Borang dengan pengesanan pendua masa nyata |

### 5.2 Aliran Pendaftaran Pesakit

```
Pengguna klik "Daftar Pesakit"
  → Dialog dibuka
  → Pengguna mengisi Nama * (wajib)
  → Pengguna mengisi No. KP dan/atau No. Pendaftaran Hospital
  → Selepas 600ms berhenti menaip:
      → Carian latar belakang untuk pendua
      → Jika dijumpai: Amaran ambar dengan nama pesakit + pautan "Lihat butiran pesakit"
      → Pengguna boleh: (a) klik pautan untuk ke butiran, atau (b) teruskan pendaftaran
  → Pengguna mengisi No. Telefon, Alamat, Catatan
  → Pemformatan automatik pada onBlur:
      → Nama, Alamat → toTitleCase
      → No. KP → formatMyKad (######-##-####)
      → No. Telefon → formatPhone (###-### ####)
      → No. Hospital → toUpperCase
  → Pengguna klik "Simpan"
  → Jika Nama kosong → butang dilumpuhkan
  → Mutasi berjalan → butang "Menyimpan..." dengan RefreshCw berputar
  → Berjaya: toast + navigasi ke /pesakit/[id]
  → Gagal: toast.error
```

### 5.3 Aliran Carian & Navigasi

```
Pengguna menaip dalam medan carian
  → Halaman ditetapkan semula ke 0
  → Kueri dihantar dengan penapis ILIKE
  → Jadual dikemas kini dengan hasil yang sepadan

Pengguna mengklik pengepala lajur
  → Isihan ditogol (asc→desc, atau lajur baharu→asc)
  → Halaman ditetapkan semula ke 0

Pengguna mengklik baris pesakit
  → setNavSource("pesakit") — untuk breadcrumb
  → Navigasi ke /pesakit/[id]
```

### 5.4 Navigasi Halaman (Pagination)

Sistem pagination menggunakan **tetingkap gelongsor 7 butang**:

```
Jika totalPages ≤ 7: Papar semua halaman [1] [2] [3] [4] [5] [6] [7]
Jika totalPages > 7:
  - Jika page < 3:         [1] [2] [3] [4] [5] [6] [7]
  - Jika page > total-4:   [...gelongsor ke hujung...]
  - Jika pertengahan:      [... page-3 ... page ... page+3 ...]
```

Butang halaman semasa: kecerunan biru, teks putih, berat 600
Butang halaman lain: putih, sempadan kelabu, teks hitam

Butang Previous/Next dilumpuhkan pada hujung julat (kelegapan 0.4, kursor default).
Teks info: "Halaman X daripada Y (Z pesakit)"

---

## 6. Reka Bentuk Visual

### 6.1 Palet Warna

| Elemen | Warna | Kegunaan |
|--------|-------|----------|
| Aksen biru | `#1877f2` / `#0d5bd4` | Butang, ikon, pengepala, isihan aktif, baris hover |
| Aksen ungu | `#7c3aed` | Sempadan kecerunan, bar aksen |
| Aksen cyan | `#06b6d4` | Sempadan kecerunan, bar aksen |
| Aksen ambar | `#f59e0b` / `#d97706` | Amaran pendua |
| Kelabu | `#65676b` / `#9ca3af` / `#dddfe2` | Teks sekunder, sempadan, placeholder, ikon tidak aktif |
| Putih | `#ffffff` | Latar kad, butang, latar dialog |
| Latar halaman | `#f0f2f5` (diwarisi) | Latar belakang |
| Kad kaca | `rgba(255,255,255,0.85)` + `blur(12px)` | Latar kad utama |

### 6.2 Kad Utama — Kesan Kaca & Sempadan Kecerunan

Kad utama menggunakan dua teknik visual yang sama dengan halaman log masuk:

1. **Sempadan kecerunan:** Pseudo-element dengan `padding: 1px` + kecerunan 4-warna + `mask-composite: exclude`
2. **Kesan kaca:** `rgba(255,255,255,0.85)` + `blur(12px)` + sempadan 1px putih separa telus
3. **Bar aksen:** 3px tinggi, kecerunan biru-ungu-cyan-biru, di bahagian atas kad

### 6.3 Tipografi

| Elemen | Saiz | Berat | Warna |
|--------|------|-------|-------|
| Tajuk halaman | 22px | 700 | `#1c1e21` |
| Sarikata header | 13px | 500 | `#65676b` |
| Pengepala jadual | 11px | 600 | `#65676b` (huruf besar, jarak huruf 0.05em) |
| Nama pesakit (desktop) | 13px | 500 | `#1c1e21` |
| Data lajur (desktop) | 13px | 400 | `#1c1e21` |
| Nama pesakit (mudah alih) | 14px | 500 | `#1c1e21` |
| Meta pesakit (mudah alih) | 12px | 400 | `#65676b` |
| Lencana kiraan | 12px | 600 | `#65676b` |
| Input carian | 13px | 500 | `#1c1e21` |
| Tajuk dialog | 16px | 700 | (default) |
| Label medan | 12px | 600 | `#65676b` |
| Input medan | 13px | 500 | `#1c1e21` |
| Butang Simpan | 13px | 600 | Putih |
| Butang Batal | 13px | 500 | `#1c1e21` |
| Info halaman | 12px | 400 | `#65676b` |
| Butang halaman | 12px | 400/600 | `#1c1e21` / Putih |
| Mesej kosong (tajuk) | 14px | 500 | `#65676b` |
| Mesej kosong (sarikata) | 12px | 400 | `#9ca3af` |

### 6.4 Jejari Sempadan

| Elemen | Jejari |
|--------|--------|
| Kad utama | 16px |
| Bar aksen | (mengikut kad) |
| Medan carian | 10px |
| Lencana kiraan | 10px |
| Ikon pesakit (avatar) | 10px (desktop), 10px (mudah alih) |
| Ikon header | 14px |
| Butang Daftar Pesakit | 12px |
| Butang halaman | 8px |
| Butang Simpan / Batal | 10px |
| Input dialog | 10px |
| Dialog | 16px |
| Amaran pendua | 10px |

### 6.5 Bayang

| Elemen | Bayang |
|--------|--------|
| Kad utama | `0 4px 16px rgba(0,0,0,0.06)` |
| Ikon header | `0 4px 12px rgba(24,119,242,0.3)` |
| Butang Daftar Pesakit | `0 4px 12px rgba(24,119,242,0.25)` |
| Dialog | `0 25px 50px rgba(0,0,0,0.15)` |

### 6.6 Animasi

| Elemen | Animasi | Jenis |
|--------|---------|-------|
| Breadcrumb | `opacity: 0 → 1` (0.12s) | Fade |
| Header | `opacity: 0, y: 5 → 1, 0` (0.15s, delay 0.02s) | Fade + slide |
| Kad utama | `opacity: 0, y: 5 → 1, 0` (0.15s, delay 0.01s) | Fade + slide |
| Baris jadual | `opacity: 0, y: -3 → 1, 0` (0.1s, stagger 0.008s) | Fade + slide down |
| Hover baris | Latar `rgba(24,119,242,0.03)` | Peralihan 0.15s |

### 6.7 Hiasan

- **Orb latar belakang:** 300×300px, biru 3%, blur 30px, di penjuru atas kanan (`top: -60px, right: -60px`)

---

## 7. Reka Bentuk Responsif

### 7.1 Dua Mod Paparan

Halaman ini menggunakan pendekatan **dual markup** — kedua-dua baris desktop dan kad mudah alih dijana dalam DOM, dengan CSS mengawal keterlihatan:

| Mod | Titik Putus | Paparan |
|-----|------------|---------|
| **Desktop** | ≥640px | Pengepala jadual grid (5 lajur) + baris grid (5 lajur) |
| **Mudah Alih** | <640px | Kad senarai (avatar + nama + meta + ChevronRight) |

### 7.2 Pengepala Jadual (Desktop)

Grid 5 lajur: `3fr 3fr 3fr 2fr 1fr`

| Lajur | Ikon | Boleh Isih? | Lebar |
|-------|------|------------|-------|
| Nama | `User` | ✅ | 3fr |
| No. Kad Pengenalan | `IdCard` | ✅ | 3fr |
| No. Pendaftaran Hospital | `Activity` | ✅ | 3fr |
| No. Telefon | `Phone` | ✅ | 2fr |
| Tindakan | — | ❌ | 1fr |

Pengepala dan baris menggunakan kelas CSS:
- `.pesakit-table-header` — `display: none` lalai, `display: grid !important` pada ≥640px
- `.pesakit-desktop-row` — `display: none` lalai, `display: grid !important` pada ≥640px
- `.pesakit-mobile-row` — `display: flex` lalai (dipaparkan pada <640px), `display: none !important` pada ≥640px

### 7.3 Baris Desktop

Setiap baris adalah grid 5 lajur yang boleh diklik:
- Lajur Nama: Avatar (32×32px, kecerunan biru) + teks nama (overflow ellipsis)
- Lajur Data: Papar nilai atau sengkang miring ("-") berwarna kelabu jika null
- Lajur Tindakan: Ikon `ArrowRight` (14px, kelabu)

### 7.4 Kad Mudah Alih

Setiap kad adalah baris flex dengan:
- Avatar (36×36px, kecerunan biru)
- Nama (14px, 500 berat) + meta di bawah (12px, KP dan Telefon)
- Ikon `ChevronRight` di kanan

### 7.5 Medan Carian — Responsif Semula Jadi

Medan carian menggunakan `flex: 1, minWidth: "200px", maxWidth: "400px"` — secara semula jadi menyesuaikan diri dengan ruang yang tersedia.

---

## 8. Pengesahan & Pemformatan Data

### 8.1 Pemformatan Automatik (onBlur)

| Medan | Fungsi | Contoh Output |
|-------|--------|---------------|
| Nama | `toTitleCase(trim)` | "ahmad bin ali" → "Ahmad Bin Ali" |
| No. Kad Pengenalan | `formatMyKad(trim)` | "890101011234" → "890101-01-1234" |
| No. Telefon | `formatPhone(trim)` | "0123456789" → "012-345 6789" |
| No. Pendaftaran Hospital | `trim.toUpperCase` | "h001234" → "H001234" |
| Alamat | `toTitleCase(trim)` | "jalan hospital" → "Jalan Hospital" |

### 8.2 Pengesahan

| Peraturan | Pelaksanaan |
|-----------|-------------|
| Nama wajib diisi | Butang Simpan dilumpuhkan jika `!newPatient.nama` |
| Tiada pengesahan panjang/format lain | Semua medan lain adalah pilihan |

### 8.3 Pengesanan Pendua

Sistem pengesanan pendua adalah proaktif dan mesra pengguna:
- Tidak menyekat pendaftaran — hanya memberi amaran
- Menyediakan pautan terus ke pesakit sedia ada
- Secara eksplisit menyatakan "Anda boleh teruskan pendaftaran jika perlu."
- Menggunakan warna ambar (amaran, bukan ralat)

---

## 9. Model Kebenaran

| Peranan | Boleh Lihat? | Boleh Daftar? |
|---------|-------------|---------------|
| Pentadbir | ✅ | ✅ |
| Penjaga Stor | ✅ | ✅ |
| Kakitangan Farmasi | ✅ | ✅ |
| Kakitangan Klinik | ✅ | ❌ (butang "Daftar Pesakit" disembunyikan) |

Keizinan `manage_patients` mengawal keterlihatan butang "Daftar Pesakit" dan keseluruhan dialog pendaftaran. Semua peranan boleh melihat senarai pesakit.

---

## 10. Navigasi & Breadcrumb

### 10.1 Breadcrumb Dinamik

Halaman ini menggunakan `setNavSource` untuk menetapkan konteks navigasi. Apabila pengguna mengklik baris pesakit:

```typescript
setNavSource("pesakit");
router.push(`/pesakit/${patient.id}`);
```

Ini membolehkan halaman Butiran Pesakit memaparkan breadcrumb yang betul: **"Senarai Pesakit > Nama Pesakit"** — bukannya laluan lalai.

### 10.2 Navigasi Selepas Pendaftaran

Selepas berjaya mendaftar pesakit baharu, pengguna secara automatik dihalakan ke halaman butiran pesakit tersebut (`/pesakit/${inserted.id}`). Ini adalah aliran UX yang lancar — staf boleh terus mendaftarkan item/ubat untuk pesakit baharu.

---

## 11. Prestasi & Pengoptimuman

| Aspek | Pendekatan |
|-------|------------|
| Kiraan & data selari | `Promise.all([countQuery, dataQuery])` — kedua-duanya berjalan serentak |
| Saiz halaman | 100 rekod setiap halaman — mengimbangi prestasi dan kebolehskrolan |
| Kunci kueri terperinci | `["patients", search, page, sort]` — caching tepat untuk setiap kombinasi parameter |
| Penetapan semula halaman | Halaman ditetapkan ke 0 apabila carian atau isihan berubah |
| useCallback | `toggleSort` dan `SortIcon` distabilkan untuk mengelakkan render semula yang tidak perlu |
| Animasi baris ringan | Setiap baris hanya `opacity + y: -3` dengan tempoh 0.1s |
| Stagger minimum | `delay: idx * 0.008` — hampir tidak dapat dilihat tetapi memberikan ilusi aliran |
| Pembersihan pemasa | Pemasa carian pendua dibersihkan dalam cleanup useEffect |

---

## 12. Model Data Berkaitan

```
patients:
  id, nama, nombor_kad_pengenalan, nombor_pendaftaran_hospital,
  dokumen_lain, nombor_telefon, alamat, catatan,
  aktif, merged_into, tarikh_daftar,
  created_at, updated_at

Penapis:
  WHERE aktif = true AND merged_into IS NULL
  [AND (nama ILIKE OR kp ILIKE OR hosp ILIKE)]

Isihan:
  nama | nombor_kad_pengenalan | nombor_pendaftaran_hospital | nombor_telefon
  ASC | DESC

Pagination:
  LIMIT 100 OFFSET page * 100
```

---

## 13. Kekuatan & Amalan Baik

1. **Pengesanan pendua proaktif:** Carian latar belakang semasa menaip — tidak menyekat tetapi memberi amaran, dengan pautan ke rekod sedia ada
2. **Navigasi terus selepas daftar:** Pengguna tidak perlu mencari pesakit yang baru didaftarkan — dihantar terus ke halaman butiran
3. **Dual markup responsif:** Baris desktop dan kad mudah alih wujud bersama dalam DOM, dikawal oleh CSS — tiada pertukaran komponen masa larian
4. **Pagination tetingkap gelongsor:** Navigasi halaman yang bijak — memaparkan maksimum 7 butang tanpa mengira jumlah halaman
5. **Isihan intuitif:** Klik pengepala = isih asc; klik lagi = isih desc; klik lajur lain = isih asc. Ikon berubah dengan jelas.
6. **Pemformatan automatik:** Pengguna tidak perlu memformat MyKad atau nombor telefon secara manual — dilakukan pada onBlur
7. **Konsistensi visual:** Kad kaca, sempadan kecerunan, dan bar aksen yang sama dengan halaman lain
8. **Keadaan kosong kontekstual:** Mesej berbeza untuk "dengan carian" vs "tanpa carian" — membantu pengguna memahami langkah seterusnya
9. **Kiraan data masa nyata:** Lencana "N pesakit" di sebelah medan carian memberikan maklum balas segera
10. **Prestasi kueri:** Kiraan dan data diambil selari; isihan dan carian menetapkan semula halaman

---

## 14. Peluang Penambahbaikan

1. **Tiada penapis status:** Hanya pesakit aktif dipaparkan — tiada pilihan untuk melihat pesakit tidak aktif atau semua pesakit
2. **Isihan terhad kepada 4 lajur:** Tiada isihan pada `created_at` (tarikh daftar) — berguna untuk melihat pesakit terbaru
3. **Tiada kiraan item/ubat:** Jadual tidak menunjukkan bilangan item yang didaftarkan untuk setiap pesakit — memerlukan JOIN atau subkueri
4. **Saiz halaman tetap 100:** Tiada pilihan untuk menukar saiz halaman (50/100/200)
5. **Carian tidak menyerlahkan padanan:** Teks yang sepadan tidak diserlahkan dalam hasil — sukar untuk melihat mengapa pesakit tertentu muncul
6. **Tiada tindakan sebaris:** Hanya navigasi ke butiran — tiada butang edit pantas, nyahaktif, atau gabung dari senarai
7. **Dialog daftar tidak boleh ditutup dengan Escape:** Tiada pengendalian papan kekunci untuk dialog
8. **Tiada pengesahan panjang minimum:** Nama boleh menjadi 1 aksara — tiada pengesahan panjang minimum
9. **Pendua hanya disemak pada KP dan Hospital:** Tiada semakan pada nama atau nombor telefon
10. **Gaya sebaris berulang:** `inputStyle` digunakan merentasi dialog — boleh diekstrak ke fail CSS atau Tailwind
11. **Tiada penunjuk memuatkan untuk dialog:** Butang hanya bertukar kepada "Menyimpan..." tetapi tiada spinner seluruh dialog