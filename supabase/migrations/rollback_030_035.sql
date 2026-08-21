-- ============================================================================
-- rollback_030_035.sql
-- Rollback for migrations 030–035 (read-only RPC functions).
-- Do NOT number this as 036 — it would auto-apply after forward migrations.
-- Apply manually only when needed.
--
-- No new tables or indexes were created in 030–035, so only functions
-- (and their GRANTs) need to be dropped.  Client fallback code in
-- use-inventory.ts, use-patients.ts, and ReportPage.tsx will
-- automatically re-engage once the functions are removed.
-- ============================================================================

DROP FUNCTION IF EXISTS get_inventory_list(TEXT, TEXT, TEXT, BIGINT, BIGINT);
DROP FUNCTION IF EXISTS get_patient_list(TEXT, BOOLEAN, TEXT, TEXT, BIGINT, BIGINT);
DROP FUNCTION IF EXISTS get_report_inventory();
DROP FUNCTION IF EXISTS get_report_transactions(TIMESTAMPTZ, TIMESTAMPTZ, BIGINT);
DROP FUNCTION IF EXISTS get_report_expiring_batches(BIGINT);
DROP FUNCTION IF EXISTS get_report_low_stock();
