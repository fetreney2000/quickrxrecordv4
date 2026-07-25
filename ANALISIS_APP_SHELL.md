# Analisis App Shell (Kerangka Aplikasi) QuickRxRecord

**Fail Dianalisis:**
- `quickrx-new/src/app/layout.tsx` — Tata Letak Root
- `quickrx-new/src/app/(dashboard)/layout.tsx` — Tata Letak Papan Pemuka
- `quickrx-new/src/components/layout/sidebar.tsx` — Bar Sisi Desktop (316 baris)
- `quickrx-new/src/components/layout/header.tsx` — Pengepala dengan Carian Pintar (327 baris)
- `quickrx-new/src/components/layout/mobile-nav.tsx` — Navigasi Bawah Mudah Alih (126 baris)
- `quickrx-new/src/lib/auth-context.tsx` — Konteks Pengesahan (116 baris)
- `quickrx-new/src/app/globals.css` — CSS Global / Sistem Reka Bentuk (305 baris)

**Tarikh Analisis:** 26 Julai 2026

---

## 1. Gambaran Keseluruhan

**App shell** QuickRxRecord ialah kerangka navigasi dan susun atur yang membaluti semua halaman aplikasi. Ia mengikuti corak **_"classic dashboard shell"_** yang terdiri daripada:

- **Root Layout** → Menyediakan infrastruktur global (fon, metadata, provider)
- **Dashboard Layout** → Cangkerang utama selepas log masuk (sidebar + header + kandungan + mobile nav)
- **Gate pengesahan** → Mengawal akses — pengguna yang tidak disahkan dihalakan semula ke `/login`

Aplikasi ini direka untuk kegunaan **desktop (utama)** dan **mudah alih (adaptif)** dengan pendekatan _mobile-first_ untuk responsif.

---

## 2. Seni Bina Cangkerang

### 2.1 Hierarki Pembalut (Wrapper Hierarchy)

```
<html lang="ms">
  <head> (metadata, manifest, theme-color)
  <body>
    <QueryProvider>                      ← React Query
      <AuthProvider>                     ← Konteks pengesahan
        <Toaster />                      ← Notifikasi sonner
        ├── /login → LoginPage
        ├── /lupa-kata-laluan → ForgotPasswordPage
        └── /(dashboard) → DashboardLayout
              ├── <Sidebar />            ← Desktop sahaja (≥769px)
              ├── <div.content-area>
              │     ├── <Header />       ← Carian pintar
              │     └── <main>           ← {children} (kandungan halaman)
              │           └── <Toaster /> (dipasang semula untuk konteks)
              └── <MobileNav />          ← Mudah alih sahaja (≤768px)
    </body>
      <script>Service Worker</script>
  </body>
</html>
```

### 2.2 Provider & Middleware

| Lapisan | Fail | Peranan |
|---------|------|--------|
| `QueryProvider` | `lib/query-provider.tsx` | Membungkus aplikasi dengan `QueryClientProvider` dari React Query untuk pengurusan state pelayan |
| `AuthProvider` | `lib/auth-context.tsx` | Menyediakan profil pengguna, fungsi `signIn`/`signOut`, `hasPermission`, dan pemulihan sesi dari localStorage + API |
| `Toaster` (sonner) | Root + Dashboard | Notifikasi toast di posisi `top-right` dengan `richColors` |
| Service Worker | Inline script di root layout | Mendaftarkan `/sw.js` untuk keupayaan PWA (offline caching) |

---

## 3. Tata Letak Root (`app/layout.tsx`)

### 3.1 Metadata & SEO

```typescript
title: "QuickRxRecord v4"
description: "Sistem pengurusan inventori dan pesakit untuk klinik/farmasi - Versi 4.0"
```

- Menyokong PWA dengan `manifest: "/manifest.json"`
- `theme-color` ditetapkan ke `#18181b` (hampir hitam — selaras dengan tema gelap sidebar)
- `application-name` untuk pemasangan PWA

### 3.2 Fon

| Fon | Kegunaan |
|-----|---------|
| **Inter** | Fon sans-serif utama, subset Latin, pemboleh ubah `--font-inter` |
| **Roboto** | Fon sandaran dengan 4 berat (300, 400, 500, 700), pemboleh ubah `--font-roboto` |

Kedua-dua fon menggunakan `display: swap` untuk mengelakkan FOIT (Flash of Invisible Text) dan `preload: false` — fon dimuatkan secara asinkronus.

### 3.3 PWA / Service Worker

Skrip sebaris mendaftarkan _service worker_ di `/sw.js` apabila dimuatkan. Ini membolehkan:
- Caching luar talian
- Pengalaman seperti aplikasi asli
- Kemas kini latar belakang

---

## 4. Tata Letak Papan Pemuka (`app/(dashboard)/layout.tsx`)

### 4.1 Gerbang Pengesahan (Auth Gate)

```
if (loading) → Papar spinner Loading (Loader2 berputar)
if (!profile) → null (useEffect halakan semula ke /login)
```

**Aliran:**
1. `loading = true` → Skrin penuh dengan pemutar biru di atas latar `#f0f2f5`
2. `loading = false, profile = null` → `useEffect` mengesan dan memanggil `router.push("/login")`
3. `loading = false, profile = ada` → Papar dashboard penuh

Rekaan pemutar menggunakan pendekatan `Loader2` dari Lucide dengan animasi CSS `spin`, diletakkan di tengah skrin.

### 4.2 Struktur Visual

Dashboard menggunakan susun atur **sidebar tetap + kawasan kandungan fleksibel**:

```
┌──────────┬──────────────────────────────────────┐
│          │ Header (sticky, 64px, glass effect)   │
│ Sidebar  ├──────────────────────────────────────┤
│ (256px)  │                                      │
│ fixed    │ main (flex: 1, padding: 24px)        │
│          │                                      │
│          │ [kandungan halaman]                  │
│          │                                      │
└──────────┴──────────────────────────────────────┘
              MobileNav (fixed bottom, 60px)
              — hanya pada ≤768px
```

**Kawasan Kandungan:**
- `marginLeft: "256px"` — mengimbangi sidebar tetap
- `display: flex; flexDirection: column; minHeight: 100vh`
- Pada mudah alih: `margin-left: 0`, `padding: 16px 12px`, `padding-bottom: 80px` (ruang untuk mobile nav)

### 4.3 Latar Belakang & Hiasan ("Orbs")

Tiga gelung animasi (`contentOrb1`, `contentOrb2`, `contentOrb3`) diletakkan sebagai latar belakang tetap di belakang kawasan kandungan:

| Gelung | Saiz | Warna | Posisi | Animasi |
|--------|------|-------|--------|---------|
| Orb 1 | 400×400px | Biru (`rgba(24,119,242,0.04)`) | Atas kanan (10%/5%) | `contentOrb1` — 20s, translate(±30px, ±20px) |
| Orb 2 | 350×350px | Ungu (`rgba(124,58,237,0.03)`) | Bawah kiri (15%/10%) | `contentOrb2` — 25s, translate(±25px, ±15px) |
| Orb 3 | 300×300px | Cyan (`rgba(6,182,212,0.03)`) | Tengah (50%/40%) | `contentOrb3` — 18s, translate(±20px, ±25px) |

Kesemua gelung menggunakan `filter: blur(60px)` dan `pointerEvents: "none"` — ia adalah hiasan semata-mata, tidak mengganggu interaksi pengguna. Warna yang sangat rendah kelegapan (0.03–0.04) memastikan ia halus dan tidak mengganggu.

---

## 5. Bar Sisi Desktop (`components/layout/sidebar.tsx`)

### 5.1 Spesifikasi Fizikal

| Atribut | Nilai |
|---------|-------|
| Lebar | 256px |
| Posisi | `fixed` (kiri, atas ke bawah) |
| z-index | 50 |
| Latar belakang | `linear-gradient(180deg, #0c1329 → #0a0e27 → #0d1117)` |
| Sempadan kanan | `1px solid rgba(255,255,255,0.06)` |
| Bayang | `4px 0 24px rgba(0,0,0,0.2)` |
| Keterlihatan mudah alih | `display: none !important` pada ≤768px |

### 5.2 Komponen Dalam Bar Sisi

#### a) Bahagian Logo
- Ikon `Activity` (Lucide) dalam kontena 40×40px dengan latar kecerunan biru
- Tajuk "QuickRxRecord" dengan lencana versi "v4" (latar biru separa telus)
- Sarikata: "Jabatan Farmasi Hospital Keningau"
- Pemisah: sempadan bawah dengan kecerunan biru halus

#### b) Navigasi Utama
7 item navigasi dengan sistem berasaskan kebenaran:

| Label | Laluan | Ikon | Warna Tema | Keizinan Diperlukan |
|-------|--------|------|------------|---------------------|
| Papan Pemuka | `/` | LayoutDashboard | `#3b82f6` (biru) | Tiada |
| Dispen Pantas | `/pantas` | Zap | `#f0932b` (oren) | `manage_supply` |
| Pesakit | `/pesakit` | Stethoscope | `#10b981` (hijau) | `view_patients` |
| Inventori | `/stok` | Pill | `#8b5cf6` (ungu) | `view_items` |
| Laporan | `/laporan` | FileText | `#f43f5e` (merah) | `view_reports` |
| Pengurusan | `/pengurusan` | UserCog | `#06b6d4` (cyan) | `manage_users` |
| Hak Cipta | `/hakcipta` | Shield | `#f59e0b` (amber) | Tiada |

**Gelagat Item Navigasi:**
- **Tidak Aktif:** Teks `rgba(255,255,255,0.55)`, latar telus
- **Hover (tidak aktif):** Latar `rgba(255,255,255,0.06)`, teks putih
- **Aktif:** Latar `rgba(24,119,242,0.1)`, teks `#60a5fa`, sempadan biru, bayang, dan **dot penunjuk** (6px, `#1877f2`, glow)
- Ikon aktif: Latar belakang berwarna mengikut tema dengan bayang (`0 4px 12px warna + 40`)

**Logik Pengesanan Aktif:**
```typescript
const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
```
Ini bermakna `/pesakit/123` akan menandakan "Pesakit" sebagai aktif (padanan awalan), manakala `/` hanya aktif tepat pada `/`.

#### c) Bahagian Profil Pengguna
- Avatar dengan inisial pertama nama (latar kecerunan biru)
- Nama penuh + peranan (boleh klik → `/profil`)
- Butang Log Keluar dengan ikon `LogOut`
  - Hover: latar merah `rgba(228,30,63,0.15)`, ikon merah `#e41e3f`
- Dipisahkan dengan sempadan atas dan kecerunan latar halus

### 5.3 Hiasan Bar Sisi ("Orbs")
Tiga gelung animasi terapung di belakang kandungan sidebar:
- Orb 1: 300px, biru, kiri-atas, `sidebarOrbFloat1` (20s)
- Orb 2: 250px, ungu, kanan-bawah, `sidebarOrbFloat2` (25s)
- Orb 3: 200px, cyan, kiri-bawah, `sidebarOrbFloat3` (18s)

### 5.4 Pelayar Disokong
Komen `/* Chrome 109 compatible */` menunjukkan gaya ditulis dengan `React.CSSProperties` gaya sebaris untuk keserasian dengan pelayar lama (tiada CSS Modules, tiada Tailwind untuk sidebar). Semua animasi mempunyai kedua-dua `@keyframes` dan `@-webkit-keyframes`.

---

## 6. Pengepala (`components/layout/header.tsx`)

### 6.1 Spesifikasi Fizikal

| Atribut | Nilai |
|---------|-------|
| Posisi | `sticky`, top: 0 |
| z-index | 40 |
| Tinggi | 64px |
| Latar belakang | `rgba(255,255,255,0.95)` + `blur(16px)` (kesan kaca) |
| Sempadan bawah | `1px solid rgba(0,0,0,0.06)` |
| Bayang | `0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)` |

Kesan kaca (`backdrop-filter: blur(16px)`) memberikannya rupa moden "frosted glass" yang membenarkan kandungan di belakang kelihatan kabur apabila ditatal.

### 6.2 Kecerunan Latar Belakang
Lapisan kecerunan statik meliputi keseluruhan pengepala:
```
linear-gradient(90deg, rgba(24,119,242,0.03) → rgba(124,58,237,0.02) → rgba(6,182,212,0.02))
```
Ini memberikan kesan peralihan warna yang sangat halus dari kiri ke kanan.

### 6.3 Hiasan Pengepala ("Orbs")
Tiga gelung animasi kecil di bahagian atas pengepala:
- Orb 1: 200px, biru, kiri (10%), `headerOrbFloat1` (12s)
- Orb 2: 160px, ungu, kanan (20%), `headerOrbFloat2` (15s)
- Orb 3: 120px, cyan, tengah (50%), `headerOrbFloat3` (18s)

Kesemua gelung berada di luar pengepala secara menegak (`top: -30px` hingga `-60px`), dengan `overflow: hidden` pada kontena. Ini bermakna ia kelihatan sebagai "cahaya ambien" di atas pengepala.

### 6.4 Carian Pintar Pesakit

Fungsi utama pengepala adalah **carian sejagat pesakit**. Ini direka sebagai jalan pintas untuk staf mencari pesakit dengan pantas dari mana-mana halaman.

**Ciri-ciri Carian:**

| Ciri | Penerangan |
|------|------------|
| Medan carian | `type="search"`, placeholder "Cari pesakit..." |
| Saiz | Lebar penuh, maksimum 480px, di tengah pengepala |
| Debounce | 300ms sebelum permintaan dihantar |
| Ambang carian | Minimum 2 aksara |
| Sasaran carian | `nama`, `nombor_kad_pengenalan`, `nombor_pendaftaran_hospital` (semua `ilike`) |
| Tapisan | Hanya pesakit aktif, bukan yang telah digabungkan (`merged_into IS NULL`) |
| Had hasil | 10 pesakit |
| Navigasi | Klik hasil → `router.push("/pesakit/[id]")` |

**Keadaan Carian:**
1. **Lalai:** Medan carian dengan ikon Search kelabu, latar biru sangat halus
2. **Fokus:** Sempadan biru terang, latar putih, gelung fokus (`0 0 0 4px rgba(24,119,242,0.1)`), ikon Search biru
3. **Mencari:** Ikon `Loader2` berputar di sebelah kanan
4. **Tiada hasil:** Teks "Tiada pesakit dijumpai." di tengah
5. **Hasil dijumpai:** Senarai dropdown dengan nama (bold) + lencana KP dan Hospital

**Pengendalian Klik:**
- Menggunakan `onMouseDown` dan bukannya `onClick` — ini memastikan pengendali dijalankan sebelum peristiwa `onBlur`, yang sebaliknya akan menyembunyikan dropdown sebelum klik didaftarkan.

**Penggayaan CSS Tersuai:**
- Menyembunyikan butang clear/search asli WebKit (`::-webkit-search-decoration`, dsb.)

### 6.5 Kelakuan Dropdown

Dropdown mempunyai:
- Latar putih, sempadan biru halus
- Bayang bertingkat: `0 12px 40px rgba(0,0,0,0.12)` + `0 4px 12px rgba(0,0,0,0.06)`
- `max-height: 320px` dengan `overflow-y: auto`
- Jejari sempadan 14px (padan dengan medan carian)

**Item hasil:**
- Nama pesakit: 13px, berat 600, warna `#1c1e21`
- Lencana meta: 11px, warna `#65676b`, format "KP: XXXXXX-XX-XXXX" dan "Hosp: XXXXX"
- Hover: latar `rgba(24,119,242,0.06)`
- Sempadan bawah pemisah biru sangat halus

---

## 7. Navigasi Mudah Alih (`components/layout/mobile-nav.tsx`)

### 7.1 Spesifikasi Fizikal

| Atribut | Nilai |
|---------|-------|
| Posisi | `fixed`, bottom: 0 |
| z-index | 50 |
| Tinggi | 60px |
| Latar belakang | `linear-gradient(180deg, rgba(12,16,42,0.98), rgba(10,14,35,1))` |
| Kesan kaca | `blur(24px)` |
| Sempadan atas | `1px solid rgba(255,255,255,0.1)` |
| Bayang | `0 -4px 24px rgba(0,0,0,0.3)` |
| Keterlihatan desktop | `display: none !important` pada ≥769px |

### 7.2 Item Navigasi (8 item)

Navigasi mudah alih mempunyai 8 item — lebih banyak daripada sidebar (7) kerana ia termasuk **Profil** sebagai item berasingan:

| Label | Laluan | Ikon | Warna |
|-------|--------|------|-------|
| Utama | `/` | LayoutDashboard | `#3b82f6` |
| Pantas | `/pantas` | Zap | `#f0932b` |
| Pesakit | `/pesakit` | Stethoscope | `#10b981` |
| Inventori | `/stok` | Pill | `#8b5cf6` |
| Laporan | `/laporan` | FileText | `#f43f5e` |
| Pengurusan | `/pengurusan` | UserCog | `#06b6d4` |
| Profil | `/profil` | User | `#22c55e` |
| Hak Cipta | `/hakcipta` | Shield | `#f59e0b` |

### 7.3 Reka Bentuk Item

Setiap item menggunakan kelas CSS `mobile-nav-item`:
- Susun atur `flex-direction: column` (ikon di atas)
- `flex: 1` — pengagihan sama rata
- Ikon dalam kontena 36×36px, jejari sempadan 10px
- Tiada label teks — **ikon sahaja** (menjimatkan ruang)

**Item Aktif:**
- Penunjuk bar kecil di atas (20px × 2px, warna tema)
- Ikon: warna tema + `strokeWidth: 2.2`
- Latar ikon: warna tema pada kelegapan 12% (`#XXXXXX20`)
- Bayang ikon: warna tema pada kelegapan ~19% (`#XXXXXX30`)

**Item Tidak Aktif:**
- Ikon: `rgba(255,255,255,0.5)` + `strokeWidth: 1.8`

### 7.4 Perbandingan Sidebar vs MobileNav

| Aspek | Sidebar (Desktop) | MobileNav |
|-------|-------------------|-----------|
| Orientasi | Menegak, kiri | Mendatar, bawah |
| Label teks | Ada | Tiada (ikon sahaja) |
| Lebar/Tinggi | 256px lebar | 60px tinggi |
| Bilangan item | 7 | 8 (+ Profil) |
| Profil pengguna | Panel dengan avatar + logout | Item navigasi ke `/profil` |
| Animasi latar | 3 orbs terapung | Tiada |
| Gaya | Kecerunan biru gelap | Kecerunan biru gelap, lebih legap |

---

## 8. Sistem Pengesahan (`lib/auth-context.tsx`)

### 8.1 Model Sesi

Sistem menggunakan **localStorage sebagai sumber utama**, dengan API sisi pelayan sebagai sandaran:

```
1. Cuba localStorage ("quickrx_session") → Profil disimpan sebagai JSON
2. Jika tiada → Fetch "/api/session" (cookie HTTP-only) → Simpan ke localStorage
3. Jika kedua-duanya tiada → Pengguna tidak disahkan
```

### 8.2 API AuthContext

| Fungsi | Penerangan |
|--------|------------|
| `signIn(nama_pengguna, kata_laluan)` | POST ke `/api/login`, simpan profil ke localStorage |
| `signOut()` | Kosongkan state + localStorage, DELETE `/api/session` |
| `refreshProfile()` | Fetch profil terkini dari Supabase REST API, kemaskini localStorage |

### 8.3 Sistem Kebenaran (RBAC)

Fungsi `hasPermission(role, action)` melaksanakan kawalan akses berasaskan peranan:

| Peranan | Keizinan |
|---------|----------|
| **Pentadbir** | `manage_users`, `manage_items`, `manage_patients`, `manage_supply`, `view_reports`, `export_reports`, `merge_patients`, `manage_batches`, `view_items`, `view_patients`, `manage_assignments` |
| **Penjaga Stor** | `manage_items`, `manage_patients`, `manage_supply`, `view_reports`, `export_reports`, `merge_patients`, `manage_batches`, `view_items`, `view_patients`, `manage_assignments` |
| **Kakitangan Farmasi** | `manage_patients`, `manage_supply`, `view_reports`, `export_reports`, `view_items`, `view_patients`, `manage_assignments` |
| **Kakitangan Klinik** | `view_items`, `view_patients` (bacaan sahaja) |

**Kesan pada App Shell:**
- Item navigasi yang memerlukan keizinan tertentu akan disembunyikan (`return null`) jika pengguna tidak mempunyai keizinan tersebut
- Ini bermakna **Kakitangan Klinik** hanya akan melihat: Papan Pemuka, Pesakit, Inventori, Profil, Hak Cipta

---

## 9. Sistem Reka Bentuk Global (`globals.css`)

### 9.1 Token Reka Bentuk (CSS Variables)

Sistem menggunakan **50+ token CSS** yang diimport ke Tailwind melalui `@theme inline`.

#### Palet Warna

| Token | Warna | Kegunaan |
|-------|-------|----------|
| `--background` | `#f0f2f5` | Latar belakang aplikasi (kelabu Facebook) |
| `--foreground` | `#1c1e21` | Teks utama |
| `--card` | `#ffffff` | Latar kad |
| `--primary` | `#1877f2` | Butang utama, pautan, aksen (Facebook Blue) |
| `--secondary` | `#e4e6eb` | Butang/latar sekunder |
| `--muted` | `#f0f2f5` | Latar yang dilemahkan |
| `--muted-foreground` | `#65676b` | Teks sekunder |
| `--destructive` | `#e41e3f` | Butang padam, amaran bahaya |
| `--success` | `#42b72a` | Status berjaya, lencana aktif |
| `--warning` | `#f0ad4e` | Amaran |
| `--border` | `#dddfe2` | Sempadan |
| `--input` | `#dddfe2` | Sempadan input |
| `--ring` | `#1877f2` | Gelung fokus |

#### Kecerunan

| Token | Nilai |
|-------|-------|
| `--gradient-primary` | `linear-gradient(135deg, #1877f2, #1a73e8, #0d5bd4)` |
| `--gradient-success` | `linear-gradient(135deg, #42b72a, #36a420)` |
| `--gradient-warning` | `linear-gradient(135deg, #f0ad4e, #ec971f)` |
| `--gradient-danger` | `linear-gradient(135deg, #e41e3f, #c41e3a)` |
| `--gradient-purple` | `linear-gradient(135deg, #7c3aed, #6d28d9)` |
| `--gradient-card` | `linear-gradient(135deg, #ffffff, #f8f9ff)` |

#### Bayang

| Token | Nilai |
|-------|-------|
| `--shadow-card` | `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)` |
| `--shadow-card-hover` | `0 10px 25px rgba(0,0,0,0.1), 0 4px 10px rgba(0,0,0,0.06)` |
| `--shadow-dropdown` | `0 10px 25px rgba(0,0,0,0.15), 0 4px 10px rgba(0,0,0,0.08)` |

### 9.2 Kelas Utiliti Premium

| Kelas | Penerangan |
|-------|------------|
| `.glass-card` | Kad dengan kesan kaca (blur 12px + latar separa telus) |
| `.premium-card` | Kad dengan transisi hover — `translateY(-4px)` + bayang lebih besar |
| `.gradient-border` | Sempadan kecerunan 3-warna (biru-ungu-hijau) menggunakan teknik pseudo-element |
| `.gradient-card-blue` / `-green` / `-purple` / `-orange` / `-red` | Kad kecerunan dengan teks putih |
| `.premium-badge` | Lencana kecil bulat (11px, 600 berat, huruf besar) |
| `.shimmer` | Animasi _loading skeleton_ — kecerunan bergerak (1.5s) |
| `.glow-blue` / `.glow-green` | Kesan cahaya kotak untuk kad |
| `.hover-lift` | Kesan angkat pada hover (`translateY(-2px) scale(1.01)`) |
| `.icon-circle` | Kontena ikon 40×40px dengan jejari 12px |
| `.stat-number` | Nombor statistik besar (1.75rem, 800 berat, jarak huruf ketat) |
| `.page-header` | Tajuk halaman dengan garis bawah kecerunan 48px |
| `.animate-slide-up` | Animasi kemasukan `slideUp` (0.5s) |
| `.animate-fade-in` | Animasi kemasukan `fadeIn` (0.5s) |
| `.premium-table th` | Pengepala jadual dengan huruf besar, jarak huruf, sempadan bawah 2px |

### 9.3 Penyesuaian Bar Tatal (Scrollbar)

```css
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-thumb { background: #c4c7cc; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #a0a3a8; }
```

Bar tatal yang nipis (6px) dan bulat sepenuhnya yang sepadan dengan estetik keseluruhan.

### 9.4 Ciri-ciri Fon Global

```css
body {
  font-family: var(--font-family);  /* Inter, Roboto, system-ui */
  font-feature-settings: "rlig" 1, "calt" 1;
}
```

`"rlig"` (required ligatures) dan `"calt"` (contextual alternates) adalah ciri OpenType yang meningkatkan keterbacaan teks.

---

## 10. Aliran UX App Shell

### 10.1 Permulaan Aplikasi

```
Pengguna membuka aplikasi
  → Root Layout dipasang
  → QueryProvider + AuthProvider diaktifkan
  → AuthProvider memuatkan sesi dari localStorage
  → Dashboard Layout dipasang
      → loading = true → Papar pemutar skrin penuh
      → loading = false → Jika tiada profil → halakan ke /login
      → loading = false → Jika ada profil → Papar dashboard
```

### 10.2 Navigasi

**Desktop:**
- Sidebar di kiri dengan 7 item
- Item aktif diserlahkan dengan latar biru + dot penunjuk
- Pengguna boleh klik mana-mana item untuk navigasi
- Carian pantas pesakit melalui pengepala

**Mudah Alih:**
- Sidebar disembunyikan sepenuhnya
- Navigasi bawah (8 ikon) muncul
- Pengepala dengan carian kekal di atas
- Ruang tambahan `padding-bottom: 80px` untuk mengelakkan kandungan dilindungi oleh nav bawah

### 10.3 Log Keluar

**Desktop:** Butang LogOut di bahagian bawah sidebar (hover merah)
**Mudah Alih:** Tiada butang log keluar langsung — pengguna perlu ke `/profil` melalui navigasi bawah

### 10.4 Carian Pantas (Header)

Pengguna boleh mencari pesakit dari mana-mana halaman:
1. Klik/Tekan medan carian di pengepala
2. Taip sekurang-kurangnya 2 aksara (nama, no. KP, atau no. hospital)
3. Tunggu 300ms (debounce) — hasil dipaparkan
4. Klik hasil → navigasi terus ke halaman butiran pesakit

Ini adalah **pintasan produktiviti utama** untuk staf farmasi/klinik yang sering perlu mencari pesakit dengan pantas.

---

## 11. Pengoptimuman & Prestasi

### 11.1 Strategi Pemuatan

| Aspek | Pendekatan |
|-------|------------|
| Fon | `display: swap` + `preload: false` — tiada sekatan pemaparan |
| Sidebar | `position: fixed` — tidak menatal bersama kandungan |
| Pengepala | `position: sticky` — kekal kelihatan semasa menatal |
| Animasi | CSS `@keyframes` + `transform` sahaja — dioptimumkan GPU, tiada `requestAnimationFrame` |
| Carian | Debounce 300ms — mengurangkan permintaan yang tidak perlu |
| Service Worker | PWA — caching aset untuk muatan luar talian yang pantas |

### 11.2 Keserasian Pelayar

Gaya ditulis dalam `React.CSSProperties` (gaya sebaris) dengan komen `/* Chrome 109 compatible */`. Ini memastikan:
- Keserasian dengan pelayar yang lebih lama
- Tiada kebergantungan pada ciri CSS moden yang mungkin tidak disokong
- Kedua-dua `@keyframes` standard dan `@-webkit-keyframes` untuk liputan WebKit

### 11.3 Reka Bentuk Adaptif

Sistem menggunakan **dua titik putus media query**:
- `max-width: 768px` — Mudah alih (sidebar disembunyikan, mobile nav dipaparkan)
- `min-width: 769px` — Desktop (sidebar dipaparkan, mobile nav disembunyikan)

Ini bermakna **tablet** (cth. iPad dalam mod landskap) akan menggunakan susun atur desktop — pendekatan yang munasabah untuk aplikasi produktiviti.

---

## 12. Model Data & Kebergantungan

### 12.1 Kebergantungan Pakej

| Pakej | Kegunaan dalam App Shell |
|--------|--------------------------|
| `next` (15.x) | App Router, `useRouter`, `usePathname`, `Metadata` |
| `@tanstack/react-query` | `QueryClientProvider` untuk caching data |
| `lucide-react` | Semua ikon (17+ ikon berbeza dalam shell) |
| `sonner` | `Toaster` untuk notifikasi |
| `next/font/google` | Fon Inter & Roboto |

### 12.2 API Routes yang Digunakan

| Laluan API | Digunakan Oleh | Kaedah |
|------------|---------------|--------|
| `/api/login` | AuthContext.signIn | POST |
| `/api/session` | AuthContext (muat + logout) | GET, DELETE |
| Supabase REST API | AuthContext.refreshProfile | GET (profiles) |
| `patients` (Supabase) | Header.searchPatients | SELECT |

---

## 13. Kekuatan & Amalan Baik

1. **Pemisahan Kebimbangan (Separation of Concerns):** Root layout (infrastruktur) vs Dashboard layout (cangkerang UI) dipisahkan dengan jelas
2. **Kawalan Akses Berlapis:** Pengesahan di peringkat layout (halakan semula) + di peringkat UI (sembunyi item navigasi)
3. **Corak Provider:** QueryClientProvider → AuthProvider → UI — hierarki yang bersih
4. **PWA-Ready:** Manifest + Service Worker + theme-color — sedia untuk pemasangan
5. **Reka Bentuk Adaptif:** Dua mod berbeza (desktop sidebar vs mobile bottom nav) tanpa pertindihan
6. **Prestasi:** Sticky header, fixed sidebar, animasi GPU-optimized, carian debounced
7. **Estetik Konsisten:** Palet warna berasaskan Facebook Blue yang seragam di seluruh shell
8. **Keserasian Pelayar Lama:** Gaya sebaris dengan `-webkit-` prefix, tiada ciri CSS eksperimental
9. **Carian Pantas:** Medan carian sejagat yang menjimatkan masa navigasi
10. **Maklum Balas Visual:** Animasi hover, penunjuk aktif, glow effects, dan animasi orbs yang memberikan rasa "hidup" pada UI
11. **Sistem Token CSS:** 50+ token reka bentuk yang boleh diguna semula untuk konsistensi

---

## 14. Peluang Penambahbaikan

1. **Tiada mod gelap (dark mode):** Walaupun terdapat `@custom-variant dark`, sidebar sudah gelap tetapi kawasan kandungan kekal terang. Tiada togol mod gelap untuk kawasan kandungan.
2. **Tiada penunjuk muatan halaman (page loading indicator):** Hanya pemutar skrin penuh semasa auth loading. Tiada `NProgress` atau bar kemajuan untuk navigasi antara halaman.
3. **Sidebar tidak boleh diruntuhkan (collapsible):** Sentiasa 256px — tiada mod "mini sidebar" (ikon sahaja) untuk menjimatkan ruang skrin pada desktop yang lebih kecil.
4. **Tiada breadcrumb automatik:** Setiap halaman perlu memasang sendiri komponen `Breadcrumb`. App shell tidak menyediakan breadcrumb global.
5. **Log keluar pada mudah alih tersembunyi:** Pengguna mudah alih perlu menavigasi ke `/profil` untuk log keluar — tiada butang cepat.
6. **Animasi peralihan halaman:** Tiada animasi peralihan antara halaman menggunakan `AnimatePresence` pada `{children}` — setiap perubahan halaman adalah serta-merta.
7. **Carian pengepala terhad kepada pesakit:** Tidak boleh mencari item inventori atau laporan — berpotensi untuk dikembangkan.
8. **Tiada pintasan papan kekunci:** Tiada `Cmd+K` / `Ctrl+K` untuk palet arahan atau carian pantas.
9. **Orbs menggunakan sumber GPU:** 9 gelung animasi serentak (3 sidebar + 3 header + 3 dashboard) mungkin menggunakan sumber yang tidak perlu pada peranti rendah kuasa. Tiada `prefers-reduced-motion` media query.
10. **Tiada pengendalian luar talian eksplisit:** Walaupun service worker didaftarkan, UI tidak menunjukkan status luar talian atau menyediakan fallback.