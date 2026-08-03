-- Durable disposal state for inventory batches.
ALTER TABLE item_batches
  ADD COLUMN IF NOT EXISTS dilupuskan BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dilupuskan_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_item_batches_dilupuskan ON item_batches(dilupuskan);

CREATE OR REPLACE FUNCTION prevent_disposed_batch_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.dilupuskan AND (
    NEW.kuantiti IS DISTINCT FROM OLD.kuantiti OR
    NEW.nombor_kelompok IS DISTINCT FROM OLD.nombor_kelompok OR
    NEW.tarikh_luput IS DISTINCT FROM OLD.tarikh_luput OR
    NEW.dilupuskan IS DISTINCT FROM OLD.dilupuskan
  ) THEN
    RAISE EXCEPTION 'Kelompok telah dilupuskan dan tidak boleh diubah.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_disposed_batch_changes ON item_batches;
CREATE TRIGGER prevent_disposed_batch_changes
  BEFORE UPDATE ON item_batches
  FOR EACH ROW EXECUTE FUNCTION prevent_disposed_batch_changes();

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
BEGIN
  SELECT * INTO v_batch FROM item_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Batch % not found', p_batch_id; END IF;
  IF v_batch.dilupuskan THEN RAISE EXCEPTION 'Kelompok telah dilupuskan.'; END IF;

  UPDATE item_batches SET kuantiti = 0, dilupuskan = true, dilupuskan_at = now() WHERE id = p_batch_id;
  INSERT INTO batch_adjustments(batch_id, previous_kuantiti, new_kuantiti, change, reason, adjusted_by)
  VALUES (p_batch_id, v_batch.kuantiti, 0, -v_batch.kuantiti, p_reason, p_adjusted_by);
  IF v_batch.kuantiti > 0 THEN
    INSERT INTO inventory_transactions(item_id, batch_id, jenis, kuantiti, rujukan_id, rujukan_type, catatan)
    VALUES (v_batch.item_id, p_batch_id, 'keluar', v_batch.kuantiti, p_batch_id, 'batch_disposal', p_reason);
  END IF;
END;
$$;

GRANT ALL ON FUNCTION process_batch_disposal(UUID, UUID, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
