-- ============================================================================
-- 027_get_item_transaction_history.sql
-- Single-query replacement for useItemTransactionHistory (190 lines → 1 RPC).
-- Fixes the supply_reversal/supply_adjustment bug where staff/patient info
-- was lost because these rujukan_types were never joined to supply_records.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_item_transaction_history(p_item_id UUID)
RETURNS TABLE (
  id UUID, tarikh TIMESTAMPTZ, jenis TEXT, jenis_label TEXT,
  kelompok TEXT, perubahan INTEGER,
  catatan TEXT, kakitangan TEXT, pesakit TEXT, baki INTEGER
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    it.id, it.created_at,
    CASE it.rujukan_type
      WHEN 'supply'            THEN 'bekalan'::TEXT
      WHEN 'supply_reversal'   THEN 'bekalan'::TEXT
      WHEN 'supply_adjustment' THEN 'bekalan'::TEXT
      ELSE 'pelarasan'::TEXT
    END,
    CASE it.rujukan_type
      WHEN 'supply'             THEN 'Bekalan'::TEXT
      WHEN 'supply_reversal'    THEN 'Pembatalan Bekalan'::TEXT
      WHEN 'supply_adjustment'  THEN 'Pelarasan Bekalan'::TEXT
      WHEN 'batch_addition'     THEN 'Penambahan'::TEXT
      WHEN 'batch_disposal'     THEN 'Pelupusan'::TEXT
      WHEN 'adjustment'         THEN
        CASE WHEN it.jenis = 'masuk' THEN 'Penambahan'::TEXT ELSE 'Pelupusan'::TEXT END
      ELSE 'Pelarasan'::TEXT
    END,
    b.nombor_kelompok,
    CASE it.rujukan_type
      WHEN 'supply'            THEN -it.kuantiti
      WHEN 'supply_reversal'   THEN  it.kuantiti
      WHEN 'batch_addition'    THEN  it.kuantiti
      WHEN 'batch_disposal'    THEN -it.kuantiti
      WHEN 'supply_adjustment' THEN
        CASE WHEN it.jenis = 'masuk' THEN it.kuantiti ELSE -it.kuantiti END
      ELSE
        CASE WHEN it.jenis = 'masuk' THEN it.kuantiti ELSE -it.kuantiti END
    END,
    CASE
      WHEN it.rujukan_type IN ('supply', 'supply_reversal', 'supply_adjustment')
        THEN COALESCE(sr.catatan_bekalan, it.catatan)
      WHEN it.rujukan_type IN ('batch_disposal', 'adjustment') THEN
        CASE
          WHEN badj.catatan IS NOT NULL AND badj.reason IS NOT NULL
               AND badj.catatan != badj.reason
            THEN badj.reason || ' — ' || badj.catatan
          WHEN badj.reason IS NOT NULL THEN badj.reason
          ELSE it.catatan
        END
      ELSE it.catatan
    END,
    CASE it.rujukan_type
      WHEN 'supply'            THEN staff_sr.nama
      WHEN 'supply_reversal'   THEN staff_sr.nama
      WHEN 'supply_adjustment' THEN staff_sr.nama
      WHEN 'batch_addition'    THEN staff_ba.nama
      WHEN 'batch_disposal'    THEN staff_badj.nama
      WHEN 'adjustment'        THEN staff_badj.nama
      ELSE NULL
    END,
    CASE it.rujukan_type
      WHEN 'supply'            THEN pat.nama
      WHEN 'supply_reversal'   THEN pat.nama
      WHEN 'supply_adjustment' THEN pat.nama
      ELSE NULL
    END,
    it.baki
  FROM inventory_transactions it
  LEFT JOIN item_batches b ON b.id = it.batch_id
  LEFT JOIN supply_records sr ON sr.id = it.rujukan_id
    AND it.rujukan_type IN ('supply', 'supply_reversal', 'supply_adjustment')
  LEFT JOIN patient_item_assignments pia ON pia.id = sr.assignment_id
  LEFT JOIN patients pat ON pat.id = pia.patient_id
  LEFT JOIN profiles staff_sr ON staff_sr.id = sr.kakitangan_pembekal
  LEFT JOIN batch_additions ba ON ba.id = it.rujukan_id
    AND it.rujukan_type = 'batch_addition'
  LEFT JOIN profiles staff_ba ON staff_ba.id = ba.added_by
  LEFT JOIN batch_adjustments badj ON badj.id = it.rujukan_id
    AND it.rujukan_type IN ('adjustment', 'batch_disposal')
  LEFT JOIN profiles staff_badj ON staff_badj.id = badj.adjusted_by
  WHERE it.item_id = p_item_id
  ORDER BY it.created_at DESC, it.id ASC;
END; $$;

GRANT EXECUTE ON FUNCTION get_item_transaction_history(UUID) TO anon, authenticated;
