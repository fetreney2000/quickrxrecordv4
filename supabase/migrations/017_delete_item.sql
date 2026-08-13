-- ============================================================================
-- 017_delete_item.sql
-- Padam item selamat: hard-delete jika item TIDAK pernah ditugaskan,
-- soft-delete (aktif=false) jika item pernah dibekalkan/ditugaskan.
-- Tarikh: 13 Ogos 2026
--
-- FUNGSI:
--   - delete_item(p_item_id UUID) RETURNS TEXT
--       'deleted'      → dipadam secara kekal (tiada patient_item_assignments)
--       'deactivated'  → ditetapkan aktif=false (ada sejarah tugasan/bekalan)
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_item(p_item_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_used INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_used
  FROM patient_item_assignments
  WHERE item_id = p_item_id;

  IF v_used > 0 THEN
    -- Used: soft delete, keep audit trail (updated_at set by update_items_updated_at trigger)
    UPDATE items SET aktif = false WHERE id = p_item_id;
    RETURN 'deactivated';
  ELSE
    -- Unused: hard delete (cascades item_batches, inventory_transactions, etc.)
    DELETE FROM items WHERE id = p_item_id;
    RETURN 'deleted';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_item(UUID) TO anon, authenticated;

-- Tamat 017_delete_item.sql