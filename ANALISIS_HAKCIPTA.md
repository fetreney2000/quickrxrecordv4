# Analisis Halaman Hak Cipta — QuickRxRecord

**Fail Dianalisis:**
- `quickrx-new/src/app/(dashboard)/hakcipta/page.tsx` — Halaman Hak Cipta (94 baris)

**Tarikh Analisis:** 26 Julai 2026

---

## 1. Gambaran Keseluruhan

Halaman **Hak Cipta** (`/hakcipta`) ialah halaman paling ringkas dalam keseluruhan aplikasi QuickRxRecord — hanya **94 baris kod**. Ia adalah halaman **statik sepenuhnya** yang memaparkan maklumat pembangun sistem dan notis hak cipta. Tiada pengambilan data, tiada state, tiada mutasi, tiada interaktiviti selain butang kembali.

Halaman ini boleh diakses oleh **semua peranan** (tiada keizinan diperlukan dalam `navItems`) dan berfungsi sebagai **"About" page** untuk sistem.

**Ciri-ciri utama:**
- Kad profil pembangun dengan nama, nombor telefon, dan email
- Notis hak cipta dinamik (tahun semasa)
- Reka bentuk konsisten dengan tema aplikasi
- Butang kembali (router.back)

---

## 2. Seni Bina Komponen

### 2.1 Hierarki Komponen

```
HakciptaPage (default export)
├── Orb hiasan (merah, 300px)
├── Breadcrumb ("Hak Cipta")
├── Header
│   ├── Butang kembali (ArrowLeft)
│   └── Tajuk + Sarikata
└── Kad Utama (glass card dengan sempadan kecerunan)
    ├── Bar aksen (merah-biru-ungu-merah, 3px)
    ├── Pengepala Profil
    │   ├── Avatar (64×64px, kecerunan biru, ikon User)
    │   └── Tajuk "QuickRxRecord v4.0" + Sarikata
    ├── Maklumat Pembangun (3 baris)
    │   ├── Nama (ikon User) — "Ahmad Fetre Bin Mohammad Zime"
    │   ├── No. Telefon (ikon Phone) — "016-881 3920"
    │   └── Email (ikon Mail) — "fetreney2000@gmail.com"
    └── Notis Hak Cipta (latar kelabu, teks berpusat)
        └── "© 2026 QuickRxRecord · Jabatan Farmasi Hospital Keningau. Hak cipta terpelihara."
```

### 2.2 Tiada Komponen Dalaman

Halaman ini tidak mentakrifkan sebarang komponen dalaman — semuanya adalah JSX sebaris.

---

## 3. Pengurusan State (Keadaan)

**Tiada state.** Halaman ini tidak menggunakan:
- `useState`
- `useEffect`
- `useMemo`
- `useCallback`
- `useRef`
- `useQuery` / `useMutation`
- Sebarang pengambilan data

Hanya menggunakan `useRouter` untuk butang kembali.

---

## 4. Reka Bentuk Visual

### 4.1 Palet Warna

| Elemen | Warna | Kegunaan |
|--------|-------|----------|
| Aksen merah | `#e11d48` / `#f43f5e` | Butang kembali, orb, sempadan kecerunan, bar aksen |
| Aksen biru | `#1877f2` / `#0d5bd4` | Avatar, ikon Nama, sempadan kecerunan, bar aksen |
| Aksen ungu | `#7c3aed` | Sempadan kecerunan, bar aksen |
| Aksen hijau | `#22c55e` | Ikon Telefon & Email |
| Kelabu | `#9ca3af` / `#65676b` | Label, sarikata, teks hak cipta |
| Putih | `#ffffff` | Latar kad, teks ikon |
| Kad kaca | `rgba(255,255,255,0.85)` + `blur(12px)` | Latar kad utama |
| Latar maklumat | `rgba(24,119,242,0.03)` | Kotak maklumat pembangun |
| Latar hak cipta | `rgba(240,242,245,0.5)` | Kotak notis hak cipta |

### 4.2 Tipografi

| Elemen | Saiz | Berat | Warna |
|--------|------|-------|-------|
| Tajuk halaman | 22px | 700 | `#1c1e21` |
| Sarikata header | 13px | 400 | `#65676b` |
| Tajuk kad (v4.0) | 18px | 700 | `#1c1e21` |
| Sarikata kad | 13px | 400 | `#65676b` |
| Label maklumat | 11px | 500 | `#9ca3af` |
| Nilai maklumat | 13px | 600 | `#1c1e21` |
| Teks hak cipta | 12px | 400 | `#9ca3af` |

### 4.3 Jejari Sempadan

| Elemen | Jejari |
|--------|--------|
| Kad utama | 16px |
| Avatar | 16px |
| Ikon maklumat | 8px |
| Kotak maklumat | 12px |
| Kotak hak cipta | 12px |
| Butang kembali | 12px |

### 4.4 Bayang

| Elemen | Bayang |
|--------|--------|
| Kad utama | `0 4px 16px rgba(0,0,0,0.06)` |
| Avatar | `0 6px 20px rgba(24,119,242,0.3)` |

### 4.5 Animasi

| Elemen | Animasi |
|--------|---------|
| Breadcrumb | `opacity: 0 → 1` (0.12s) |
| Header | `opacity: 0, y: 5 → 1, 0` (0.15s, delay 0.02s) |
| Kad utama | `opacity: 0, y: 5 → 1, 0` (0.15s, delay 0.03s) |

### 4.6 Hiasan

- **Orb latar belakang:** 300×300px, merah 3%, blur 30px (`top: -60px, right: -60px`)
- **Bar aksen:** 3px tinggi, kecerunan merah-biru-ungu-merah (statik, tiada animasi `gradientShift`)

### 4.7 Ikon (5 ikon)

`ArrowLeft, User, Phone, Mail, Shield` (Shield diimport tetapi tidak digunakan secara langsung)

---

## 5. UX: Satu-satunya Interaksi

### 5.1 Butang Kembali

Satu-satunya elemen interaktif adalah butang kembali:
```typescript
<button onClick={() => router.back()}>
  <ArrowLeft size={20} color="#e11d48" />
</button>
```

Ini menggunakan `router.back()` — navigasi ke halaman sebelumnya dalam sejarah pelayar. Jika pengguna menavigasi terus ke `/hakcipta`, butang ini akan membawa mereka kembali ke halaman sebelum ini.

### 5.2 Tiada Interaksi Lain

- Tiada medan input
- Tiada butang selain kembali
- Tiada pautan
- Tiada keadaan memuatkan
- Halaman dipaparkan serta-merta

---

## 6. Kandungan Statik

### 6.1 Maklumat Pembangun

| Medan | Nilai |
|-------|-------|
| Nama | Ahmad Fetre Bin Mohammad Zime |
| No. Telefon | 016-881 3920 |
| Email | fetreney2000@gmail.com |

Maklumat ini adalah **keras (hardcoded)** dalam JSX — bukan dari pangkalan data atau fail konfigurasi.

### 6.2 Notis Hak Cipta

```
© 2026 QuickRxRecord · Jabatan Farmasi Hospital Keningau. Hak cipta terpelihara.
```

Tahun adalah **dinamik** — menggunakan `new Date().getFullYear()`. Ini memastikan notis hak cipta sentiasa menunjukkan tahun semasa tanpa perlu dikemas kini secara manual.

---

## 7. Konsistensi dengan Aplikasi

### 7.1 Elemen Reka Bentuk yang Dikongsi

Halaman ini menggunakan elemen visual yang sama dengan halaman lain:

| Elemen | Dikongsi Dengan |
|--------|----------------|
| Kad kaca (`blur(12px)`) | Senarai Pesakit, Senarai Inventori, Laporan |
| Sempadan kecerunan (`mask-composite`) | Semua halaman dengan kad utama |
| Bar aksen (3px) | Semua halaman dengan kad utama |
| Orb hiasan (blur 30px) | Semua halaman |
| Breadcrumb | Semua halaman |
| Header dengan butang kembali | Butiran Pesakit, Butiran Item |

### 7.2 Perbezaan

- **Tiada animasi `gradientShift`** pada bar aksen — ia statik
- **Saiz maksimum terhad** — `maxWidth: "640px"` (lebih sempit daripada halaman lain)
- **Tiada kueri data** — unik dalam aplikasi
- **Tiada state React** — unik dalam aplikasi

---

## 8. Model Kebenaran

Halaman ini boleh diakses oleh **semua peranan** — `permission: null` dalam `navItems`:

```typescript
{ href: "/hakcipta", label: "Hak Cipta", icon: Shield, color: "#f59e0b", permission: null }
```

| Peranan | Boleh Akses? |
|---------|-------------|
| Pentadbir | ✅ |
| Penjaga Stor | ✅ |
| Kakitangan Farmasi | ✅ |
| Kakitangan Klinik | ✅ |

---

## 9. Perbandingan dengan Halaman Lain

| Aspek | Hak Cipta | Laporan | Butiran Pesakit |
|-------|-----------|---------|-----------------|
| Baris kod | 94 | 323 | 652 |
| State | 0 | 1 | 20+ |
| Kueri | 0 | 2 | 12 |
| Mutasi | 0 | 0 | 8 |
| Komponen dalaman | 0 | 2 (fungsi eksport) | 3 (SortableHeader, FoldableCard, MergeDialog) |
| Ikon | 5 | 4 | 20+ |
| Interaksi | 1 (butang kembali) | 4 (tab + 2 eksport) | 15+ |
| Tema | Merah | Merah (tab 1) / Ungu (tab 2) | Biru |

---

## 10. Kekuatan & Amalan Baik

1. **Simplicity melampau:** Halaman paling ringkas — sesuai untuk tujuan paparan maklumat statik
2. **Konsistensi visual:** Menggunakan bahasa reka bentuk yang sama (kad kaca, sempadan kecerunan, orb)
3. **Tahun hak cipta dinamik:** `new Date().getFullYear()` — tidak perlu kemas kini tahunan
4. **Animasi kemasukan halus:** Breadcrumb, header, dan kad dianimasikan masuk secara berperingkat
5. **Saiz responsif semula jadi:** `maxWidth: "640px"` — tidak meregang pada skrin lebar, kekal mudah dibaca
6. **Tiada kebergantungan data:** Boleh dipaparkan walaupun pangkalan数据 tidak tersedia

---

## 11. Peluang Penambahbaikan

1. **Maklumat pembangun keras:** Nama, telefon, dan email adalah hardcoded — boleh dipindahkan ke fail konfigurasi atau pembolehubah persekitaran
2. **Tiada maklumat versi terperinci:** Hanya "v4.0" — boleh ditambah changelog, tarikh keluaran, atau pautan ke dokumentasi
3. **Tiada pautan ke repositori:** Tiada pautan ke kod sumber atau sistem pelacakan isu
4. **Ikon Shield diimport tetapi tidak digunakan:** Diimport pada baris 7 tetapi tidak dipaparkan di mana-mana
5. **Butang kembali menggunakan `router.back()`:** Jika pengguna menavigasi terus, `router.back()` mungkin membawa ke halaman di luar aplikasi — `router.push("/")` mungkin lebih selamat sebagai fallback
6. **Tiada metadata lesen:** Tiada maklumat tentang lesen perisian (contoh: MIT, proprietari)
7. **Bar aksen statik:** Tidak mempunyai animasi `gradientShift` seperti halaman lain — mungkin disengajakan atau terlupa