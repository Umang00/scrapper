import { Page } from 'playwright';
import { logger } from '../services/logger';

export interface JobContext {
  jobId: string;
  urls: string[];
  config: Record<string, unknown>;
  authMode: 'public' | 'session_cookie' | 'oauth' | 'api_key' | 'interactive';
  proxyId?: string;
}

export interface AuthSnapshot {
  sessionId: string;
  cookies?: any[];
  tokens?: Record<string, unknown>;
  isValid: boolean;
}

export interface RawData {
  url: string;
  html?: string;
  json?: unknown;
  screenshotPath?: string;
  harPath?: string;
  metadata?: Record<string, unknown>;
}

export interface NormalizedItem {
  url: string;
  postId?: string;
  authorHandle?: string;
  contentType: 'post' | 'comment' | 'article' | 'video' | 'image' | 'story' | 'reel' | 'thread';
  textContent?: string;
  title?: string;
  publishedAt?: string;
  engagement?: {
    likes?: number;
    shares?: number;
    comments?: number;
    views?: number;
    [key: string]: number | undefined;
  };
  mediaRefs?: Array<{
    type: string;
    url: string;
    s3Key?: string;
  }>;
  storageRefs: {
    screenshot?: string;
    har?: string;
    html?: string;
    [key: string]: string | undefined;
  };
}

export abstract class BaseConnector {
  abstract name: string;
  abstract requiresAuth: boolean;

  /**
   * Determine if this URL needs browser automation
   */
  abstract needsBrowser(url: string): boolean;

  /**
   * Prepare authentication and session
   */
  async prepare(job: JobContext): Promise<AuthSnapshot> {
    logger.info('Preparing connector', { connector: this.name, jobId: job.jobId });

    if (!this.requiresAuth) {
      return {
        sessionId: 'public',
        isValid: true,
      };
    }

    // Subclasses should override this for platform-specific auth
    return {
      sessionId: 'default',
      isValid: false,
    };
  }

  /**
   * Crawl the URL and extract raw data
   */
  abstract crawl(job: JobContext, page: Page | null, url: string): Promise<RawData>;

  /**
   * Parse raw data into normalized items
   */
  abstract parse(rawData: RawData): Promise<NormalizedItem[]>;

  /**
   * Extract metadata from page
   */
  protected async extractMetaTags(page: Page): Promise<Record<string, string>> {
    const metaTags: Record<string, string> = {};

    try {
      const metaElements = await page.$$('meta');

      for (const meta of metaElements) {
        const name = (await meta.getAttribute('name')) || (await meta.getAttribute('property'));
        const content = await meta.getAttribute('content');

        if (name && content) {
          metaTags[name] = content;
        }
      }
    } catch {
      logger.warn('Failed to extract meta tags');
    }

    return metaTags;
  }

  /**
   * Wait for page to be ready
   */
  protected async waitForReady(page: Page, timeout: number = 30000): Promise<void> {
    try {
      await page.waitForLoadState('networkidle', { timeout });
    } catch {
      logger.warn('Page did not reach networkidle state', { url: page.url() });
    }
  }

  /**
   * Handle infinite scroll
   */
  protected async handleInfiniteScroll(
    page: Page,
    maxScrolls: number = 5,
    scrollDelay: number = 1000
  ): Promise<void> {
    let previousHeight = 0;
    let scrollCount = 0;

    while (scrollCount < maxScrolls) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(scrollDelay);

      const currentHeight = await page.evaluate(() => document.body.scrollHeight);

      if (currentHeight === previousHeight) {
        // No more content to load
        break;
      }

      previousHeight = currentHeight;
      scrollCount++;
    }

    logger.debug('Infinite scroll completed', { scrolls: scrollCount });
  }
}
