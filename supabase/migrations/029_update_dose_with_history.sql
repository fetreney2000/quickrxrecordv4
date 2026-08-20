-- ============================================================================
-- 029_update_dose_with_history.sql
-- Atomically update the dose on a patient_item_assignment and insert a new
-- dose_history row. Matches useUpdateDose behavior (insert-only, no
-- deactivation of previous history).
-- ============================================================================

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
  UPDATE patient_item_assignments SET dos = p_dos WHERE id = p_assignment_id;
  INSERT INTO dose_history (assignment_id, tarikh, dos, aktif, catatan, dikemaskini_oleh)
  VALUES (p_assignment_id, now(), p_dos, true, p_catatan, p_dikemaskini_oleh);
END; $$;

GRANT EXECUTE ON FUNCTION update_dose_with_history(UUID, TEXT, TEXT, UUID) TO anon, authenticated;
