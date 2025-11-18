-- Universal Crawler - Supabase Realtime Configuration
-- Created: 2025-11-18
-- Description: Enables Realtime subscriptions for live job updates and captcha queue

-- ============================================
-- Enable Realtime for Tables
-- ============================================

-- This SQL enables realtime publication for the following tables:
-- - crawl_jobs: For job status updates
-- - crawl_items: For item extraction progress
-- - captcha_events: For captcha queue notifications
-- - operator_sessions: For presence detection

-- Note: In Supabase, realtime is enabled via the dashboard or CLI
-- This is a reference SQL for documentation purposes
-- Run via Supabase CLI: supabase db push

-- ============================================
-- Realtime Publication Setup
-- ============================================

-- Enable realtime for crawl_jobs
ALTER PUBLICATION supabase_realtime ADD TABLE crawl_jobs;

-- Enable realtime for crawl_items
ALTER PUBLICATION supabase_realtime ADD TABLE crawl_items;

-- Enable realtime for captcha_events
ALTER PUBLICATION supabase_realtime ADD TABLE captcha_events;

-- Enable realtime for operator_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE operator_sessions;

-- ============================================
-- Realtime Broadcast Channels (Conceptual)
-- ============================================

-- Channels are created dynamically via client subscriptions
-- This is documentation of our channel naming convention:

-- Channel: jobs.<crawl_id>
--   Purpose: Job-specific updates
--   Payload: { event: string, data: object, timestamp: string }
--   Subscribers: Operators viewing job detail page

-- Channel: captcha_queue
--   Purpose: Global captcha queue notifications
--   Payload: { captcha_id: uuid, type: string, screenshot_url: string }
--   Subscribers: All active operators

-- Channel: operator_presence
--   Purpose: Track which operators are online
--   Payload: { user_id: uuid, status: 'online' | 'away' | 'offline' }
--   Subscribers: Dashboard and operator list views

-- Channel: alerts.global
--   Purpose: System-wide alerts (proxy failures, quota warnings, etc.)
--   Payload: { severity: string, message: string, details: object }
--   Subscribers: All authenticated operators

-- ============================================
-- Functions for Realtime Events
-- ============================================

-- Function to broadcast job status changes
CREATE OR REPLACE FUNCTION notify_job_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- This trigger will cause a realtime event
  -- Subscribers to table 'crawl_jobs' will receive the update
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_job_status_change
AFTER UPDATE OF status ON crawl_jobs
FOR EACH ROW
EXECUTE FUNCTION notify_job_status_change();

-- Function to broadcast new captcha events
CREATE OR REPLACE FUNCTION notify_captcha_event()
RETURNS TRIGGER AS $$
BEGIN
  -- Realtime subscribers will be notified
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_captcha_event
AFTER INSERT ON captcha_events
FOR EACH ROW
EXECUTE FUNCTION notify_captcha_event();

-- Function to track operator last_seen
CREATE OR REPLACE FUNCTION update_operator_last_seen(
  p_session_token TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE operator_sessions
  SET last_seen_at = now()
  WHERE session_token = p_session_token
  AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Realtime Filters (RLS Integration)
-- ============================================

-- RLS policies already defined in migration 001 will be respected
-- by Realtime subscriptions. Operators will only receive updates
-- for resources they have access to.

-- ============================================
-- Monitoring Views for Realtime Health
-- ============================================

CREATE OR REPLACE VIEW realtime_health AS
SELECT
  'crawl_jobs' as table_name,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE updated_at > now() - interval '5 minutes') as recent_updates
FROM crawl_jobs
UNION ALL
SELECT
  'captcha_events',
  COUNT(*),
  COUNT(*) FILTER (WHERE updated_at > now() - interval '5 minutes')
FROM captcha_events
UNION ALL
SELECT
  'operator_sessions',
  COUNT(*),
  COUNT(*) FILTER (WHERE last_seen_at > now() - interval '5 minutes')
FROM operator_sessions;

-- Grant access to authenticated users
GRANT SELECT ON realtime_health TO authenticated;

-- Migration complete
