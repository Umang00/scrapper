import { Page } from 'playwright';
import {
  BaseConnector,
  JobContext,
  RawData,
  NormalizedItem,
} from '../base-connector';
import { logger } from '../../services/logger';

/**
 * Twitter/X Connector
 *
 * Extracts tweets, profiles, and timelines from Twitter/X.
 * Requires authentication cookies for most content.
 *
 * NOTE: This is a simplified implementation. Full production version should include:
 * - Advanced tweet parsing (threads, quoted tweets, retweets)
 * - Infinite scroll for timelines
 * - Video extraction and download
 * - Rate limiting and retry logic
 * - Profile follower/following extraction
 */
export class TwitterConnector extends BaseConnector {
  name = 'twitter';
  requiresAuth = true;

  needsBrowser(_url: string): boolean {
    return true; // Twitter requires JavaScript
  }

  async crawl(_job: JobContext, page: Page | null, url: string): Promise<RawData> {
    logger.info('[Twitter] Crawling URL', { url });

    if (!page) {
      throw new Error('Twitter connector requires browser');
    }

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // Wait for Twitter content to load
      await this.waitForReady(page, 10000);
      await page.waitForSelector('[data-testid="primaryColumn"]', { timeout: 10000 }).catch(() => {
        logger.warn('[Twitter] Primary column not found');
      });

      const html = await page.content();
      const screenshotPath = `/tmp/twitter-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: false });
      const metadata = await this.extractMetaTags(page);

      logger.info('[Twitter] Successfully crawled', { url });

      return {
        url,
        html,
        screenshotPath,
        metadata: {
          ...metadata,
          platform: 'twitter',
          urlType: this.detectUrlType(url),
        },
      };
    } catch (error) {
      logger.error('[Twitter] Error crawling', { url, error });
      throw error;
    }
  }

  async parse(rawData: RawData): Promise<NormalizedItem[]> {
    logger.info('[Twitter] Parsing data', { url: rawData.url });

    const title = (rawData.metadata?.['og:title'] as string) || 'Twitter Post';
    const description = (rawData.metadata?.['og:description'] as string) || '';
    const image = rawData.metadata?.['og:image'] as string;

    const item: NormalizedItem = {
      url: rawData.url,
      contentType: 'post',
      title,
      textContent: description,
      publishedAt: new Date().toISOString(),
      mediaRefs: image ? [{ type: 'image', url: image }] : [],
      storageRefs: {
        screenshot: rawData.screenshotPath,
        html: rawData.url,
      },
    };

    return [item];
  }

  private detectUrlType(url: string): string {
    if (url.includes('/status/')) return 'tweet';
    if (url.includes('/search')) return 'search';
    if (url.includes('/home') || url.includes('/timeline')) return 'timeline';
    return 'profile';
  }
}

export const twitterConnector = new TwitterConnector();
