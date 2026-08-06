-- Store the light/dark theme preference per user.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tema TEXT NOT NULL DEFAULT 'light'
  CHECK (tema IN ('light', 'dark'));

COMMENT ON COLUMN profiles.tema IS 'Tema paparan pilihan pengguna';
