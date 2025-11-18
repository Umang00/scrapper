-- Universal Crawler - Initial Schema Migration
-- Created: 2025-11-18
-- Description: Creates core tables for crawl jobs, items, sessions, and captcha management

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types
CREATE TYPE job_status AS ENUM ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled');
CREATE TYPE crawl_item_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'skipped');
CREATE TYPE content_type AS ENUM ('post', 'comment', 'article', 'video', 'image', 'story', 'reel', 'thread');
CREATE TYPE captcha_status AS ENUM ('pending', 'solving', 'solved', 'failed', 'timeout');
CREATE TYPE auth_mode AS ENUM ('public', 'session_cookie', 'oauth', 'api_key', 'interactive');

-- ============================================
-- Table: crawl_jobs
-- ============================================
CREATE TABLE crawl_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,

  -- Job configuration
  connector TEXT NOT NULL,
  source_platform TEXT NOT NULL,
  auth_mode auth_mode NOT NULL DEFAULT 'public',

  -- Job parameters
  urls TEXT[] NOT NULL,
  depth INTEGER DEFAULT 1,
  max_items INTEGER,
  config JSONB DEFAULT '{}',

  -- Status tracking
  status job_status NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Progress metrics
  total_urls INTEGER DEFAULT 0,
  processed_urls INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,

  -- Error tracking
  error_message TEXT,
  error_details JSONB,

  -- Metadata
  created_by UUID,
  tags TEXT[],
  notes TEXT,

  CONSTRAINT valid_depth CHECK (depth >= 1 AND depth <= 10),
  CONSTRAINT valid_counts CHECK (processed_urls <= total_urls)
);

CREATE INDEX idx_crawl_jobs_status ON crawl_jobs(status);
CREATE INDEX idx_crawl_jobs_created_at ON crawl_jobs(created_at DESC);
CREATE INDEX idx_crawl_jobs_connector ON crawl_jobs(connector);
CREATE INDEX idx_crawl_jobs_source_platform ON crawl_jobs(source_platform);

-- ============================================
-- Table: crawl_items
-- ============================================
CREATE TABLE crawl_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crawl_id UUID NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,

  -- Source information
  source_platform TEXT NOT NULL,
  url TEXT NOT NULL,
  post_id TEXT,
  author_handle TEXT,

  -- Content
  content_type content_type NOT NULL,
  text_content TEXT,
  title TEXT,

  -- Timestamps
  extracted_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,

  -- Engagement metrics
  engagement JSONB DEFAULT '{}',
  -- Example: {"likes": 100, "shares": 50, "comments": 25, "views": 1000}

  -- Media references
  media_refs JSONB DEFAULT '[]',
  -- Example: [{"type": "image", "url": "...", "s3_key": "..."}, ...]

  -- Storage references (REQUIRED)
  storage_refs JSONB NOT NULL DEFAULT '{}',
  -- Example: {"screenshot": "s3://bucket/...", "har": "s3://bucket/...", "html": "s3://bucket/..."}

  -- Crawl metadata
  connector TEXT NOT NULL,
  auth_state JSONB,
  proxy_id TEXT,
  fingerprint_used JSONB,

  -- Status
  status crawl_item_status NOT NULL DEFAULT 'completed',
  error_message TEXT,

  -- Raw snapshot path
  raw_snapshot_path TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,

  CONSTRAINT unique_platform_post UNIQUE NULLS NOT DISTINCT (source_platform, post_id)
);

CREATE INDEX idx_crawl_items_crawl_id ON crawl_items(crawl_id);
CREATE INDEX idx_crawl_items_source_platform ON crawl_items(source_platform);
CREATE INDEX idx_crawl_items_status ON crawl_items(status);
CREATE INDEX idx_crawl_items_extracted_at ON crawl_items(extracted_at DESC);
CREATE INDEX idx_crawl_items_author ON crawl_items(author_handle);
CREATE INDEX idx_crawl_items_content_type ON crawl_items(content_type);

-- GIN index for JSONB columns
CREATE INDEX idx_crawl_items_engagement ON crawl_items USING GIN(engagement);
CREATE INDEX idx_crawl_items_media_refs ON crawl_items USING GIN(media_refs);

-- ============================================
-- Table: captcha_events
-- ============================================
CREATE TABLE captcha_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,

  -- Association
  crawl_id UUID REFERENCES crawl_jobs(id) ON DELETE CASCADE,
  item_id UUID REFERENCES crawl_items(id) ON DELETE SET NULL,

  -- Captcha details
  captcha_type TEXT NOT NULL, -- recaptcha_v2, recaptcha_v3, hcaptcha, etc.
  source_platform TEXT NOT NULL,
  url TEXT NOT NULL,

  -- Captcha challenge data
  site_key TEXT,
  challenge_data JSONB,

  -- Storage references
  screenshot_s3_key TEXT,
  har_s3_key TEXT,

  -- Status and resolution
  status captcha_status NOT NULL DEFAULT 'pending',
  solved_at TIMESTAMP WITH TIME ZONE,
  solved_by UUID, -- operator user ID
  solution_token TEXT,

  -- Timing
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  timeout_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  worker_id TEXT,
  proxy_id TEXT,
  attempts INTEGER DEFAULT 1,

  CONSTRAINT valid_attempts CHECK (attempts >= 1)
);

CREATE INDEX idx_captcha_events_status ON captcha_events(status);
CREATE INDEX idx_captcha_events_crawl_id ON captcha_events(crawl_id);
CREATE INDEX idx_captcha_events_created_at ON captcha_events(created_at DESC);
CREATE INDEX idx_captcha_events_platform ON captcha_events(source_platform);

-- ============================================
-- Table: operator_sessions
-- ============================================
CREATE TABLE operator_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,

  -- Session identification
  session_token TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,

  -- Session metadata
  ip_address INET,
  user_agent TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Presence (for Supabase Realtime)
  presence_data JSONB DEFAULT '{}',

  CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

CREATE INDEX idx_operator_sessions_user_id ON operator_sessions(user_id);
CREATE INDEX idx_operator_sessions_active ON operator_sessions(is_active, expires_at);
CREATE INDEX idx_operator_sessions_last_seen ON operator_sessions(last_seen_at DESC);

-- ============================================
-- Table: auth_credentials
-- ============================================
CREATE TABLE auth_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,

  -- Platform identification
  platform TEXT NOT NULL,
  account_identifier TEXT NOT NULL, -- username, email, or account ID

  -- Credential type
  credential_type auth_mode NOT NULL,

  -- Encrypted credentials (using pgcrypto)
  encrypted_data BYTEA NOT NULL,

  -- Session cookies (if applicable)
  cookie_bundle JSONB,
  cookie_expires_at TIMESTAMP WITH TIME ZONE,

  -- OAuth tokens (if applicable)
  oauth_tokens JSONB,
  token_expires_at TIMESTAMP WITH TIME ZONE,

  -- Status
  is_valid BOOLEAN DEFAULT true,
  last_validated_at TIMESTAMP WITH TIME ZONE,
  validation_error TEXT,

  -- Metadata
  created_by UUID,
  notes TEXT,

  CONSTRAINT unique_platform_account UNIQUE (platform, account_identifier)
);

CREATE INDEX idx_auth_credentials_platform ON auth_credentials(platform);
CREATE INDEX idx_auth_credentials_valid ON auth_credentials(is_valid);
CREATE INDEX idx_auth_credentials_expiry ON auth_credentials(cookie_expires_at);

-- ============================================
-- Table: proxy_pool
-- ============================================
CREATE TABLE proxy_pool (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,

  -- Proxy details
  proxy_url TEXT UNIQUE NOT NULL,
  proxy_type TEXT NOT NULL, -- residential, datacenter, mobile
  provider TEXT NOT NULL,

  -- Geographic info
  country_code CHAR(2),
  region TEXT,
  city TEXT,

  -- Health metrics
  is_active BOOLEAN DEFAULT true,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  last_success_at TIMESTAMP WITH TIME ZONE,
  last_failure_at TIMESTAMP WITH TIME ZONE,

  -- Performance
  avg_response_time_ms INTEGER,

  -- Rate limiting
  requests_today INTEGER DEFAULT 0,
  daily_limit INTEGER,

  -- Metadata
  notes TEXT,

  CONSTRAINT valid_country_code CHECK (country_code ~ '^[A-Z]{2}$' OR country_code IS NULL)
);

CREATE INDEX idx_proxy_pool_active ON proxy_pool(is_active);
CREATE INDEX idx_proxy_pool_type ON proxy_pool(proxy_type);
CREATE INDEX idx_proxy_pool_country ON proxy_pool(country_code);

-- ============================================
-- Table: storage_artifacts
-- ============================================
CREATE TABLE storage_artifacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,

  -- Association
  crawl_id UUID REFERENCES crawl_jobs(id) ON DELETE CASCADE,
  item_id UUID REFERENCES crawl_items(id) ON DELETE CASCADE,

  -- Storage details
  artifact_type TEXT NOT NULL, -- screenshot, har, html, video, image
  s3_key TEXT UNIQUE NOT NULL,
  s3_bucket TEXT NOT NULL,

  -- File metadata
  file_size_bytes BIGINT,
  mime_type TEXT,
  checksum_sha256 TEXT,

  -- Access
  signed_url_expires_at TIMESTAMP WITH TIME ZONE,

  -- Lifecycle
  expires_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT valid_file_size CHECK (file_size_bytes >= 0)
);

CREATE INDEX idx_storage_artifacts_crawl_id ON storage_artifacts(crawl_id);
CREATE INDEX idx_storage_artifacts_item_id ON storage_artifacts(item_id);
CREATE INDEX idx_storage_artifacts_type ON storage_artifacts(artifact_type);
CREATE INDEX idx_storage_artifacts_expires ON storage_artifacts(expires_at);

-- ============================================
-- Table: audit_log
-- ============================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,

  -- Actor
  user_id UUID,
  user_email TEXT,
  ip_address INET,

  -- Action
  action TEXT NOT NULL, -- create_job, stop_job, solve_captcha, access_credential, etc.
  resource_type TEXT NOT NULL, -- job, item, credential, etc.
  resource_id UUID,

  -- Details
  details JSONB DEFAULT '{}',

  -- Result
  success BOOLEAN DEFAULT true,
  error_message TEXT
);

CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);

-- ============================================
-- Functions and Triggers
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_crawl_jobs_updated_at BEFORE UPDATE ON crawl_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crawl_items_updated_at BEFORE UPDATE ON crawl_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_captcha_events_updated_at BEFORE UPDATE ON captcha_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_operator_sessions_updated_at BEFORE UPDATE ON operator_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auth_credentials_updated_at BEFORE UPDATE ON auth_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_proxy_pool_updated_at BEFORE UPDATE ON proxy_pool
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE crawl_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE captcha_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE proxy_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for backend workers)
CREATE POLICY service_role_all ON crawl_jobs FOR ALL USING (true);
CREATE POLICY service_role_all ON crawl_items FOR ALL USING (true);
CREATE POLICY service_role_all ON captcha_events FOR ALL USING (true);
CREATE POLICY service_role_all ON operator_sessions FOR ALL USING (true);
CREATE POLICY service_role_all ON auth_credentials FOR ALL USING (true);
CREATE POLICY service_role_all ON proxy_pool FOR ALL USING (true);
CREATE POLICY service_role_all ON storage_artifacts FOR ALL USING (true);
CREATE POLICY service_role_all ON audit_log FOR ALL USING (true);

-- Authenticated users (operators) can read their own jobs
CREATE POLICY operators_read_own_jobs ON crawl_jobs FOR SELECT
  USING (auth.uid() = created_by OR auth.role() = 'authenticated');

-- Operators can read items from their jobs
CREATE POLICY operators_read_own_items ON crawl_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM crawl_jobs
      WHERE crawl_jobs.id = crawl_items.crawl_id
      AND (crawl_jobs.created_by = auth.uid() OR auth.role() = 'authenticated')
    )
  );

-- Operators can read and update captcha events
CREATE POLICY operators_captcha_access ON captcha_events FOR ALL
  USING (auth.role() = 'authenticated');

-- Operators can read their own sessions
CREATE POLICY operators_read_own_sessions ON operator_sessions FOR SELECT
  USING (user_id = auth.uid());

-- ============================================
-- Initial Data / Seed
-- ============================================

-- Insert some example proxy providers (template only)
INSERT INTO proxy_pool (proxy_url, proxy_type, provider, country_code, is_active, daily_limit)
VALUES
  ('http://example-residential.proxy.com:8080', 'residential', 'ExampleProvider', 'US', false, 10000),
  ('http://example-datacenter.proxy.com:8081', 'datacenter', 'ExampleProvider', 'US', false, 50000)
ON CONFLICT DO NOTHING;

-- Migration complete
COMMENT ON SCHEMA public IS 'Universal Crawler - Schema Version 1.0';
