# Supabase Edge Functions

Edge Functions untuk kegunaan dalam produksi. Untuk pembangunan tempatan,
Gunakan mock API dalam `vite/api-mock.ts`.

## Fungsi yang Tersedia

| Fungsi | Path | Kaedah | Tujuan |
|--------|------|--------|--------|
| `login` | `/functions/v1/login` | POST | Pengesahan tersuai |
| `session` | `/functions/v1/session` | GET | Dapatkan profil semasa |
| `session-delete` | `/functions/v1/session` | DELETE | Log keluar |
| `reset-request` | `/functions/v1/reset-request` | POST | Permintaan reset kata laluan |

## Persekitaran (Environment Variables)

Sebelum deploy, pastikan:

```bash
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

> ⚠️ Jangan tetapkan `SUPABASE_ANON_KEY` di sini — edge functions mesti
> menggunakan service role key untuk akses pentadbir.

## Deploy

```bash
# Login ke Supabase
supabase login

# Paut projek
supabase link --project-ref your-project-ref

# Deploy semua fungsi
supabase functions deploy

# Atau deploy satu-satu
supabase functions deploy login
supabase functions deploy session
supabase functions deploy reset-request
```

## Konfigurasi Client

Untuk kegunaan dalam produksi, kemas kini `auth-store.ts` untuk
menggunakan `supabase.functions.invoke()` bukan `fetch`:

```typescript
const { data, error } = await supabase.functions.invoke("login", {
  body: { nama_pengguna, kata_laluan },
});
```

## Pembangunan Tempatan

Dalam pembangunan, mock API di `vite/api-mock.ts` akan mengendalikan
permintaan ke `/api/*`. Mock ini menyokong bcryptjs (jika hash disimpan
dengan bcrypt) atau perbandingan plaintext (untuk ujian sahaja).

## Konvensyen Respons

Semua fungsi mengembalikan JSON dalam format:
```json
{
  "profile": { /* ... Profile object */ },
  "token": "uuid-string",
  "error": "Ralat message (jika ada)"
}
```

Status kod HTTP:
- 200: Berjaya
- 400: Input tidak sah
- 401: Tidak disahkan (nama pengguna/kata laluan salah)
- 403: Tidak dibenarkan
- 404: Tidak dijumpai
- 409: Konflik (cth. permintaan reset pendua)
- 500: Ralat pelayan
- 503: Perkhidmatan tidak tersedia (Supabase tidak dikonfigurasi)
