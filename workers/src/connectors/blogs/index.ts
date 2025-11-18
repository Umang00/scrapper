import { Page } from 'playwright';
import { BaseConnector, JobContext, RawData, NormalizedItem } from '../base-connector';
import { logger } from '../../services/logger';

export class BlogConnector extends BaseConnector {
  name = 'blog';
  requiresAuth = false;

  needsBrowser(url: string): boolean {
    // Check if URL likely needs JavaScript
    const jsHeavyDomains = ['medium.com', 'substack.com', 'ghost.io'];
    return jsHeavyDomains.some((domain) => url.includes(domain));
  }

  async crawl(_job: JobContext, page: Page | null, url: string): Promise<RawData> {
    logger.info('Crawling blog URL', { url, connector: this.name });

    if (!page) {
      throw new Error('Blog connector requires browser page');
    }

    try {
      // Navigate to URL
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      // Wait for content to load
      await this.waitForReady(page);

      // Extract HTML
      const html = await page.content();

      // Extract metadata
      const metadata = await this.extractMetaTags(page);

      // Take screenshot
      const screenshotPath = `/tmp/screenshot-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: false });

      logger.debug('Blog page crawled', { url, htmlLength: html.length });

      return {
        url,
        html,
        screenshotPath,
        metadata,
      };
    } catch (error) {
      logger.error('Failed to crawl blog', { url, error });
      throw error;
    }
  }

  async parse(rawData: RawData): Promise<NormalizedItem[]> {
    logger.info('Parsing blog data', { url: rawData.url });

    if (!rawData.html) {
      throw new Error('No HTML content to parse');
    }

    try {
      // Extract article content using common selectors
      const { parseHTML } = await this.parseHTMLContent(rawData.html);

      const item: NormalizedItem = {
        url: rawData.url,
        contentType: 'article',
        title: parseHTML.title || (rawData.metadata?.['og:title'] as string) || undefined,
        textContent: parseHTML.textContent,
        authorHandle: (rawData.metadata?.['article:author'] as string) || parseHTML.author,
        publishedAt: (rawData.metadata?.['article:published_time'] as string) || parseHTML.publishedDate,
        engagement: {
          views: this.extractNumber((rawData.metadata?.['article:views'] as string)),
        },
        mediaRefs: parseHTML.images.map((src) => ({
          type: 'image',
          url: src,
        })),
        storageRefs: {
          screenshot: rawData.screenshotPath,
          html: rawData.url, // Will be uploaded separately
        },
      };

      return [item];
    } catch (error) {
      logger.error('Failed to parse blog', { url: rawData.url, error });
      throw error;
    }
  }

  private async parseHTMLContent(html: string): Promise<{
    parseHTML: {
      title?: string;
      textContent?: string;
      author?: string;
      publishedDate?: string;
      images: string[];
    };
  }> {
    // Simple HTML parsing (in production, use cheerio or similar)
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : undefined;

    // Extract article content (simplified)
    const articleMatch = html.match(/<article[^>]*>(.*?)<\/article>/is);
    const articleHTML = articleMatch ? articleMatch[1] : html;

    // Strip HTML tags for text content
    const textContent = articleHTML.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    // Extract images
    const images: string[] = [];
    const imgRegex = /<img[^>]+src="([^">]+)"/g;
    let imgMatch;

    while ((imgMatch = imgRegex.exec(html)) !== null) {
      images.push(imgMatch[1]);
    }

    // Extract author (simplified)
    const authorMatch = html.match(/<meta[^>]+name="author"[^>]+content="([^">]+)"/i);
    const author = authorMatch ? authorMatch[1] : undefined;

    // Extract published date (simplified)
    const dateMatch = html.match(/<time[^>]+datetime="([^">]+)"/i);
    const publishedDate = dateMatch ? dateMatch[1] : undefined;

    return {
      parseHTML: {
        title,
        textContent: textContent.substring(0, 50000), // Limit length
        author,
        publishedDate,
        images: images.slice(0, 10), // Limit images
      },
    };
  }

  private extractNumber(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const num = parseInt(value.replace(/\D/g, ''), 10);
    return isNaN(num) ? undefined : num;
  }
}

export const blogConnector = new BlogConnector();
