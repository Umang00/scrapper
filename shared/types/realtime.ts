/**
 * Supabase Realtime Channel Payload Types
 * These types define the structure of messages sent over Realtime channels
 */

import { JobStatus, CaptchaStatus, PresenceStatus } from './database';

// ============================================
// Channel: jobs.<crawl_id>
// ============================================

export interface JobStatusPayload {
  event: 'status';
  data: {
    job_id: string;
    status: JobStatus;
    timestamp: string;
    message?: string;
  };
}

export interface JobProgressPayload {
  event: 'progress';
  data: {
    job_id: string;
    total_urls: number;
    processed_urls: number;
    success_count: number;
    error_count: number;
    current_url?: string;
    timestamp: string;
  };
}

export interface JobErrorPayload {
  event: 'error';
  data: {
    job_id: string;
    error_message: string;
    error_details?: Record<string, unknown>;
    url?: string;
    timestamp: string;
  };
}

export interface ItemExtractedPayload {
  event: 'item_extracted';
  data: {
    job_id: string;
    item_id: string;
    url: string;
    content_type: string;
    timestamp: string;
  };
}

export type JobChannelPayload =
  | JobStatusPayload
  | JobProgressPayload
  | JobErrorPayload
  | ItemExtractedPayload;

// ============================================
// Channel: captcha_queue
// ============================================

export interface NewCaptchaPayload {
  event: 'new_captcha';
  data: {
    captcha_id: string;
    job_id: string;
    captcha_type: string;
    source_platform: string;
    url: string;
    screenshot_url?: string;
    site_key?: string;
    timeout_at: string;
    timestamp: string;
  };
}

export interface CaptchaSolvedPayload {
  event: 'captcha_solved';
  data: {
    captcha_id: string;
    solved_by: string;
    timestamp: string;
  };
}

export interface CaptchaTimeoutPayload {
  event: 'captcha_timeout';
  data: {
    captcha_id: string;
    timestamp: string;
  };
}

export type CaptchaChannelPayload =
  | NewCaptchaPayload
  | CaptchaSolvedPayload
  | CaptchaTimeoutPayload;

// ============================================
// Channel: operator_presence
// ============================================

export interface OperatorPresenceState {
  user_id: string;
  email: string;
  online_at: string;
  status: PresenceStatus;
}

export interface PresenceState {
  [userId: string]: OperatorPresenceState[];
}

// ============================================
// Channel: alerts.global
// ============================================

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface AlertAction {
  label: string;
  url: string;
}

export interface GlobalAlertPayload {
  event: 'alert';
  data: {
    alert_id: string;
    severity: AlertSeverity;
    title: string;
    message: string;
    details?: Record<string, unknown>;
    action?: AlertAction;
    timestamp: string;
  };
}

// ============================================
// Helper Types
// ============================================

export interface RealtimeChannelConfig {
  channel: string;
  event?: string;
  schema?: string;
  table?: string;
  filter?: string;
}

export interface BroadcastConfig {
  ack?: boolean;
  self?: boolean;
}

export interface PresenceConfig {
  key: string;
}
