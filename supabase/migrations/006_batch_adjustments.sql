-- ============================================================================
-- 006_batch_adjustments.sql
-- Audit log pelarasan stok kelompok
-- Tarikh: 26 Julai 2026
--
-- JADUAL:
--   9. batch_adjustments
-- ============================================================================

CREATE TABLE IF NOT EXISTS batch_adjustments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID NOT NULL REFERENCES item_batches(id) ON DELETE CASCADE,
  previous_kuantiti INTEGER NOT NULL,
  new_kuantiti INTEGER NOT NULL,
  change INTEGER NOT NULL,
  reason TEXT,
  adjusted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_batch_adjustments_batch ON batch_adjustments(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_adjustments_created ON batch_adjustments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_batch_adjustments_adjusted_by ON batch_adjustments(adjusted_by);

-- RLS dipermudahkan (disable penuh seperti 005)
ALTER TABLE batch_adjustments DISABLE ROW LEVEL SECURITY;

-- Grant akses
GRANT ALL ON batch_adjustments TO anon, authenticated;

-- Tamat 006_batch_adjustments.sql
