import { Page } from 'playwright';
import {
  BaseConnector,
  JobContext,
  RawData,
  NormalizedItem,
} from '../base-connector';
import { logger } from '../../services/logger';

/**
 * Reddit Connector
 *
 * Extracts posts, comments, and subreddits from Reddit.
 * Most content is publicly accessible.
 *
 * NOTE: This is a simplified implementation. Full production version should include:
 * - JSON API integration for better performance
 * - Comment thread parsing
 * - Subreddit pagination
 * - User profile extraction
 * - Video/gallery handling
 * - Old vs New Reddit support
 */
export class RedditConnector extends BaseConnector {
  name = 'reddit';
  requiresAuth = false; // Most Reddit content is public

  needsBrowser(url: string): boolean {
    // Use JSON API for simple listings, browser for comments
    return url.includes('/comments/') || url.includes('/user/');
  }

  async crawl(_job: JobContext, page: Page | null, url: string): Promise<RawData> {
    logger.info('[Reddit] Crawling URL', { url });

    // Try JSON API first for public content
    if (!this.needsBrowser(url)) {
      return await this.crawlWithApi(url);
    }

    if (!page) {
      throw new Error('Reddit connector requires browser for this URL');
    }

    try {
      // Use old.reddit.com for more stable selectors
      const oldRedditUrl = url.replace('www.reddit.com', 'old.reddit.com');
      await page.goto(oldRedditUrl, { waitUntil: 'networkidle', timeout: 30000 });

      await this.waitForReady(page, 10000);
      await page.waitForSelector('.sitetable', { timeout: 10000 }).catch(() => {
        logger.warn('[Reddit] Sitetable not found');
      });

      const html = await page.content();
      const screenshotPath = `/tmp/reddit-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: false });
      const metadata = await this.extractMetaTags(page);

      logger.info('[Reddit] Successfully crawled with browser', { url });

      return {
        url,
        html,
        screenshotPath,
        metadata: {
          ...metadata,
          platform: 'reddit',
          urlType: this.detectUrlType(url),
          fetchMethod: 'browser',
        },
      };
    } catch (error) {
      logger.error('[Reddit] Error crawling', { url, error });
      throw error;
    }
  }

  private async crawlWithApi(url: string): Promise<RawData> {
    try {
      const jsonUrl = url.endsWith('.json') ? url : `${url}.json`;

      logger.info('[Reddit] Fetching JSON API', { url: jsonUrl });

      const response = await fetch(jsonUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; UniversalCrawler/1.0)',
        },
      });

      if (!response.ok) {
        throw new Error(`Reddit API returned ${response.status}`);
      }

      const data = await response.json();
      const json = data;

      logger.info('[Reddit] Successfully fetched via API', { url });

      return {
        url,
        json,
        metadata: {
          platform: 'reddit',
          urlType: this.detectUrlType(url),
          fetchMethod: 'api',
        },
      };
    } catch (error) {
      logger.error('[Reddit] API fetch failed', { url, error });
      throw error;
    }
  }

  async parse(rawData: RawData): Promise<NormalizedItem[]> {
    logger.info('[Reddit] Parsing data', { url: rawData.url });

    // If we have JSON data, parse it
    if (rawData.json) {
      return this.parseJsonData(rawData);
    }

    // Otherwise parse from HTML metadata
    const title = (rawData.metadata?.['og:title'] as string) || 'Reddit Post';
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

  private parseJsonData(rawData: RawData): NormalizedItem[] {
    const items: NormalizedItem[] = [];
    const data: any = rawData.json;

    if (!data) return items;

    // Handle subreddit listing
    if (Array.isArray(data)) {
      // Post with comments
      const postData = data[0]?.data?.children?.[0]?.data;
      if (postData) {
        items.push(this.parsePost(postData, rawData.url));
      }
    } else if (data.data?.children) {
      // Subreddit listing
      for (const child of data.data.children) {
        if (child.data) {
          items.push(this.parsePost(child.data, rawData.url));
        }
      }
    }

    return items;
  }

  private parsePost(post: any, sourceUrl: string): NormalizedItem {
    return {
      url: `https://reddit.com${post.permalink || sourceUrl}`,
      postId: post.id,
      contentType: post.is_video ? 'video' : 'post',
      title: post.title || 'Reddit Post',
      textContent: post.selftext || post.body || '',
      authorHandle: post.author,
      publishedAt: new Date((post.created_utc || 0) * 1000).toISOString(),
      engagement: {
        likes: post.ups || 0,
        comments: post.num_comments || 0,
      },
      mediaRefs: post.thumbnail && post.thumbnail.startsWith('http')
        ? [{ type: 'image', url: post.thumbnail }]
        : [],
      storageRefs: {},
    };
  }

  private detectUrlType(url: string): string {
    if (url.includes('/comments/')) return 'comments';
    if (url.includes('/r/') && !url.includes('/comments/')) return 'subreddit';
    if (url.includes('/user/') || url.includes('/u/')) return 'user';
    return 'post';
  }
}

export const redditConnector = new RedditConnector();
