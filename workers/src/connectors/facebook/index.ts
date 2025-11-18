import { Page } from 'playwright';
import {
  BaseConnector,
  JobContext,
  RawData,
  NormalizedItem,
} from '../base-connector';
import { logger } from '../../services/logger';

/**
 * Facebook Connector
 *
 * Extracts posts, pages, groups, and events from Facebook.
 * Requires authentication as Facebook heavily restricts unauthenticated access.
 *
 * NOTE: This is a simplified MVP implementation. Full production version should include:
 * - Facebook Graph API integration (requires app approval)
 * - Group post extraction
 * - Event tracking and attendee lists
 * - Page analytics and insights
 * - Comment thread extraction
 * - Reaction counts and engagement metrics
 * - Video extraction from Facebook Watch
 * - Marketplace listings
 * - Stories and Reels
 */
export class FacebookConnector extends BaseConnector {
  name = 'facebook';
  requiresAuth = true;

  needsBrowser(_url: string): boolean {
    return true; // Facebook requires browser for authentication
  }

  async crawl(_job: JobContext, page: Page | null, url: string): Promise<RawData> {
    logger.info('[Facebook] Crawling URL', { url });

    if (!page) {
      throw new Error('Facebook connector requires browser');
    }

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // Wait for Facebook content
      await this.waitForReady(page, 10000);

      // Wait for main content (Facebook uses dynamic class names, so we use data attributes)
      await page.waitForSelector('[role="main"], [data-pagelet="root"]', { timeout: 10000 }).catch(() => {
        logger.warn('[Facebook] Main content not found, might need authentication');
      });

      // Add human-like delay (Facebook has very aggressive bot detection)
      await page.waitForTimeout(2500 + Math.random() * 2500);

      const html = await page.content();
      const screenshotPath = `/tmp/facebook-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: false });
      const metadata = await this.extractMetaTags(page);

      logger.info('[Facebook] Successfully crawled', { url });

      return {
        url,
        html,
        screenshotPath,
        metadata: {
          ...metadata,
          platform: 'facebook',
          urlType: this.detectUrlType(url),
        },
      };
    } catch (error) {
      logger.error('[Facebook] Error crawling', { url, error });
      throw error;
    }
  }

  async parse(rawData: RawData): Promise<NormalizedItem[]> {
    logger.info('[Facebook] Parsing data', { url: rawData.url });

    const title = (rawData.metadata?.['og:title'] as string) || 'Facebook Content';
    const description = (rawData.metadata?.['og:description'] as string) || '';
    const image = rawData.metadata?.['og:image'] as string;
    const video = rawData.metadata?.['og:video'] as string;

    // Determine content type based on URL
    const urlType = rawData.metadata?.urlType as string;
    let contentType: NormalizedItem['contentType'] = 'post';

    if (urlType === 'video' || urlType === 'watch') contentType = 'video';
    if (urlType === 'photo') contentType = 'image';
    if (urlType === 'page' || urlType === 'profile') contentType = 'article';
    if (urlType === 'reel') contentType = 'reel';

    const item: NormalizedItem = {
      url: rawData.url,
      contentType,
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
    if (url.includes('/posts/') || url.includes('/permalink/')) return 'post';
    if (url.includes('/profile.php') || url.includes('/people/')) return 'profile';
    if (url.includes('/pages/') || url.includes('/pg/')) return 'page';
    if (url.includes('/groups/')) return 'group';
    if (url.includes('/events/')) return 'event';
    if (url.includes('/watch/')) return 'watch';
    if (url.includes('/videos/')) return 'video';
    if (url.includes('/photos/') || url.includes('/photo/')) return 'photo';
    if (url.includes('/reel/')) return 'reel';
    if (url.includes('/marketplace/')) return 'marketplace';
    if (url.includes('/stories/')) return 'story';
    return 'unknown';
  }
}

export const facebookConnector = new FacebookConnector();
