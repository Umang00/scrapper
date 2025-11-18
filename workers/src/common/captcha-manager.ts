import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import { Page } from 'playwright';
import { logger } from '../services/logger';
import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';

export interface CaptchaChallenge {
  id: string;
  type: string;
  url: string;
  siteKey?: string;
  screenshotPath?: string;
  timeout: number;
}

export class CaptchaManager {
  private pool: Pool;
  private supabase: ReturnType<typeof createClient>;
  private pendingCaptchas: Map<string, Promise<string>> = new Map();

  constructor() {
    this.pool = new Pool({
      connectionString: config.database.url,
      max: 5,
    });

    this.supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);
  }

  async detectCaptcha(page: Page): Promise<CaptchaChallenge | null> {
    try {
      // Check for common captcha selectors
      const captchaSelectors = [
        'iframe[src*="recaptcha"]',
        'iframe[src*="hcaptcha"]',
        '.g-recaptcha',
        '.h-captcha',
        '#captcha',
        '[data-sitekey]',
      ];

      for (const selector of captchaSelectors) {
        const element = await page.$(selector);
        if (element) {
          const siteKey = await element.getAttribute('data-sitekey');
          const captchaType = selector.includes('hcaptcha') ? 'hcaptcha' : 'recaptcha';

          logger.info('Captcha detected', {
            type: captchaType,
            url: page.url(),
            siteKey,
          });

          return {
            id: uuidv4(),
            type: captchaType,
            url: page.url(),
            siteKey: siteKey || undefined,
            timeout: 300000, // 5 minutes
          };
        }
      }

      return null;
    } catch (error) {
      logger.error('Error detecting captcha', { error });
      return null;
    }
  }

  async requestSolution(
    challenge: CaptchaChallenge,
    jobId: string,
    screenshotS3Key?: string
  ): Promise<string> {
    // Check if already pending
    if (this.pendingCaptchas.has(challenge.id)) {
      logger.debug('Captcha solution already pending', { captchaId: challenge.id });
      return this.pendingCaptchas.get(challenge.id)!;
    }

    const solutionPromise = new Promise<string>(async (resolve, reject) => {
      try {
        // Insert captcha event into database
        const timeoutAt = new Date(Date.now() + challenge.timeout);

        await this.pool.query(
          `INSERT INTO captcha_events (
            id, crawl_id, captcha_type, source_platform, url, site_key,
            screenshot_s3_key, status, timeout_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id`,
          [
            challenge.id,
            jobId,
            challenge.type,
            'unknown', // Will be set by connector
            challenge.url,
            challenge.siteKey || null,
            screenshotS3Key || null,
            'pending',
            timeoutAt,
          ]
        );

        logger.info('Captcha event created', { captchaId: challenge.id, jobId });

        // Broadcast to captcha queue channel
        await this.supabase.channel('captcha_queue').send({
          type: 'broadcast',
          event: 'new_captcha',
          payload: {
            captcha_id: challenge.id,
            job_id: jobId,
            captcha_type: challenge.type,
            url: challenge.url,
            site_key: challenge.siteKey,
            screenshot_url: screenshotS3Key ? `s3://${config.aws.s3BucketName}/${screenshotS3Key}` : undefined,
            timeout_at: timeoutAt.toISOString(),
            timestamp: new Date().toISOString(),
          },
        });

        // Poll for solution
        const startTime = Date.now();
        const pollInterval = 2000; // 2 seconds

        const poll = async (): Promise<void> => {
          if (Date.now() - startTime > challenge.timeout) {
            // Timeout
            await this.pool.query(
              'UPDATE captcha_events SET status = $1 WHERE id = $2',
              ['timeout', challenge.id]
            );

            logger.warn('Captcha solution timeout', { captchaId: challenge.id });
            reject(new Error('Captcha solution timeout'));
            return;
          }

          // Check if solved
          const result = await this.pool.query(
            'SELECT status, solution_token FROM captcha_events WHERE id = $1',
            [challenge.id]
          );

          if (result.rows.length > 0) {
            const { status, solution_token } = result.rows[0];

            if (status === 'solved' && solution_token) {
              logger.info('Captcha solved', { captchaId: challenge.id });
              resolve(solution_token);
              return;
            }

            if (status === 'failed' || status === 'timeout') {
              reject(new Error(`Captcha ${status}`));
              return;
            }
          }

          // Continue polling
          setTimeout(poll, pollInterval);
        };

        await poll();
      } catch (error) {
        logger.error('Error requesting captcha solution', { error });
        reject(error);
      } finally {
        this.pendingCaptchas.delete(challenge.id);
      }
    });

    this.pendingCaptchas.set(challenge.id, solutionPromise);
    return solutionPromise;
  }

  async close(): Promise<void> {
    await this.pool.end();
    logger.info('Captcha manager closed');
  }
}

export const captchaManager = new CaptchaManager();
