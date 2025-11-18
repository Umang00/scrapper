import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TwitterConnector } from './index';
import { Page } from 'playwright';

describe('TwitterConnector', () => {
  let connector: TwitterConnector;
  let mockPage: any;

  beforeEach(() => {
    connector = new TwitterConnector();

    // Mock Playwright Page with all required methods
    mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      content: vi.fn().mockResolvedValue('<html><head><meta property="og:title" content="Test Tweet"/></head></html>'),
      evaluate: vi.fn().mockResolvedValue({}),
      url: vi.fn().mockReturnValue('https://twitter.com/user/status/123'),
      screenshot: vi.fn().mockResolvedValue(undefined),
      $: vi.fn().mockResolvedValue(null),
      $$: vi.fn().mockResolvedValue([]),
    };
  });

  describe('name', () => {
    it('should have correct connector name', () => {
      expect(connector.name).toBe('twitter');
    });
  });

  describe('requiresAuth', () => {
    it('should require authentication', () => {
      expect(connector.requiresAuth).toBe(true);
    });
  });

  describe('needsBrowser', () => {
    it('should require browser for all Twitter URLs', () => {
      const urls = [
        'https://twitter.com/user/status/123',
        'https://x.com/user/status/456',
        'https://mobile.twitter.com/user/status/789',
      ];

      urls.forEach((url) => {
        expect(connector.needsBrowser(url)).toBe(true);
      });
    });
  });

  describe('prepare', () => {
    it('should return auth snapshot with sessionId and isValid', async () => {
      const result = await connector.prepare({
        jobId: 'test-job-id',
        urls: ['https://twitter.com/user/status/123'],
        config: {},
        authMode: 'session_cookie',
      });

      expect(result).toHaveProperty('sessionId');
      expect(result).toHaveProperty('isValid');
      expect(typeof result.sessionId).toBe('string');
      expect(typeof result.isValid).toBe('boolean');
    });
  });

  describe('crawl', () => {
    const mockJob = {
      jobId: 'test-job-id',
      urls: ['https://twitter.com/user/status/123'],
      config: {},
      authMode: 'session_cookie' as const,
    };

    it('should navigate to URL and extract metadata', async () => {
      const result = await connector.crawl(
        mockJob,
        mockPage as unknown as Page,
        'https://twitter.com/user/status/123'
      );

      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://twitter.com/user/status/123',
        expect.objectContaining({
          waitUntil: 'networkidle',
          timeout: 30000,
        })
      );

      expect(result).toMatchObject({
        url: 'https://twitter.com/user/status/123',
        metadata: expect.any(Object),
      });
      expect(result).toHaveProperty('html');
    });

    it('should extract Open Graph metadata', async () => {
      mockPage.content.mockResolvedValue(`
        <html>
          <head>
            <meta property="og:title" content="Test Tweet" />
            <meta property="og:description" content="This is a test tweet" />
            <meta property="og:image" content="https://example.com/image.jpg" />
            <meta property="og:url" content="https://twitter.com/user/status/123" />
          </head>
        </html>
      `);

      mockPage.$$.mockResolvedValue([
        {
          getAttribute: vi.fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce('og:title')
            .mockResolvedValueOnce('Test Tweet'),
        },
        {
          getAttribute: vi.fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce('og:description')
            .mockResolvedValueOnce('This is a test tweet'),
        },
      ]);

      const result = await connector.crawl(mockJob, mockPage as unknown as Page, 'https://twitter.com/user/status/123');

      expect(result.metadata).toBeDefined();
    });

    it('should handle missing page gracefully', async () => {
      await expect(
        connector.crawl(mockJob, null, 'https://twitter.com/user/status/123')
      ).rejects.toThrow('Twitter connector requires browser');
    });

    it('should call goto with correct URL', async () => {
      await connector.crawl(mockJob, mockPage as unknown as Page, 'https://twitter.com/user/status/123');

      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://twitter.com/user/status/123',
        expect.objectContaining({
          waitUntil: 'networkidle',
        })
      );
    });
  });

  describe('parse', () => {
    it('should parse raw data into array of normalized items', async () => {
      const rawData = {
        url: 'https://twitter.com/user/status/123',
        html: '<html></html>',
        metadata: {
          'og:title': 'Test Tweet',
          'og:description': 'This is a test',
        },
      };

      const result = await connector.parse(rawData);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      const item = result[0];
      expect(item).toMatchObject({
        url: 'https://twitter.com/user/status/123',
        title: 'Test Tweet',
        textContent: 'This is a test',
        contentType: 'post',
      });
      expect(item.storageRefs).toBeDefined();
    });

    it('should handle missing metadata gracefully', async () => {
      const rawData = {
        url: 'https://twitter.com/user/status/123',
        html: '<html></html>',
        metadata: {},
      };

      const result = await connector.parse(rawData);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      const item = result[0];
      expect(item.url).toBe('https://twitter.com/user/status/123');
      expect(item.title).toBeDefined();
    });

    it('should return array with proper structure', async () => {
      const rawData = {
        url: 'https://twitter.com/user/status/123',
        html: '<html></html>',
        metadata: {
          'og:title': 'Tweet Title',
        },
      };

      const result = await connector.parse(rawData);

      expect(result).toBeInstanceOf(Array);

      result.forEach((item) => {
        expect(item).toHaveProperty('url');
        expect(item).toHaveProperty('contentType');
        expect(item).toHaveProperty('storageRefs');
        expect(item).toHaveProperty('publishedAt');
      });
    });
  });
});
