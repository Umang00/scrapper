import { logger } from './logger';

// Note: Database operations for manual solving need to be implemented
// This is a placeholder - in production, use the API server's database service
// or implement a shared database client
interface Database {
  query(sql: string, params: any[]): Promise<{ rows: any[] }>;
}

// Mock database for now - will be replaced with actual implementation
const db: Database = {
  async query() {
    throw new Error('Database not configured. Set CAPTCHA_SOLVER_MODE=auto to bypass manual solving.');
  },
};

export interface CaptchaChallenge {
  id: string;
  type: 'recaptcha_v2' | 'recaptcha_v3' | 'hcaptcha' | 'funcaptcha' | 'image';
  sitekey?: string;
  pageUrl: string;
  imageData?: string; // Base64 encoded image for image captchas
  action?: string; // For reCAPTCHA v3
  minScore?: number; // For reCAPTCHA v3
}

export interface CaptchaSolution {
  success: boolean;
  token?: string;
  text?: string; // For image captchas
  error?: string;
  solvedBy: '2captcha' | 'human';
  solveTime: number; // milliseconds
}

/**
 * Captcha Solver Service
 *
 * Supports multiple solving strategies:
 * 1. 2Captcha API (automated, requires API key)
 * 2. Human-in-loop (manual solving via API endpoints)
 *
 * Configuration via environment variables:
 * - CAPTCHA_SOLVER_MODE: 'auto' | 'manual' | 'hybrid' (default: 'manual')
 * - TWOCAPTCHA_API_KEY: 2Captcha API key (required for auto/hybrid)
 * - CAPTCHA_TIMEOUT_MS: Max time to wait for solution (default: 120000)
 */
export class CaptchaSolver {
  private mode: 'auto' | 'manual' | 'hybrid';
  private apiKey?: string;
  private timeout: number;
  private baseUrl = 'https://2captcha.com';

  constructor() {
    this.mode = (process.env.CAPTCHA_SOLVER_MODE as any) || 'manual';
    this.apiKey = process.env.TWOCAPTCHA_API_KEY;
    this.timeout = parseInt(process.env.CAPTCHA_TIMEOUT_MS || '120000');

    if (this.mode !== 'manual' && !this.apiKey) {
      logger.warn('2Captcha API key not configured, falling back to manual mode');
      this.mode = 'manual';
    }

    logger.info('Captcha solver initialized', {
      mode: this.mode,
      hasApiKey: !!this.apiKey,
      timeout: this.timeout,
    });
  }

  /**
   * Solve a captcha using configured strategy
   */
  async solve(challenge: CaptchaChallenge): Promise<CaptchaSolution> {
    const startTime = Date.now();

    logger.info('Solving captcha', {
      type: challenge.type,
      mode: this.mode,
      challengeId: challenge.id,
    });

    try {
      // Try automated solving first (if configured)
      if (this.mode === 'auto' || this.mode === 'hybrid') {
        try {
          const solution = await this.solveWith2Captcha(challenge);
          const solveTime = Date.now() - startTime;

          logger.info('Captcha solved via 2Captcha', {
            challengeId: challenge.id,
            solveTime,
          });

          return {
            ...solution,
            solvedBy: '2captcha',
            solveTime,
          };
        } catch (error) {
          logger.warn('2Captcha solving failed', {
            challengeId: challenge.id,
            error: (error as Error).message,
          });

          // If hybrid mode, fall back to manual
          if (this.mode === 'hybrid') {
            logger.info('Falling back to manual solving');
          } else {
            throw error;
          }
        }
      }

      // Manual solving (human-in-loop)
      const solution = await this.solveManually(challenge);
      const solveTime = Date.now() - startTime;

      logger.info('Captcha solved manually', {
        challengeId: challenge.id,
        solveTime,
      });

      return {
        ...solution,
        solvedBy: 'human',
        solveTime,
      };
    } catch (error) {
      const solveTime = Date.now() - startTime;

      logger.error('Captcha solving failed', {
        challengeId: challenge.id,
        error: (error as Error).message,
        solveTime,
      });

      return {
        success: false,
        error: (error as Error).message,
        solvedBy: this.mode === 'manual' ? 'human' : '2captcha',
        solveTime,
      };
    }
  }

  /**
   * Solve captcha using 2Captcha API
   */
  private async solveWith2Captcha(challenge: CaptchaChallenge): Promise<Omit<CaptchaSolution, 'solvedBy' | 'solveTime'>> {
    if (!this.apiKey) {
      throw new Error('2Captcha API key not configured');
    }

    // Submit captcha to 2Captcha
    const taskId = await this.submit2CaptchaTask(challenge);

    // Poll for solution
    const solution = await this.poll2CaptchaSolution(taskId);

    return solution;
  }

  /**
   * Submit captcha task to 2Captcha
   */
  private async submit2CaptchaTask(challenge: CaptchaChallenge): Promise<string> {
    const params = new URLSearchParams({
      key: this.apiKey!,
      json: '1',
    });

    // Add challenge-specific parameters
    switch (challenge.type) {
      case 'recaptcha_v2':
        params.append('method', 'userrecaptcha');
        params.append('googlekey', challenge.sitekey!);
        params.append('pageurl', challenge.pageUrl);
        break;

      case 'recaptcha_v3':
        params.append('method', 'userrecaptcha');
        params.append('version', 'v3');
        params.append('googlekey', challenge.sitekey!);
        params.append('pageurl', challenge.pageUrl);
        if (challenge.action) params.append('action', challenge.action);
        if (challenge.minScore) params.append('min_score', challenge.minScore.toString());
        break;

      case 'hcaptcha':
        params.append('method', 'hcaptcha');
        params.append('sitekey', challenge.sitekey!);
        params.append('pageurl', challenge.pageUrl);
        break;

      case 'funcaptcha':
        params.append('method', 'funcaptcha');
        params.append('publickey', challenge.sitekey!);
        params.append('pageurl', challenge.pageUrl);
        break;

      case 'image':
        if (!challenge.imageData) {
          throw new Error('Image data required for image captcha');
        }
        params.append('method', 'base64');
        params.append('body', challenge.imageData);
        break;

      default:
        throw new Error(`Unsupported captcha type: ${challenge.type}`);
    }

    const response = await fetch(`${this.baseUrl}/in.php?${params.toString()}`);
    const data = await response.json();

    if (data.status !== 1) {
      throw new Error(`2Captcha submission failed: ${data.request}`);
    }

    return data.request; // Task ID
  }

  /**
   * Poll 2Captcha for solution
   */
  private async poll2CaptchaSolution(taskId: string): Promise<Omit<CaptchaSolution, 'solvedBy' | 'solveTime'>> {
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds

    while (Date.now() - startTime < this.timeout) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const params = new URLSearchParams({
        key: this.apiKey!,
        action: 'get',
        id: taskId,
        json: '1',
      });

      const response = await fetch(`${this.baseUrl}/res.php?${params.toString()}`);
      const data = await response.json();

      if (data.status === 1) {
        // Solution ready
        return {
          success: true,
          token: data.request,
        };
      }

      if (data.request !== 'CAPCHA_NOT_READY') {
        // Error occurred
        throw new Error(`2Captcha error: ${data.request}`);
      }

      // Continue polling
    }

    throw new Error('2Captcha timeout: solution not received in time');
  }

  /**
   * Solve captcha manually (human-in-loop)
   *
   * This creates a captcha challenge record in the database and waits for a human
   * to solve it via the API endpoints.
   */
  private async solveManually(challenge: CaptchaChallenge): Promise<Omit<CaptchaSolution, 'solvedBy' | 'solveTime'>> {
    // Store captcha challenge in database
    await db.query(
      `INSERT INTO captcha_challenges (id, type, sitekey, page_url, image_data, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
       ON CONFLICT (id) DO UPDATE SET
         type = $2,
         sitekey = $3,
         page_url = $4,
         image_data = $5,
         status = 'pending',
         created_at = NOW()`,
      [challenge.id, challenge.type, challenge.sitekey, challenge.pageUrl, challenge.imageData]
    );

    logger.info('Captcha challenge created, waiting for human solver', {
      challengeId: challenge.id,
    });

    // Poll database for solution
    const startTime = Date.now();
    const pollInterval = 2000; // 2 seconds

    while (Date.now() - startTime < this.timeout) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const result = await db.query(
        `SELECT status, solution FROM captcha_challenges WHERE id = $1`,
        [challenge.id]
      );

      if (result.rows.length === 0) {
        throw new Error('Captcha challenge not found');
      }

      const { status, solution } = result.rows[0];

      if (status === 'solved') {
        return {
          success: true,
          token: solution,
        };
      }

      if (status === 'failed') {
        throw new Error('Captcha marked as failed by human solver');
      }

      // Continue polling
    }

    // Mark as expired
    await db.query(
      `UPDATE captcha_challenges SET status = 'expired' WHERE id = $1`,
      [challenge.id]
    );

    throw new Error('Manual solving timeout: no human solver responded');
  }

  /**
   * Get solver configuration
   */
  getConfig() {
    return {
      mode: this.mode,
      hasApiKey: !!this.apiKey,
      timeout: this.timeout,
    };
  }
}

// Global instance
export const captchaSolver = new CaptchaSolver();
