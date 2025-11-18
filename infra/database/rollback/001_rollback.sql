-- Rollback script for migration 001_initial_schema.sql

-- Drop triggers
DROP TRIGGER IF EXISTS update_crawl_jobs_updated_at ON crawl_jobs;
DROP TRIGGER IF EXISTS update_crawl_items_updated_at ON crawl_items;
DROP TRIGGER IF EXISTS update_captcha_events_updated_at ON captcha_events;
DROP TRIGGER IF EXISTS update_operator_sessions_updated_at ON operator_sessions;
DROP TRIGGER IF EXISTS update_auth_credentials_updated_at ON auth_credentials;
DROP TRIGGER IF EXISTS update_proxy_pool_updated_at ON proxy_pool;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables (in reverse dependency order)
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS storage_artifacts;
DROP TABLE IF EXISTS proxy_pool;
DROP TABLE IF EXISTS auth_credentials;
DROP TABLE IF EXISTS operator_sessions;
DROP TABLE IF EXISTS captcha_events;
DROP TABLE IF EXISTS crawl_items;
DROP TABLE IF EXISTS crawl_jobs;

-- Drop enum types
DROP TYPE IF EXISTS auth_mode;
DROP TYPE IF EXISTS captcha_status;
DROP TYPE IF EXISTS content_type;
DROP TYPE IF EXISTS crawl_item_status;
DROP TYPE IF EXISTS job_status;

-- Drop extensions (optional - only if not used elsewhere)
-- DROP EXTENSION IF EXISTS "pgcrypto";
-- DROP EXTENSION IF EXISTS "uuid-ossp";
