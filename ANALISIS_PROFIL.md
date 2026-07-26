# Analisis Halaman Profil Pengguna

> **Fail:** `src/app/(dashboard)/profil/page.tsx`
> **Tarikh:** 26 Julai 2026
> **Bahasa:** TypeScript (React / Next.js)

---

## 1. Ringkasan Umum

Halaman Profil Pengguna (`/profil`) membolehkan pengguna melihat dan mengemaskini maklumat peribadi serta menukar kata laluan. Halaman ini terdiri daripada dua kad utama — **Maklumat Peribadi** dan **Tukar Kata Laluan** — dibungkus dalam reka bentuk "glassmorphism" moden dengan animasi kemasukan yang lancar.

---

## 2. Analisis UX (Pengalaman Pengguna)

### 2.1 Struktur Halaman

| Zon | Kandungan |
|-----|-----------|
| **Crumb** | Breadcrumb navigasi: `Utama > Profil` |
| **Tajuk** | Butang kembali + tajuk "Profil Pengguna" + sub-teks |
| **Kad Maklumat Peribadi** | Paparan 4 medan (Nama, Nama Pengguna, Jawatan, Peranan) dalam grid 2×2, atau borang edit |
| **Kad Tukar Kata Laluan** | Butang pelancar atau borang 3 medan kata laluan |

### 2.2 Aliran Interaksi

1. **Paparan Lalai** — Pengguna melihat maklumat profil dalam mod baca sahaja.
2. **Edit Profil** — Klik "Edit Profil" → medan boleh diedit muncul → isi数据 → klik "Simpan" atau "Batal".
3. **Tukar Kata Laluan** — Klik "Tukar Kata Laluan" → 3 medan kata laluan muncul → isi → klik butang sahkan.

### 2.3 Penilaian UX

| Aspek | Penilaian | Catatan |
|-------|-----------|---------|
| **Kejelasan** | ⭐⭐⭐⭐⭐ | Label jelas, maklumat tersusun dalam grid kemas |
| **Aliran Edit** | ⭐⭐⭐⭐ | Mod edit/baca ditukar dengan `useState` — ringkas dan intuitif |
| **Maklum Balas** | ⭐⭐⭐⭐ | Toast notification (sonner) untuk kejayaan/kegagalan |
| **Validasi** | ⭐⭐⭐ | Validasi asas kata laluan (padanan, minimum 6 aksara) — tiada validasi real-time medan |
| **Aksesibiliti** | ⭐⭐⭐ | Breadcrumb ada `aria-label` — tiada `aria-label` pada butang utama |
| **Responsive** | ⭐⭐⭐⭐ | Grid `1fr 1fr` untuk medan, `maxWidth: 640px` — sesuai untuk mobile |
| **Keselamatan** | ⭐⭐⭐⭐ | Kata laluan tidak dipaparkan, hash tidak dihantar ke client |

### 2.4 Cadangan Peningkatan UX

- Tambah `aria-label` pada butang "Edit Profil" dan "Simpan" untuk pembaca skrin.
- Paparkan kekuatan kata laluan secara real-time (meter kekuatan).
- Tambah medan pengesahan visual (checkmark) apabila profil berjaya dikemaskini.
- Pertimbangkan untuk menambah tarikh kemaskini terakhir ("Dikemaskini pada: ...").

---

## 3. Analisis Animasi

### 3.1 Framer Motion — Kemasukan Bertahap

Halaman menggunakan `motion.div` dari Framer Motion untuk animasi masuk bertahap (staggered entry):

```tsx
// Breadcrumb — muncul dahulu
<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
  transition={{ duration: 0.12 }}>

// Header — 20ms selepas breadcrumb
<motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.15, delay: 0.02 }}>

// Kad Maklumat Peribadi — 30ms delay
<motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.15, delay: 0.03 }}>

// Kad Tukar Kata Laluan — 80ms delay
<motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.15, delay: 0.08 }}>
```

| Ciri | Nilai |
|------|-------|
| **Jenis animasi** | Fade-in + translateY kecil (5px → 0) |
| **Tempoh** | 120ms–150ms |
| **Delay kumulatif** | 0ms → 20ms → 30ms → 80ms |
| **Easing** | Linear (default Framer Motion) |

### 3.2 Animasi Putar (Spin) — Butang Muat Turun

```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

Digunakan pada ikon `RefreshCw` semasa proses penyimpanan/penukaran kata laluan:

```tsx
<RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />
```

### 3.3 Transisi CSS — Hover & Focus

```tsx
transition: "all 0.2s ease"  // Dalam inputStyle dan butang
```

Digunakan pada:
- Input medan (border, background berubah pada focus)
- Butang "Edit Profil" (perubahan warna halus)
- Butang "Tukar Kata Laluan" (perubahan warna halus)

### 3.4 Penilaian Animasi

| Aspek | Penilaian | Catatan |
|-------|-----------|---------|
| **Kesepadanan** | ⭐⭐⭐⭐⭐ | Animasi masuk bertahap memberi kesan premium |
| **Kelajuan** | ⭐⭐⭐⭐⭐ | 120-150ms — pantas, tidak mengganggu |
| **Konsistensi** | ⭐⭐⭐⭐ | Selaras dengan halaman lain dalam aplikasi |
| **Kesederhanaan** | ⭐⭐⭐⭐⭐ | Tidak berlebihan — sesuai untuk halaman profil |
| **Kritikan** | Animasi easing menggunakan linear, boleh dipertingkatkan dengan `easeOut` untuk rasa lebih organik |

---

## 4. Analisis Kod

### 4.1 Seni Bina Komponen

```
ProfilePage (Client Component)
├── AuthProvider (Context) — profile, refreshProfile
├── useMutation — updateProfileMutation (Supabase langsung)
├── useMutation — changePasswordMutation (API /api/change-password)
├── useState — editing, editData, changingPassword, pwd, focusedField
└── Render
    ├── Breadcrumb
    ├── Header (ArrowBack + tajuk)
    ├── Kad Maklumat Peribadi
    │   ├── Mod Baca (grid 2×2 medan)
    │   └── Mod Edit (Input fields + butang Simpan/Batal)
    └── Kad Tukar Kata Laluan
        ├── Mod collapsed (butang pelancar)
        └── Mod expanded (3 password fields + butang)
```

### 4.2 Pengurusan State

| State | Tujuan |
|-------|--------|
| `mounted` | Mengesan klien telah dimuatkan (mount detection) — *tidak digunakan selepas inisialisasi* |
| `editing` | Mod edit profil (true/false) |
| `editData` | Data boleh diedit: `{ nama, jawatan, nama_pengguna }` |
| `changingPassword` | Mod tukar kata laluan (true/false) |
| `pwd` | Data kata laluan: `{ current, newPwd, confirm }` |
| `focusedField` | Medan yang sedang fokus — *didefinisikan tetapi tidak digunakan dalam render* |

### 4.3 Pengurusan Data

| Operasi | Kaedah | Endpoint |
|---------|--------|----------|
| Kemaskini profil | `supabase.from("profiles").update(...)` | Supabase langsung (client-side) |
| Tukar kata laluan | `fetch("/api/change-password")` | API route (server-side) |

**Nota:** Kemaskini profil dilakukan terus dari client ke Supabase tanpa melalui API route — ini adalah pendekatan yang boleh diterima kerana Supabase RLS (Row Level Security) sepatutnya mengawal akses. Namun, ia tidak menggunakan API route yang lebih selamat.

### 4.4 Kualiti Kod

| Aspek | Penilaian | Catatan |
|-------|-----------|---------|
| **Kebersihan** | ⭐⭐⭐ | Semua inline styles — tiada CSS modules atau Tailwind classes |
| **Readability** | ⭐⭐⭐ | Banyak props panjang dalam satu baris, sukar dibaca |
| **Reusability** | ⭐⭐ | `inputStyle` ditakrif semula — boleh diekstrak ke komponen |
| **Type Safety** | ⭐⭐⭐⭐ | TypeScript digunakan, `typeof editData` untuk fungsi mutation |
| **Error Handling** | ⭐⭐⭐⭐ | Toast notification untuk success/error |
| **Unused Code** | ⭐⭐⭐ | `mounted` state dan `focusedField` state tidak digunakan dalam render |

### 4.5 Isu Teknikal

1. **`mounted` state** — Ditetapkan pada `true` melalui `useEffect` tetapi tidak digunakan di mana-mana dalam JSX.
2. **`focusedField` state** — Didefinisikan tetapi tidak digunakan dalam render.
3. **Inline styles berlebihan** — Lebih 50 properti style inline — sukar penyelenggaraan jangka panjang.
4. **Tiada loading state visual** — Apabila `profile` null, komponen return `null` tanpa skeleton/spinner.
5. **`toTitleCase` pada onBlur** — Mengubah teks selepas pengguna selesai menaip — mungkin mengejutkan pengguna.

---

## 5. Analisis Warna

### 5.1 Palette Utama

| Warna | Kod | Kegunaan |
|-------|-----|----------|
| **Hijau (Primary)** | `#22c55e` | Butang kembali, ikon kad profil, butang "Simpan", gradient border |
| **Biru (Secondary)** | `#1877f2` | Butang "Edit Profil", input border, gradient border |
| **Amber/Kuning** | `#f59e0b` | Ikon & butang "Tukar Kata Laluan", gradient border kad |
| **Merah** | `#ef4444` | Dalam gradient kad kata laluan |
| **Ungu** | `#7c3aed` | Dalam gradient border kedua-dua kad |
| **Hitam** | `#1c1e21` | Teks utama (tajuk, nilai medan) |
| **Kelabu** | `#65676b` | Teks sekunder (subtitle, label) |
| **Kelabu Border** | `#dddfe2` | Border input, butang batal |
| **Putih** | `#ffffff` | Latar belakang kad, butang batal |

### 5.2 Penggunaan Gradient

#### Gradient Border — Kad Maklumat Peribadi
```css
linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(24, 119, 242, 0.15), rgba(124, 58, 237, 0.1))
```
Hijau → Biru → Ungu (135°) — lembut, transparan.

#### Gradient Border — Kad Kata Laluan
```css
linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(239, 68, 68, 0.1), rgba(124, 58, 237, 0.08))
```
Amber → Merah → Ungu (135°) — menandakan zon berhati-hati.

#### Gradient Butang "Simpan"
```css
linear-gradient(135deg, #22c55e, #16a34a)
```
Hijau pekat — menandakan tindakan positif/menyimpan.

#### Gradient Butang "Tukar Kata Laluan"
```css
linear-gradient(135deg, #f59e0b, #d97706)
```
Amber pekat — menandakan tindakan berhati-hati.

#### Gradient Bar Atas Kad
```
Kad Profil: linear-gradient(90deg, #22c55e, #1877f2, #7c3aed, #22c55e)
Kad Kata Laluan: linear-gradient(90deg, #f59e0b, #ef4444, #7c3aed, #f59e0b)
```
Bar hiasan 3px di bahagian atas setiap kad — bergerak dari kiri ke kanan.

### 5.3 Penilaian Warna

| Aspek | Penilaian | Catatan |
|-------|-----------|---------|
| **Konsistensi** | ⭐⭐⭐⭐⭐ | Selaras dengan design system global (`globals.css` variables) |
| **Psikologi Warna** | ⭐⭐⭐⭐⭐ | Hijau = positif/simpan, Amber = berhati-hati/kata laluan, Biru = informatif |
| **Kontras** | ⭐⭐⭐⭐ | Teks pada latar putih mempunyai kontras yang baik |
| **Kebersihan** | ⭐⭐⭐⭐ | Gradient lembut dan tidak berlebihan |
| **Aksesibiliti** | ⭐⭐⭐ | Warna tidak satu-satunya penunjuk maklumat — teks label juga membantu |

---

## 6. Analisis Ikon

### 6.1 Senarai Ikon

| Ikon | Sumber | Saiz | Warna | Kegunaan |
|------|--------|------|-------|----------|
| `ArrowLeft` | lucide-react | 20px | `#22c55e` | Butang kembali |
| `User` | lucide-react | 16px | `#22c55e` | Ikon tajuk kad profil |
| `Lock` | lucide-react | 16px | `#f59e0b` | Ikon tajuk kad kata laluan |
| `KeyRound` | lucide-react | 16px | `#d97706` | Butang "Tukar Kata Laluan" |
| `Save` | lucide-react | 14px | `#ffffff` (inherit) | Butang "Simpan" |
| `RefreshCw` | lucide-react | 14px | `#ffffff` (inherit) | Animasi putar semasa memuat |
| `Shield` | lucide-react | — | — | Diimport tetapi **tidak digunakan** |
| `Activity` | lucide-react | — | — | Diimport tetapi **tidak digunakan** |

### 6.2 Saiz & Konsistensi

- **Ikon tajuk kad:** 16px — konsisten antara kedua-dua kad
- **Ikon butang:** 14px–16px — sesuai dengan saiz teks sekeliling
- **Ikon butang kembali:** 20px — lebih besar untuk kebolehlihatan

### 6.3 Penilaian Ikon

| Aspek | Penilaian | Catatan |
|-------|-----------|---------|
| **Pemilihan** | ⭐⭐⭐⭐ | Ikon sesuai dengan konteks masing-masing |
| **Konsistensi Saiz** | ⭐⭐⭐⭐ | Saiz proporsional mengikut konteks |
| **Warna** | ⭐⭐⭐⭐⭐ | Warna ikon sepadan dengan tema kad |
| **Kebersihan** | ⭐⭐⭐ | 2 ikon diimport tetapi tidak digunakan (`Shield`, `Activity`) |
| **Library** | ⭐⭐⭐⭐⭐ | lucide-react — ringan, konsisten, moden |

---

## 7. Analisis Reka Bentuk Visual

### 7.1 Kad Glassmorphism

Kedua-dua kad menggunakan kesan "glass" moden:

```tsx
background: "rgba(255, 255, 255, 0.85)"
backdropFilter: "blur(12px)"
border: "1px solid rgba(255, 255, 255, 0.5)"
boxShadow: "0 4px 16px rgba(0,0,0,0.06)"
```

Ini memberikan kesan kaca lut sinar yang elegan.

### 7.2 Gradient Border Technique

Menggunakan teknik CSS mask untuk border gradient:

```tsx
position: "absolute", inset: 0, borderRadius: "16px", padding: "1px",
background: "linear-gradient(135deg, ...)",
WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
WebkitMaskComposite: "xor",
maskComposite: "exclude"
```

Teknik ini mencipta border gradient tanpa extra DOM elements — pendekatan yang cekap.

### 7.3 Latar Belakang Halaman

- Latar belakang utama: `#f0f2f5` (dari layout)
- Decorative orb: `radial-gradient(circle, rgba(34, 197, 94, 0.03) 0%, transparent 70%)` dengan `blur(30px)` — sangat halus
- Background orbs animasi dari layout (`contentOrb1/2/3`) — bergerak perlahan (18–25 saat kitaran)

### 7.4 Tipografi

| Elemen | Saiz | Berat | Warna |
|--------|------|-------|-------|
| Tajuk halaman | 22px | 700 (Bold) | `#1c1e21` |
| Tajuk kad | 15px | 700 (Bold) | `#1c1e21` |
| Subtajuk halaman | 13px | 400 (Regular) | `#65676b` |
| Subtajuk kad | 12px | 400 (Regular) | `#65676b` |
| Label medan | 12px | 600 (SemiBold) | `#65676b` |
| Label medan (mod baca) | 11px | 600 (SemiBold) | `#65676b` + uppercase + letterSpacing |
| Nilai medan | 14px | 500 (Medium) | `#1c1e21` |
| Butang | 12–13px | 600 (SemiBold) | Bergantung pada jenis |

### 7.5 Ruang & Layout

| Ciri | Nilai |
|------|-------|
| **Max-width halaman** | 640px |
| **Border radius kad** | 16px |
| **Border radius butang** | 10px |
| **Border radius input** | 10px |
| **Padding kad** | 20px 24px |
| **Gap grid medan** | 14px |
| **Gap antara kad** | 20px |
| **Input height** | 42px |

---

## 8. Cadangan Peningkatan

### 8.1 Kod

1. **Buang `mounted` dan `focusedField` state** — tidak digunakan.
2. **Ekstrak `inputStyle` ke fail berasingan** — konsisten dengan komponen lain.
3. **Pertimbangkan CSS Modules atau Tailwind** — mengurangkan inline styles.
4. **Tambah skeleton loading** semasa `profile` null.
5. **Pindah kemaskini profil ke API route** — lebih selamat, konsisten dengan tukar kata laluan.

### 8.2 UX

1. **Tambah password strength meter** — panduan visual kekuatan kata laluan.
2. **Tambah auto-save atau unsaved changes warning** — elak kehilangan data.
3. **Paparkan masa kemaskini terakhir** (`updated_at`).
4. **Tambah avatar/initials** — personalisasi visual.
5. **Animasi transisi edit → baca** — smooth morph, bukan instant swap.

### 8.3 Animasi

1. **Gunakan `easeOut`** untuk animasi masuk — lebih organik.
2. **Tambah `layoutId`** untuk transisi antara mod edit/baca — animasi morph.
3. **Tambah hover scale** pada butang utama (gunakan kelas `hover-lift` yang sedia ada).
4. **Pertimbangkan animasi gradient bar** — currently statik, boleh dianimasikan.

### 8.4 Aksesibiliti

1. **Tambah `aria-label`** pada semua butang utama.
2. **Tambah `role="form"`** pada borang edit.
3. **Pastikan focus management** — auto-focus pada medan pertama semasa mod edit.
4. **Tambah `aria-live="polite"`** pada kawasan mesej kejayaan/kegagalan.

---

## 9. Ringkasan Penilaian Keseluruhan

| Kategori | Penilaian | Catatan |
|----------|-----------|---------|
| **UX** | ⭐⭐⭐⭐ | Jelas, intuitif, mudah digunakan |
| **Animasi** | ⭐⭐⭐⭐ | Lancar, tidak berlebihan, konsisten |
| **Kod** | ⭐⭐⭐ | Berfungsi tetapi ada unused code dan inline styles berlebihan |
| **Warna** | ⭐⭐⭐⭐⭐ | Konsisten, bermakna, menarik |
| **Ikon** | ⭐⭐⭐⭐ | Sesuai, 2 ikon tidak digunakan |
| **Reka Bentuk** | ⭐⭐⭐⭐⭐ | Glassmorphism moden, gradient border elegan |
| **Responsive** | ⭐⭐⭐⭐ | Sesuai untuk mobile dan desktop |
| **Aksesibiliti** | ⭐⭐⭐ | Boleh dipertingkatkan |

**Penilaian Keseluruhan: ⭐⭐⭐⭐ (4/5)** — Halaman profil yang direka dengan baik dengan reka bentuk visual premium. Peningkatan utama yang diperlukan ialah kebersihan kod, aksesibiliti, dan sedikit ciri UX tambahan.