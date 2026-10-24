-- ============================================================================
-- 059_protect_last_admin.sql
--
-- Menutup HIGH-1 (audit pengguna): tiada pengawal terhadap nyahaktif /
-- penurunan peranan diri sendiri atau Pentadbir aktif TERAKHIR — satu klik
-- boleh mengunci seluruh sistem (tiada jalan pentadbir semula kecuali
-- akses DB langsung).
--
-- Mengukuhkan trg_profiles_protect (039 §3): selepas pengesahan peranan
-- Pentadbir, tolak sebarang peralihan yang akan meninggalkan sifar
-- Pentadbir aktif (peranan–>bukan-Pentadbir ATAU aktif true→false).
-- service_role / sesi tanpa JWT kekal sebagai jalan kecemasan (tidak
-- disekat — pemulihan memerlukan akses DB langsung).
-- ============================================================================

CREATE OR REPLACE FUNCTION profiles_protect_privileged()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claims JSONB;
  v_role TEXT;
  v_is_service BOOLEAN;
BEGIN
  IF (NEW.peranan IS NOT DISTINCT FROM OLD.peranan
      AND NEW.aktif IS NOT DISTINCT FROM OLD.aktif
      AND NEW.kata_laluan_hash IS NOT DISTINCT FROM OLD.kata_laluan_hash) THEN
    RETURN NEW;
  END IF;
  v_claims := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  v_is_service := (v_claims IS NULL OR v_claims->>'role' = 'service_role');
  IF v_is_service THEN
    -- Jalan kecemasan: SQL editor / service_role tidak disekat.
    RETURN NEW;
  END IF;
  SELECT peranan INTO v_role
  FROM profiles WHERE id = auth.uid() AND aktif = true;
  IF v_role IS DISTINCT FROM 'Pentadbir' THEN
    RAISE EXCEPTION 'Tiada kebenaran mengubah peranan/aktif/kata laluan pengguna'
      USING ERRCODE = '42501';
  END IF;
  -- Pentadbir disahkan — tetapi tidak boleh menghapuskan Pentadbir
  -- aktif yang terakhir (termasuk diri sendiri).
  IF (OLD.peranan = 'Pentadbir' AND COALESCE(OLD.aktif, false) IS TRUE)
     AND (NEW.peranan IS DISTINCT FROM 'Pentadbir'
          OR COALESCE(NEW.aktif, false) IS NOT TRUE) THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE peranan = 'Pentadbir'
        AND COALESCE(aktif, false) IS TRUE
        AND id <> OLD.id
    ) THEN
      RAISE EXCEPTION 'Operasi ditolak: sekurang-kurangnya seorang Pentadbir aktif mesti kekal. Minta Pentadbir lain membuat perubahan ini.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- PENGESAHAN SELEPAS MIGRASI (jalankan secara manual):
--   -- Cuba nyahaktifkan / menurunkan satu-satunya Pentadbir aktif → ERROR.
--   -- Dengan ≥2 Pentadbir aktif, operasi yang sama lulus seperti biasa.
--   -- service_role (SQL editor) kekal boleh (jalan kecemasan).
-- ============================================================================
