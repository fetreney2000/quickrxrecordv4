-- ============================================================================
-- 018_inventory_ledger_baki.sql
-- Canonical inventory ledger with persisted running balance (baki)
-- Tarikh: 14 Ogos 2026
--
-- PERUBAHAN:
--   1. Tambah lajur `baki` pada inventory_transactions (baki stok item selepas pergerakan).
--   2. Longgarkan CHECK kuantiti kepada >= 0 agar pelupusan kelompok kosong boleh dijurnal.
--   3. Indeks susunan kronologi per item: (item_id, created_at, id).
--   4. RPC atomik dengan penguncian baris item (FOR UPDATE) untuk serialisasi:
--        - process_supply             (bekalan — dikemas kini dengan baki)
--        - process_batch_disposal     (pelupusan — sentiasa jurnal, termasuk kuantiti 0)
--        - record_batch_addition      (tambah stok / kelompok baharu)
--        - record_batch_adjustment    (pelarasan bukan pelupusan)
--   5. backfill_inventory_ledger() untuk mengisi baki mulai 2026-08-11.
--
-- SEMPADAN BAKI: 2026-08-11. Sebarang baris created_at < '2026-08-11' kekal `baki = NULL`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Lajur baki
-- ----------------------------------------------------------------------------
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS baki INTEGER;

-- ----------------------------------------------------------------------------
-- 2. Longgarkan CHECK kuantiti -> >= 0 (jurnal pelupusan kelompok kosong)
-- ----------------------------------------------------------------------------
ALTER TABLE inventory_transactions
  DROP CONSTRAINT IF EXISTS inventory_transactions_kuantiti_check;
ALTER TABLE inventory_transactions
  ADD CONSTRAINT inventory_transactions_kuantiti_check CHECK (kuantiti >= 0);

-- ----------------------------------------------------------------------------
-- 3. Indeks kronologi per item
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_inv_trans_item_time
  ON inventory_transactions(item_id, created_at, id);

-- Pergantungan pada fungsi baki; idempotent
CREATE OR REPLACE FUNCTION inventory_item_baki(v_item_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(kuantiti), 0)::INTEGER
  FROM item_batches
  WHERE item_id = v_item_id;
$$;

-- ============================================================================
-- 4. RPC ATOMIK
-- ============================================================================

-- ----------------------------------------------------------------------------
-- process_supply (bekalan atomik + baki)
-- Mengunci baris items (serialisasi per item), kurangkan stok kelompok,
-- cipta supply_records & inventory_transactions dengan baki baharu.
-- ----------------------------------------------------------------------------
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
  -- 1. Dapatkan item_id dari tugasan
  SELECT item_id INTO v_item_id
  FROM patient_item_assignments
  WHERE id = p_assignment_id;

  IF v_item_id IS NULL THEN
    RAISE EXCEPTION 'Assignment % not found', p_assignment_id;
  END IF;

  -- 2. Kunci baris item utk serialisasi per item
  PERFORM 1 FROM items WHERE id = v_item_id FOR UPDATE;

  -- 3. Kunci baris kelompok
  SELECT kuantiti INTO v_current_stock
  FROM item_batches
  WHERE id = p_batch_id
  FOR UPDATE;

  IF v_current_stock IS NULL THEN
    RAISE EXCEPTION 'Batch % not found', p_batch_id;
  END IF;

  -- 4. Sahkan stok mencukupi
  IF v_current_stock < p_kuantiti THEN
    RAISE EXCEPTION 'Stok tidak mencukupi. Baki: %, Diminta: %', v_current_stock, p_kuantiti;
  END IF;

  -- 5. Kurangkan stok
  UPDATE item_batches
  SET kuantiti = kuantiti - p_kuantiti,
      updated_at = now()
  WHERE id = p_batch_id;

  -- 6. Kira baki item selepas pergerakan (berdasarkan current %ubah)
  SELECT COALESCE(SUM(kuantiti), 0)::INTEGER INTO v_baki
  FROM item_batches WHERE item_id = v_item_id;

  -- 7. Cipta rekod bekalan
  INSERT INTO supply_records (
    assignment_id, dos, tempoh_dibekal, kuantiti,
    batch_id, kakitangan_pembekal, catatan_bekalan
  ) VALUES (
    p_assignment_id, p_dos, p_tempoh_dibekal, p_kuantiti,
    p_batch_id, p_kakitangan_pembekal, p_catatan_bekalan
  )
  RETURNING id INTO v_supply_id;

  -- 8. Cipta jurnal inventory_transactions (keluar) dengan baki
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

GRANT ALL ON FUNCTION process_supply(
  UUID, TEXT, TEXT, INTEGER, UUID, UUID, TEXT
) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- process_batch_disposal (pelupusan atomik + baki; sentiasa jurnal)
-- Menyokong pelupusan kelompok kosong (kuantiti 0) utk rekod audit penuh.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION process_batch_disposal(
  p_batch_id UUID,
  p_adjusted_by UUID DEFAULT NULL,
  p_reason TEXT DEFAULT 'Pelupusan Stok'
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
  SELECT * INTO v_batch FROM item_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Batch % not found', p_batch_id; END IF;
  IF v_batch.dilupuskan THEN RAISE EXCEPTION 'Kelompok telah dilupuskan.'; END IF;

  -- Serialisasi per item
  PERFORM 1 FROM items WHERE id = v_batch.item_id FOR UPDATE;

  -- Set stok kepada kosong & tandakan dilupuskan
  UPDATE item_batches SET kuantiti = 0, dilupuskan = true, dilupuskan_at = now()
  WHERE id = p_batch_id;

  -- Detail pelarasan (sentiasa, termasuk kuantiti 0)
  INSERT INTO batch_adjustments(batch_id, previous_kuantiti, new_kuantiti, change, reason, adjusted_by)
  VALUES (p_batch_id, v_batch.kuantiti, 0, -v_batch.kuantiti, p_reason, p_adjusted_by)
  RETURNING id INTO v_adjustment_id;

  -- Jurnal (sentiasa, termasuk kuantiti 0)
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

GRANT ALL ON FUNCTION process_batch_disposal(UUID, UUID, TEXT) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- record_batch_addition (tambah stok / kelompok baharu, atomik)
-- Upsert kelompok mengikut nombor_kelompok (tambah kuantiti jika wujud),
-- rakan kongsi logik useAddBatch.
-- ----------------------------------------------------------------------------
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
  IF p_kuantiti <= 0 THEN
    RAISE EXCEPTION 'Kuantiti mesti lebih daripada sifar.';
  END IF;

  -- Serialisasi per item
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
    -- Tambah stok ke kelompok sedia ada
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

GRANT ALL ON FUNCTION record_batch_addition(UUID, TEXT, DATE, INTEGER, UUID) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- record_batch_adjustment (pelarasan bukan pelupusan, atomik)
-- Menyokong pelarasan naik/turun ke kuantiti tertentu.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_batch_adjustment(
  p_batch_id UUID,
  p_new_kuantiti INTEGER,
  p_reason TEXT DEFAULT NULL,
  p_adjusted_by UUID DEFAULT NULL
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
  SELECT * INTO v_batch FROM item_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kelompok tidak dijumpai.'; END IF;
  IF v_batch.dilupuskan THEN
    RAISE EXCEPTION 'Kelompok ini telah dilupuskan dan tidak boleh diubah.';
  END IF;

  -- Serialisasi per item
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

  INSERT INTO batch_adjustments(batch_id, previous_kuantiti, new_kuantiti, change, reason, adjusted_by)
  VALUES (p_batch_id, v_batch.kuantiti, p_new_kuantiti, v_change, p_reason, p_adjusted_by)
  RETURNING id INTO v_adjustment_id;

  INSERT INTO inventory_transactions(
    item_id, batch_id, jenis, kuantiti, rujukan_id, rujukan_type, catatan, baki
  ) VALUES (
    v_batch.item_id, p_batch_id, v_jenis, v_abs_change,
    v_adjustment_id, 'adjustment', p_reason, inventory_item_baki(v_batch.item_id)
  );
END;
$$;

GRANT ALL ON FUNCTION record_batch_adjustment(UUID, INTEGER, TEXT, UUID) TO anon, authenticated;

-- ============================================================================
-- 5. BACKFILL — backfill_inventory_ledger()
-- ----------------------------------------------------------------------------
--  - Masukkan baris jurnal yang hilang utk batch_adjustments (rujukan_type
--    'adjustment') yang belum diwakili dalam inventory_transactions.
--  - Tetapkan baki = NULL utk semua baris created_at < '2026-08-11'.
--  - Utk baris >= '2026-08-11': kira baki berjalan per item, berpaut kepada
--    SUM(item_batches.kuantiti) semasa supaya baris terbaru == stok semasa.
--  - Jalankan SEKALI selepas deploy (bukan dalam migration secara automatik).
-- ============================================================================
CREATE OR REPLACE FUNCTION backfill_inventory_ledger()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item RECORD;
  v_tx RECORD;
  v_count INTEGER;
  v_offset BIGINT;
  v_running BIGINT;
  v_change INTEGER;
  v_jenis TEXT;
  v_item_id UUID;
  v_total_change BIGINT;
  v_current_stock BIGINT;
  v_prev_item UUID := NULL;
BEGIN
  -- (a0) Buang baris 'adjustment' yang tercipta pendua oleh backfill sebelum ini
  --      utk stok awal migrasi (yang diwakili oleh rujukan_type='migration_initial_stock').
  --      Menjadikan fungsi ini idempotent dan membersihkan data sedia ada.
  DELETE FROM inventory_transactions it
  WHERE it.rujukan_type = 'adjustment'
    AND it.catatan = 'Stok awal migrasi SRQ.db3'
    AND EXISTS (
      SELECT 1 FROM inventory_transactions it2
      WHERE it2.batch_id = it.batch_id
        AND it2.rujukan_type = 'migration_initial_stock'
    );

  -- (a) Masukkan jurnal yang hilang utk batch_adjustments bukan pelupusan
  --     Stok awal migrasi sudah wujud sebagai baris
  --     rujukan_type='migration_initial_stock' (rujukan_id = batch.id), jadi
  --     jangan cipta baris 'adjustment' pendua untuk batch_adjustments yang
  --     berkorespon dengannya.
  FOR v_item IN
    SELECT ba.id AS adjustment_id, ba.batch_id, ba.change, ba.previous_kuantiti,
           ba.new_kuantiti, ba.reason, ba.adjusted_by, ba.created_at,
           b.item_id, b.nombor_kelompok
    FROM batch_adjustments ba
    JOIN item_batches b ON b.id = ba.batch_id
    WHERE NOT EXISTS (
      SELECT 1 FROM inventory_transactions it
      WHERE it.rujukan_type IN ('adjustment', 'batch_disposal')
        AND it.rujukan_id = ba.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM inventory_transactions it2
      WHERE it2.batch_id = b.id
        AND it2.rujukan_type = 'migration_initial_stock'
    )
  LOOP
    v_change := ABS(v_item.change);
    v_jenis := CASE WHEN v_item.change > 0 THEN 'masuk' ELSE 'keluar' END;
    INSERT INTO inventory_transactions(
      item_id, batch_id, jenis, kuantiti, rujukan_id, rujukan_type, catatan, created_at
    ) VALUES (
      v_item.item_id, v_item.batch_id, v_jenis, v_change,
      v_item.adjustment_id, 'adjustment', v_item.reason, v_item.created_at
    );
  END LOOP;

  -- (b) Tetapkan baki = NULL utk baris sebelum sempadan
  UPDATE inventory_transactions SET baki = NULL
  WHERE created_at < '2026-08-11';

  -- (c) Kira baki berjalan per item utk baris >= sempadan
  FOR v_item IN
    SELECT DISTINCT item_id FROM inventory_transactions
    WHERE created_at >= '2026-08-11'
    ORDER BY item_id
  LOOP
    v_item_id := v_item.item_id;

    SELECT COALESCE(SUM(kuantiti), 0)::BIGINT INTO v_current_stock
    FROM item_batches WHERE item_id = v_item_id;

    SELECT COALESCE(SUM(
      CASE WHEN it.jenis = 'masuk' THEN it.kuantiti ELSE -it.kuantiti END
    ), 0)::BIGINT INTO v_total_change
    FROM inventory_transactions it
    WHERE it.item_id = v_item_id AND it.created_at >= '2026-08-11';

    v_offset := v_current_stock - v_total_change;
    v_running := v_offset;

    FOR v_tx IN
      SELECT id, jenis, kuantiti
      FROM inventory_transactions
      WHERE item_id = v_item_id AND created_at >= '2026-08-11'
      ORDER BY created_at ASC, id ASC
    LOOP
      IF v_tx.jenis = 'masuk' THEN
        v_running := v_running + v_tx.kuantiti;
      ELSE
        v_running := v_running - v_tx.kuantiti;
      END IF;
      IF v_running < 0 THEN v_running := 0; END IF;
      UPDATE inventory_transactions SET baki = v_running::INTEGER WHERE id = v_tx.id;
    END LOOP;
  END LOOP;
END;
$$;

GRANT ALL ON FUNCTION backfill_inventory_ledger() TO anon, authenticated;

-- Tamat 018_inventory_ledger_baki.sql