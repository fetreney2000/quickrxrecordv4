-- ============================================================================
-- 002_password_reset_requests.sql
-- Permintaan tetapan semula kata laluan
-- Tarikh: 26 Julai 2026
--
-- JADUAL:
--   8. password_reset_requests
-- ============================================================================

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_reset_requests_status ON password_reset_requests(status);
CREATE INDEX IF NOT EXISTS idx_reset_requests_user ON password_reset_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_reset_requests_requested_at ON password_reset_requests(requested_at DESC);

-- Grant akses
GRANT ALL ON password_reset_requests TO anon, authenticated;

-- Tamat 002_password_reset_requests.sql
