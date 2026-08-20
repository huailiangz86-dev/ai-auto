-- ============================================================
-- AI auto - PostgreSQL Init Script
-- Runs automatically on first container start
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create application user (already done via POSTGRES_USER)
-- GRANT ALL PRIVILEGES ON DATABASE ai_auto_dev TO ai_auto;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'AI auto database initialized successfully';
END $$;
