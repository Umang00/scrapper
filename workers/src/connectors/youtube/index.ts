import { Page } from 'playwright';
import {
  BaseConnector,
  JobContext,
  RawData,
  NormalizedItem,
} from '../base-connector';
import { logger } from '../../services/logger';

/**
 * YouTube Connector
 *
 * Extracts videos, channels, playlists, and comments from YouTube.
 * Can use both browser automation and YouTube Data API v3.
 *
 * NOTE: This is a simplified MVP implementation. Full production version should include:
 * - YouTube Data API v3 integration for better performance
 * - Video transcript extraction
 * - Channel analytics and subscriber tracking
 * - Comment thread extraction with replies
 * - Playlist management
 * - Live stream data capture
 */
export class YouTubeConnector extends BaseConnector {
  name = 'youtube';
  requiresAuth = false; // Public videos don't require auth

  needsBrowser(url: string): boolean {
    // Use browser for comments, API for basic video data
    return url.includes('?') || url.includes('watch');
  }

  async crawl(_job: JobContext, page: Page | null, url: string): Promise<RawData> {
    logger.info('[YouTube] Crawling URL', { url });

    if (!page && this.needsBrowser(url)) {
      throw new Error('YouTube connector requires browser for this URL type');
    }

    try {
      if (page) {
        // Browser-based crawling
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

        // Wait for YouTube content
        await this.waitForReady(page, 10000);
        await page.waitForSelector('ytd-video-primary-info-renderer', { timeout: 10000 }).catch(() => {
          logger.warn('[YouTube] Video info not found, might be a different page type');
        });

        const html = await page.content();
        const screenshotPath = `/tmp/youtube-${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: false });
        const metadata = await this.extractMetaTags(page);

        logger.info('[YouTube] Successfully crawled with browser', { url });

        return {
          url,
          html,
          screenshotPath,
          metadata: {
            ...metadata,
            platform: 'youtube',
            urlType: this.detectUrlType(url),
          },
        };
      } else {
        // API-based crawling (for future implementation)
        logger.warn('[YouTube] API crawling not yet implemented, returning minimal data');

        return {
          url,
          metadata: {
            platform: 'youtube',
            urlType: this.detectUrlType(url),
          },
        };
      }
    } catch (error) {
      logger.error('[YouTube] Error crawling', { url, error });
      throw error;
    }
  }

  async parse(rawData: RawData): Promise<NormalizedItem[]> {
    logger.info('[YouTube] Parsing data', { url: rawData.url });

    const title = (rawData.metadata?.['og:title'] as string) || 'YouTube Video';
    const description = (rawData.metadata?.['og:description'] as string) || '';
    const image = rawData.metadata?.['og:image'] as string;
    const video = rawData.metadata?.['og:video:url'] as string;

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
    if (url.includes('/watch')) return 'video';
    if (url.includes('/channel/') || url.includes('/@')) return 'channel';
    if (url.includes('/playlist')) return 'playlist';
    if (url.includes('/shorts/')) return 'short';
    if (url.includes('/live/')) return 'livestream';
    return 'unknown';
  }
}

export const youtubeConnector = new YouTubeConnector();
