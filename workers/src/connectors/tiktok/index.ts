import { Page } from 'playwright';
import {
  BaseConnector,
  JobContext,
  RawData,
  NormalizedItem,
} from '../base-connector';
import { logger } from '../../services/logger';

/**
 * TikTok Connector
 *
 * Extracts videos, profiles, and trending content from TikTok.
 * Requires authentication for most content due to TikTok's strict scraping policies.
 *
 * NOTE: This is a simplified MVP implementation. Full production version should include:
 * - Video download and storage
 * - Comment extraction
 * - Hashtag and sound tracking
 * - Profile analytics
 * - Duet and stitch relationship mapping
 */
export class TikTokConnector extends BaseConnector {
  name = 'tiktok';
  requiresAuth = true;

  needsBrowser(_url: string): boolean {
    return true; // TikTok requires JavaScript heavily
  }

  async crawl(_job: JobContext, page: Page | null, url: string): Promise<RawData> {
    logger.info('[TikTok] Crawling URL', { url });

    if (!page) {
      throw new Error('TikTok connector requires browser');
    }

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // Wait for TikTok content to load
      await this.waitForReady(page, 10000);
      await page.waitForSelector('[data-e2e="browse-video"]', { timeout: 10000 }).catch(() => {
        logger.warn('[TikTok] Video element not found, trying alternative selector');
      });

      // Add human-like delay
      await page.waitForTimeout(1500 + Math.random() * 1500);

      const html = await page.content();
      const screenshotPath = `/tmp/tiktok-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: false });
      const metadata = await this.extractMetaTags(page);

      logger.info('[TikTok] Successfully crawled', { url });

      return {
        url,
        html,
        screenshotPath,
        metadata: {
          ...metadata,
          platform: 'tiktok',
          urlType: this.detectUrlType(url),
        },
      };
    } catch (error) {
      logger.error('[TikTok] Error crawling', { url, error });
      throw error;
    }
  }

  async parse(rawData: RawData): Promise<NormalizedItem[]> {
    logger.info('[TikTok] Parsing data', { url: rawData.url });

    const title = (rawData.metadata?.['og:title'] as string) || 'TikTok Video';
    const description = (rawData.metadata?.['og:description'] as string) || '';
    const image = rawData.metadata?.['og:image'] as string;
    const video = rawData.metadata?.['og:video'] as string;

    const item: NormalizedItem = {
      url: rawData.url,
      contentType: 'video',
      title,
      textContent: description,
      publishedAt: new Date().toISOString(),
      mediaRefs: [],
      storageRefs: {
        screenshot: rawData.screenshotPath,
        html: rawData.url,
      },
    };

    if (video) {
      item.mediaRefs?.push({ type: 'video', url: video });
    }
    if (image) {
      item.mediaRefs?.push({ type: 'image', url: image });
    }

    return [item];
  }

  private detectUrlType(url: string): string {
    if (url.includes('/@')) {
      if (url.includes('/video/')) return 'video';
      return 'profile';
    }
    if (url.includes('/tag/')) return 'hashtag';
    if (url.includes('/music/')) return 'sound';
    if (url.includes('/trending')) return 'trending';
    return 'unknown';
  }
}

export const tiktokConnector = new TikTokConnector();
