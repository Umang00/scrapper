/**
 * Database Schema Types
 * Auto-generated from database schema
 * DO NOT MODIFY - These types must match the database schema exactly
 */

// ============================================
// Enum Types
// ============================================

export type JobStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type CrawlItemStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'skipped';

export type ContentType =
  | 'post'
  | 'comment'
  | 'article'
  | 'video'
  | 'image'
  | 'story'
  | 'reel'
  | 'thread';

export type CaptchaStatus =
  | 'pending'
  | 'solving'
  | 'solved'
  | 'failed'
  | 'timeout';

export type AuthMode =
  | 'public'
  | 'session_cookie'
  | 'oauth'
  | 'api_key'
  | 'interactive';

export type ProxyType =
  | 'residential'
  | 'datacenter'
  | 'mobile';

export type ArtifactType =
  | 'screenshot'
  | 'har'
  | 'html'
  | 'video'
  | 'image';

export type PresenceStatus =
  | 'available'
  | 'busy'
  | 'away';

// ============================================
// Table: crawl_jobs
// ============================================

export interface CrawlJob {
  id: string;
  created_at: string;
  updated_at: string;

  // Job configuration
  connector: string;
  source_platform: string;
  auth_mode: AuthMode;

  // Job parameters
  urls: string[];
  depth: number;
  max_items: number | null;
  config: Record<string, unknown>;

  // Status tracking
  status: JobStatus;
  started_at: string | null;
  completed_at: string | null;

  // Progress metrics
  total_urls: number;
  processed_urls: number;
  success_count: number;
  error_count: number;

  // Error tracking
  error_message: string | null;
  error_details: Record<string, unknown> | null;

  // Metadata
  created_by: string | null;
  tags: string[] | null;
  notes: string | null;
}

export interface CreateCrawlJob {
  connector: string;
  source_platform: string;
  auth_mode?: AuthMode;
  urls: string[];
  depth?: number;
  max_items?: number;
  config?: Record<string, unknown>;
  created_by?: string;
  tags?: string[];
  notes?: string;
}

export interface UpdateCrawlJob {
  status?: JobStatus;
  started_at?: string;
  completed_at?: string;
  total_urls?: number;
  processed_urls?: number;
  success_count?: number;
  error_count?: number;
  error_message?: string;
  error_details?: Record<string, unknown>;
}

// ============================================
// Table: crawl_items
// ============================================

export interface EngagementMetrics {
  likes?: number;
  shares?: number;
  comments?: number;
  views?: number;
  retweets?: number;
  favorites?: number;
  [key: string]: number | undefined;
}

export interface MediaReference {
  type: string;
  url: string;
  s3_key?: string;
  width?: number;
  height?: number;
  duration?: number;
  thumbnail_url?: string;
}

export interface StorageReferences {
  screenshot?: string;
  har?: string;
  html?: string;
  video?: string;
  [key: string]: string | undefined;
}

export interface AuthState {
  session_id?: string;
  cookies_used?: boolean;
  oauth_token?: string;
  [key: string]: unknown;
}

export interface Fingerprint {
  user_agent?: string;
  viewport?: { width: number; height: number };
  timezone?: string;
  language?: string;
  [key: string]: unknown;
}

export interface CrawlItem {
  id: string;
  crawl_id: string;

  // Source information
  source_platform: string;
  url: string;
  post_id: string | null;
  author_handle: string | null;

  // Content
  content_type: ContentType;
  text_content: string | null;
  title: string | null;

  // Timestamps
  extracted_at: string;
  published_at: string | null;

  // Engagement metrics
  engagement: EngagementMetrics;

  // Media references
  media_refs: MediaReference[];

  // Storage references (REQUIRED)
  storage_refs: StorageReferences;

  // Crawl metadata
  connector: string;
  auth_state: AuthState | null;
  proxy_id: string | null;
  fingerprint_used: Fingerprint | null;

  // Status
  status: CrawlItemStatus;
  error_message: string | null;

  // Raw snapshot path
  raw_snapshot_path: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface CreateCrawlItem {
  crawl_id: string;
  source_platform: string;
  url: string;
  post_id?: string;
  author_handle?: string;
  content_type: ContentType;
  text_content?: string;
  title?: string;
  published_at?: string;
  engagement?: EngagementMetrics;
  media_refs?: MediaReference[];
  storage_refs: StorageReferences;
  connector: string;
  auth_state?: AuthState;
  proxy_id?: string;
  fingerprint_used?: Fingerprint;
  status?: CrawlItemStatus;
  error_message?: string;
  raw_snapshot_path?: string;
}

// ============================================
// Table: captcha_events
// ============================================

export interface ChallengeData {
  site_key?: string;
  data_sitekey?: string;
  data_callback?: string;
  action?: string;
  [key: string]: unknown;
}

export interface CaptchaEvent {
  id: string;
  created_at: string;
  updated_at: string;

  // Association
  crawl_id: string | null;
  item_id: string | null;

  // Captcha details
  captcha_type: string;
  source_platform: string;
  url: string;

  // Captcha challenge data
  site_key: string | null;
  challenge_data: ChallengeData | null;

  // Storage references
  screenshot_s3_key: string | null;
  har_s3_key: string | null;

  // Status and resolution
  status: CaptchaStatus;
  solved_at: string | null;
  solved_by: string | null;
  solution_token: string | null;

  // Timing
  detected_at: string;
  timeout_at: string | null;

  // Metadata
  worker_id: string | null;
  proxy_id: string | null;
  attempts: number;
}

export interface CreateCaptchaEvent {
  crawl_id?: string;
  item_id?: string;
  captcha_type: string;
  source_platform: string;
  url: string;
  site_key?: string;
  challenge_data?: ChallengeData;
  screenshot_s3_key?: string;
  har_s3_key?: string;
  timeout_at?: string;
  worker_id?: string;
  proxy_id?: string;
}

export interface SolveCaptcha {
  solution_token: string;
  solved_by: string;
}

// ============================================
// Table: operator_sessions
// ============================================

export interface PresenceData {
  user_id: string;
  email: string;
  online_at: string;
  status: PresenceStatus;
  [key: string]: unknown;
}

export interface OperatorSession {
  id: string;
  created_at: string;
  updated_at: string;

  // Session identification
  session_token: string;
  user_id: string;
  user_email: string;

  // Session metadata
  ip_address: string | null;
  user_agent: string | null;

  // Status
  is_active: boolean;
  last_seen_at: string;
  expires_at: string;

  // Presence
  presence_data: PresenceData;
}

export interface CreateOperatorSession {
  session_token: string;
  user_id: string;
  user_email: string;
  ip_address?: string;
  user_agent?: string;
  expires_at: string;
  presence_data?: PresenceData;
}

// ============================================
// Table: auth_credentials
// ============================================

export interface CookieBundle {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  }>;
  user_agent?: string;
  viewport?: { width: number; height: number };
}

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string[];
}

export interface AuthCredential {
  id: string;
  created_at: string;
  updated_at: string;

  // Platform identification
  platform: string;
  account_identifier: string;

  // Credential type
  credential_type: AuthMode;

  // Encrypted credentials (base64 encoded)
  encrypted_data: string;

  // Session cookies
  cookie_bundle: CookieBundle | null;
  cookie_expires_at: string | null;

  // OAuth tokens
  oauth_tokens: OAuthTokens | null;
  token_expires_at: string | null;

  // Status
  is_valid: boolean;
  last_validated_at: string | null;
  validation_error: string | null;

  // Metadata
  created_by: string | null;
  notes: string | null;
}

export interface CreateAuthCredential {
  platform: string;
  account_identifier: string;
  credential_type: AuthMode;
  encrypted_data: string;
  cookie_bundle?: CookieBundle;
  cookie_expires_at?: string;
  oauth_tokens?: OAuthTokens;
  token_expires_at?: string;
  created_by?: string;
  notes?: string;
}

// ============================================
// Table: proxy_pool
// ============================================

export interface ProxyPoolEntry {
  id: string;
  created_at: string;
  updated_at: string;

  // Proxy details
  proxy_url: string;
  proxy_type: ProxyType;
  provider: string;

  // Geographic info
  country_code: string | null;
  region: string | null;
  city: string | null;

  // Health metrics
  is_active: boolean;
  success_count: number;
  failure_count: number;
  last_success_at: string | null;
  last_failure_at: string | null;

  // Performance
  avg_response_time_ms: number | null;

  // Rate limiting
  requests_today: number;
  daily_limit: number | null;

  // Metadata
  notes: string | null;
}

export interface CreateProxyPoolEntry {
  proxy_url: string;
  proxy_type: ProxyType;
  provider: string;
  country_code?: string;
  region?: string;
  city?: string;
  daily_limit?: number;
  notes?: string;
}

// ============================================
// Table: storage_artifacts
// ============================================

export interface StorageArtifact {
  id: string;
  created_at: string;

  // Association
  crawl_id: string | null;
  item_id: string | null;

  // Storage details
  artifact_type: ArtifactType;
  s3_key: string;
  s3_bucket: string;

  // File metadata
  file_size_bytes: number | null;
  mime_type: string | null;
  checksum_sha256: string | null;

  // Access
  signed_url_expires_at: string | null;

  // Lifecycle
  expires_at: string | null;
  archived_at: string | null;
}

export interface CreateStorageArtifact {
  crawl_id?: string;
  item_id?: string;
  artifact_type: ArtifactType;
  s3_key: string;
  s3_bucket: string;
  file_size_bytes?: number;
  mime_type?: string;
  checksum_sha256?: string;
  expires_at?: string;
}

// ============================================
// Table: audit_log
// ============================================

export interface AuditLog {
  id: string;
  created_at: string;

  // Actor
  user_id: string | null;
  user_email: string | null;
  ip_address: string | null;

  // Action
  action: string;
  resource_type: string;
  resource_id: string | null;

  // Details
  details: Record<string, unknown>;

  // Result
  success: boolean;
  error_message: string | null;
}

export interface CreateAuditLog {
  user_id?: string;
  user_email?: string;
  ip_address?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: Record<string, unknown>;
  success?: boolean;
  error_message?: string;
}

// ============================================
// Connector Interface
// ============================================

export interface JobContext {
  job_id: string;
  urls: string[];
  config: Record<string, unknown>;
  auth_mode: AuthMode;
  proxy_id?: string;
}

export interface AuthSnapshot {
  session_id: string;
  cookies?: CookieBundle;
  tokens?: OAuthTokens;
  is_valid: boolean;
}

export interface RawData {
  url: string;
  html?: string;
  json?: unknown;
  screenshot_path?: string;
  har_path?: string;
  metadata?: Record<string, unknown>;
}

export interface NormalizedItem {
  url: string;
  post_id?: string;
  author_handle?: string;
  content_type: ContentType;
  text_content?: string;
  title?: string;
  published_at?: string;
  engagement?: EngagementMetrics;
  media_refs?: MediaReference[];
  storage_refs: StorageReferences;
}

export interface Connector {
  name: string;
  requiresAuth: boolean;
  needsBrowser(url: string): boolean;
  prepare(job: JobContext): Promise<AuthSnapshot>;
  crawl(job: JobContext, pageOrResponse: unknown): Promise<RawData>;
  parse(rawData: RawData): Promise<NormalizedItem[]>;
}
