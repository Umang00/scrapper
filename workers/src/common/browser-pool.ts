import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { logger } from '../services/logger';
import { config } from '../config';

export interface BrowserOptions {
  proxy?: string;
  userAgent?: string;
  viewport?: { width: number; height: number };
  headless?: boolean;
}

export class BrowserPool {
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();
  private maxContexts: number;

  constructor(maxContexts: number = config.browser.maxContexts) {
    this.maxContexts = maxContexts;
  }

  async init(): Promise<void> {
    if (this.browser) return;

    this.browser = await chromium.launch({
      headless: config.crawler.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
    });

    logger.info('Browser pool initialized');
  }

  async getContext(contextId: string, options?: BrowserOptions): Promise<BrowserContext> {
    if (!this.browser) {
      await this.init();
    }

    let context = this.contexts.get(contextId);

    if (!context) {
      if (this.contexts.size >= this.maxContexts) {
        // Close oldest context
        const oldestKey = this.contexts.keys().next().value;
        if (oldestKey) {
          await this.closeContext(oldestKey);
        }
      }

      context = await this.browser!.newContext({
        userAgent: options?.userAgent,
        viewport: options?.viewport || { width: 1920, height: 1080 },
        proxy: options?.proxy ? { server: options.proxy } : undefined,
        ignoreHTTPSErrors: true,
      });

      this.contexts.set(contextId, context);
      logger.debug('Created new browser context', { contextId, contextCount: this.contexts.size });
    }

    return context;
  }

  async newPage(contextId: string, options?: BrowserOptions): Promise<Page> {
    const context = await this.getContext(contextId, options);
    const page = await context.newPage();

    // Set default navigation timeout
    page.setDefaultNavigationTimeout(60000);
    page.setDefaultTimeout(30000);

    logger.debug('Created new page', { contextId });
    return page;
  }

  async closeContext(contextId: string): Promise<void> {
    const context = this.contexts.get(contextId);
    if (context) {
      await context.close();
      this.contexts.delete(contextId);
      logger.debug('Closed browser context', { contextId });
    }
  }

  async closeAll(): Promise<void> {
    for (const [contextId] of this.contexts) {
      await this.closeContext(contextId);
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('Browser pool closed');
    }
  }

  getContextCount(): number {
    return this.contexts.size;
  }
}

export const browserPool = new BrowserPool();
