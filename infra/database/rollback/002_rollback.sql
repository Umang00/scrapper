-- Rollback script for migration 002_realtime_setup.sql

-- Drop views
DROP VIEW IF EXISTS realtime_health;

-- Drop functions
DROP FUNCTION IF EXISTS update_operator_last_seen(TEXT);
DROP FUNCTION IF EXISTS notify_captcha_event();
DROP FUNCTION IF EXISTS notify_job_status_change();

-- Drop triggers
DROP TRIGGER IF EXISTS trigger_captcha_event ON captcha_events;
DROP TRIGGER IF EXISTS trigger_job_status_change ON crawl_jobs;

-- Remove tables from realtime publication
-- Note: This requires Supabase CLI or dashboard
-- ALTER PUBLICATION supabase_realtime DROP TABLE crawl_jobs;
-- ALTER PUBLICATION supabase_realtime DROP TABLE crawl_items;
-- ALTER PUBLICATION supabase_realtime DROP TABLE captcha_events;
-- ALTER PUBLICATION supabase_realtime DROP TABLE operator_sessions;
