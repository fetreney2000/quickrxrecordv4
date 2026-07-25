-- ============================================================================
-- 004_custom_auth.sql
-- Pengesahan tersuai: kata_laluan_hash + fungsi update_password_hash
-- Tarikh: 26 Julai 2026
--
-- PERUBAHAN:
--   - Tambah lajur kata_laluan_hash pada profiles
--   - Cipta fungsi update_password_hash untuk pentadbir
-- ============================================================================

-- Tambah lajur kata_laluan_hash pada profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS kata_laluan_hash TEXT;

COMMENT ON COLUMN profiles.kata_laluan_hash IS
  'Hash kata laluan (bcrypt/argon2) — pengesahan dikendalikan di aplikasi';

-- ============================================================================
-- FUNGSI: update_password_hash
-- Digunakan oleh pentadbir untuk menetapkan semula kata laluan pengguna
-- ============================================================================

CREATE OR REPLACE FUNCTION update_password_hash(
  p_user_id UUID,
  p_new_hash TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID cannot be null';
  END IF;

  IF p_new_hash IS NULL OR length(p_new_hash) < 10 THEN
    RAISE EXCEPTION 'New password hash is invalid';
  END IF;

  UPDATE profiles
  SET kata_laluan_hash = p_new_hash,
      updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found', p_user_id;
  END IF;
END;
$$;

-- Grant akses
GRANT ALL ON FUNCTION update_password_hash TO anon, authenticated;

-- Tamat 004_custom_auth.sql
