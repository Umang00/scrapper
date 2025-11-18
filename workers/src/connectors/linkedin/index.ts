import { Page } from 'playwright';
import {
  BaseConnector,
  JobContext,
  RawData,
  NormalizedItem,
} from '../base-connector';
import { logger } from '../../services/logger';

/**
 * LinkedIn Connector
 *
 * Extracts posts, profiles, company pages, and job listings from LinkedIn.
 * Requires authentication as LinkedIn heavily restricts unauthenticated access.
 *
 * NOTE: This is a simplified MVP implementation. Full production version should include:
 * - LinkedIn API integration (Official LinkedIn API is very limited)
 * - Connection network mapping
 * - Job scraping with detailed criteria
 * - Company analytics and employee tracking
 * - Post engagement metrics
 * - Skills and endorsements extraction
 * - Rate limiting specific to LinkedIn (very aggressive anti-scraping)
 */
export class LinkedInConnector extends BaseConnector {
  name = 'linkedin';
  requiresAuth = true;

  needsBrowser(_url: string): boolean {
    return true; // LinkedIn requires browser for authentication
  }

  async crawl(_job: JobContext, page: Page | null, url: string): Promise<RawData> {
    logger.info('[LinkedIn] Crawling URL', { url });

    if (!page) {
      throw new Error('LinkedIn connector requires browser');
    }

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // Wait for LinkedIn content
      await this.waitForReady(page, 10000);

      // Wait for main content feed or profile
      await page.waitForSelector('.scaffold-layout__main, .profile-content', { timeout: 10000 }).catch(() => {
        logger.warn('[LinkedIn] Main content not found, might need authentication');
      });

      // Add human-like delay (LinkedIn has aggressive bot detection)
      await page.waitForTimeout(2000 + Math.random() * 2000);

      const html = await page.content();
      const screenshotPath = `/tmp/linkedin-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: false });
      const metadata = await this.extractMetaTags(page);

      logger.info('[LinkedIn] Successfully crawled', { url });

      return {
        url,
        html,
        screenshotPath,
        metadata: {
          ...metadata,
          platform: 'linkedin',
          urlType: this.detectUrlType(url),
        },
      };
    } catch (error) {
      logger.error('[LinkedIn] Error crawling', { url, error });
      throw error;
    }
  }

  async parse(rawData: RawData): Promise<NormalizedItem[]> {
    logger.info('[LinkedIn] Parsing data', { url: rawData.url });

    const title = (rawData.metadata?.['og:title'] as string) || 'LinkedIn Content';
    const description = (rawData.metadata?.['og:description'] as string) || '';
    const image = rawData.metadata?.['og:image'] as string;

    // Determine content type based on URL
    const urlType = rawData.metadata?.urlType as string;
    let contentType: NormalizedItem['contentType'] = 'post';

    if (urlType === 'profile') contentType = 'article';
    if (urlType === 'job') contentType = 'article';
    if (urlType === 'company') contentType = 'article';

    const item: NormalizedItem = {
      url: rawData.url,
      contentType,
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
    if (url.includes('/posts/')) return 'post';
    if (url.includes('/in/')) return 'profile';
    if (url.includes('/company/')) return 'company';
    if (url.includes('/jobs/')) return 'job';
    if (url.includes('/feed/')) return 'feed';
    if (url.includes('/pulse/')) return 'article';
    return 'unknown';
  }
}

export const linkedinConnector = new LinkedInConnector();
