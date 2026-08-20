-- ============================================================================
-- 026_get_item_patients_with_activity.sql
-- Single-query replacement for useItemPatients. Returns active assignments
-- for an item with patient info, latest supply, latest declination, and
-- computed last_activity — all in one RPC call.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_item_patients_with_activity(p_item_id UUID)
RETURNS TABLE (
  id UUID, patient_id UUID, dos TEXT, tarikh_mula_guna DATE,
  patient_nama TEXT, patient_no_kp TEXT, patient_no_hospital TEXT,
  last_supply_tarikh TIMESTAMPTZ, last_supply_kuantiti INTEGER,
  last_declination_tarikh TIMESTAMPTZ, last_activity TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pia.id, pia.patient_id, pia.dos, pia.tarikh_mula_guna,
    pat.nama, pat.nombor_kad_pengenalan, pat.nombor_pendaftaran_hospital,
    ls.tarikh_dibekal, ls.kuantiti,
    ld.tarikh,
    GREATEST(ls.tarikh_dibekal, ld.tarikh)
  FROM patient_item_assignments pia
  JOIN patients pat ON pat.id = pia.patient_id
  LEFT JOIN LATERAL (
    SELECT sr.tarikh_dibekal, sr.kuantiti
    FROM supply_records sr
    WHERE sr.assignment_id = pia.id AND sr.voided_at IS NULL
    ORDER BY sr.tarikh_dibekal DESC LIMIT 1
  ) ls ON true
  LEFT JOIN LATERAL (
    SELECT sd.tarikh
    FROM supply_declinations sd
    WHERE sd.assignment_id = pia.id
    ORDER BY sd.tarikh DESC LIMIT 1
  ) ld ON true
  WHERE pia.item_id = p_item_id AND pia.aktif = true;
END; $$;

GRANT EXECUTE ON FUNCTION get_item_patients_with_activity(UUID) TO anon, authenticated;

-- Recommended composite indexes
CREATE INDEX IF NOT EXISTS idx_supply_record_assignment_date
  ON supply_records(assignment_id, tarikh_dibekal DESC)
  WHERE voided_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_supply_decl_assignment_date
  ON supply_declinations(assignment_id, tarikh DESC);
