# Analisis Halaman Log Masuk & Lupa Kata Laluan — QuickRxRecord

**Fail Dianalisis:**
- `quickrx-new/src/app/login/page.tsx` — Halaman Log Masuk (905 baris)
- `quickrx-new/src/app/lupa-kata-laluan/page.tsx` — Halaman Lupa Kata Laluan (544 baris)

**Tarikh Analisis:** 26 Julai 2026

---

## 1. Gambaran Keseluruhan

Halaman **Log Masuk** (`/login`) dan **Lupa Kata Laluan** (`/lupa-kata-laluan`) membentuk pengalaman pengesahan aplikasi QuickRxRecord. Kedua-dua halaman berkongsi bahasa reka bentuk yang sama: **latar gelap premium dengan animasi kompleks**, dibina sepenuhnya dengan gaya sebaris (React.CSSProperties) untuk keserasian pelayar lama. Ini adalah halaman yang diasingkan sepenuhnya daripada app shell — tiada sidebar, tiada header, tiada mobile nav. Ia direka untuk berdiri sendiri sebagai pengalaman skrin penuh.

**Ciri utama yang dikongsi:**
- Latar belakang kecerunan animasi (`gradientShift` 15s)
- 3–4 "orbs" animasi menggunakan Framer Motion
- 16–20 zarah terapung (animasi CSS tulen)
- Corak grid latar belakang (60×60px)
- Kad kaca (blur 24px, latar separa telus)
- Sempadan kecerunan menggunakan teknik `mask-composite`
- Bar aksen animasi di atas kad
- Pengaki (footer) hak cipta

---

## 2. Halaman Log Masuk (`app/login/page.tsx`)

### 2.1 Struktur Halaman

Halaman log masuk menggunakan susun atur **split layout** pada desktop (≥769px): **kawasan penjenamaan (branding) di kiri** + **kad log masuk di kanan**. Pada mudah alih (<768px), kawasan penjenamaan disembunyikan dan hanya kad log masuk dipaparkan dengan logo mudah alih.

```
┌──────────────────────────────────────────────────────┐
│ Latar Belakang Animasi                               │
│  ┌─ gradientShift 15s                                │
│  ├─ meshOverlay (3 radial gradients)                 │
│  ├─ Grid Pattern (60×60px)                           │
│  ├─ 4 Orbs (Framer Motion)                           │
│  └─ 20 zarah terapung (CSS anim)                     │
│                                                      │
│  ┌──────────────────┐    ┌─────────────────────────┐ │
│  │ Penjenamaan (Kiri)│    │ Kad Log Masuk (Kanan)    │ │
│  │                  │    │ ┌─────────────────────┐ │ │
│  │ Lencana "v4.0"   │    │ │ Bar Aksen Animasi    │ │ │
│  │ QuickRxRecord    │    │ │ Logo (mobile sahaja) │ │ │
│  │ Jabatan Farmasi  │    │ │ Selamat Datang       │ │ │
│  │ ───────────────  │    │ │                      │ │ │
│  │ • Pengurusan Stok│    │ │ [ Nama Pengguna    ] │ │ │
│  │ • Pembekalan Ubat│    │ │ [ Kata Laluan    👁] │ │ │
│  │ • Rekod Pesakit  │    │ │ [   Log Masuk  →   ] │ │ │
│  │ • Laporan        │    │ │                      │ │ │
│  │                  │    │ │ Lupa kata laluan?    │ │ │
│  │                  │    │ └─────────────────────┘ │ │
│  └──────────────────┘    └─────────────────────────┘ │
│                                                      │
│  © 2026 QuickRxRecord. Hak cipta terpelihara.        │
└──────────────────────────────────────────────────────┘
```

### 2.2 Spesifikasi Visual

| Elemen | Perincian |
|--------|-----------|
| Latar belakang | `#0a0e27` (biru sangat gelap) |
| Kecerunan animasi | `linear-gradient(135deg)` — biru gelap → ungu → biru → biru gelap, 400% saiz, 15s kitaran |
| Grid | Garis putih 1px pada kelegapan 2%, sel 60×60px |
| Mesh overlay | 3 kecerunan elips (biru 8%, ungu 6%, cyan 5%) |
| Kad | `rgba(255,255,255,0.07)` + `blur(24px)`, jejari 20px, bayang bertingkat |
| Sempadan kad | Kecerunan 4-warna melalui pseudo-element + mask-composite |
| Bar aksen | 3px tinggi, kecerunan biru-ungu-cyan-biru, 4s kitaran |

### 2.3 Sistem Orbs (4 Gelung)

| Orb | Saiz | Warna | Posisi | Animasi |
|-----|------|-------|--------|---------|
| Primer | 500×500px | Biru (20% → 5%) | Atas kiri (-10%, -5%) | 20s, x: ±80px, y: ±60px, scale: 1±0.1 |
| Sekunder | 450×450px | Ungu (18% → 4%) | Kanan tengah (50%, -10%) | 25s, x: ±60px, y: ±50px, scale: 1±0.15 |
| Aksen | 350×350px | Cyan (15% → 3%) | Bawah tengah (-5%, 30%) | 18s, x: ±60px, y: ±60px, scale: 1±0.2 |
| Hangat | 280×280px | Amber (10% → 2%) | Atas kanan (20%, 20%) | 15s, x: ±40px, y: ±50px, scale: 1±0.1 |

Kesemua orbs menggunakan `filter: blur(40-60px)` dan `pointerEvents: "none"`. Animasi menggunakan Framer Motion dengan `repeat: Infinity` dan `ease: "easeInOut"`. Orb amber (oren) hanya wujud pada halaman log masuk — lupa kata laluan tidak memilikinya.

### 2.4 Zarah Terapung (20 Zarah)

Dijana melalui `Array.from` dengan 20 zarah:
- Saiz: 3, 5, 7, atau 9px (berkitar)
- Animasi CSS `floatParticle`: bergerak sehingga 25px secara menegak dan 10px secara mendatar
- Tempoh: 8–23s (berbeza untuk setiap zarah)
- Kelegapan: 0.15–0.35
- Semua zarah berwarna putih dengan kelegapan rendah

### 2.5 Kawasan Penjenamaan (Kiri — Desktop Sahaja)

| Elemen | Perincian |
|--------|-----------|
| Lencana versi | "v4.0" — latar biru separa telus, sempadan biru, teks `#60a5fa`, 11px, huruf besar, jarak huruf 0.1em |
| Tajuk | "Quick**Rx**Record" — 42px, berat 800, dengan "Rx" dalam kecerunan biru-ungu |
| Sarikata | "Jabatan Farmasi Hospital Keningau" — 16px, putih 50% kelegapan |
| Pembahagi | Garis 48×3px dengan kecerunan biru-ungu |
| Senarai ciri | 4 item dengan dot kecerunan biru dan teks putih 60%: Pengurusan Stok, Pembekalan Ubat, Rekod Pesakit, Laporan Analitikal |

Kawasan penjenamaan menggunakan animasi kemasukan `initial={{ opacity: 0, x: -60 }}` — meluncur masuk dari kiri. Setiap item ciri dianimasikan dengan `stagger delay` (0.5s + 0.1s × indeks).

### 2.6 Kad Log Masuk (Kanan)

#### a) Logo Mudah Alih (Tersembunyi pada Desktop)
- Komponen `RxLogo` tersuai: ikon SVG 36×36px yang menggambarkan simbol preskripsi "Rx" dengan palang perubatan
- Gelung cahaya (glow) di belakang logo: berdenyut `scale: 1→1.3, opacity: 0.4→0.7`
- Logo dalam kontena 72×72px, kecerunan biru, jejari 18px, bayang bertingkat
- Hover: skala 1.05 dengan spring

#### b) Teks Selamat Datang
- "Selamat Datang" — 20px, berat 700, putih
- "Masukkan nama pengguna dan kata laluan anda" — 14px, putih 45%

#### c) Medan Nama Pengguna
- Label dengan ikon `User` (14px) — ikon bertukar dari `#9ca3af` ke `#1877f2` apabila fokus
- Input teks, 48px tinggi, jejari 12px
- Latar: `rgba(255,255,255,0.06)`, sempadan: `rgba(255,255,255,0.1)`
- Fokus: sempadan biru 50%, gelung 3px biru 10%, bayang biru
- `autoComplete="username"`
- Placeholder: "Masukkan nama pengguna"

#### d) Medan Kata Laluan
- Label dengan ikon `Lock` (14px) — perubahan warna semasa fokus
- Input kata laluan, 48px tinggi
- Butang tukar keterlihatan (Eye/EyeOff) — diletakkan di kanan dalam medan, `tabIndex={-1}`
- `autoComplete="current-password"`
- Placeholder: "Masukkan kata laluan"
- `paddingRight: "48px"` untuk memberi ruang pada butang mata

#### e) Butang Hantar
- 50px tinggi, lebar penuh, jejari 12px
- Kecerunan biru (`#1877f2` → `#0d5bd4`)
- Bayang biru bertingkat
- Teks: "Log Masuk" + ikon `ArrowRight` (18px)
- Hover: `translateY(-2px)` + bayang lebih besar
- Keadaan memuatkan: `Loader2` berputar + teks "Log Masuk..." + kelegapan 0.8
- `letterSpacing: 0.02em`
- Dilumpuhkan semasa `loading = true`

#### f) Pautan Lupa Kata Laluan
- Ikon `Lock` (12px) + "Lupa kata laluan?"
- Warna: putih 40% kelegapan
- Menghala ke `/lupa-kata-laluan`

### 2.7 Animasi Kemasukan (Staggered)

Setiap elemen dalam kad mempunyai animasi kemasukan berperingkat:

| Elemen | Kelewatan | Animasi |
|--------|-----------|---------|
| Kad itu sendiri | 0s | `opacity: 0, y: 40, scale: 0.96` → kemasukan penuh |
| Teks Selamat Datang | 0.08s | `opacity: 0, y: 5` → kemasukan |
| Medan Nama Pengguna | 0.02s | `opacity: 0, y: 5` → kemasukan |
| Medan Kata Laluan | 0.5s | `opacity: 0, y: 5` → kemasukan |
| Butang Hantar | 0.6s | `opacity: 0, y: 5` → kemasukan |
| Lupa kata laluan | 0.8s | `opacity: 0` → kemasukan |
| Pengaki | 1.2s | `opacity: 0` → kemasukan |

Animasi kawasan penjenamaan: 0s dengan `x: -60`, tempoh 0.8s, ciri-ciri dengan `stagger` 0.1s bermula dari 0.5s.

### 2.8 Logik Pengesahan

```
handleSubmit:
  1. Sahkan kedua-dua medan diisi
  2. setLoading(true)
  3. Panggil signIn(nama_pengguna, kata_laluan) dari AuthContext
     → POST /api/login
     → Simpan profil ke localStorage
  4. Jika berjaya:
     → toast.success("Log masuk berjaya!")
     → router.push("/")
     → router.refresh()
  5. Jika gagal:
     → toast.error(mesej ralat dari API)
```

Profil pengguna disimpan dalam localStorage di bawah kunci `"quickrx_session"` — ini membolehkan sesi kekal merentasi penyegaran halaman.

### 2.9 Kelakuan Fokus Medan

Setiap medan input menjejak keadaan fokusnya sendiri melalui state `focusedField` (`"username"` | `"password"` | `null`). Apabila medan difokuskan:
- Sempadan berubah dari `rgba(255,255,255,0.1)` ke `rgba(24,119,242,0.5)`
- Bayang kotak berubah dari `0 1px 3px rgba(0,0,0,0.04)` ke `0 0 0 3px rgba(24,119,242,0.1), 0 2px 8px rgba(24,119,242,0.08)`
- Ikon Label bertukar dari kelabu ke biru
- Kelas Tailwind `ring-2 ring-primary/20 border-primary/50` ditambah

---

## 3. Halaman Lupa Kata Laluan (`app/lupa-kata-laluan/page.tsx`)

### 3.1 Struktur Halaman

Halaman ini menggunakan susun atur **kad tunggal berpusat** (tiada split layout). Mempunyai **dua keadaan** (state): **borang permintaan** dan **keadaan berjaya**.

```
┌──────────────────────────────────────────────────────┐
│ Latar Belakang Animasi (dikongsi dengan login)        │
│                                                      │
│              ┌─────────────────────────┐             │
│              │ Kad                    │             │
│              │ ┌─────────────────────┐ │             │
│              │ │ Bar Aksen Animasi    │ │             │
│              │ │                      │ │             │
│              │ │  🔑 (Ikon KeyRound)  │ │             │
│              │ │ Lupa Kata Laluan?    │ │             │
│              │ │                      │ │             │
│              │ │ [ Nama Pengguna    ] │ │             │
│              │ │ [ Hantar Permintaan ] │ │             │
│              │ │                      │ │             │
│              │ │ ← Kembali ke Log Masuk│ │             │
│              │ └─────────────────────┘ │             │
│              └─────────────────────────┘             │
│                                                      │
│  © 2026 QuickRxRecord. Hak cipta terpelihara.        │
└──────────────────────────────────────────────────────┘
```

### 3.2 Spesifikasi Visual

Halaman ini berkongsi hampir semua spesifikasi visual dengan halaman log masuk, dengan perbezaan berikut:
- **Tiada kawasan penjenamaan** — hanya kad tunggal
- **Tiada orb amber** — hanya 3 orbs (biru, ungu, cyan)
- **16 zarah** (berbanding 20 pada log masuk)
- Kad berpusat dengan `maxWidth: "440px"` (tanpa flex row)
- Ikon `KeyRound` menggantikan RxLogo
- Butang `ArrowLeft` untuk kembali ke log masuk

### 3.3 Komponen Dalaman

#### `BackgroundOrbs`
Sama seperti halaman log masuk tetapi **tanpa orb keempat (amber)**. Hanya 3 orbs: primer (biru, 500px), sekunder (ungu, 450px), aksen (cyan, 350px). Animasi, saiz, dan posisi adalah sama.

#### `FloatingParticles`
16 zarah (berbanding 20 pada log masuk). Saiz: 3–9px. Kelegapan: 0.12–0.28. Tempoh: 8–20s. Parameter yang sedikit berbeza untuk variasi visual.

#### `SuccessState` — Komponen Skrin Penuh
Apabila permintaan berjaya dihantar, seluruh halaman bertukar kepada `SuccessState` — komponen berasingan yang mengembalikan susun atur skrin penuh baharu:

- Latar belakang animasi yang sama (kecerunan, mesh, grid, orbs, zarah)
- Kad dengan **bar aksen hijau** (`#22c55e → #06b6d4 → #22c55e`)
- Ikon kejayaan: `CheckCircle2` dalam kontena 80×80px dengan kecerunan hijau
- Gelung cahaya hijau di belakang ikon
- Tajuk: "Permintaan Dihantar"
- Perihalan: "Permintaan reset kata laluan anda telah dihantar kepada pentadbir. Anda akan dimaklumkan apabila kata laluan anda telah ditetapkan semula."
- Butang "Kembali ke Log Masuk" dengan ikon `ArrowLeft`
- Animasi kemasukan untuk ikon: skala spring dari 0.5

### 3.4 Aliran Permintaan

```
handleSubmit:
  1. Sahkan nama_pengguna diisi
  2. setLoading(true)
  3. Cari profil di Supabase:
     → SELECT id, nama_pengguna FROM profiles WHERE nama_pengguna = $nama_pengguna
  4. Jika tidak dijumpai:
     → toast.error("Nama pengguna tidak dijumpai.")
     → Kekal pada borang
  5. Jika dijumpai:
     → POST /api/reset-request { userId: profiles.id }
  6. Jika respons OK:
     → setSent(true) → Papar SuccessState
  7. Jika respons 409 (permintaan sedia wujud):
     → setSent(true) → Papar SuccessState (mengelakkan spam)
  8. Jika respons ralat lain:
     → toast.error(mesej dari API)
```

### 3.5 Borang Permintaan

| Elemen | Perincian |
|--------|-----------|
| Ikon logo | `KeyRound` (32px, putih) — bukannya Rx SVG |
| Tajuk | "Lupa Kata Laluan?" — 20px, berat 700, putih |
| Sarikata | "Masukkan nama pengguna anda. Permintaan akan dihantar kepada pentadbir." — 14px, putih 45% |
| Medan input | Sama seperti log masuk: 48px, jejari 12px, latar separa telus |
| Ikon label | `HelpCircle` — bertukar biru apabila fokus |
| Butang hantar | "Hantar Permintaan" — reka bentuk sama seperti butang log masuk |
| Pautan kembali | `ArrowLeft` + "Kembali ke Log Masuk" — menghala ke `/login` |

### 3.6 Animasi Kemasukan

| Elemen | Kelewatan | Animasi |
|--------|-----------|---------|
| Kad | 0s | `opacity: 0, y: 40, scale: 0.96` |
| Logo KeyRound | 0.03s | `opacity: 0, scale: 0.8, type: "spring"` |
| Teks Selamat Datang | 0.08s | `opacity: 0, y: 5` |
| Medan Nama Pengguna | 0.02s | `opacity: 0, y: 5` |
| Butang Hantar | 0.5s | `opacity: 0, y: 5` |
| Pautan Kembali | 0.7s | `opacity: 0` |
| Pengaki | 1.2s | `opacity: 0` |

`SuccessState`:
| Elemen | Kelewatan | Animasi |
|--------|-----------|---------|
| Ikon Kejayaan | 0.01s | `opacity: 0, scale: 0.5, type: "spring", stiffness: 200` |
| Tajuk | 0.02s | `opacity: 0, y: 5` |
| Perihalan | 0.5s | `opacity: 0, y: 5` |
| Butang Kembali | 0.7s | `opacity: 0, y: 5` |

### 3.7 Perbezaan dengan Halaman Log Masuk

| Aspek | Log Masuk | Lupa Kata Laluan |
|-------|-----------|------------------|
| Susun atur | Split (penjenamaan kiri + kad kanan) | Kad tunggal berpusat |
| Bilangan orbs | 4 (biru + ungu + cyan + amber) | 3 (biru + ungu + cyan) |
| Bilangan zarah | 20 | 16 |
| Ikon utama | Rx SVG tersuai | KeyRound (Lucide) |
| Bilangan medan | 2 (nama pengguna + kata laluan) | 1 (nama pengguna sahaja) |
| Keadaan (states) | 1 (borang) | 2 (borang + berjaya) |
| API dipanggil | `/api/login` | Supabase profiles + `/api/reset-request` |
| Navigasi keluar | `router.push("/")` selepas berjaya | Kekal pada halaman dengan skrin kejayaan |
| Butang mata laluan | Ada | Tiada |
| Bar aksen kejayaan | Tiada | Ada (hijau) |

---

## 4. Utiliti & Fungsi Dikongsi

### 4.1 Pengurusan Keadaan (State Management)

**Kedua-dua halaman menggunakan corak `mounted`:**
```typescript
const [mounted, setMounted] = useState(false);
useEffect(() => { setMounted(true); }, []);
```
Ini menghalang animasi Framer Motion daripada berjalan semasa SSR (Server-Side Rendering), mengelakkan ketidakpadanan penghidratan (hydration mismatch). Animasi hanya menggunakan sasaran `animate` apabila `mounted = true`.

### 4.2 Corak Gaya Sebaris

Kesemua gaya ditulis sebagai objek `React.CSSProperties` dalam kamus `styles`. Ini memberikan:
- **Keserasian Chrome 109** — tiada kebergantungan pada ciri CSS moden
- **Jenis selamat (Type-safe)** — Tiada ralat ejaan nama sifat CSS
- **Prestasi** — Tiada penghuraian CSS tambahan
- Kelemahan: Tiada pseudo-class asli (`:hover`, `:focus`) — sebaliknya menggunakan pengendali `onMouseEnter`/`onMouseLeave`/`onFocus`/`onBlur`

### 4.3 CSS Inline (Tag `<style>`)

Beberapa animasi dan atur cara responsif memerlukan CSS mentah:
- `@keyframes spin` — Pemutar
- `@keyframes floatParticle` — Animasi zarah
- `@keyframes gradientShift` — Kecerunan latar belakang
- `@media (max-width: 768px)` — Sembunyi kawasan penjenamaan, papar logo mudah alih
- Penggayaan input carian WebKit (`::-webkit-search-*`)

### 4.4 Notifikasi (Toast)

Kedua-dua halaman menggunakan `sonner` untuk maklum balas:
- `toast.success()` — Latar belakang hijau (log masuk berjaya)
- `toast.error()` — Latar belakang merah (pengesahan gagal, pengguna tidak dijumpai, ralat pelayan)

---

## 5. UX: Klik & Aliran Pengguna

### 5.1 Aliran Log Masuk

```
Pengguna membuka /login
  → Latar belakang animasi kelihatan serta-merta
  → Kad dan penjenamaan dianimasikan masuk
  → Pengguna mengisi nama pengguna (fokus biru)
  → Pengguna mengisi kata laluan (boleh lihat/sembunyi)
  → Pengguna klik "Log Masuk" atau tekan Enter
  → Butang bertukar kepada "Log Masuk..." dengan pemutar
  → Jika berjaya: toast hijau + halakan ke /
  → Jika gagal: toast merah dengan mesej ralat, kekal pada halaman
```

### 5.2 Aliran Lupa Kata Laluan

```
Pengguna klik "Lupa kata laluan?" di halaman log masuk
  → Navigasi ke /lupa-kata-laluan
  → Kad dianimasikan masuk
  → Pengguna mengisi nama pengguna
  → Pengguna klik "Hantar Permintaan" atau tekan Enter
  → Butang bertukar kepada "Menghantar..." dengan pemutar
  → Jika pengguna tidak dijumpai: toast merah, kekal pada borang
  → Jika berjaya (atau 409 pendua): kad bertukar kepada skrin kejayaan
      → Ikon tanda semak hijau dengan animasi spring
      → Mesej kejayaan
      → Butang "Kembali ke Log Masuk"
```

### 5.3 Pintasan Papan Kekunci

- **Enter** pada borang → Hantar (gelagat `<form>` asli)
- **Tab** → Beralih antara medan
- **Butang mata** pada kata laluan → `tabIndex={-1}` (dikecualikan dari tab order)

### 5.4 Kelakuan Responsif

| Ciri | Desktop (≥769px) | Mudah Alih (<768px) |
|------|------------------|---------------------|
| Log Masuk — Penjenamaan | Dipaparkan (animasi slaid dari kiri) | `display: none !important` |
| Log Masuk — Logo | Tiada (penjenamaan sudah ada) | Dipaparkan di atas kad |
| Lupa Kata Laluan | Kad berpusat, 440px maks | Kad lebar penuh dengan padding |
| Padding | 16px | 16px |

---

## 6. Reka Bentuk Visual: Perbandingan Ringkas

### 6.1 Palet Warna (Kedua-dua Halaman)

| Peranan | Warna | Kelegapan / Kegunaan |
|--------|-------|----------------------|
| Latar belakang | `#0a0e27` | Pepejal |
| Kecerunan | `#0a0e27, #1a1145, #0d1b3e, #0a1628` | Animasi 15s |
| Aksen biru | `#1877f2` / `#60a5fa` | Butang, fokus, orbs, bar aksen |
| Aksen ungu | `#7c3aed` / `#a78bfa` | Orbs, sempadan, kecerunan Rx |
| Aksen cyan | `#06b6d4` | Orbs, bar aksen |
| Aksen amber | `#f59e0b` | Orb hangat (log masuk sahaja) |
| Aksen hijau | `#22c55e` / `#16a34a` | Skrin kejayaan (lupa kata laluan sahaja) |
| Teks putih | `#ffffff` | Tajuk, teks butang |
| Teks sekunder | `rgba(255,255,255,0.4–0.7)` | Label, sarikata, pautan |
| Kad | `rgba(255,255,255,0.07)` | Latar belakang kad |
| Sempadan kad | `rgba(255,255,255,0.1)` | Sempadan + inset highlight |
| Input | `rgba(255,255,255,0.06)` | Latar belakang medan |

### 6.2 Tipografi

| Elemen | Saiz | Berat | Warna |
|--------|------|-------|-------|
| Tajuk penjenamaan (desktop) | 42px | 800 | Putih + kecerunan |
| Tajuk kad | 20px | 700 | Putih |
| Sarikata | 14–16px | 400–500 | Putih 45–50% |
| Label medan | 13px | 600 | Putih 70% |
| Input | 14px | 400 | Putih |
| Butang | 15px | 700 | Putih |
| Teks pautan | 13px | 400 | Putih 40% |
| Lencana versi | 11px | 700 | `#60a5fa` |
| Teks ciri | 14px | 500 | Putih 60% |
| Pengaki | 12px | 400 | Putih 25% |

### 6.3 Jejari Sempadan

| Elemen | Jejari |
|--------|--------|
| Kad | 20px |
| Butang hantar | 12px |
| Medan input | 12px |
| Ikon logo | 18px |
| Ikon kejayaan | 20px |
| Lencana versi | 20px |
| Butang mata | 6px |

---

## 7. Model Data & API

### 7.1 API Routes yang Digunakan

| Halaman | API | Kaedah | Input | Output |
|---------|-----|--------|-------|--------|
| Log Masuk | `/api/login` | POST | `{ nama_pengguna, kata_laluan }` | `{ profile }` atau `{ error }` |
| Lupa Kata Laluan | Supabase `profiles` | SELECT | `nama_pengguna` | Profil pengguna atau null |
| Lupa Kata Laluan | `/api/reset-request` | POST | `{ userId }` | `{ success }` atau `{ error }` |

### 7.2 Kebergantungan

| Pakej/Antaramuka | Kegunaan |
|------------------|----------|
| `next/navigation` | `useRouter`, `Link` |
| `framer-motion` | Animasi orbs, kemasukan kad, hover |
| `lucide-react` | `Loader2, Eye, EyeOff, Lock, User, ArrowRight, ArrowLeft, HelpCircle, KeyRound, CheckCircle2` |
| `sonner` | Notifikasi toast |
| `@supabase/supabase-js` | Carian profil (lupa kata laluan) |
| `@/lib/auth-context` | `useAuth()` — fungsi `signIn` |
| `@/components/ui/button` | Komponen butang (tidak digunakan secara langsung — butang tersuai digunakan) |
| `@/components/ui/input` | Komponen input (digunakan untuk medan) |
| `@/components/ui/label` | Komponen label (digunakan untuk label medan) |

---

## 8. Suntikan CSS — Reka Bentuk Visual Umum

### 8.1 Teknik Sempadan Kecerunan Kad

Sempadan kecerunan dicapai menggunakan teknik `mask-composite`:
```css
/* Pseudo-element dengan padding 1px */
position: absolute; inset: 0; border-radius: 20px; padding: 1px;
background: linear-gradient(135deg, ...);
/* Potong bahagian dalam untuk mendedahkan kandungan */
-webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
-webkit-mask-composite: xor;
mask-composite: exclude;
```
Ini mencipta sempadan kecerunan 1px tanpa menambah lebar pada kad.

### 8.2 Kesan Kaca

Semua kad menggunakan:
- `background: rgba(255, 255, 255, 0.07)` — latar separa telus
- `backdrop-filter: blur(24px)` — kaburkan kandungan di belakang
- `-webkit-backdrop-filter: blur(24px)` — keserasian Safari
- `border: 1px solid rgba(255, 255, 255, 0.1)` — definisi sempadan
- `box-shadow: ... inset 0 1px 0 rgba(255, 255, 255, 0.1)` — sorotan atas untuk kesan 3D

### 8.3 Teks Kecerunan ("Rx")

```css
background: linear-gradient(135deg, #60a5fa, #a78bfa);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
background-clip: text;
```
Hanya "Rx" dalam tajuk mempunyai kesan kecerunan ini — selebihnya teks berwarna putih pepejal.

---

## 9. Kekuatan & Amalan Baik

1. **Pengalaman visual yang mengagumkan:** Animasi latar belakang yang kaya (orbs, zarah, grid, kecerunan beralih) mencipta kesan pertama yang profesional dan premium
2. **Pemisahan kebimbangan:** Komponen berasingan untuk `BackgroundOrbs`, `FloatingParticles`, `RxLogo`, dan `SuccessState` — setiap satu dengan tujuan yang jelas
3. **Pencegahan isu SSR:** Corak `mounted` menghalang animasi Framer Motion daripada berjalan di pelayan
4. **Reka bentuk responsif yang kemas:** Sembunyi/papar elemen berdasarkan lebar skrin, susun atur berbeza untuk desktop vs mudah alih
5. **Maklum balas pengguna yang jelas:** Toast kejayaan/gagal, animasi butang memuatkan, perubahan warna fokus
6. **Reka bentuk telus:** Butang mata laluan, label ikon, placeholder deskriptif
7. **Keserasian pelayar:** Gaya sebaris + `-webkit-` prefix, tiada ciri eksperimental
8. **Keselamatan:** AutoComplete atribut yang betul, kata laluan tidak didedahkan dalam UI
9. **Pencegahan spam:** API lupa kata laluan mengembalikan 409 untuk permintaan pendua — pengguna tetap melihat skrin kejayaan
10. **Konsisten dengan bahasa:** Semua teks dalam Bahasa Melayu, termasuk mesej ralat dan placeholder
11. **Prestasi animasi:** Framer Motion untuk orbs (kompleks, berterusan), CSS `@keyframes` untuk zarah (ringan, banyak), pengasingan yang bijak

---

## 10. Peluang Penambahbaikan

1. **Halaman log masuk 905 baris — terlalu besar:** Boleh dipecahkan kepada komponen berasingan (`BrandingPanel`, `LoginForm`, `LoginCard`) untuk kebolehselenggaraan
2. **Tiada pengesahan format nama pengguna:** Medan menerima sebarang teks — boleh ditambah pengesahan panjang minimum atau corak
3. **Kata laluan tiada penunjuk kekuatan:** Tiada meter kekuatan kata laluan
4. **Tiada "Ingat Saya":** Tiada pilihan untuk sesi berterusan — sesi hanya dalam localStorage
5. **Tiada pengendalian Caps Lock:** Tiada amaran apabila Caps Lock dihidupkan semasa menaip kata laluan
6. **Pautan lupa kata laluan sukar dilihat:** Putih 40% kelegapan pada latar gelap adalah sangat halus — mungkin terlalu sukar ditemui oleh sesetengah pengguna
7. **Kod pendua:** Objek `backgroundOrbs`, `floatingParticles`, dan sebahagian besar `styles` diulang antara kedua-dua halaman — boleh diekstrak ke komponen/fail dikongsi
8. **Tiada animasi peralihan halaman:** Navigasi dari `/login` ke `/lupa-kata-laluan` adalah serta-merta — tiada kesinambungan visual antara kedua-dua halaman
9. **Pemulihan ralat untuk pengguna tidak dijumpai:** Selepas ralat "Nama pengguna tidak dijumpai", medan tidak dikosongkan tetapi pengguna perlu memadam teks secara manual
10. **Tiada pengehadan kadar (rate limiting) pada UI:** Walaupun API mungkin mempunyai pengehadan, UI tidak menunjukkan baki percubaan atau kunci keluar sementara
11. **Tiada `prefers-reduced-motion`:** Pengguna dengan sensitiviti gerakan akan melihat semua animasi — tiada media query untuk menghormati tetapan sistem
12. **Salinan footer diulang:** Kedua-dua halaman dan komponen `SuccessState` masing-masing mempunyai markup footer sendiri — boleh diekstrak