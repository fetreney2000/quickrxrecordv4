-- ============================================================================
-- 039_rbac_and_integrity.sql
-- RBAC server-side + sesi boleh ditarik balik + integriti kelompok↔item
-- (audit H3, H5, H6)
--
-- PERUBAHAN:
--   1. jadual auth_attempts — penombor percubaan login berasaskan DB
--   2. Fungsi bantuan: app_role(), app_session_ok(), app_require_role()
--      - app_role()       → peranan pengguna AKTIF semasa (auth.uid()) atau NULL
--      - app_session_ok() → sesi sah: aktif + pwv (sidik jari hash) sepadan
--                           dengan claim pwv dalam JWT — password change /
--                           deactivation menarik balik sesi serta-merta
--      - app_require_role() → RAISE 42501 jika peranan tidak dibenarkan
--   3. Ganti kebijakan blanket authenticated_all → kebijakan ikut kumpulan
--      peranan (sepadan dengan src/lib/permissions.ts):
--        - Klinik (lihat sahaja) TIADA akses tulis langsung
--        - Pentadbir/Penjaga Stor: kumpulan inventori
--        - +Kakitangan Farmasi: kumpulan klinikal
--   4. profiles: sekatan lajur (kata_laluan_hash tidak boleh dibaca/ditulis
--      klien) + trigger pelindung lajur peranan/aktif/kata_laluan_hash
--   5. Guard peranan + pemeriksaan kelompok↔item pada semua RPC tulisan
--
-- PELANCARAN: jalankan SELEPAS deploy kod 039 (pelanggan mesti mengeluarkan
-- JWT dengan claim pwv). Semua pengguna perlu log masuk semula sekali.
-- ============================================================================

-- ── 1. Jadual had laju percubaan auth (service_role sahaja) ────────────────
CREATE TABLE IF NOT EXISTS auth_attempts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_key_ts ON auth_attempts (key, ts);
ALTER TABLE auth_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all" ON auth_attempts;
REVOKE ALL ON auth_attempts FROM anon, authenticated;

-- ── 2. Fungsi bantuan sesi/peranan ─────────────────────────────────────────
-- Peranan pengguna AKTIF semasa; NULL jika tiada JWT/sub/akaun tidak aktif.
CREATE OR REPLACE FUNCTION app_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT peranan FROM profiles
  WHERE id = auth.uid() AND aktif = true;
$$;

-- Sesi sah: akaun aktif DAN claim pwv JWT sepadan dengan sidik jari hash
-- kata laluan semasa (left(md5(hash),16)). Menukar kata laluan atau
-- menyahaktifkan akaun serta-merta membatalkan semua token sedia ada.
CREATE OR REPLACE FUNCTION app_session_ok()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND aktif = true
      AND left(md5(kata_laluan_hash), 16) =
          (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb)->>'pwv'
  );
$$;

-- Guard RPC: benarkan konteks tanpa JWT (SQL editor) dan service_role;
-- selain itu wajib seorang pengguna aktif dalam senarai peranan dibenarkan.
CREATE OR REPLACE FUNCTION app_require_role(VARIADIC p_roles TEXT[])
RETURNS VOID
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claims JSONB;
  v_role TEXT;
BEGIN
  v_claims := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  IF v_claims IS NULL OR v_claims->>'role' = 'service_role' THEN
    RETURN;
  END IF;
  SELECT peranan INTO v_role
  FROM profiles WHERE id = auth.uid() AND aktif = true;
  IF v_role IS NULL OR NOT (v_role = ANY (p_roles)) THEN
    RAISE EXCEPTION 'Tiada kebenaran untuk tindakan ini' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION app_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_session_ok() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_require_role(TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_session_ok() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_require_role(TEXT[]) TO authenticated, service_role;

-- ── 3. Trigger pelindung lajur sensitif profiles ───────────────────────────
-- Menghalang perubahan peranan/aktif/kata_laluan_hash oleh sesiapa sahaja
-- selain Pentadbir (atau konteks service_role / SQL editor tanpa JWT).
CREATE OR REPLACE FUNCTION profiles_protect_privileged()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claims JSONB;
  v_role TEXT;
BEGIN
  IF (NEW.peranan IS NOT DISTINCT FROM OLD.peranan
      AND NEW.aktif IS NOT DISTINCT FROM OLD.aktif
      AND NEW.kata_laluan_hash IS NOT DISTINCT FROM OLD.kata_laluan_hash) THEN
    RETURN NEW;
  END IF;
  v_claims := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  IF v_claims IS NULL OR v_claims->>'role' = 'service_role' THEN
    RETURN NEW;
  END IF;
  SELECT peranan INTO v_role
  FROM profiles WHERE id = auth.uid() AND aktif = true;
  IF v_role = 'Pentadbir' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Tiada kebenaran mengubah peranan/aktif/kata laluan pengguna'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_protect ON profiles;
CREATE TRIGGER trg_profiles_protect
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_protect_privileged();

-- ── 4. Sekatan lajur profiles (H4: hash tidak boleh disentuh klien) ───────
REVOKE ALL ON profiles FROM authenticated;
GRANT SELECT (id, nama, jawatan, nama_pengguna, peranan, aktif,
              created_at, updated_at, tema)
  ON profiles TO authenticated;
GRANT UPDATE (nama, jawatan, nama_pengguna, peranan, aktif, tema, updated_at)
  ON profiles TO authenticated;
-- Nota: peranan/kekalk dalam UPDATE untuk UI pentadbir; trigger (atas)
-- menghalang perubahan oleh bukan-Pentadbir. kata_laluan_hash: service_role
-- (API pelayan) sahaja.

-- ── 5. Kumpulan kebijakan RLS ──────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  -- SELECT: mana-mana sesi sahaja (sepadan tingkah laku aplikasi hari ini)
  -- Nota: password_reset_requests TIDAK termasuk di sini — Pentadbir sahaja
  -- (polisi admin_only di bawah meliputi semua arahan termasuk SELECT).
  FOREACH t IN ARRAY ARRAY[
    'patients','patient_item_assignments','supply_records','dose_history',
    'supply_declinations','items','item_batches','batch_adjustments',
    'batch_additions','inventory_transactions','item_categories','item_forms',
    'supply_durations','profiles','staff_migration_lookup'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_all" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "sel_active" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "sel_active" ON public.%I FOR SELECT TO authenticated USING ((SELECT app_session_ok()))',
      t);
  END LOOP;

  -- Tulis kumpulan KLINIKAL: Pentadbir, Penjaga Stor, Kakitangan Farmasi
  FOREACH t IN ARRAY ARRAY[
    'patients','patient_item_assignments','supply_records','dose_history',
    'supply_declinations'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "wr_clinical" ON public.%I', t);
    EXECUTE format($p$
      CREATE POLICY "wr_clinical" ON public.%I FOR ALL TO authenticated
      USING ((SELECT app_role()) IN ('Pentadbir','Penjaga Stor','Kakitangan Farmasi'))
      WITH CHECK ((SELECT app_role()) IN ('Pentadbir','Penjaga Stor','Kakitangan Farmasi'))$p$,
      t);
  END LOOP;

  -- Tulis kumpulan INVENTORI: Pentadbir, Penjaga Stor sahaja
  FOREACH t IN ARRAY ARRAY[
    'items','item_batches','batch_adjustments','batch_additions',
    'inventory_transactions','item_categories','item_forms','supply_durations'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "wr_inventory" ON public.%I', t);
    EXECUTE format($p$
      CREATE POLICY "wr_inventory" ON public.%I FOR ALL TO authenticated
      USING ((SELECT app_role()) IN ('Pentadbir','Penjaga Stor'))
      WITH CHECK ((SELECT app_role()) IN ('Pentadbir','Penjaga Stor'))$p$,
      t);
  END LOOP;

  -- profiles: tulis baris sendiri ATAU pentadbir (lajur sensitif via trigger)
  DROP POLICY IF EXISTS "upd_own_or_admin" ON public.profiles;
  CREATE POLICY "upd_own_or_admin" ON public.profiles FOR UPDATE TO authenticated
    USING (id = auth.uid() OR (SELECT app_role()) = 'Pentadbir')
    WITH CHECK (id = auth.uid() OR (SELECT app_role()) = 'Pentadbir');
  -- profiles tiada polisi INSERT/DELETE → klien tidak boleh cipta/padam profil

  -- password_reset_requests: Pentadbir sahaja (baca + tulis)
  DROP POLICY IF EXISTS "admin_only" ON public.password_reset_requests;
  CREATE POLICY "admin_only" ON public.password_reset_requests FOR ALL TO authenticated
    USING ((SELECT app_role()) = 'Pentadbir')
    WITH CHECK ((SELECT app_role()) = 'Pentadbir');

  -- staff_migration_lookup: tiada polisi → dikunci daripada semua klien
END $$;

-- ── 6. Guard peranan pada RPC tulisan + integriti kelompok↔item ────────────

-- 6a. process_supply (018 — versi terkini, + guard + semak kelompok milik item)
CREATE OR REPLACE FUNCTION process_supply(
  p_assignment_id UUID,
  p_dos TEXT,
  p_tempoh_dibekal TEXT,
  p_kuantiti INTEGER,
  p_batch_id UUID,
  p_kakitangan_pembekal UUID,
  p_catatan_bekalan TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item_id UUID;
  v_current_stock INTEGER;
  v_supply_id UUID;
  v_baki INTEGER;
BEGIN
  PERFORM app_require_role('Pentadbir','Penjaga Stor','Kakitangan Farmasi');

  SELECT item_id INTO v_item_id
  FROM patient_item_assignments
  WHERE id = p_assignment_id;
  IF v_item_id IS NULL THEN
    RAISE EXCEPTION 'Assignment % not found', p_assignment_id;
  END IF;

  PERFORM 1 FROM items WHERE id = v_item_id FOR UPDATE;

  SELECT kuantiti INTO v_current_stock
  FROM item_batches
  WHERE id = p_batch_id AND item_id = v_item_id
  FOR UPDATE;
  IF v_current_stock IS NULL THEN
    RAISE EXCEPTION 'Kelompok % tidak dijumpai atau bukan milik item tugasan ini.', p_batch_id;
  END IF;

  IF v_current_stock < p_kuantiti THEN
    RAISE EXCEPTION 'Stok tidak mencukupi. Baki: %, Diminta: %', v_current_stock, p_kuantiti;
  END IF;

  UPDATE item_batches
  SET kuantiti = kuantiti - p_kuantiti, updated_at = now()
  WHERE id = p_batch_id;

  SELECT COALESCE(SUM(kuantiti), 0)::INTEGER INTO v_baki
  FROM item_batches WHERE item_id = v_item_id;

  INSERT INTO supply_records (
    assignment_id, dos, tempoh_dibekal, kuantiti,
    batch_id, kakitangan_pembekal, catatan_bekalan
  ) VALUES (
    p_assignment_id, p_dos, p_tempoh_dibekal, p_kuantiti,
    p_batch_id, p_kakitangan_pembekal, p_catatan_bekalan
  )
  RETURNING id INTO v_supply_id;

  INSERT INTO inventory_transactions (
    item_id, batch_id, jenis, kuantiti,
    rujukan_id, rujukan_type, catatan, baki
  ) VALUES (
    v_item_id, p_batch_id, 'keluar', p_kuantiti,
    v_supply_id, 'supply', p_catatan_bekalan, v_baki
  );

  RETURN v_supply_id;
END;
$$;

-- 6b. process_supply_multi (021 — + guard + semak kelompok milik item)
CREATE OR REPLACE FUNCTION process_supply_multi(
  p_assignment_id UUID,
  p_dos TEXT,
  p_tempoh_dibekal TEXT,
  p_allocations JSONB,
  p_kakitangan_pembekal UUID,
  p_catatan_bekalan TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item_id UUID;
  v_supply_id UUID;
  v_first_supply_id UUID := NULL;
  v_elem JSONB;
  v_batch_id UUID;
  v_batch_qty INTEGER;
  v_current_stock INTEGER;
  v_baki INTEGER;
BEGIN
  PERFORM app_require_role('Pentadbir','Penjaga Stor','Kakitangan Farmasi');

  SELECT item_id INTO v_item_id
  FROM patient_item_assignments
  WHERE id = p_assignment_id;
  IF v_item_id IS NULL THEN
    RAISE EXCEPTION 'Assignment % not found', p_assignment_id;
  END IF;

  PERFORM 1 FROM items WHERE id = v_item_id FOR UPDATE;

  FOR v_elem IN SELECT jsonb_array_elements(p_allocations)
  LOOP
    v_batch_id := (v_elem->>'batch_id')::UUID;
    v_batch_qty := (v_elem->>'kuantiti')::INTEGER;

    IF v_batch_qty <= 0 THEN
      RAISE EXCEPTION 'Kuantiti mestilah lebih daripada sifar untuk kelompok %', v_batch_id;
    END IF;

    SELECT kuantiti INTO v_current_stock
    FROM item_batches
    WHERE id = v_batch_id AND item_id = v_item_id
    FOR UPDATE;
    IF v_current_stock IS NULL THEN
      RAISE EXCEPTION 'Kelompok % tidak dijumpai atau bukan milik item tugasan ini.', v_batch_id;
    END IF;

    IF EXISTS (SELECT 1 FROM item_batches WHERE id = v_batch_id AND dilupuskan = true) THEN
      RAISE EXCEPTION 'Kelompok % telah dilupuskan.', v_batch_id;
    END IF;

    IF v_current_stock < v_batch_qty THEN
      RAISE EXCEPTION 'Stok tidak mencukupi untuk kelompok %. Baki: %, Diminta: %', v_batch_id, v_current_stock, v_batch_qty;
    END IF;

    UPDATE item_batches
    SET kuantiti = kuantiti - v_batch_qty, updated_at = now()
    WHERE id = v_batch_id;

    SELECT COALESCE(SUM(kuantiti), 0)::INTEGER INTO v_baki
    FROM item_batches WHERE item_id = v_item_id;

    INSERT INTO supply_records (
      assignment_id, dos, tempoh_dibekal, kuantiti,
      batch_id, kakitangan_pembekal, catatan_bekalan
    ) VALUES (
      p_assignment_id, p_dos, p_tempoh_dibekal, v_batch_qty,
      v_batch_id, p_kakitangan_pembekal, p_catatan_bekalan
    )
    RETURNING id INTO v_supply_id;

    IF v_first_supply_id IS NULL THEN
      v_first_supply_id := v_supply_id;
    END IF;

    INSERT INTO inventory_transactions (
      item_id, batch_id, jenis, kuantiti,
      rujukan_id, rujukan_type, catatan, baki
    ) VALUES (
      v_item_id, v_batch_id, 'keluar', v_batch_qty,
      v_supply_id, 'supply', p_catatan_bekalan, v_baki
    );
  END LOOP;

  IF v_first_supply_id IS NULL THEN
    RAISE EXCEPTION 'Tiada alokasi diproses.';
  END IF;

  RETURN v_first_supply_id;
END;
$$;

-- 6c. update_supply (023 + guard)
CREATE OR REPLACE FUNCTION update_supply(
  p_supply_id UUID,
  p_dos TEXT,
  p_kuantiti INTEGER,
  p_tempoh_dibekal TEXT,
  p_catatan_bekalan TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supply RECORD;
  v_item_id UUID;
  v_diff INTEGER;
  v_baki INTEGER;
BEGIN
  PERFORM app_require_role('Pentadbir','Penjaga Stor','Kakitangan Farmasi');

  SELECT sr.*, pia.item_id INTO v_supply
  FROM supply_records sr
  JOIN patient_item_assignments pia ON pia.id = sr.assignment_id
  WHERE sr.id = p_supply_id AND sr.voided_at IS NULL;

  IF v_supply IS NULL THEN
    RAISE EXCEPTION 'Rekod bekalan % tidak dijumpai atau telah dibatalkan.', p_supply_id;
  END IF;

  v_item_id := v_supply.item_id;
  v_diff := p_kuantiti - v_supply.kuantiti;

  IF v_diff = 0 THEN
    UPDATE supply_records
    SET dos = p_dos,
        tempoh_dibekal = p_tempoh_dibekal,
        catatan_bekalan = p_catatan_bekalan
    WHERE id = p_supply_id;
    RETURN;
  END IF;

  PERFORM 1 FROM items WHERE id = v_item_id FOR UPDATE;
  PERFORM 1 FROM item_batches WHERE id = v_supply.batch_id FOR UPDATE;

  IF v_diff > 0 THEN
    IF (SELECT kuantiti FROM item_batches WHERE id = v_supply.batch_id) < v_diff THEN
      RAISE EXCEPTION 'Stok tidak mencukupi untuk menambah % unit.', v_diff;
    END IF;
  END IF;

  UPDATE item_batches
  SET kuantiti = kuantiti - v_diff, updated_at = now()
  WHERE id = v_supply.batch_id;

  SELECT COALESCE(SUM(kuantiti), 0)::INTEGER INTO v_baki
  FROM item_batches WHERE item_id = v_item_id;

  INSERT INTO inventory_transactions (
    item_id, batch_id, jenis, kuantiti,
    rujukan_id, rujukan_type, catatan, baki
  ) VALUES (
    v_item_id, v_supply.batch_id,
    CASE WHEN v_diff < 0 THEN 'masuk' ELSE 'keluar' END,
    ABS(v_diff),
    p_supply_id, 'supply_adjustment',
    COALESCE(p_catatan_bekalan, 'Pelarasan kuantiti bekalan'),
    v_baki
  );

  UPDATE supply_records
  SET dos = p_dos,
      kuantiti = p_kuantiti,
      tempoh_dibekal = p_tempoh_dibekal,
      catatan_bekalan = p_catatan_bekalan
  WHERE id = p_supply_id;
END;
$$;

-- 6d. reverse_supply (022 + guard)
CREATE OR REPLACE FUNCTION reverse_supply(
  p_supply_id UUID,
  p_catatan TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supply RECORD;
  v_item_id UUID;
  v_baki INTEGER;
BEGIN
  PERFORM app_require_role('Pentadbir','Penjaga Stor','Kakitangan Farmasi');

  SELECT sr.*, pia.item_id INTO v_supply
  FROM supply_records sr
  JOIN patient_item_assignments pia ON pia.id = sr.assignment_id
  WHERE sr.id = p_supply_id AND sr.voided_at IS NULL;

  IF v_supply IS NULL THEN
    RAISE EXCEPTION 'Rekod bekalan % tidak dijumpai atau telah dibatalkan.', p_supply_id;
  END IF;

  v_item_id := v_supply.item_id;

  PERFORM 1 FROM items WHERE id = v_item_id FOR UPDATE;

  UPDATE item_batches
  SET kuantiti = kuantiti + v_supply.kuantiti, updated_at = now()
  WHERE id = v_supply.batch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kelompok % tidak dijumpai.', v_supply.batch_id;
  END IF;

  SELECT COALESCE(SUM(kuantiti), 0)::INTEGER INTO v_baki
  FROM item_batches WHERE item_id = v_item_id;

  INSERT INTO inventory_transactions (
    item_id, batch_id, jenis, kuantiti,
    rujukan_id, rujukan_type, catatan, baki
  ) VALUES (
    v_item_id, v_supply.batch_id, 'masuk', v_supply.kuantiti,
    p_supply_id, 'supply_reversal',
    COALESCE(p_catatan, 'Pembatalan bekalan'),
    v_baki
  );

  UPDATE supply_records SET voided_at = now() WHERE id = p_supply_id;
END;
$$;

-- 6e. add_assignment_with_dose (028 + guard; SECURITY INVOKER — RLS klinikal
--     turut terpakai)
CREATE OR REPLACE FUNCTION add_assignment_with_dose(
  p_patient_id UUID,
  p_item_id UUID,
  p_dos TEXT,
  p_catatan_penggunaan TEXT DEFAULT NULL,
  p_dimulakan_oleh UUID DEFAULT NULL,
  p_kakitangan_farmasi_perekod UUID DEFAULT NULL,
  p_dose_catatan TEXT DEFAULT 'Bekalan kali pertama',
  p_tarikh_dose TIMESTAMPTZ DEFAULT now()
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE v_id UUID;
BEGIN
  PERFORM app_require_role('Pentadbir','Penjaga Stor','Kakitangan Farmasi');

  INSERT INTO patient_item_assignments (
    patient_id, item_id, dos, catatan_penggunaan,
    tarikh_mula_guna, aktif, dimulakan_oleh, kakitangan_farmasi_perekod
  ) VALUES (
    p_patient_id, p_item_id, p_dos, p_catatan_penggunaan,
    CURRENT_DATE, true, p_dimulakan_oleh, p_kakitangan_farmasi_perekod
  ) RETURNING id INTO v_id;

  IF p_dos IS NOT NULL AND p_dos != '' THEN
    INSERT INTO dose_history (assignment_id, tarikh, dos, aktif, catatan, dikemaskini_oleh)
    VALUES (v_id, p_tarikh_dose, p_dos, true, p_dose_catatan, p_dimulakan_oleh);
  END IF;

  RETURN v_id;
END; $$;

-- 6f. update_dose_with_history (029 + guard; SECURITY INVOKER)
CREATE OR REPLACE FUNCTION update_dose_with_history(
  p_assignment_id UUID,
  p_dos TEXT,
  p_catatan TEXT DEFAULT NULL,
  p_dikemaskini_oleh UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM app_require_role('Pentadbir','Penjaga Stor','Kakitangan Farmasi');

  UPDATE patient_item_assignments SET dos = p_dos WHERE id = p_assignment_id;
  INSERT INTO dose_history (assignment_id, tarikh, dos, aktif, catatan, dikemaskini_oleh)
  VALUES (p_assignment_id, now(), p_dos, true, p_catatan, p_dikemaskini_oleh);
END; $$;

-- 6g. process_batch_disposal (020 — versi 4-parameter terkini + guard)
CREATE OR REPLACE FUNCTION process_batch_disposal(
  p_batch_id UUID,
  p_adjusted_by UUID DEFAULT NULL,
  p_reason TEXT DEFAULT 'Pelupusan Stok',
  p_catatan TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch item_batches%ROWTYPE;
  v_adjustment_id UUID;
  v_baki INTEGER;
BEGIN
  PERFORM app_require_role('Pentadbir','Penjaga Stor');

  SELECT * INTO v_batch FROM item_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Batch % not found', p_batch_id; END IF;
  IF v_batch.dilupuskan THEN RAISE EXCEPTION 'Kelompok telah dilupuskan.'; END IF;

  PERFORM 1 FROM items WHERE id = v_batch.item_id FOR UPDATE;

  UPDATE item_batches SET kuantiti = 0, dilupuskan = true, dilupuskan_at = now()
  WHERE id = p_batch_id;

  INSERT INTO batch_adjustments(
    batch_id, previous_kuantiti, new_kuantiti, change, reason, adjusted_by, catatan
  )
  VALUES (
    p_batch_id, v_batch.kuantiti, 0, -v_batch.kuantiti, p_reason, p_adjusted_by, p_catatan
  )
  RETURNING id INTO v_adjustment_id;

  SELECT COALESCE(SUM(kuantiti), 0)::INTEGER INTO v_baki
  FROM item_batches WHERE item_id = v_batch.item_id;

  INSERT INTO inventory_transactions(
    item_id, batch_id, jenis, kuantiti, rujukan_id, rujukan_type, catatan, baki
  ) VALUES (
    v_batch.item_id, p_batch_id, 'keluar', v_batch.kuantiti,
    v_adjustment_id, 'batch_disposal', p_reason, v_baki
  );
END;
$$;

-- 6h. record_batch_adjustment (020 — versi 5-parameter terkini + guard)
CREATE OR REPLACE FUNCTION record_batch_adjustment(
  p_batch_id UUID,
  p_new_kuantiti INTEGER,
  p_reason TEXT DEFAULT NULL,
  p_adjusted_by UUID DEFAULT NULL,
  p_catatan TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch item_batches%ROWTYPE;
  v_adjustment_id UUID;
  v_change INTEGER;
  v_jenis TEXT;
  v_abs_change INTEGER;
BEGIN
  PERFORM app_require_role('Pentadbir','Penjaga Stor');

  SELECT * INTO v_batch FROM item_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kelompok tidak dijumpai.'; END IF;
  IF v_batch.dilupuskan THEN
    RAISE EXCEPTION 'Kelompok ini telah dilupuskan dan tidak boleh diubah.';
  END IF;

  PERFORM 1 FROM items WHERE id = v_batch.item_id FOR UPDATE;

  IF p_new_kuantiti < 0 THEN
    RAISE EXCEPTION 'Kuantiti tidak boleh negatif.';
  END IF;

  v_change := p_new_kuantiti - v_batch.kuantiti;
  IF v_change = 0 THEN
    RAISE EXCEPTION 'Tiada perubahan pada kuantiti.';
  END IF;

  UPDATE item_batches SET kuantiti = p_new_kuantiti, updated_at = now() WHERE id = p_batch_id;

  v_abs_change := ABS(v_change);
  v_jenis := CASE WHEN v_change > 0 THEN 'masuk' ELSE 'keluar' END;

  INSERT INTO batch_adjustments(
    batch_id, previous_kuantiti, new_kuantiti, change, reason, adjusted_by, catatan
  )
  VALUES (
    p_batch_id, v_batch.kuantiti, p_new_kuantiti, v_change, p_reason, p_adjusted_by, p_catatan
  )
  RETURNING id INTO v_adjustment_id;

  INSERT INTO inventory_transactions(
    item_id, batch_id, jenis, kuantiti, rujukan_id, rujukan_type, catatan, baki
  ) VALUES (
    v_batch.item_id, p_batch_id, v_jenis, v_abs_change,
    v_adjustment_id, 'adjustment', p_reason, inventory_item_baki(v_batch.item_id)
  );
END;
$$;

-- 6i. record_batch_addition (018 + guard)
CREATE OR REPLACE FUNCTION record_batch_addition(
  p_item_id UUID,
  p_nombor_kelompok TEXT,
  p_tarikh_luput DATE,
  p_kuantiti INTEGER,
  p_added_by UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing RECORD;
  v_batch_id UUID;
  v_addition_id UUID;
  v_nama_uppercase TEXT;
BEGIN
  PERFORM app_require_role('Pentadbir','Penjaga Stor');

  IF p_kuantiti <= 0 THEN
    RAISE EXCEPTION 'Kuantiti mesti lebih daripada sifar.';
  END IF;

  PERFORM 1 FROM items WHERE id = p_item_id FOR UPDATE;

  v_nama_uppercase := UPPER(p_nombor_kelompok);

  SELECT * INTO v_existing
  FROM item_batches
  WHERE item_id = p_item_id AND UPPER(nombor_kelompok) = v_nama_uppercase
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.dilupuskan THEN
      RAISE EXCEPTION 'Kelompok ini telah dilupuskan dan tidak boleh digunakan semula.';
    END IF;
    v_batch_id := v_existing.id;
    UPDATE item_batches
    SET kuantiti = kuantiti + p_kuantiti, tarikh_luput = p_tarikh_luput, updated_at = now()
    WHERE id = v_batch_id;
  ELSE
    INSERT INTO item_batches(item_id, nombor_kelompok, tarikh_luput, kuantiti)
    VALUES (p_item_id, UPPER(p_nombor_kelompok), p_tarikh_luput, p_kuantiti)
    RETURNING id INTO v_batch_id;
  END IF;

  INSERT INTO batch_additions(batch_id, quantity, added_by)
  VALUES (v_batch_id, p_kuantiti, p_added_by)
  RETURNING id INTO v_addition_id;

  INSERT INTO inventory_transactions(
    item_id, batch_id, jenis, kuantiti, rujukan_id, rujukan_type, catatan, baki
  ) VALUES (
    p_item_id, v_batch_id, 'masuk', p_kuantiti,
    v_addition_id, 'batch_addition',
    CASE WHEN v_existing.id IS NOT NULL THEN 'Tambah stok ke kelompok sedia ada' ELSE 'Kelompok baharu' END,
    inventory_item_baki(p_item_id)
  );
END;
$$;

-- 6j. delete_item (019 — versi 2-parameter terkini + guard)
CREATE OR REPLACE FUNCTION delete_item(p_item_id UUID, p_deleted_by UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_used INTEGER;
  cur_batch RECORD;
  v_sebab TEXT := 'Item dinyahaktifkan / dikeluarkan dari inventori';
BEGIN
  PERFORM app_require_role('Pentadbir','Penjaga Stor');

  SELECT COUNT(*) INTO v_used
  FROM patient_item_assignments
  WHERE item_id = p_item_id;

  IF v_used > 0 THEN
    UPDATE items SET aktif = false WHERE id = p_item_id;

    UPDATE patient_item_assignments
    SET aktif = false,
        tarikh_tamat_guna = CURRENT_DATE,
        sebab_tamat = v_sebab,
        ditamatkan_oleh = p_deleted_by
    WHERE item_id = p_item_id
      AND aktif = true;

    FOR cur_batch IN
      SELECT id FROM item_batches
      WHERE item_id = p_item_id AND dilupuskan = false
    LOOP
      PERFORM process_batch_disposal(cur_batch.id, p_deleted_by, v_sebab);
    END LOOP;

    RETURN 'deactivated';
  ELSE
    DELETE FROM items WHERE id = p_item_id;
    RETURN 'deleted';
  END IF;
END;
$$;

-- 6k. merge_patients (013 — kedua-dua beban + guard pada beban utama)
CREATE OR REPLACE FUNCTION merge_patients(
  p_primary_id UUID,
  p_secondary_ids UUID[],
  p_merge_date DATE DEFAULT CURRENT_DATE,
  p_merged_by UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secondary_id UUID;
  v_duplicate_assignment RECORD;
  v_primary_assignment_id UUID;
BEGIN
  PERFORM app_require_role('Pentadbir','Penjaga Stor','Kakitangan Farmasi');

  IF p_primary_id IS NULL THEN
    RAISE EXCEPTION 'Primary patient ID cannot be null';
  END IF;
  IF p_secondary_ids IS NULL OR cardinality(p_secondary_ids) = 0 THEN
    RAISE EXCEPTION 'Secondary IDs cannot be null or empty';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM patients
    WHERE id = p_primary_id AND merged_into IS NULL
  ) THEN
    RAISE EXCEPTION 'Primary patient % not found or already merged', p_primary_id;
  END IF;

  PERFORM 1 FROM patients WHERE id = p_primary_id FOR UPDATE;

  FOREACH v_secondary_id IN ARRAY p_secondary_ids LOOP
    IF v_secondary_id IS NULL OR v_secondary_id = p_primary_id THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM patients
      WHERE id = v_secondary_id AND merged_into IS NULL
    ) THEN
      RAISE EXCEPTION 'Secondary patient % not found or already merged', v_secondary_id;
    END IF;

    PERFORM 1 FROM patients WHERE id = v_secondary_id FOR UPDATE;

    FOR v_duplicate_assignment IN
      SELECT *
      FROM patient_item_assignments
      WHERE patient_id = v_secondary_id
      ORDER BY created_at, id
      FOR UPDATE
    LOOP
      SELECT id INTO v_primary_assignment_id
      FROM patient_item_assignments
      WHERE patient_id = p_primary_id
        AND item_id = v_duplicate_assignment.item_id
        AND aktif = true
      ORDER BY created_at, id
      LIMIT 1
      FOR UPDATE;

      IF v_primary_assignment_id IS NOT NULL THEN
        UPDATE dose_history
        SET assignment_id = v_primary_assignment_id
        WHERE assignment_id = v_duplicate_assignment.id;

        UPDATE supply_records
        SET assignment_id = v_primary_assignment_id
        WHERE assignment_id = v_duplicate_assignment.id;

        UPDATE patient_item_assignments
        SET aktif = false,
            tarikh_tamat_guna = COALESCE(p_merge_date, CURRENT_DATE),
            sebab_tamat = 'Digabungkan ke pesakit lain',
            ditamatkan_oleh = p_merged_by
        WHERE id = v_duplicate_assignment.id;
      ELSE
        UPDATE patient_item_assignments
        SET patient_id = p_primary_id
        WHERE id = v_duplicate_assignment.id;
      END IF;
    END LOOP;

    UPDATE patients
    SET merged_into = p_primary_id,
        aktif = false,
        updated_at = now()
    WHERE id = v_secondary_id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION merge_patients(
  p_primary_id UUID,
  p_secondary_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM merge_patients(p_primary_id, p_secondary_ids, CURRENT_DATE, NULL);
END;
$$;

-- ── 7. Grant/Revoke eksplisit (idempoten; lalai PUBLIC pada fungsi baharu) ─
DO $$
DECLARE f RECORD;
BEGIN
  FOR f IN SELECT DISTINCT ON (p.proname, pg_get_function_identity_arguments(p.oid))
             p.proname, pg_get_function_identity_arguments(p.oid) AS args
           FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public'
             AND p.proname IN (
               'process_supply','process_supply_multi','update_supply',
               'reverse_supply','add_assignment_with_dose',
               'update_dose_with_history','process_batch_disposal',
               'record_batch_adjustment','record_batch_addition',
               'delete_item','merge_patients','inventory_item_baki'
             )
           ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s(%s) FROM PUBLIC, anon', f.proname, f.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s(%s) TO authenticated, service_role', f.proname, f.args);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- PENGESAHAN SELEPAS MIGRASI (jalankan secara manual):
--   -- 1. anon disekat sepenuhnya:
--   SET ROLE anon; SELECT count(*) FROM patients; RESET ROLE;
--   -- 2. hash tidak boleh dibaca klien (selepas login sbToken pwv):
--   --    dari konsol browser dgn sbToken: supabase.from('profiles').select('*')
--   --    → mesej permission denied for column kata_laluan_hash
--   -- 3. Kakitangan Klinik (klinikal): INSERT supply_records → 42501
--   -- 4. Eskalasi diri: UPDATE profiles SET peranan='Pentadbir'
--   --    WHERE id = auth.uid() (sbToken bukan pentadbir) → trigger 42501
--   -- 5. Integriti: process_supply dgn p_batch_id milik item lain → exception
--   -- 6. Selepas tukar kata laluan: tab lama → RLS tolak; /api/session → null
-- ============================================================================
