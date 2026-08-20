-- ============================================================================
-- 028_add_assignment_with_dose.sql
-- Atomically insert a patient_item_assignments row and its initial dose_history.
-- Deduplicated across useAddAssignment (Butiran Pesakit) and
-- useAddAssignmentInline (Dispen Pantas).
-- ============================================================================

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

GRANT EXECUTE ON FUNCTION add_assignment_with_dose(UUID, UUID, TEXT, TEXT, UUID, UUID, TEXT, TIMESTAMPTZ) TO anon, authenticated;
