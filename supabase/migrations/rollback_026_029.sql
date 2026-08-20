-- ============================================================================
-- rollback_026_029.sql
-- Rollback for migrations 026–029 (RPC functions + indexes).
-- Do NOT number this as 030 — it would auto-apply after forward migrations.
-- Apply manually only when needed.
--
-- Before Phase 4 cleanup: SQL drops alone suffice (client fallback code exists).
-- After Phase 4 cleanup: SQL drops + revert client code via git.
-- ============================================================================

DROP FUNCTION IF EXISTS get_item_patients_with_activity(UUID);
DROP FUNCTION IF EXISTS get_item_transaction_history(UUID);
DROP FUNCTION IF EXISTS add_assignment_with_dose(UUID, UUID, TEXT, TEXT, UUID, UUID, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS update_dose_with_history(UUID, TEXT, TEXT, UUID);
DROP INDEX IF EXISTS idx_supply_record_assignment_date;
DROP INDEX IF EXISTS idx_supply_decl_assignment_date;
