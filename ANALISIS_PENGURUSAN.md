# Analisis Halaman Pengurusan — QuickRxRecord

**Fail Dianalisis:**
- `quickrx-new/src/app/(dashboard)/pengurusan/page.tsx` — Halaman Pengurusan Pengguna (409 baris)
- `quickrx-new/src/components/pengurusan/lookup-manager.tsx` — Komponen LookupManager (267 baris)

**Tarikh Analisis:** 26 Julai 2026

---

## 1. Gambaran Keseluruhan

Halaman **Pengurusan** (`/pengurusan`) ialah pusat kawalan pentadbiran sistem — **hanya boleh diakses oleh Pentadbir**. Ia menyediakan tiga fungsi utama melalui antara muka bertab:

1. **Pengurusan Pengguna** — CRUD pengguna, tukar status aktif, reset kata laluan
2. **Permintaan Reset Kata Laluan** — Melulus/menolak permintaan dari halaman Lupa Kata Laluan
3. **Rujukan Sistem** — Urus data rujukan (kategori item, bentuk dos, durasi bekalan)

Ini adalah satu-satunya halaman dalam aplikasi yang menggunakan komponen `Tabs` shadcn/ui dan satu-satunya halaman yang memuatkan komponen pengurusan khusus (`LookupManager`). Halaman ini menggabungkan tiga modul pentadbiran yang berbeza ke dalam satu antara muka bersatu.

**Ciri-ciri utama:**
- Senarai pengguna dengan baris boleh dikembangkan (expandable rows)
- Edit sebaris dalam panel kembangan dengan animasi AnimatePresence
- Dialog pengesahan untuk nyahaktif/aktif dan reset kata laluan
- Lencana pending count pada tab "Permintaan Reset"
- Komponen `LookupManager` generik untuk CRUD data rujukan
- Reka bentuk dengan tema cyan (`#06b6d4`)
- API routes: `/api/create-user`, `/api/reset-password`

---

## 2. Seni Bina Komponen

### 2.1 Hierarki Komponen

```
PengurusanPage (default export)
├── Orb hiasan (cyan, 300px)
├── Breadcrumb ("Pengurusan Pengguna")
├── Header (ikon Users + tajuk + butang "Tambah Pengguna")
│   └── Dialog: Tambah Pengguna Baharu
│       ├── 6 medan: Nama*, Nama Pengguna*, Kata Laluan*, Jawatan, Peranan* (Select)
│       └── POST /api/create-user
├── Tabs (shadcn/ui)
│   ├── Tab "Pengguna" (Users icon)
│   │   └── Card: Senarai Pengguna
│   │       ├── Carian pengguna
│   │       ├── Table (6 lajur): ▼, Nama, Nama Pengguna, Jawatan, Peranan, Status
│   │       │   └── Baris boleh dikembangkan (expandable):
│   │       │       ├── Panel Kembangan (AnimatePresence):
│   │       │       │   ├── Maklumat terperinci (grid 4-lajur)
│   │       │       │   └── Edit Form ATAU Action Buttons
│   │       │       │       ├── Edit: Borang sebaris (Nama, Nama Pengguna, Jawatan, Peranan)
│   │       │       │       └── Actions: Edit | Nyahaktif/Aktif | Reset Kata Laluan
│   │       │       └── ChevronDown berputar 180°
│   │       ├── Dialog: Nyahaktifkan/Aktifkan Pengguna
│   │       │   └── Amaran merah (nyahaktif) / hijau (aktif)
│   │       └── Dialog: Reset Kata Laluan
│   │           └── Amaran amber + maklumat pengguna
│   ├── Tab "Permintaan Reset" (MailQuestion icon)
│   │   ├── Badge kiraan pending (destructive)
│   │   └── Card: Senarai Permintaan
│   │       └── Kad permintaan (amber jika pending, kelabu jika selesai)
│   │           ├── Nama pengguna + Badge status
│   │           ├── Nama pengguna + tarikh
│   │           └── Butang "Sah & Reset" / "Tolak" (jika pending)
│   └── Tab "Rujukan" (BookOpen icon)
│       └── LookupManager × 3:
│           ├── Kategori Item
│           ├── Bentuk Dos
│           └── Durasi Bekalan
```

### 2.2 Komponen `LookupManager`

Komponen generik yang boleh diguna semula untuk mengurus data jadual rujukan. Ia menerima prop `type` dan melaksanakan CRUD penuh untuk jadual tersebut.

**Props:**
```typescript
type: "item_categories" | "item_forms" | "supply_durations"
```

**Konfigurasi setiap jenis:**

| Type | Tajuk | Label | Ikon | Penerangan |
|------|-------|-------|------|------------|
| `item_categories` | Kategori Item | Kategori | `Package` | Urus kategori untuk item/ubat |
| `item_forms` | Bentuk Dos | Bentuk Dos | `Pill` | Urus bentuk dos untuk item/ubat |
| `supply_durations` | Durasi Bekalan | Durasi | `CalendarDays` | Urus tempoh durasi bekalan |

**Ciri-ciri:**
- Jadual 3 lajur (#, Nama, Tindakan)
- Dialog tambah dengan auto-fokus + Enter untuk hantar
- Edit sebaris dengan auto-fokus + Enter/ Escape untuk simpan/batal
- Dialog pengesahan padam dengan amaran
- Pemformatan `toTitleCase` automatik pada onBlur
- Pengendalian ralat dengan toast

**State (6 pembolehubah):**
| State | Tujuan |
|-------|--------|
| `openAdd` | Kawal dialog tambah |
| `editId` | ID rekod yang sedang diedit (null = mod lihat) |
| `newName` | Nama untuk rekod baharu |
| `editName` | Nama untuk rekod yang diedit |
| `deleteConfirm` | Rekod yang akan dipadam (null = tiada) |

---

## 3. Pengurusan State — Halaman Utama

### 3.1 State Tempatan — 9 Pembolehubah

| State | Jenis | Tujuan |
|-------|------|--------|
| `openAdd` | `boolean` | Kawal dialog tambah pengguna |
| `expandedUser` | `string \| null` | ID pengguna yang dikembangkan |
| `editId` | `string \| null` | ID pengguna yang sedang diedit |
| `newUser` | `object` (5 medan) | Data borang pengguna baharu |
| `editData` | `Partial<Profile>` | Data borang edit pengguna |
| `confirmToggle` | `{ id, name, newStatus } \| null` | Dialog nyahaktif/aktif |
| `confirmReset` | `{ id, name, nama_pengguna } \| null` | Dialog reset kata laluan |
| `userSearch` | `string` | Carian pengguna |

### 3.2 Data Teringat (useMemo)

| Memo | Input | Output |
|------|-------|--------|
| `filteredUsers` | `users, userSearch` | Pengguna ditapis (nama, nama_pengguna, jawatan) |

### 3.3 Derived Values

| Pembolehubah | Pengiraan |
|-------------|-----------|
| `isAdmin` | `profile?.peranan === "Pentadbir"` |

---

## 4. Pemerolehan Data & API

### 4.1 Kueri React Query

| Kunci Kueri | Sumber | Tujuan | Syarat |
|-------------|--------|--------|--------|
| `["users"]` | `profiles` (Supabase) | Semua profil pengguna | `enabled: isAdmin` |
| `["reset-requests"]` | `password_reset_requests` (JOIN: profiles) | Semua permintaan reset | `enabled: isAdmin` |
| `[type]` ×3 | `item_categories / item_forms / supply_durations` | Data rujukan (dalam LookupManager) | Sentiasa |

### 4.2 API Routes

| Route | Kaedah | Tujuan | Digunakan Oleh |
|-------|--------|--------|---------------|
| `/api/create-user` | POST | Cipta pengguna baharu (auth + profile) | `addUserMutation` |
| `/api/reset-password` | POST | Set semula kata laluan ke "password123" | `resetPasswordMutation` |

### 4.3 Mutasi

| Mutasi | Operasi | API/Supabase |
|--------|---------|-------------|
| `addUserMutation` | Cipta pengguna | `POST /api/create-user` |
| `updateUserMutation` | Kemaskini profil + auth (jika nama_pengguna berubah) | `supabase.from("profiles").update()` + `supabase.auth.admin.updateUserById()` |
| `toggleActiveMutation` | Tukar status aktif | `supabase.from("profiles").update({ aktif })` |
| `resetPasswordMutation` | Reset kata laluan | `POST /api/reset-password` |
| `resolveRequestMutation` | Kemaskini status permintaan | `supabase.from("password_reset_requests").update()` |

**Dalam `LookupManager`:**
| Mutasi | Operasi |
|--------|---------|
| `addMutation` | INSERT ke jadual rujukan |
| `updateMutation` | UPDATE jadual rujukan |
| `deleteMutation` | DELETE dari jadual rujukan |

---

## 5. Aliran UX (User Experience)

### 5.1 Kawalan Akses

Pengguna bukan Pentadbir melihat mesej ringkas:
> "Anda tidak mempunyai akses ke halaman ini."

Semua kueri juga menggunakan `enabled: isAdmin` — data tidak diambil untuk bukan pentadbir.

### 5.2 Aliran Tambah Pengguna

```
Klik "Tambah Pengguna"
  → Dialog dibuka
  → Isi Nama*, Nama Pengguna*, Kata Laluan*, Jawatan, Peranan*
  → Nama & Jawatan auto-toTitleCase onBlur
  → Klik "Simpan"
  → POST /api/create-user (cipta auth user + profile)
  → Berjaya: toast + tutup dialog + invalidasi senarai
  → Gagal: toast dengan mesej ralat dari API
```

### 5.3 Aliran Kembangan Baris (Expandable Row)

```
Klik baris pengguna
  → Baris mengembang (animasi AnimatePresence: height + opacity)
  → ChevronDown berputar 180°
  → Latar baris bertukar ke #f0f0f0
  → Panel kembangan menunjukkan:
      - Maklumat terperinci (Nama Pengguna, Didaftarkan, Kemaskini)
      - Butang tindakan: Edit | Nyahaktif/Aktif | Reset Kata Laluan

Klik Edit:
  → Butang bertukar kepada borang 4 medan (animasi AnimatePresence mode="wait")
  → Isi perubahan
  → Simpan Perubahan / Batal

Klik Nyahaktif/Aktif:
  → Dialog pengesahan dengan amaran
  → Ya, Nyahaktifkan / Ya, Aktifkan

Klik Reset Kata Laluan:
  → Dialog pengesahan dengan amaran amber
  → Kata laluan akan menjadi "password123"
  → Ya, Set Semula

Klik baris lagi (atau baris lain):
  → Tutup kembangan semasa
  → Jika baris lain: buka kembangan baharu
```

### 5.4 Aliran Permintaan Reset

```
Tab "Permintaan Reset" menunjukkan:
  - Kad untuk setiap permintaan
  - Warna latar: amber (pending) / kelabu (selesai)
  - Badge: "Menunggu" (merah) / "Disahkan" / "Ditolak"

Untuk permintaan pending:
  → Klik "Sah & Reset":
      1. Tukar status ke "approved"
      2. Reset kata laluan ke "password123"
  → Klik "Tolak":
      1. Tukar status ke "rejected"
```

### 5.5 Aliran Pengurusan Rujukan (LookupManager)

```
Tab "Rujukan" menunjukkan 3 kad:
  - Kategori Item
  - Bentuk Dos
  - Durasi Bekalan

Setiap kad:
  → Jadual semua rekod
  → Butang "Tambah [Kategori/Bentuk/Durasi]"
      → Dialog dengan input + auto-toTitleCase
      → Enter untuk simpan
  → Setiap baris: Edit (sebaris) | Padam (dialog pengesahan)
      → Edit: input + Simpan/Batal, Enter/Escape
      → Padam: dialog dengan amaran
```

---

## 6. Reka Bentuk Visual

### 6.1 Palet Warna — Tema Cyan

| Elemen | Warna | Kegunaan |
|--------|-------|----------|
| Aksen cyan | `#06b6d4` / `#0891b2` | Ikon header, orb |
| Aksen biru | `#1877f2` | Butang Simpan, butang utama |
| Aksen amber | `#d97706` / `#f59e0b` | Reset kata laluan, ikon amaran |
| Aksen merah | `destructive` / `red-50/600/700` | Nyahaktif, padam, amaran |
| Aksen hijau | `emerald` | Aktifkan semula, pengesahan |
| Kelabu | `#65676b` / `#f0f0f0` / `#f8f8f8` | Teks sekunder, baris berselang, latar kembangan |
| Putih | `#ffffff` | Latar kad, baris ganjil |

### 6.2 Baris Berselang Warna

Jadual pengguna menggunakan corak jalur:
- Baris ganjil: `#ffffff`
- Baris genap: `#f8f8f8`
- Baris dikembangkan: `#f0f0f0`

### 6.3 Tipografi

| Elemen | Saiz | Berat | Warna |
|--------|------|-------|-------|
| Tajuk halaman | 22px | 700 | `#1c1e21` |
| Sarikata header | 13px | — | `#65676b` |
| Nama pengguna (jadual) | — | 500 (medium) | (default) |
| Nama pengguna (monospace) | 14px (text-sm) | — | (default, monospace) |
| Label maklumat | 14px (text-sm) | — | `muted-foreground` |
| Nilai maklumat | — | 500 (medium) | (default) |
| Tajuk dialog | — | (default) | (default) |
| Amaran teks | 14px (text-sm) / 12px (text-xs) | 600 / 400 | Merah / Amber / Hijau |

### 6.4 Ikon (25+ ikon)

`Users, UserPlus, ChevronDown, Edit, UserX, UserCheck, KeyRound, ShieldAlert, AlertTriangle, Lock, MailQuestion, BookOpen, Plus, Trash2, CheckCircle2, XCircle, RefreshCw, Package, Pill, CalendarDays, History, BellRing`

### 6.5 Dialog Pengesahan — Tiga Varian

| Dialog | Ikon | Warna Tema | Senarai Amaran |
|--------|------|------------|----------------|
| Nyahaktif | `ShieldAlert` | Amber → Merah | 3 item (tidak boleh log masuk, data kekal, boleh diaktifkan semula) |
| Aktifkan | `UserCheck` | Hijau | 2 item (boleh log masuk, data tidak berubah) |
| Reset Kata Laluan | `Lock` | Amber | 3 item (password123, dipaksa log masuk, tidak boleh dibatalkan) |

### 6.6 Animasi

| Elemen | Animasi |
|--------|---------|
| Chevron kembangan | Putaran 180° (0.1s) |
| Panel kembangan | `height: 0, opacity: 0 → auto, 1` (0.15s, AnimatePresence) |
| Edit form ↔ Butang tindakan | `opacity: 0, y: -3 → 1, 0` (0.15s, AnimatePresence mode="wait") |

---

## 7. Model Kebenaran

Halaman ini adalah **eksklusif untuk Pentadbir**. Tiada peranan lain boleh mengakses:

| Peranan | Akses? |
|---------|--------|
| Pentadbir | ✅ Penuh |
| Penjaga Stor | ❌ |
| Kakitangan Farmasi | ❌ |
| Kakitangan Klinik | ❌ |

Semakan `isAdmin = profile?.peranan === "Pentadbir"` mengawal kedua-dua UI dan pengambilan data.

### 7.1 Perlindungan Khas

- Butang "Reset Kata Laluan" tidak dipaparkan untuk pengguna dengan peranan "Pentadbir" — mencegah pentadbir merosakkan akaun sendiri atau rakan pentadbir secara tidak sengaja
- Syarat: `user.peranan !== "Pentadbir"`

---

## 8. Komponen LookupManager — Analisis Reka Bentuk

### 8.1 Corak Generik

`LookupManager` adalah contoh terbaik komponen generik dalam aplikasi ini. Ia menggunakan:

1. **Objek konfigurasi** (`LOOKUP_CONFIGS`) — Memetakan setiap jenis kepada tajuk, label, ikon, dan penerangan
2. **Kunci kueri dinamik** — `queryKey: [type]` — setiap jenis mempunyai cache berasingan
3. **Mesej dinamik** — Semua toast, label, dan penerangan menggunakan `config.label` untuk konsistensi

### 8.2 Pendekatan Edit Sebaris

Berbanding dengan halaman lain yang menggunakan dialog untuk mengedit, `LookupManager` menggunakan **edit sebaris dalam jadual**:
- Klik Edit → baris bertukar kepada input + butang Simpan/Batal
- Auto-fokus pada input
- Enter = Simpan, Escape = Batal
- Ini lebih pantas untuk data rujukan ringkas yang hanya mempunyai satu medan (`nama`)

### 8.3 Perbandingan dengan Halaman Lain

| Aspek | LookupManager | Dialog Tambah (halaman lain) |
|-------|--------------|-----------------------------|
| Edit | Sebaris (dalam jadual) | Dialog berasingan |
| Medan | 1 (nama) | 2-8 medan |
| Pintasan | Enter/Escape | Tiada (kecuali Dispen Pantas) |
| Padam | Dialog pengesahan | (tiada di kebanyakan halaman) |

---

## 9. Ciri-ciri Keselamatan & Reka Bentuk Teliti

### 9.1 Reset Kata Laluan

- Kata laluan diset semula ke nilai tetap `"password123"` — reka bentuk yang sengaja mudah untuk persekitaran klinik
- Mesej toast secara eksplisit menyatakan kata laluan baharu
- Dialog amaran menyatakan tindakan tidak boleh dibatalkan
- Hanya tersedia untuk pengguna bukan Pentadbir

### 9.2 Nyahaktif Pengguna

- Amaran eksplisit: "Pengguna tidak akan dapat log masuk" tetapi "Data akan kekal dalam pangkalan data"
- Boleh diterbalikkan: "Boleh diaktifkan semula bila-bila masa"
- Butang bertukar antara "Nyahaktif" (merah, ikon UserX) dan "Aktif" (default, ikon UserCheck)

### 9.3 Kelulusan Permintaan Reset

- Butang "Sah & Reset" melakukan dua tindakan sekaligus:
  1. Tukar status permintaan ke "approved"
  2. Reset kata laluan pengguna
- Ini menjimatkan satu langkah berbanding meluluskan dan mereset secara berasingan

---

## 10. Perbandingan Tab

| Aspek | Tab Pengguna | Tab Permintaan Reset | Tab Rujukan |
|-------|-------------|---------------------|-------------|
| Komponen | Table + Expandable Row | Kad senarai | LookupManager ×3 |
| CRUD | Tambah, Edit, Nyahaktif/Aktif, Reset | Sah & Reset, Tolak | Tambah, Edit, Padam |
| Carian | Ya (nama, nama_pengguna, jawatan) | Tiada | Tiada |
| Animasi | AnimatePresence (kembangan + edit) | Tiada | Dialog |
| Keadaan kosong | "Tiada pengguna didaftarkan." | "Tiada permintaan." | "Tiada [label] didaftarkan." |
| Data | `profiles` | `password_reset_requests` + `profiles` | `item_categories / item_forms / supply_durations` |

---

## 11. Prestasi & Pengoptimuman

| Aspek | Pendekatan |
|-------|------------|
| Kueri bersyarat | Semua kueri hanya dijalankan jika `isAdmin = true` |
| useMemo | `filteredUsers` diingati untuk mengelakkan penapisan semula |
| Edit sebaris | Tiada pembukaan/tutup dialog — lebih pantas untuk data ringkas |
| Invalidasi selektif | Setiap mutasi hanya menginvalidasikan kunci kueri yang berkaitan |
| Komponen generik | `LookupManager` menghapuskan pertindihan kod untuk 3 jadual |

---

## 12. Model Data Berkaitan

```
Pengurusan Pengguna:
  profiles (semua, isih: nama)
  POST /api/create-user
  POST /api/reset-password

Permintaan Reset:
  password_reset_requests (JOIN: profiles)
    status: pending | approved | rejected

Rujukan Sistem:
  item_categories
  item_forms
  supply_durations
```

---

## 13. Kekuatan & Amalan Baik

1. **Komponen generik `LookupManager`:** Satu komponen mengendalikan 3 jadual rujukan — mengurangkan pertindihan kod dengan ketara
2. **Corak konfigurasi:** `LOOKUP_CONFIGS` menyediakan semua metadata (tajuk, label, ikon) dalam satu tempat
3. **Edit sebaris dengan pintasan papan kekunci:** Enter untuk simpan, Escape untuk batal — sangat cekap
4. **AnimatePresence mode="wait":** Peralihan lancar antara mod lihat dan mod edit dalam panel kembangan
5. **Perlindungan Pentadbir:** Butang reset kata laluan disembunyikan untuk akaun Pentadbir
6. **Tiga dialog pengesahan berbeza:** Setiap satu dengan ikon, warna, dan senarai amaran yang sesuai
7. **Baris berselang warna:** Meningkatkan kebolehbacaan jadual
8. **Lencana pending count:** Tab "Permintaan Reset" menunjukkan bilangan permintaan yang belum selesai
9. **Tindakan bergabung "Sah & Reset":** Meluluskan dan mereset kata laluan dalam satu klik
10. **Pemisahan kebimbangan:** Halaman utama untuk pengguna + komponen berasingan untuk rujukan

---

## 14. Peluang Penambahbaikan

1. **Carian pengguna hanya di klien:** Jika terdapat ratusan pengguna, penapisan klien akan menjadi perlahan — boleh ditambah carian sisi pelayan
2. **Tiada pagination:** Semua pengguna dipaparkan dalam satu jadual — boleh menjadi panjang
3. **Kata laluan "password123" keras:** Nilai kata laluan lalai adalah tetap dan tidak selamat — boleh dijana secara rawak atau dibenarkan input tersuai
4. **Tiada pengesahan kekuatan kata laluan:** Dialog tambah pengguna tidak menguatkuasakan keperluan kerumitan kata laluan
5. **Edit nama_pengguna dalam `updateUserMutation`:** Kod cuba mengemas kini `auth.users` melalui `supabase.auth.admin.updateUserById` — tetapi dengan RLS dinyahaktifkan dan pengesahan tersuai, panggilan ini mungkin tidak berfungsi
6. **LookupManager tidak menyemak keizinan:** Walaupun hanya Pentadbir boleh mengakses halaman, komponen itu sendiri tidak mempunyai semakan kebenaran
7. **Tiada pengesahan rujukan sebelum padam:** Memadam kategori/bentuk/durasi boleh meninggalkan item dengan FK yang tergantung — tiada semakan sebelum padam
8. **Tiada log audit untuk tindakan pentadbir:** Tiada rekod siapa yang mencipta/mengedit/memadam pengguna atau data rujukan
9. **Tiada eksport:** Tiada keupayaan untuk mengeksport senarai pengguna atau permintaan reset
10. **Baris kembangan tidak menutup apabila mengklik baris yang sama:** Pengguna perlu mengklik baris yang sama sekali lagi (berfungsi seperti yang diharapkan, tetapi tiada penutupan automatik)