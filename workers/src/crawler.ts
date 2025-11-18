// import { PlaywrightCrawler } from 'crawlee'; // Reserved for future use
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import { logger } from './services/logger';
import { config } from './config';
import { browserPool } from './common/browser-pool';
import { proxyManager } from './common/proxy-manager';
import { authManager } from './common/auth-manager';
import { captchaManager } from './common/captcha-manager';
import { storageAdapter } from './common/storage-adapter';
import { getConnector } from './connectors';
import { JobContext } from './connectors/base-connector';

export class CrawlerWorker {
  private pool: Pool;
  private supabase: ReturnType<typeof createClient>;
  // private crawler: PlaywrightCrawler; // Reserved for future use

  constructor() {
    this.pool = new Pool({
      connectionString: config.database.url,
      max: 10,
    });

    this.supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

    // Reserved for future Crawlee integration
    // this.crawler = new PlaywrightCrawler({
    //   maxConcurrency: config.crawler.maxConcurrency,
    //   headless: config.crawler.headless,
    //   requestHandler: async ({ page, request }) => {
    //     await this.handleRequest(page, request);
    //   },
    //   failedRequestHandler: async ({ request }, error) => {
    //     logger.error('Request failed', {
    //       url: request.url,
    //       error: error.message,
    //     });
    //   },
    // });

    logger.info('Crawler worker initialized');
  }

  async processJob(jobId: string): Promise<void> {
    logger.info('Processing job', { jobId });

    try {
      // Fetch job details
      const jobResult = await this.pool.query('SELECT * FROM crawl_jobs WHERE id = $1', [jobId]);

      if (jobResult.rows.length === 0) {
        throw new Error(`Job ${jobId} not found`);
      }

      const job = jobResult.rows[0];

      // Update job status to running
      await this.pool.query(
        'UPDATE crawl_jobs SET status = $1, started_at = now() WHERE id = $2',
        ['running', jobId]
      );

      // Broadcast job started
      await this.supabase.channel(`jobs.${jobId}`).send({
        type: 'broadcast',
        event: 'status',
        payload: {
          job_id: jobId,
          status: 'running',
          message: 'Job started',
          timestamp: new Date().toISOString(),
        },
      });

      // Get connector
      const connector = getConnector(job.connector);

      if (!connector) {
        throw new Error(`Unknown connector: ${job.connector}`);
      }

      // Prepare authentication
      const jobContext: JobContext = {
        jobId: job.id,
        urls: job.urls,
        config: job.config || {},
        authMode: job.auth_mode,
      };

      await connector.prepare(jobContext);

      // Process each URL
      const urls = Array.isArray(job.urls) ? job.urls : JSON.parse(job.urls);

      for (const url of urls) {
        try {
          await this.processURL(job.id, connector.name, url);
        } catch (error) {
          logger.error('Failed to process URL', { jobId, url, error });

          // Increment error count
          await this.pool.query(
            'UPDATE crawl_jobs SET error_count = error_count + 1 WHERE id = $1',
            [jobId]
          );
        }

        // Update progress
        await this.pool.query(
          'UPDATE crawl_jobs SET processed_urls = processed_urls + 1 WHERE id = $1',
          [jobId]
        );

        // Broadcast progress
        const progressResult = await this.pool.query(
          'SELECT total_urls, processed_urls, success_count, error_count FROM crawl_jobs WHERE id = $1',
          [jobId]
        );

        const progress = progressResult.rows[0];

        await this.supabase.channel(`jobs.${jobId}`).send({
          type: 'broadcast',
          event: 'progress',
          payload: {
            job_id: jobId,
            total_urls: progress.total_urls,
            processed_urls: progress.processed_urls,
            success_count: progress.success_count,
            error_count: progress.error_count,
            current_url: url,
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Mark job as completed
      await this.pool.query(
        'UPDATE crawl_jobs SET status = $1, completed_at = now() WHERE id = $2',
        ['completed', jobId]
      );

      // Broadcast completion
      await this.supabase.channel(`jobs.${jobId}`).send({
        type: 'broadcast',
        event: 'status',
        payload: {
          job_id: jobId,
          status: 'completed',
          message: 'Job completed successfully',
          timestamp: new Date().toISOString(),
        },
      });

      logger.info('Job completed', { jobId });
    } catch (error) {
      logger.error('Job failed', { jobId, error });

      // Mark job as failed
      await this.pool.query(
        'UPDATE crawl_jobs SET status = $1, error_message = $2, completed_at = now() WHERE id = $3',
        ['failed', error instanceof Error ? error.message : 'Unknown error', jobId]
      );

      // Broadcast failure
      await this.supabase.channel(`jobs.${jobId}`).send({
        type: 'broadcast',
        event: 'error',
        payload: {
          job_id: jobId,
          error_message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      });

      throw error;
    }
  }

  private async processURL(jobId: string, connectorName: string, url: string): Promise<void> {
    logger.info('Processing URL', { jobId, url, connector: connectorName });

    const connector = getConnector(connectorName);

    if (!connector) {
      throw new Error(`Unknown connector: ${connectorName}`);
    }

    // Get proxy
    const proxy = proxyManager.getProxy();
    const proxyUrl = proxy?.url;

    // Create browser context
    const page = await browserPool.newPage(jobId, {
      proxy: proxyUrl,
    });

    try {
      // Crawl
      const jobContext: JobContext = {
        jobId,
        urls: [url],
        config: {},
        authMode: 'public',
        proxyId: proxy?.id,
      };

      const rawData = await connector.crawl(jobContext, page, url);

      // Check for captcha
      const captchaChallenge = await captchaManager.detectCaptcha(page);

      if (captchaChallenge) {
        logger.warn('Captcha detected', { url, captchaType: captchaChallenge.type });

        // Upload screenshot if available
        let screenshotS3Key: string | undefined;

        if (captchaChallenge.screenshotPath) {
          const screenshotRef = await storageAdapter.uploadScreenshot(
            jobId,
            captchaChallenge.screenshotPath
          );
          screenshotS3Key = screenshotRef.s3Key;
        }

        // Request solution
        const solution = await captchaManager.requestSolution(
          captchaChallenge,
          jobId,
          screenshotS3Key
        );

        // Apply solution (connector-specific)
        logger.info('Captcha solved, continuing', { url, solution });
      }

      // Upload artifacts
      if (rawData.screenshotPath) {
        const screenshotRef = await storageAdapter.uploadScreenshot(jobId, rawData.screenshotPath);
        rawData.metadata = rawData.metadata || {};
        rawData.metadata.screenshot_s3_key = screenshotRef.s3Key;
      }

      if (rawData.html) {
        const htmlRef = await storageAdapter.uploadHTML(jobId, rawData.html);
        rawData.metadata = rawData.metadata || {};
        rawData.metadata.html_s3_key = htmlRef.s3Key;
      }

      // Parse
      const items = await connector.parse(rawData);

      // Save items
      for (const item of items) {
        const itemData = {
          crawl_id: jobId,
          source_platform: connectorName,
          url: item.url,
          post_id: item.postId,
          author_handle: item.authorHandle,
          content_type: item.contentType,
          text_content: item.textContent,
          title: item.title,
          published_at: item.publishedAt,
          engagement: item.engagement,
          media_refs: item.mediaRefs,
          storage_refs: item.storageRefs,
          connector: connectorName,
          proxy_id: proxy?.id,
        };

        const itemId = await storageAdapter.saveItem(itemData);

        logger.info('Item saved', { itemId, url: item.url });

        // Broadcast item extracted
        await this.supabase.channel(`jobs.${jobId}`).send({
          type: 'broadcast',
          event: 'item_extracted',
          payload: {
            job_id: jobId,
            item_id: itemId,
            url: item.url,
            content_type: item.contentType,
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Record proxy success
      if (proxy) {
        proxyManager.recordSuccess(proxy.id);
      }

      // Update success count
      await this.pool.query('UPDATE crawl_jobs SET success_count = success_count + 1 WHERE id = $1', [
        jobId,
      ]);
    } catch (error) {
      // Record proxy failure
      if (proxy) {
        proxyManager.recordFailure(proxy.id);
      }

      throw error;
    } finally {
      await page.close();
    }
  }

  // private async handleRequest(page: any, request: any): Promise<void> {
  //   // This is called by Crawlee for each request
  //   // Can be used for additional processing if needed
  //   logger.debug('Handling request', { url: request.url });
  // }

  async close(): Promise<void> {
    await browserPool.closeAll();
    await authManager.close();
    await captchaManager.close();
    await storageAdapter.close();
    await this.pool.end();
    logger.info('Crawler worker closed');
  }
}

export const crawlerWorker = new CrawlerWorker();
