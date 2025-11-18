import { logger } from '../services/logger';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number; // milliseconds
  maxDelay?: number; // milliseconds
  backoffMultiplier?: number;
  retryableErrors?: string[]; // Error messages that trigger retry
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ECONNREFUSED',
    'NetworkError',
    'TimeoutError',
    '429', // Rate limit
    '500', // Internal Server Error
    '502', // Bad Gateway
    '503', // Service Unavailable
    '504', // Gateway Timeout
  ],
  onRetry: () => {},
};

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error;
  let delay = opts.initialDelay;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      const isRetryable = isErrorRetryable(lastError, opts.retryableErrors);

      if (!isRetryable || attempt === opts.maxAttempts) {
        logger.error('Max retry attempts reached or non-retryable error', {
          attempt,
          maxAttempts: opts.maxAttempts,
          error: lastError.message,
          retryable: isRetryable,
        });
        throw lastError;
      }

      // Log retry attempt
      logger.warn('Retrying after error', {
        attempt,
        maxAttempts: opts.maxAttempts,
        delay,
        error: lastError.message,
      });

      // Call onRetry callback
      if (opts.onRetry) {
        opts.onRetry(attempt, lastError);
      }

      // Wait before retrying
      await sleep(delay);

      // Calculate next delay with exponential backoff
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError!;
}

/**
 * Check if error is retryable based on error message or code
 */
function isErrorRetryable(error: Error, retryableErrors: string[]): boolean {
  const errorCode = error && typeof error === 'object' && 'code' in error ? (error as { code: string }).code : '';
  const errorString = error.message + ' ' + errorCode;

  return retryableErrors.some((retryable) =>
    errorString.toLowerCase().includes(retryable.toLowerCase())
  );
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry decorator for class methods
 */
export function Retry(options: RetryOptions = {}) {
  return function (
    _target: object,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      return retryWithBackoff(
        () => originalMethod.apply(this, args),
        options
      );
    };

    return descriptor;
  };
}

/**
 * Per-platform rate limiting with retry
 */
export class PlatformRateLimiter {
  private requestTimestamps: Map<string, number[]> = new Map();
  private limits: Map<string, { requestsPerMinute: number; requestsPerHour: number }> = new Map();

  constructor() {
    // Configure rate limits per platform
    this.limits.set('twitter', {
      requestsPerMinute: 50,
      requestsPerHour: 500,
    });

    this.limits.set('instagram', {
      requestsPerMinute: 30,
      requestsPerHour: 200,
    });

    this.limits.set('reddit', {
      requestsPerMinute: 60,
      requestsPerHour: 600,
    });

    this.limits.set('default', {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
    });
  }

  /**
   * Check if request can be made, wait if needed
   */
  async throttle(platform: string): Promise<void> {
    const limits = this.limits.get(platform) || this.limits.get('default')!;
    const timestamps = this.requestTimestamps.get(platform) || [];
    const now = Date.now();

    // Remove timestamps older than 1 hour
    const recentTimestamps = timestamps.filter((ts) => now - ts < 60 * 60 * 1000);

    // Check hourly limit
    if (recentTimestamps.length >= limits.requestsPerHour) {
      const oldestTimestamp = recentTimestamps[0];
      const waitTime = 60 * 60 * 1000 - (now - oldestTimestamp);

      logger.warn(`[Rate Limit] Hourly limit reached for ${platform}, waiting ${waitTime}ms`, {
        platform,
        limit: limits.requestsPerHour,
        current: recentTimestamps.length,
      });

      await sleep(waitTime);
      return this.throttle(platform); // Re-check after waiting
    }

    // Check per-minute limit
    const lastMinuteTimestamps = recentTimestamps.filter((ts) => now - ts < 60 * 1000);

    if (lastMinuteTimestamps.length >= limits.requestsPerMinute) {
      const oldestTimestamp = lastMinuteTimestamps[0];
      const waitTime = 60 * 1000 - (now - oldestTimestamp) + 1000; // Add 1s buffer

      logger.warn(`[Rate Limit] Per-minute limit reached for ${platform}, waiting ${waitTime}ms`, {
        platform,
        limit: limits.requestsPerMinute,
        current: lastMinuteTimestamps.length,
      });

      await sleep(waitTime);
      return this.throttle(platform); // Re-check after waiting
    }

    // Add current timestamp
    recentTimestamps.push(now);
    this.requestTimestamps.set(platform, recentTimestamps);

    logger.debug(`[Rate Limit] Request allowed for ${platform}`, {
      platform,
      perMinute: lastMinuteTimestamps.length + 1,
      perHour: recentTimestamps.length + 1,
    });
  }

  /**
   * Update rate limits for a platform
   */
  setLimit(platform: string, requestsPerMinute: number, requestsPerHour: number): void {
    this.limits.set(platform, { requestsPerMinute, requestsPerHour });
    logger.info(`[Rate Limit] Updated limits for ${platform}`, {
      platform,
      requestsPerMinute,
      requestsPerHour,
    });
  }
}

// Global rate limiter instance
export const platformRateLimiter = new PlatformRateLimiter();
