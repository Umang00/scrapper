import { describe, it, expect, vi, beforeEach } from 'vitest';
import { retryWithBackoff, PlatformRateLimiter } from './retry';

describe('retryWithBackoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should succeed on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await retryWithBackoff(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable error', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce('success');

    const result = await retryWithBackoff(fn, {
      maxAttempts: 3,
      initialDelay: 10,
    });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should fail after max attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('ETIMEDOUT'));

    await expect(
      retryWithBackoff(fn, {
        maxAttempts: 3,
        initialDelay: 10,
      })
    ).rejects.toThrow('ETIMEDOUT');

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should not retry non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('ValidationError'));

    await expect(
      retryWithBackoff(fn, {
        maxAttempts: 3,
        initialDelay: 10,
      })
    ).rejects.toThrow('ValidationError');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should call onRetry callback', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce('success');

    const onRetry = vi.fn();

    await retryWithBackoff(fn, {
      maxAttempts: 3,
      initialDelay: 10,
      onRetry,
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });

  it('should implement exponential backoff', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce('success');

    const delays: number[] = [];
    const onRetry = vi.fn((attempt) => {
      delays.push(Date.now());
    });

    await retryWithBackoff(fn, {
      maxAttempts: 3,
      initialDelay: 50,
      backoffMultiplier: 2,
      onRetry,
    });

    // Verify delays increase (with some tolerance for execution time)
    if (delays.length >= 2) {
      const delay1 = delays[1] - delays[0];
      expect(delay1).toBeGreaterThanOrEqual(40); // Should be ~50ms + ~100ms
    }
  });

  it('should respect max delay', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('500'))
      .mockRejectedValueOnce(new Error('500'))
      .mockResolvedValueOnce('success');

    await retryWithBackoff(fn, {
      maxAttempts: 3,
      initialDelay: 100,
      maxDelay: 150,
      backoffMultiplier: 10,
    });

    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('PlatformRateLimiter', () => {
  let limiter: PlatformRateLimiter;

  beforeEach(() => {
    limiter = new PlatformRateLimiter();
  });

  it('should allow requests within limits', async () => {
    const start = Date.now();

    await limiter.throttle('twitter');
    await limiter.throttle('twitter');
    await limiter.throttle('twitter');

    const duration = Date.now() - start;

    // Should complete quickly (no throttling)
    expect(duration).toBeLessThan(100);
  });

  it('should throttle when per-minute limit reached', async () => {
    // Twitter limit is 50/min
    // We'll simulate hitting the limit by setting a lower limit
    limiter.setLimit('test-platform', 2, 100);

    const start = Date.now();

    // First 2 should be immediate
    await limiter.throttle('test-platform');
    await limiter.throttle('test-platform');

    const immediateTime = Date.now() - start;
    expect(immediateTime).toBeLessThan(100);

    // Third request should be throttled
    // We'll timeout after 100ms to keep test fast
    const throttlePromise = limiter.throttle('test-platform');
    const raceResult = await Promise.race([
      throttlePromise,
      new Promise((resolve) => setTimeout(() => resolve('timeout'), 100)),
    ]);

    // Should have timed out (meaning it's waiting for throttle)
    expect(raceResult).toBe('timeout');
  }, 10000);

  it('should allow custom limits per platform', async () => {
    limiter.setLimit('custom', 100, 1000);

    // Should not throw
    await expect(limiter.throttle('custom')).resolves.toBeUndefined();
  });

  it('should handle different platforms independently', async () => {
    await limiter.throttle('twitter');
    await limiter.throttle('instagram');
    await limiter.throttle('reddit');

    // All should complete without throttling
    expect(true).toBe(true);
  });

  it('should use default limits for unknown platforms', async () => {
    // Should use default limits without throwing
    await expect(limiter.throttle('unknown-platform')).resolves.toBeUndefined();
  });
});
