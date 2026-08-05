-- Transactional patient merge with assignment and history transfer.

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

    -- Lock the duplicate before reading its assignments so concurrent merges cannot split history.
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

-- Preserve the original two-argument API while routing it through the transaction.
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

GRANT EXECUTE ON FUNCTION merge_patients(UUID, UUID[], DATE, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION merge_patients(UUID, UUID[]) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
