# Captcha Solving Guide

Complete guide to solving captchas in Universal Crawler with 2Captcha integration and human-in-loop fallback.

## 🧩 Overview

The Universal Crawler supports multiple captcha solving strategies:

1. **Automated Solving** - 2Captcha API (paid service)
2. **Manual Solving** - Human-in-loop via API endpoints (free)
3. **Hybrid Mode** - Try 2Captcha first, fallback to manual

## 🔧 Configuration

### Environment Variables

```bash
# Solver mode: auto | manual | hybrid (default: manual)
CAPTCHA_SOLVER_MODE=hybrid

# 2Captcha API key (required for auto/hybrid modes)
TWOCAPTCHA_API_KEY=your_api_key_here

# Max time to wait for solution in milliseconds (default: 120000)
CAPTCHA_TIMEOUT_MS=120000
```

### Solving Modes

**Manual Mode** (Default - Free)
```bash
CAPTCHA_SOLVER_MODE=manual
```
- All captchas solved by humans via API
- No 2Captcha API key required
- Cost: Free
- Speed: Depends on human availability

**Auto Mode** (Paid - Fast)
```bash
CAPTCHA_SOLVER_MODE=auto
TWOCAPTCHA_API_KEY=your_key
```
- All captchas solved by 2Captcha
- Requires valid API key
- Cost: ~$0.50-$3.00 per 1000 captchas
- Speed: 10-40 seconds per captcha

**Hybrid Mode** (Recommended)
```bash
CAPTCHA_SOLVER_MODE=hybrid
TWOCAPTCHA_API_KEY=your_key
```
- Try 2Captcha first
- Fallback to manual if 2Captcha fails
- Best of both worlds
- Cost: Variable based on success rate

## 📦 Supported Captcha Types

### reCAPTCHA v2
```typescript
import { captchaSolver } from '../services/captcha-solver';

const solution = await captchaSolver.solve({
  id: 'unique-challenge-id',
  type: 'recaptcha_v2',
  sitekey: '6Le-wvkSAAAAAPBMRTvw0Q4Muexq9bi0DJwx_mJ-',
  pageUrl: 'https://example.com/page',
});

console.log(solution.token); // g-recaptcha-response token
```

### reCAPTCHA v3
```typescript
const solution = await captchaSolver.solve({
  id: 'unique-challenge-id',
  type: 'recaptcha_v3',
  sitekey: '6Le-wvkSAAAAAPBMRTvw0Q4Muexq9bi0DJwx_mJ-',
  pageUrl: 'https://example.com/page',
  action: 'login', // Optional action name
  minScore: 0.7, // Optional minimum score (0.0-1.0)
});
```

### hCaptcha
```typescript
const solution = await captchaSolver.solve({
  id: 'unique-challenge-id',
  type: 'hcaptcha',
  sitekey: '10000000-ffff-ffff-ffff-000000000001',
  pageUrl: 'https://example.com/page',
});
```

### FunCaptcha (Arkose Labs)
```typescript
const solution = await captchaSolver.solve({
  id: 'unique-challenge-id',
  type: 'funcaptcha',
  sitekey: '11111111-1111-1111-1111-111111111111',
  pageUrl: 'https://example.com/page',
});
```

### Image Captcha
```typescript
const solution = await captchaSolver.solve({
  id: 'unique-challenge-id',
  type: 'image',
  imageData: 'base64_encoded_image_data',
  pageUrl: 'https://example.com/page',
});

console.log(solution.text); // Decoded text (e.g., "abc123")
```

## 🔌 Using in Connectors

### Example: Twitter Connector with Captcha

```typescript
import { captchaSolver } from '../../services/captcha-solver';
import { v4 as uuidv4 } from 'uuid';

export class TwitterConnector extends BaseConnector {
  async crawl(job: JobContext, page: Page, url: string): Promise<RawData> {
    await page.goto(url);

    // Check if captcha is present
    const hasCaptcha = await page.$('iframe[src*="recaptcha"]');

    if (hasCaptcha) {
      logger.info('[Twitter] Captcha detected, solving...');

      // Extract sitekey
      const sitekey = await page.evaluate(() => {
        const iframe = document.querySelector('iframe[src*="recaptcha"]') as HTMLIFrameElement;
        const match = iframe?.src.match(/k=([^&]+)/);
        return match ? match[1] : null;
      });

      if (!sitekey) {
        throw new Error('Could not extract captcha sitekey');
      }

      // Solve captcha
      const solution = await captchaSolver.solve({
        id: uuidv4(),
        type: 'recaptcha_v2',
        sitekey,
        pageUrl: page.url(),
      });

      if (!solution.success) {
        throw new Error(`Captcha solving failed: ${solution.error}`);
      }

      // Inject solution
      await page.evaluate((token) => {
        const textarea = document.getElementById('g-recaptcha-response') as HTMLTextAreaElement;
        if (textarea) {
          textarea.value = token;
        }
      }, solution.token);

      // Submit form
      await page.click('button[type="submit"]');
      await page.waitForNavigation({ waitUntil: 'networkidle' });

      logger.info('[Twitter] Captcha solved successfully', {
        solvedBy: solution.solvedBy,
        solveTime: solution.solveTime,
      });
    }

    // Continue normal crawling
    const html = await page.content();
    // ...
  }
}
```

## 🔄 Human-in-Loop Workflow

When using manual or hybrid mode, captchas are solved by humans via API endpoints.

### 1. Captcha Queue Endpoint

Get pending captchas waiting for solution:

```bash
GET /api/captcha/queue

Response:
{
  "captchas": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "type": "recaptcha_v2",
      "sitekey": "6Le-wvkSAAAAAPBMRTvw0Q4Muexq9bi0DJwx_mJ-",
      "pageUrl": "https://twitter.com/login",
      "status": "pending",
      "createdAt": "2024-01-01T12:00:00Z"
    }
  ]
}
```

### 2. Get Captcha Details

```bash
GET /api/captcha/:id

Response:
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "recaptcha_v2",
  "sitekey": "6Le-wvkSAAAAAPBMRTvw0Q4Muexq9bi0DJwx_mJ-",
  "pageUrl": "https://twitter.com/login",
  "imageData": null, # Base64 image for image captchas
  "status": "pending",
  "createdAt": "2024-01-01T12:00:00Z"
}
```

### 3. Submit Solution

```bash
POST /api/captcha/:id/solve
Content-Type: application/json

{
  "solution": "03AGdBq26QW7vX..."
}

Response:
{
  "success": true,
  "message": "Captcha solved successfully"
}
```

## 🎯 2Captcha API Setup

### 1. Create Account

Sign up at [2captcha.com](https://2captcha.com)

### 2. Get API Key

1. Go to [2captcha.com/enterpage](https://2captcha.com/enterpage)
2. Navigate to "Settings"
3. Copy your API key

### 3. Add Funds

Pricing (as of 2024):
- reCAPTCHA v2: $1.00 per 1000 captchas
- reCAPTCHA v3: $1.50 per 1000 captchas
- hCaptcha: $0.50 per 1000 captchas
- FunCaptcha: $3.00 per 1000 captchas
- Image: $0.50 per 1000 captchas

### 4. Configure Environment

```bash
CAPTCHA_SOLVER_MODE=auto
TWOCAPTCHA_API_KEY=your_api_key_here
```

## 📊 Monitoring & Logging

The captcha solver logs detailed information:

```typescript
// Successful solve
logger.info('Captcha solved via 2Captcha', {
  challengeId: '550e8400-e29b-41d4-a716-446655440000',
  solveTime: 15234, // milliseconds
});

// Manual solve
logger.info('Captcha solved manually', {
  challengeId: '550e8400-e29b-41d4-a716-446655440000',
  solveTime: 45678,
});

// Fallback
logger.warn('2Captcha solving failed', {
  challengeId: '550e8400-e29b-41d4-a716-446655440000',
  error: 'ERROR_CAPTCHA_UNSOLVABLE',
});
```

## 🔧 Troubleshooting

### Problem: 2Captcha Not Working

**Solution:**
1. Verify API key is correct
2. Check account balance
3. Verify captcha type is supported
4. Check for rate limiting (20 captchas/min limit on API)

### Problem: Manual Solving Timeout

**Solution:**
1. Increase timeout: `CAPTCHA_TIMEOUT_MS=180000`
2. Check if humans are monitoring the queue
3. Verify database connection
4. Check API endpoint availability

### Problem: Invalid Sitekey Error

**Solution:**
- Verify the sitekey extraction logic
- Check if the captcha iframe is fully loaded
- Use browser DevTools to inspect the captcha element

### Problem: High Costs with 2Captcha

**Solution:**
1. Switch to hybrid mode (fallback to manual)
2. Implement caching for frequently accessed pages
3. Use session cookies to avoid repeated captchas
4. Consider residential proxies to reduce captcha frequency

## 💡 Best Practices

### 1. Use Hybrid Mode in Production
```bash
CAPTCHA_SOLVER_MODE=hybrid
TWOCAPTCHA_API_KEY=your_key
```
- Automatic solving when available
- Manual fallback for reliability
- Cost-effective

### 2. Monitor Solve Rates
```typescript
const { solvedBy, solveTime } = solution;

// Log metrics
metrics.captcha.solveTime.record(solveTime, { solver: solvedBy });
metrics.captcha.solves.increment({ solver: solvedBy, type: challenge.type });
```

### 3. Implement Retry Logic
```typescript
import { retryWithBackoff } from '../common/retry';

const solution = await retryWithBackoff(
  () => captchaSolver.solve(challenge),
  {
    maxAttempts: 3,
    initialDelay: 5000,
    onRetry: (attempt, error) => {
      logger.warn(`Captcha solve retry ${attempt}`, { error });
    },
  }
);
```

### 4. Cache Solutions
```typescript
// Cache successful tokens for a short period
const cacheKey = `captcha:${challenge.sitekey}:${challenge.pageUrl}`;
const cached = await cache.get(cacheKey);

if (cached) {
  return { success: true, token: cached, solvedBy: 'cache' };
}

const solution = await captchaSolver.solve(challenge);

if (solution.success) {
  await cache.set(cacheKey, solution.token, 300); // 5 minutes
}
```

## 📈 Cost Estimation

### Manual Mode (Free)
- Cost: $0
- Speed: Variable (depends on human availability)
- Best for: Low volume, development, testing

### Auto Mode with 2Captcha
Estimate for 1000 jobs/day with 30% captcha rate:
```
300 captchas/day × $1.00/1000 = $0.30/day
$0.30/day × 30 days = $9.00/month
```

### Hybrid Mode (Recommended)
Assuming 80% success rate with 2Captcha:
```
240 auto-solved × $1.00/1000 = $0.24/day
60 manually solved × $0 = $0/day
Total: $0.24/day or $7.20/month
```

## 🚀 Future Enhancements

- [ ] Support for more captcha types (DataDome, Kasada)
- [ ] Multiple 2Captcha account rotation
- [ ] Real-time captcha solving dashboard
- [ ] Machine learning-based solving
- [ ] Captcha avoidance strategies
- [ ] Browser fingerprint rotation

---

**Need help?** Check the [rate limiting guide](./rate-limiting-and-queues.md) for related best practices.
