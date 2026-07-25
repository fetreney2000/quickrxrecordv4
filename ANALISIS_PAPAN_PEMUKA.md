# Analisis Halaman Papan Pemuka (Dashboard) — QuickRxRecord

**Fail Dianalisis:**
- `quickrx-new/src/app/(dashboard)/page.tsx` — Halaman Papan Pemuka (627 baris)

**Tarikh Analisis:** 26 Julai 2026

---

## 1. Gambaran Keseluruhan

Halaman **Papan Pemuka** (`/`) ialah halaman utama yang dipaparkan sejurus selepas log masuk. Ia berfungsi sebagai **pusat arahan** (command center) yang memberikan gambaran menyeluruh tentang status sistem kepada pengguna berdasarkan peranan mereka. Halaman ini dibina sebagai komponen klien Next.js dengan fokus pada **visualisasi data ringkas, cepat, dan berasaskan peranan**.

**Ciri utama:**
- Kad statistik animasi dengan pembilang nombor (counting animation)
- Penapisan kandungan berdasarkan peranan pengguna (RBAC)
- Papan pemuka luput khusus untuk Pentadbir & Penjaga Stor
- Animasi kemasukan berperingkat (staggered entry)
- Reka bentuk responsif (3→2→1 lajur)

---

## 2. Seni Bina Komponen

### 2.1 Hierarki Komponen

```
DashboardPage (default export)
├── bgDecoration (orb hiasan)
├── bgGrid (corak grid)
├── Header
│   ├── Ikon Activity (animasi spring)
│   ├── Tajuk "Selamat Datang, {nama}" (animasi slaid)
│   ├── Sarikata peranan (animasi slaid)
│   ├── Lencana Peranan (dot berdenyut)
│   └── Lencana Status Sistem (dot berdenyut hijau)
├── Grid Kad Statistik (3 lajur, responsif)
│   └── Kad Statistik (3–6 kad, ditapis mengikut peranan)
│       ├── Latar kecerunan
│       ├── Bulatan hiasan ×2
│       ├── Cahaya glow
│       ├── Teks (tajuk, nilai dengan AnimatedNumber, sarikata)
│       └── Ikon (animasi spring)
└── Papan Pemuka Luput (hanya Pentadbir & Penjaga Stor)
    ├── Pengepala bahagian
    ├── Lencana ringkasan warna (Kritikal/Amaran/Selamat)
    └── Jadual kelompok luput (50 item pertama)
```

### 2.2 Komponen Dalaman

#### `AnimatedNumber`
Komponen yang memaparkan nombor dengan animasi pembilang (counting animation). Menggunakan `useInView` Framer Motion untuk mencetuskan animasi hanya apabila elemen kelihatan dalam viewport.

**Props:**
- `value: number | string` — Nilai untuk dipaparkan
- `duration?: number` — Tempoh animasi (default: 0.8s)

**Gelagat:**
- Apabila tidak kelihatan: papar "0"
- Apabila kelihatan: animasi masuk dengan `opacity: 0, scale: 0.6 → 1, 1` (0.25s)
- Menggunakan `margin: "0px 0px -50px 0px"` untuk `useInView` — mencetuskan lebih awal sebelum elemen benar-benar kelihatan

#### `CountingNumber`
Sub-komponen yang melaksanakan animasi pembilang sebenar menggunakan `requestAnimationFrame`.

**Mekanisme:**
1. Mula dengan `performance.now()`
2. Setiap bingkai (frame), kira kemajuan = `elapsed / (duration * 1000)`
3. Guna lengkung easing `1 - Math.pow(1 - progress, 4)` — **expo-like ease-out** yang memberikan kesan "snappy" (pantas pada permulaan, perlahan pada penghujung)
4. Kemas kini state `count` dengan `Math.floor(eased * to)`
5. Pada bingkai terakhir: tetapkan nilai tepat untuk mengelakkan ralat pembundaran
6. Format dengan `toLocaleString()` (koma untuk ribuan)

---

## 3. Pengurusan State

### 3.1 State Tempatan

| State | Jenis | Tujuan |
|-------|------|--------|
| `mounted` | `boolean` (sentiasa `true`) | Kawal animasi Framer Motion |

Nota: `mounted` ditetapkan sebagai `useState(true)` — tidak seperti halaman log masuk yang menggunakan `useEffect`. Ini bermakna animasi berjalan serta-merta tanpa kitaran render tambahan, kerana dashboard sentiasa dipasang di klien (tidak seperti halaman log masuk yang mungkin pra-render di pelayan).

### 3.2 Data Teringat (Derived)

| Pembolehubah | Pengiraan |
|-------------|-----------|
| `peranan` | `profile?.peranan \|\| ""` |
| `isStoreOrAdmin` | `peranan === "Penjaga Stor" \|\| peranan === "Pentadbir"` |
| `roleLabel` | Carian dalam `ROLE_LABELS` |
| `roleColors` | Carian dalam `ROLE_LABEL_COLORS` |
| `statCards` | `allCards.filter(card => card.roles.includes(peranan)).map((card, idx) => ({ ...card, delay: idx * 0.04 }))` |

### 3.3 Tiada Kesan Sampingan (useEffect)

Halaman ini tidak menggunakan `useEffect` langsung — semuanya adalah derivasi tulen dari data kueri dan props.

---

## 4. Pemerolehan Data (Data Fetching)

### 4.1 Kueri Utama: `["dashboard-stats"]`

**Strategi:** Menggunakan `Promise.all` untuk empat panggilan Supabase selari:

| Kueri | Jadual | Kaedah | Tujuan |
|-------|--------|--------|--------|
| Pesakit Aktif | `patients` | `count: "exact", head: true` | Kiraan pesakit aktif + bukan gabungan |
| Item Ubatan | `items` | `count: "exact", head: true` | Kiraan item aktif |
| Bekalan Hari Ini | `supply_records` | `count: "exact", head: true` | Kiraan bekalan dengan `tarikh_dibekal >= hari ini` |
| Akan Luput (30 Hari) | `item_batches` | `count: "exact", head: true` | Kiraan kelompok dengan `tarikh_luput < 30 hari dari sekarang` + `kuantiti > 0` |

Selepas empat kueri selari selesai, **kueri kelima berjujukan** dijalankan:

| Kueri | Jadual | Tujuan |
|-------|--------|--------|
| Item Dengan Kelompok | `items` (join `item_batches`) | Kira jumlah stok dan item di bawah kuota |

**Pengiraan Sisi Klien:**
```typescript
let totalStock = 0;
let lowStockCount = 0;
for (const item of itemsWithBatches) {
  const itemStock = item.item_batches.reduce((s, b) => s + b.kuantiti, 0);
  totalStock += itemStock;
  if (item.kuota && itemStock < item.kuota) lowStockCount++;
}
```

Kedua-dua pengiraan dilakukan di klien kerana pengagregatan rentas jadual adalah kompleks untuk dilakukan di Supabase dengan satu kueri.

**Output:**
```typescript
{
  totalPatients: number,    // Pesakit aktif
  totalItems: number,       // Item aktif
  supplyToday: number,      // Bekalan hari ini
  expiringSoon: number,     // Kelompok akan luput dalam 30 hari
  totalStock: number,       // Jumlah unit stok
  lowStockCount: number,    // Item di bawah kuota
}
```

### 4.2 Kueri Kedua: `["expiry-dashboard"]`

Diambil secara berasingan — HANYA untuk Pentadbir & Penjaga Stor (`isStoreOrAdmin` sentiasa benar, tetapi jadual hanya dipaparkan untuk mereka).

| Kueri | Jadual | Tujuan |
|-------|--------|--------|
| Kelompok Luput | `item_batches` (join `items`) | Semua kelompok dengan `kuantiti > 0`, diisih mengikut tarikh luput |

**Pemprosesan Sisi Klien:**
Setiap kelompok dikategorikan:
- `daysLeft < 0` → **critical** (Luput)
- `daysLeft <= 30` → **critical** (Kritikal)
- `daysLeft <= 90` → **warning** (Amaran)
- `daysLeft > 90` → **safe** (Selamat)

### 4.3 Corak Prestasi

- **Tiada `staleTime`** dinyatakan — menggunakan default React Query (0 untuk `useQuery`, data sentiasa dianggap basi)
- **Kueri bebas** — `dashboard-stats` dan `expiry-dashboard` berjalan selari
- **Tiada pagination** — jadual luput dihadkan kepada 50 item pertama (`.slice(0, 50)`)
- **Tiada lazy loading** untuk jadual luput — diambil serta-merta (walaupun hanya dipaparkan untuk peranan tertentu)

---

## 5. Kad Statistik Berasaskan Peranan

### 5.1 Semua Definisi Kad

Sistem menggunakan tatasusunan `allCards` dengan 6 kad yang ditakrifkan. Setiap kad mempunyai medan `roles` yang menentukan peranan mana yang boleh melihatnya.

| Kunci | Tajuk | Ikon | Kecerunan | Peranan Yang Melihat |
|-------|-------|------|-----------|---------------------|
| `patients` | Pesakit Aktif | `Users` | Biru `#2563eb→#3b82f6` | Semua (4 peranan) |
| `items` | Item Ubatan | `Package` | Hijau `#059669→#10b981` | Pentadbir, Penjaga Stor, Kakitangan Farmasi |
| `supply` | Bekalan Hari Ini | `TrendingUp` | Ungu `#7c3aed→#8b5cf6` | Semua (4 peranan) |
| `expiry` | Akan Luput (30 Hari) | `AlertTriangle` | Oren `#ea580c→#f97316` | Semua (4 peranan) |
| `stock` | Jumlah Stok | `Package` | Cyan `#0891b2→#06b6d4` | Pentadbir, Penjaga Stor, Kakitangan Klinik |
| `lowStock` | Stok Rendah | `AlertTriangle` | Merah `#dc2626→#ef4444` | Pentadbir, Penjaga Stor, Kakitangan Farmasi |

### 5.2 Perbezaan Pandangan Mengikut Peranan

| Peranan | Bilangan Kad | Kad Yang Dipaparkan |
|---------|-------------|---------------------|
| **Pentadbir** | 6 | Pesakit Aktif, Item Ubatan, Bekalan Hari Ini, Akan Luput, Jumlah Stok, Stok Rendah |
| **Penjaga Stor** | 6 | Sama seperti Pentadbir |
| **Kakitangan Farmasi** | 5 | Pesakit Aktif, Item Ubatan, Bekalan Hari Ini, Akan Luput, Stok Rendah (TIADA Jumlah Stok) |
| **Kakitangan Klinik** | 4 | Pesakit Aktif, Bekalan Hari Ini, Akan Luput, Jumlah Stok (TIADA Item Ubatan, Stok Rendah) |

### 5.3 Reka Bentuk Kad

Setiap kad statistik direka sebagai kad **kecerunan gelap** dengan teks putih:

```
┌──────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ ← Latar kecerunan
│   ● (bulatan hiasan 100px)     │
│                                  │
│   PESAKIT AKTIF       [👥 Ikon]  │ ← Tajuk (11px, huruf besar)
│   1,234                          │ ← Nilai (30px, 800 berat) + AnimatedNumber
│   Jumlah pesakit dalam sistem    │ ← Sarikata (10px)
│                      ● (80px)    │ ← Bulatan hiasan
│   ✦ (glow tertutup)             │
└──────────────────────────────────┘
```

**Elemen visual setiap kad:**
1. **Latar kecerunan** — Kecerunan tersuai mengikut jenis kad (biru, hijau, ungu, oren, cyan, merah)
2. **Bulatan hiasan 1** — 100×100px, putih 10%, di penjuru atas kanan (`top: -20px, right: -20px`)
3. **Bulatan hiasan 2** — 80×80px, putih 6%, di penjuru bawah kiri (`bottom: -30px, left: -15px`)
4. **Cahaya glow** — `boxShadow: "0 0 60px warna"`, kelegapan 0 secara lalai (hanya kelihatan pada hover)
5. **Tajuk** — 11px, berat 600, putih 70%, huruf besar, jarak huruf 0.06em
6. **Nilai** — 30px, berat 800, putih, jarak huruf -0.02em, dengan `AnimatedNumber`
7. **Sarikata** — 10px, putih 50%
8. **Ikon** — 44×44px, latar putih 18%, jejari 12px, animasi spring semasa kemasukan

### 5.4 Animasi Kemasukan

Setiap kad dianimasikan masuk dengan `stagger delay`:
```
Kad 1: delay = 0.10s (0.10 + 0*0.04)
Kad 2: delay = 0.14s (0.10 + 1*0.04)
Kad 3: delay = 0.18s (0.10 + 2*0.04)
...
Kad N: delay = 0.10 + (N-1)*0.04
```

Animasi: `opacity: 0, y: 30, scale: 0.97 → 1, 0, 1` dengan `type: "spring", damping: 25, stiffness: 200`

**Kesan hover:** `whileHover={{ y: -4, scale: 1.02 }}` dengan `duration: 0.15` — kad terangkat dan membesar sedikit.

---

## 6. Pengepala (Header)

### 6.1 Struktur

```
┌──────────────────────────────────────────────────────────────┐
│ [🔵 Ikon]  Selamat Datang, Nama           [🟢 Peranan] [🟢] │
│            Peranan — Papan Pemuka          [🟢 Sistem Beroperasi] │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 Elemen Pengepala

| Elemen | Perincian |
|--------|-----------|
| Ikon | `Activity` (20px, putih), latar kecerunan biru 44×44px, jejari 14px, animasi spring dari `scale: 0, rotate: -90` |
| Tajuk | 22px, berat 700, `#1c1e21`, jarak huruf -0.01em, animasi slaid dari kiri (`x: -15`) |
| Sarikata | 13px, `#65676b`, format "{peranan} — Papan Pemuka" |
| Lencana Peranan | Warna latar/teks/sempadan mengikut peranan, dot berdenyut |
| Lencana Status | Hijau, dot berdenyut, teks "Sistem Beroperasi" |

### 6.3 Lencana Peranan — Kod Warna

| Peranan | Latar | Teks | Sempadan |
|---------|-------|------|----------|
| Pentadbir | Ungu 8% | `#7c3aed` | Ungu 20% |
| Penjaga Stor | Hijau 8% | `#059669` | Hijau 20% |
| Kakitangan Farmasi | Biru 8% | `#1877f2` | Biru 20% |
| Kakitangan Klinik | Amber 8% | `#d97706` | Amber 20% |

### 6.4 Dot Berdenyut

Kedua-dua lencana (peranan dan status) mempunyai dot yang berdenyut:
```typescript
animate={{ opacity: [1, 0.3, 1] }}
transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
```
Ini memberikan isyarat visual halus bahawa sistem "hidup" dan beroperasi.

---

## 7. Papan Pemuka Luput (Pentadbir & Penjaga Stor Sahaja)

### 7.1 Struktur

```
┌──────────────────────────────────────────────────────────────┐
│ [📅 Ikon] Papan Pemuka Luput                                 │
│           Pantau kelompok ubat yang akan tamat tempoh         │
│                                                              │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │
│ │ 🔴 Kritikal  │ │ 🟠 Amaran    │ │ 🟢 Selamat   │          │
│ │ (<30 Hari) 5 │ │ (30-90)   12 │ │ (>90)     34 │          │
│ └──────────────┘ └──────────────┘ └──────────────┘          │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Nama Item │ Kelompok │ Luput │ Stok │ Hari │ Status     │ │
│ │ ─────────────────────────────────────────────────────── │ │
│ │ Paracetamol 500mg │ B003 │ 2026-08-15 │ 200 │ 21 │ 🔴 Kritikal │ │
│ │ ...                                                   │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 Lencana Ringkasan

Tiga lencana memberikan ringkasan pantas:

| Kategori | Julat Hari | Warna | Latar | Sempadan |
|----------|-----------|-------|-------|----------|
| Kritikal | <30 Hari (termasuk luput) | `#dc2626` | Merah 8% | Merah 20% |
| Amaran | 30–90 Hari | `#ea580c` | Oren 8% | Oren 20% |
| Selamat | >90 Hari | `#16a34a` | Hijau 6% | Hijau 15% |

Setiap lencana menunjukkan: dot warna + label + kiraan (16px, berat 800)

### 7.3 Jadual Kelompok Luput

| Lajur | Perincian |
|-------|-----------|
| Nama Item | Nama item + kekuatan, kod item di bawah (10px) |
| Kelompok | Nombor kelompok, fon monospace |
| Tarikh Luput | Tarikh dalam format ISO |
| Stok | Kuantiti (tengah) |
| Hari | `daysLeft` atau "Luput" jika negatif, warna mengikut kategori |
| Status | Dot + label "Kritikal"/"Amaran"/"Selamat", warna mengikut kategori |

**Ciri-ciri jadual:**
- Pengepala jadual: latar kelabu 2%, sempadan bawah, teks 11px
- Baris berkod warna: latar baris mengikut tahap kritikal
- Setiap baris mempunyai sempadan bawah halus (4% hitam)
- Dihadkan kepada 50 item (`.slice(0, 50)`)
- Keadaan kosong: "Tiada kelompok ubat ditemui."
- `overflowX: "auto"` untuk mudah alih

---

## 8. Reka Bentuk Visual

### 8.1 Latar Belakang Halaman

Dua elemen hiasan:
1. **Orb hiasan** — 400×400px, biru 4%, blur 40px, di penjuru atas kanan (`top: -100px, right: -100px`)
2. **Corak grid** — Garis hitam 1px pada kelegapan 1%, sel 40×40px

Kedua-duanya dengan `pointerEvents: "none"` — tidak mengganggu interaksi.

### 8.2 Tipografi

| Elemen | Saiz | Berat | Warna |
|--------|------|-------|-------|
| Tajuk pengepala | 22px | 700 | `#1c1e21` |
| Sarikata pengepala | 13px | 500 | `#65676b` |
| Teks lencana | 12px | 600 | Warna peranan |
| Tajuk kad | 11px | 600 | Putih 70% (huruf besar) |
| Nilai kad | 30px | 800 | Putih |
| Sarikata kad | 10px | 500 | Putih 50% |
| Tajuk bahagian | 16px | 700 | `#1c1e21` |
| Pengepala jadual | 11px | 600 | `#65676b` |
| Sel jadual | 10–12px | 400–600 | `#1c1e21` / `#374151` |
| Kiraan lencana | 16px | 800 | Warna kategori |

### 8.3 Jejari Sempadan

| Elemen | Jejari |
|--------|--------|
| Kad statistik | 16px |
| Ikon pengepala | 14px |
| Ikon kad statistik | 12px |
| Lencana status | 10px |
| Lencana ringkasan luput | 12px |
| Jadual luput | 14px |
| Ikon bahagian luput | 11px |

### 8.4 Bayang

| Elemen | Bayang |
|--------|--------|
| Kad statistik | `0 4px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)` |
| Ikon pengepala | `0 4px 12px rgba(24,119,242,0.3)` |
| Ikon bahagian luput | `0 4px 12px rgba(234,88,12,0.25)` |
| Jadual luput | `0 2px 8px rgba(0,0,0,0.03)` |

### 8.5 Animasi

| Elemen | Animasi | Jenis |
|--------|---------|-------|
| Pengepala | `opacity: 0, y: -15 → 1, 0` | Fade + slide down |
| Ikon pengepala | `scale: 0, rotate: -90 → 1, 0` | Spring, damping 18 |
| Tajuk pengepala | `opacity: 0, x: -15 → 1, 0` | Fade + slide right |
| Lencana status | `opacity: 0, scale: 0.8 → 1, 1` | Fade + scale |
| Dot status | `opacity: [1, 0.3, 1]` berulang | Berdenyut, 1.5s |
| Kad statistik | `opacity: 0, y: 30, scale: 0.97 → 1, 0, 1` | Spring, damping 25, staggered |
| Hover kad | `y: -4, scale: 1.02` | Spring, 0.15s |
| Ikon kad | `scale: 0, rotate: -90 → 1, 0` | Spring, damping 18 |
| Nombor kad | `opacity: 0, scale: 0.6 → 1, 1` (apabila kelihatan) | Fade + scale |

---

## 9. Model Kebenaran (RBAC) pada Dashboard

Dashboard menggunakan sistem RBAC yang sama dengan seluruh aplikasi (`hasPermission`), tetapi untuk penapisan kad, ia menggunakan semakan terus terhadap `peranan`:

```typescript
const allCards = [
  { ... roles: ["Pentadbir", "Penjaga Stor", "Kakitangan Farmasi", "Kakitangan Klinik"] },
  { ... roles: ["Pentadbir", "Penjaga Stor", "Kakitangan Farmasi"] },
  // ...
];

const statCards = allCards.filter(card => card.roles.includes(peranan));
```

Untuk papan pemuka luput:
```typescript
const isStoreOrAdmin = peranan === "Penjaga Stor" || peranan === "Pentadbir";
// ...
{isStoreOrAdmin && (<div>Papan Pemuka Luput...</div>)}
```

**Ringkasan akses:**
| Peranan | Kad Statistik | Papan Pemuka Luput |
|---------|--------------|-------------------|
| Pentadbir | 6 kad | ✅ |
| Penjaga Stor | 6 kad | ✅ |
| Kakitangan Farmasi | 5 kad | ❌ |
| Kakitangan Klinik | 4 kad | ❌ |

---

## 10. Responsif

### 10.1 Pecahan Titik Putus (Breakpoints)

| Saiz Skrin | Grid Kad | Pengepala |
|------------|----------|-----------|
| >768px (Desktop) | 3 lajur, gap 20px | Baris (flex row) |
| 481px–768px (Tablet) | 2 lajur, gap 12px | Lajur (flex column), gap 12px |
| ≤480px (Mudah Alih) | 1 lajur | Lajur (flex column), gap 12px |

### 10.2 Kelakuan Khusus Mudah Alih

- Pengepala: `flex-direction: column`, `align-items: flex-start` — tajuk dan lencana disusun secara menegak
- Lencana status: `align-self: flex-start` — tidak meregang dalam mod lajur
- Grid kad: `grid-template-columns: 1fr 1fr` pada tablet, `1fr` pada telefon
- Tiada padding tambahan untuk nav mudah alih — dashboard tidak menambah `padding-bottom` (diuruskan oleh `(dashboard)/layout.tsx`)

---

## 11. Prestasi & Pengoptimuman

### 11.1 Strategi

| Aspek | Pendekatan |
|-------|------------|
| Pemerolehan data | 4 kueri selari (`Promise.all`) + 1 kueri berjujukan + 1 kueri selari untuk luput |
| Animasi | `requestAnimationFrame` untuk pembilang nombor — mengelakkan render yang tidak perlu |
| `useInView` | Pembilang nombor hanya berjalan apabila kad kelihatan dalam viewport |
| `mounted = true` | Tiada kitaran render tambahan (tidak seperti corak `useEffect`) |
| Tiada `useMemo` | Data cukup ringkas — pengiraan terus adalah mencukupi |
| Pembilang nombor | Easing eksponen (`pow(1-p, 4)`) memberikan animasi yang "snappy" dalam 0.8s |

### 11.2 Potensi Isu

1. **Kueri berjujukan** — Kueri kelima (`itemsWithBatches`) dijalankan SELEPAS `Promise.all` selesai. Ini menambah ~1 perjalanan pergi-balik tambahan. Boleh dijalankan selari dengan kueri lain.
2. **Pengiraan stok di klien** — Untuk dataset besar, mengulangi semua item dan kelompok di klien boleh menjadi perlahan. Boleh dipindahkan ke RPC Supabase.
3. **Kueri luput sentiasa diambil** — Walaupun untuk Kakitangan Farmasi/Klinik yang tidak melihat papan pemuka luput, kueri `["expiry-dashboard"]` tetap dijalankan. Boleh ditambah `enabled: isStoreOrAdmin`.

---

## 12. Model Data Berkaitan

```
Dashboard Stats:
  patients (count, aktif=true, merged_into IS NULL)
  items (count, aktif=true)
  supply_records (count, tarikh_dibekal >= today)
  item_batches (count, tarikh_luput < 30 hari, kuantiti > 0)
  items + item_batches (aggregate: total stock, low stock)

Expiry Dashboard:
  item_batches + items (all, kuantiti > 0, ordered by tarikh_luput)
```

---

## 13. Kekuatan & Amalan Baik

1. **Papan pemuka berasaskan peranan:** Kandungan menyesuaikan diri mengikut peranan pengguna — tidak memaparkan data yang tidak relevan
2. **Animasi bermakna:** Pembilang nombor memberikan rasa "hidup" pada data, bukannya statik
3. **Prestasi animasi:** `requestAnimationFrame` + easing tersuai untuk pembilang yang lancar; `useInView` mengelakkan animasi yang tidak kelihatan
4. **Maklumat pantas:** Lencana ringkasan luput memberikan gambaran segera tanpa perlu meneliti jadual
5. **Kod warna intuitif:** Merah = kritikal, Oren = amaran, Hijau = selamat — sistem isyarat universal
6. **Pemerolehan data selari:** `Promise.all` untuk 4 kueri pertama memaksimumkan kelajuan
7. **Reka bentuk responsif:** Susun atur menyesuaikan diri dari 3→2→1 lajur dengan media query CSS
8. **Konsistensi visual:** Palet warna, jejari sempadan, dan tipografi yang seragam dengan seluruh aplikasi
9. **Kad kecerunan premium:** Latar belakang kecerunan + bulatan hiasan + cahaya glow memberikan rupa premium
10. **Tiada `useEffect`:** Semua data adalah derivasi tulen — tiada kesan sampingan yang kompleks

---

## 14. Peluang Penambahbaikan

1. **Pengoptimuman kueri:** Kueri kelima (`itemsWithBatches`) boleh dijalankan selari dalam `Promise.all`, mengurangkan masa muat
2. **Kueri luput bersyarat:** `useQuery` untuk `["expiry-dashboard"]` boleh menggunakan `enabled: isStoreOrAdmin` untuk mengelakkan pengambilan data yang tidak diperlukan
3. **Pengagregatan sisi pelayan:** Pengiraan `totalStock` dan `lowStockCount` boleh dipindahkan ke RPC Supabase untuk prestasi yang lebih baik dengan dataset besar
4. **Tiada pautan navigasi:** Kad statistik adalah statik — mengklik "Pesakit Aktif" sepatutnya menavigasi ke `/pesakit`, "Item Ubatan" ke `/stok`, dsb.
5. **Tiada carta/graph:** Halaman hanya mempunyai kad statistik dan jadual — boleh ditambah carta bar/masa untuk visualisasi tren
6. **Tiada penapis masa:** Semua statistik adalah "semasa" — tiada pilihan untuk melihat data semalam, minggu lepas, bulan lepas
7. **Jadual luput tiada isihan:** Jadual hanya diisih mengikut tarikh luput — pengguna tidak boleh mengisih mengikut lajur lain
8. **Jadual luput tiada tindakan:** Tiada pautan ke halaman stok atau butiran item dari jadual luput
9. **Tiada loading skeleton:** Tiada keadaan pemuatan untuk kad statistik — nilai "0" dipaparkan sehingga data tiba
10. **Jadual luput tiada pagination penuh:** Dihadkan kepada 50 item — jika terdapat >50 kelompok, selebihnya tidak kelihatan
11. **Lencana ringkasan tidak boleh diklik:** Mengklik lencana "Kritikal" tidak menapis jadual untuk menunjukkan hanya item kritikal