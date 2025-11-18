# Rate Limiting & Job Queue System

Complete guide to rate limiting, retry logic, and job queue management in Universal Crawler.

## 🚦 Rate Limiting

### API Rate Limiting

All API endpoints are protected with rate limiting to prevent abuse.

#### General API Limits

```typescript
// Applied to all /api/* endpoints
Rate Limit: 100 requests per 15 minutes per IP
```

**What happens when limit exceeded:**
```json
{
  "status": "error",
  "message": "Too many requests from this IP, please try again later",
  "retryAfter": "2024-01-01T12:15:00Z"
}
```

#### Specific Endpoint Limits

**Job Creation** (`POST /api/jobs`)
```typescript
Rate Limit: 10 jobs per hour per IP
Purpose: Prevent resource exhaustion from excessive crawl jobs
```

**Authentication** (`POST /api/auth/sessions`)
```typescript
Rate Limit: 5 attempts per 15 minutes per IP
Purpose: Prevent brute force attacks
Skip successful requests: Yes
```

**Captcha Solving** (`POST /api/captcha/:id/solve`)
```typescript
Rate Limit: 20 solutions per minute per IP
Purpose: Prevent captcha solving abuse
```

### Platform-Specific Rate Limiting (Workers)

Each social media platform has its own rate limits to avoid getting blocked:

```typescript
// workers/src/common/retry.ts - PlatformRateLimiter

Twitter:
- 50 requests per minute
- 500 requests per hour

Instagram:
- 30 requests per minute
- 200 requests per hour

Reddit:
- 60 requests per minute
- 600 requests per hour

Default (other platforms):
- 60 requests per minute
- 1000 requests per hour
```

#### Usage in Connectors

```typescript
import { platformRateLimiter } from '../common/retry';

export class TwitterConnector extends BaseConnector {
  async crawl(job, page, url) {
    // Wait if rate limit would be exceeded
    await platformRateLimiter.throttle('twitter');

    // Now safe to make request
    await page.goto(url);
    // ...
  }
}
```

#### Configure Custom Limits

```typescript
import { platformRateLimiter } from './common/retry';

// Customize limits for a platform
platformRateLimiter.setLimit('twitter', 30, 300); // 30/min, 300/hour
```

## 🔄 Retry Logic with Exponential Backoff

Automatic retry for transient failures with exponential backoff.

### Default Retry Configuration

```typescript
{
  maxAttempts: 3,
  initialDelay: 1000,        // 1 second
  maxDelay: 30000,           // 30 seconds max
  backoffMultiplier: 2,      // Double delay each time
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ECONNREFUSED',
    'NetworkError',
    'TimeoutError',
    '429', // Rate limit
    '500', '502', '503', '504'
  ]
}
```

### Retry Timeline Example

```
Attempt 1: Fails → Wait 1 second
Attempt 2: Fails → Wait 2 seconds
Attempt 3: Fails → Throw error
```

### Usage

**Functional Approach:**

```typescript
import { retryWithBackoff } from '../common/retry';

const result = await retryWithBackoff(
  async () => {
    return await fetch('https://api.example.com/data');
  },
  {
    maxAttempts: 5,
    initialDelay: 2000,
    onRetry: (attempt, error) => {
      logger.warn(`Retry attempt ${attempt}`, { error });
    },
  }
);
```

**Decorator Approach:**

```typescript
import { Retry } from '../common/retry';

class MyConnector {
  @Retry({ maxAttempts: 5, initialDelay: 2000 })
  async crawl(url: string) {
    return await fetch(url);
  }
}
```

### Retryable vs Non-Retryable Errors

**Retryable (automatic retry):**
- Network errors (timeout, connection reset)
- 429 Rate Limit
- 500, 502, 503, 504 (server errors)

**Non-Retryable (fail immediately):**
- 400 Bad Request
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found
- ValidationError
- AuthenticationError

## 📋 Job Queue System

Database-backed job queue with PostgreSQL advisory locks.

### Features

✅ **Atomic job claiming** - No duplicate processing
✅ **Automatic retry** - Stuck jobs are retried after 1 hour
✅ **Concurrent processing** - Process multiple jobs in parallel
✅ **Graceful shutdown** - Wait for jobs to complete
✅ **Queue stats** - Monitor pending, running, completed jobs

### Architecture

```
┌─────────────┐
│  API Server │ ──enqueue()──┐
└─────────────┘              │
                             ▼
                    ┌─────────────────┐
                    │  PostgreSQL     │
                    │  crawl_jobs     │
                    │  (Job Queue)    │
                    └─────────────────┘
                             │
                   ┌─────────┼─────────┐
                   ▼         ▼         ▼
              ┌────────┐ ┌────────┐ ┌────────┐
              │Worker 1│ │Worker 2│ │Worker 3│
              └────────┘ └────────┘ └────────┘
```

### Usage

**Start Worker:**

```typescript
import { jobQueue } from './services/job-queue';
import { CrawlerWorker } from './crawler';

const crawler = new CrawlerWorker();

// Start processing jobs
await jobQueue.start(async (job) => {
  await crawler.execute(job);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await jobQueue.stop();
  process.exit(0);
});
```

**Enqueue Job (API Server):**

```typescript
import { jobQueue } from '../workers/services/job-queue';

// Add job to queue
const jobId = await jobQueue.enqueue({
  connector: 'twitter',
  source_platform: 'twitter',
  urls: ['https://twitter.com/user/status/123'],
  config: { auth_required: true },
});
```

**Monitor Queue:**

```typescript
const stats = await jobQueue.getStats();
console.log(stats);
// {
//   pending: 10,
//   running: 3,
//   completed: 50,
//   failed: 2,
//   processing: 3
// }
```

**Cancel Job:**

```typescript
await jobQueue.cancel(jobId);
```

**Retry Failed Job:**

```typescript
await jobQueue.retry(jobId);
```

**Cleanup Old Jobs:**

```typescript
// Delete completed/failed jobs older than 30 days
const deleted = await jobQueue.cleanup(30);
```

### Configuration

```typescript
const jobQueue = new JobQueue({
  pollInterval: 5000,        // Poll every 5 seconds
  maxConcurrentJobs: 5,      // Process 5 jobs at once
});
```

**Scaling:**

- **Vertical**: Increase `maxConcurrentJobs` per worker
- **Horizontal**: Deploy multiple worker instances
- Each worker polls independently
- PostgreSQL advisory locks prevent duplicate processing

### Job States

```
pending → running → completed
                  → failed
                  → cancelled
```

**Automatic Retry:**
- Jobs stuck in "running" for >1 hour are automatically retried
- Manual retry available for failed jobs

### Production Upgrade Path

For high volume (>1000 jobs/day), consider migrating to:

**BullMQ (Redis-based):**
```bash
npm install bullmq ioredis
```

```typescript
import { Queue, Worker } from 'bullmq';

const jobQueue = new Queue('crawl-jobs', {
  connection: { host: 'localhost', port: 6379 },
});

const worker = new Worker('crawl-jobs', async (job) => {
  await crawler.execute(job.data);
}, {
  connection: { host: 'localhost', port: 6379 },
  concurrency: 10,
});
```

**Advantages of BullMQ:**
- ✅ Higher performance (in-memory)
- ✅ Advanced features (priorities, delayed jobs, rate limiting)
- ✅ Dashboard (Bull Board)
- ✅ Better for >10,000 jobs/day

**Current PostgreSQL Queue:**
- ✅ Simple (no extra infrastructure)
- ✅ Good for <1000 jobs/day
- ✅ ACID guarantees
- ✅ Free tier friendly (Render/Railway)

## 🎯 Best Practices

### API Rate Limiting

1. **Monitor rate limit headers:**
```typescript
const response = await fetch('/api/jobs');
console.log(response.headers.get('X-RateLimit-Limit'));
console.log(response.headers.get('X-RateLimit-Remaining'));
console.log(response.headers.get('X-RateLimit-Reset'));
```

2. **Implement client-side backoff:**
```typescript
if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After');
  await sleep(parseInt(retryAfter) * 1000);
  // Retry request
}
```

### Platform Rate Limiting

1. **Always throttle before requests:**
```typescript
await platformRateLimiter.throttle('twitter');
await page.goto(url);
```

2. **Add random delays:**
```typescript
// Appear more human
const randomDelay = 1000 + Math.random() * 2000;
await page.waitForTimeout(randomDelay);
```

3. **Monitor logs:**
```
[Rate Limit] Hourly limit reached for twitter, waiting 30000ms
```

### Retry Logic

1. **Use for network operations:**
```typescript
const html = await retryWithBackoff(async () => {
  return await page.content();
}, { maxAttempts: 3 });
```

2. **Don't retry validation errors:**
```typescript
if (error.message.includes('ValidationError')) {
  throw error; // Don't retry
}
```

3. **Log retry attempts:**
```typescript
await retryWithBackoff(fn, {
  onRetry: (attempt, error) => {
    logger.warn(`Retry ${attempt}`, { error: error.message });
  },
});
```

### Job Queue

1. **Set appropriate timeouts:**
```typescript
// In connector
async crawl(job, page, url) {
  // Don't let job run forever
  await page.goto(url, { timeout: 30000 });
}
```

2. **Update progress:**
```typescript
// In worker
for (const url of job.urls) {
  await processUrl(url);
  await db.query(
    'UPDATE crawl_jobs SET processed_urls = processed_urls + 1 WHERE id = $1',
    [job.id]
  );
}
```

3. **Handle errors gracefully:**
```typescript
try {
  await processJob(job);
} catch (error) {
  logger.error('Job failed', { jobId: job.id, error });
  // Error is automatically logged and job marked as failed
}
```

## 🔧 Troubleshooting

### Rate Limit Issues

**Problem: Getting 429 errors**
```
Solution: Reduce job creation frequency or contact admin to increase limits
```

**Problem: Platform blocking requests**
```
Solution:
1. Check platformRateLimiter logs
2. Increase delays between requests
3. Use residential proxies
4. Rotate user agents
```

### Retry Issues

**Problem: Job keeps failing after retries**
```
Solution:
1. Check error logs for root cause
2. Fix non-retryable errors (auth, validation)
3. Increase maxAttempts if transient
```

**Problem: Retry delays too long**
```
Solution: Adjust retry configuration:
platformRateLimiter.setLimit('twitter', 30, 300);
```

### Queue Issues

**Problem: Jobs stuck in "running" state**
```
Solution: Wait 1 hour for automatic retry, or manually:
UPDATE crawl_jobs SET status = 'pending' WHERE id = 'xxx';
```

**Problem: Queue growing too fast**
```
Solution:
1. Scale workers horizontally
2. Increase maxConcurrentJobs
3. Optimize connector performance
```

**Problem: Duplicate job processing**
```
Solution: PostgreSQL advisory locks prevent this. If occurring, check:
1. Database connection issues
2. Worker configuration
```

## 📊 Monitoring

### API Rate Limits

```bash
# Check current rate limit usage
curl -I https://your-api.com/api/jobs

# Headers:
# X-RateLimit-Limit: 100
# X-RateLimit-Remaining: 75
# X-RateLimit-Reset: 1640000000
```

### Platform Rate Limits

```typescript
// Check logs for rate limit warnings
grep "Rate Limit" logs/workers.log

// Example output:
// [Rate Limit] Request allowed for twitter {perMinute: 45, perHour: 200}
// [Rate Limit] Per-minute limit reached for twitter, waiting 5000ms
```

### Queue Stats

```typescript
// Get queue statistics
const stats = await jobQueue.getStats();

// {
//   pending: 10,      // Waiting to be processed
//   running: 3,       // Currently processing
//   completed: 50,    // Successfully completed
//   failed: 2,        // Failed jobs
//   processing: 3     // Active workers
// }
```

### Metrics to Track

1. **API Rate Limit Hit Rate** - How often users hit limits
2. **Platform Rate Limit Wait Time** - Average wait time per platform
3. **Retry Success Rate** - % of jobs that succeed after retry
4. **Queue Processing Time** - Average time from enqueue to completion
5. **Worker Utilization** - % of time workers are busy

## 🚀 Production Checklist

Before going live:

- [ ] Test rate limits with load testing tool
- [ ] Configure appropriate rate limits for your use case
- [ ] Set up monitoring for rate limit violations
- [ ] Test retry logic with network failures
- [ ] Configure platform rate limits based on account tier
- [ ] Set up queue monitoring dashboard
- [ ] Test graceful shutdown of workers
- [ ] Configure auto-scaling for workers (Render/Railway)
- [ ] Set up alerts for queue growth
- [ ] Test job cancellation and retry
- [ ] Document rate limits for API users
- [ ] Consider Redis/BullMQ upgrade if >1000 jobs/day

---

**Rate limiting, retry logic, and job queues are now production-ready!** 🎉
