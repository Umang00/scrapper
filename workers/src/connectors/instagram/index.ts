import { Page } from 'playwright';
import {
  BaseConnector,
  JobContext,
  RawData,
  NormalizedItem,
} from '../base-connector';
import { logger } from '../../services/logger';

/**
 * Instagram Connector
 *
 * Extracts posts, reels, and profiles from Instagram.
 * Requires authentication for most content.
 *
 * NOTE: This is a simplified implementation. Full production version should include:
 * - Advanced post parsing (carousels, tagged users, locations)
 * - Story extraction
 * - Reel metadata and video download
 * - Profile grid parsing with pagination
 * - Hashtag and location pages
 * - Comment extraction
 */
export class InstagramConnector extends BaseConnector {
  name = 'instagram';
  requiresAuth = true;

  needsBrowser(_url: string): boolean {
    return true; // Instagram requires JavaScript
  }

  async crawl(_job: JobContext, page: Page | null, url: string): Promise<RawData> {
    logger.info('[Instagram] Crawling URL', { url });

    if (!page) {
      throw new Error('Instagram connector requires browser');
    }

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // Wait for Instagram content to load
      await this.waitForReady(page, 10000);
      await page.waitForSelector('main[role="main"]', { timeout: 10000 }).catch(() => {
        logger.warn('[Instagram] Main content not found');
      });

      // Random delay to appear more human
      await page.waitForTimeout(1000 + Math.random() * 2000);

      const html = await page.content();
      const screenshotPath = `/tmp/instagram-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: false });
      const metadata = await this.extractMetaTags(page);

      logger.info('[Instagram] Successfully crawled', { url });

      return {
        url,
        html,
        screenshotPath,
        metadata: {
          ...metadata,
          platform: 'instagram',
          urlType: this.detectUrlType(url),
        },
      };
    } catch (error) {
      logger.error('[Instagram] Error crawling', { url, error });
      throw error;
    }
  }

  async parse(rawData: RawData): Promise<NormalizedItem[]> {
    logger.info('[Instagram] Parsing data', { url: rawData.url });

    const title = (rawData.metadata?.['og:title'] as string) || 'Instagram Post';
    const description = (rawData.metadata?.['og:description'] as string) || '';
    const image = rawData.metadata?.['og:image'] as string;
    const video = rawData.metadata?.['og:video'] as string;

    const contentType = video ? 'video' : 'post';

    const item: NormalizedItem = {
      url: rawData.url,
      contentType,
      title,
      textContent: description,
      publishedAt: new Date().toISOString(),
      mediaRefs: [
        ...(image ? [{ type: 'image', url: image }] : []),
        ...(video ? [{ type: 'video', url: video }] : []),
      ],
      storageRefs: {
        screenshot: rawData.screenshotPath,
        html: rawData.url,
      },
    };

    return [item];
  }

  private detectUrlType(url: string): string {
    if (url.includes('/p/') || url.includes('/tv/')) return 'post';
    if (url.includes('/reel/')) return 'reel';
    if (url.includes('/stories/')) return 'story';
    return 'profile';
  }
}

export const instagramConnector = new InstagramConnector();
