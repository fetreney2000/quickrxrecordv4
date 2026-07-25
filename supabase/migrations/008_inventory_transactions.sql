-- ============================================================================
-- 008_inventory_transactions.sql
-- Jejak audit pergerakan stok (masuk/keluar)
-- Tarikh: 26 Julai 2026
--
-- JADUAL:
--   14. inventory_transactions
--
-- FUNGSI (v2 — digantikan dalam 010):
--   - process_supply v2 (mencipta rekod inventory_transactions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES item_batches(id) ON DELETE SET NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('masuk', 'keluar')),
  kuantiti INTEGER NOT NULL CHECK (kuantiti > 0),
  rujukan_id UUID,
  rujukan_type TEXT,
  catatan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_trans_item ON inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_inv_trans_batch ON inventory_transactions(batch_id);
CREATE INDEX IF NOT EXISTS idx_inv_trans_created ON inventory_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_trans_jenis ON inventory_transactions(jenis);
CREATE INDEX IF NOT EXISTS idx_inv_trans_rujukan ON inventory_transactions(rujukan_id, rujukan_type);

-- RLS disable
ALTER TABLE inventory_transactions DISABLE ROW LEVEL SECURITY;

-- Grant akses
GRANT ALL ON inventory_transactions TO anon, authenticated;

-- ============================================================================
-- FUNGSI: process_supply (VERSI 2) — ditambah integrasi inventory_transactions
-- DITIMPA oleh 010_remove_dose_history_from_supply.sql
-- ============================================================================

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
BEGIN
  -- 1. Dapatkan item_id dari tugasan
  SELECT item_id INTO v_item_id
  FROM patient_item_assignments
  WHERE id = p_assignment_id;

  IF v_item_id IS NULL THEN
    RAISE EXCEPTION 'Assignment % not found', p_assignment_id;
  END IF;

  -- 2. Kunci baris kelompok
  SELECT kuantiti INTO v_current_stock
  FROM item_batches
  WHERE id = p_batch_id
  FOR UPDATE;

  IF v_current_stock IS NULL THEN
    RAISE EXCEPTION 'Batch % not found', p_batch_id;
  END IF;

  -- 3. Sahkan stok mencukupi
  IF v_current_stock < p_kuantiti THEN
    RAISE EXCEPTION 'Stok tidak mencukupi. Baki: %, Diminta: %', v_current_stock, p_kuantiti;
  END IF;

  -- 4. Kurangkan stok kelompok
  UPDATE item_batches
  SET kuantiti = kuantiti - p_kuantiti,
      updated_at = now()
  WHERE id = p_batch_id;

  -- 5. Cipta rekod bekalan
  INSERT INTO supply_records (
    assignment_id, dos, tempoh_dibekal, kuantiti,
    batch_id, kakitangan_pembekal, catatan_bekalan
  ) VALUES (
    p_assignment_id, p_dos, p_tempoh_dibekal, p_kuantiti,
    p_batch_id, p_kakitangan_pembekal, p_catatan_bekalan
  )
  RETURNING id INTO v_supply_id;

  -- 6. Cipta rekod inventory_transactions (jenis='keluar')
  INSERT INTO inventory_transactions (
    item_id, batch_id, jenis, kuantiti,
    rujukan_id, rujukan_type, catatan
  ) VALUES (
    v_item_id, p_batch_id, 'keluar', p_kuantiti,
    v_supply_id, 'supply', p_catatan_bekalan
  );

  RETURN v_supply_id;
END;
$$;

-- Tamat 008_inventory_transactions.sql
