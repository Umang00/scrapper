import AWS from 'aws-sdk';
import { Pool } from 'pg';
import { logger } from '../services/logger';
import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import fs from 'fs/promises';

export interface UploadOptions {
  crawlId: string;
  itemId?: string;
  artifactType: string;
  filePath?: string;
  data?: Buffer;
  mimeType?: string;
}

export interface StorageReference {
  id: string;
  s3Key: string;
  s3Url: string;
  checksum?: string;
}

export class StorageAdapter {
  private s3: AWS.S3;
  private pool: Pool;

  constructor() {
    this.s3 = new AWS.S3({
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey,
      region: config.aws.region,
    });

    this.pool = new Pool({
      connectionString: config.database.url,
      max: 5,
    });

    logger.info('Storage adapter initialized');
  }

  private generateS3Key(crawlId: string, artifactType: string, extension: string): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `${crawlId}/${artifactType}/${timestamp}-${random}.${extension}`;
  }

  private calculateChecksum(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  async upload(options: UploadOptions): Promise<StorageReference> {
    try {
      let dataBuffer: Buffer;

      // Load data from file or use provided buffer
      if (options.filePath) {
        dataBuffer = await fs.readFile(options.filePath);
      } else if (options.data) {
        dataBuffer = options.data;
      } else {
        throw new Error('Either filePath or data must be provided');
      }

      // Determine extension and mime type
      const extension = options.mimeType?.split('/')[1] || 'bin';
      const mimeType = options.mimeType || 'application/octet-stream';

      // Generate S3 key
      const s3Key = this.generateS3Key(options.crawlId, options.artifactType, extension);

      // Calculate checksum
      const checksum = this.calculateChecksum(dataBuffer);

      // Upload to S3
      await this.s3
        .putObject({
          Bucket: config.aws.s3BucketName,
          Key: s3Key,
          Body: dataBuffer,
          ContentType: mimeType,
          Metadata: {
            crawl_id: options.crawlId,
            artifact_type: options.artifactType,
            checksum,
          },
        })
        .promise();

      logger.debug('Uploaded to S3', { s3Key, size: dataBuffer.length });

      // Store metadata in database
      const storageId = uuidv4();

      await this.pool.query(
        `INSERT INTO storage_artifacts (
          id, crawl_id, item_id, artifact_type, s3_key, s3_bucket,
          file_size_bytes, mime_type, checksum_sha256
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          storageId,
          options.crawlId,
          options.itemId || null,
          options.artifactType,
          s3Key,
          config.aws.s3BucketName,
          dataBuffer.length,
          mimeType,
          checksum,
        ]
      );

      const s3Url = `s3://${config.aws.s3BucketName}/${s3Key}`;

      return {
        id: storageId,
        s3Key,
        s3Url,
        checksum,
      };
    } catch (error) {
      logger.error('Failed to upload to storage', { error, options });
      throw error;
    }
  }

  async uploadScreenshot(
    crawlId: string,
    screenshotPath: string,
    itemId?: string
  ): Promise<StorageReference> {
    return this.upload({
      crawlId,
      itemId,
      artifactType: 'screenshot',
      filePath: screenshotPath,
      mimeType: 'image/png',
    });
  }

  async uploadHAR(crawlId: string, harData: any, itemId?: string): Promise<StorageReference> {
    const harBuffer = Buffer.from(JSON.stringify(harData, null, 2));
    return this.upload({
      crawlId,
      itemId,
      artifactType: 'har',
      data: harBuffer,
      mimeType: 'application/json',
    });
  }

  async uploadHTML(crawlId: string, html: string, itemId?: string): Promise<StorageReference> {
    const htmlBuffer = Buffer.from(html, 'utf-8');
    return this.upload({
      crawlId,
      itemId,
      artifactType: 'html',
      data: htmlBuffer,
      mimeType: 'text/html',
    });
  }

  async saveItem(itemData: any): Promise<string> {
    try {
      const itemId = uuidv4();

      await this.pool.query(
        `INSERT INTO crawl_items (
          id, crawl_id, source_platform, url, post_id, author_handle,
          content_type, text_content, title, published_at, engagement,
          media_refs, storage_refs, connector, auth_state, proxy_id,
          fingerprint_used, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING id`,
        [
          itemId,
          itemData.crawl_id,
          itemData.source_platform,
          itemData.url,
          itemData.post_id || null,
          itemData.author_handle || null,
          itemData.content_type,
          itemData.text_content || null,
          itemData.title || null,
          itemData.published_at || null,
          JSON.stringify(itemData.engagement || {}),
          JSON.stringify(itemData.media_refs || []),
          JSON.stringify(itemData.storage_refs || {}),
          itemData.connector,
          itemData.auth_state ? JSON.stringify(itemData.auth_state) : null,
          itemData.proxy_id || null,
          itemData.fingerprint_used ? JSON.stringify(itemData.fingerprint_used) : null,
          'completed',
        ]
      );

      logger.info('Saved crawl item', { itemId, crawlId: itemData.crawl_id });
      return itemId;
    } catch (error) {
      logger.error('Failed to save item', { error, itemData });
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    logger.info('Storage adapter closed');
  }
}

export const storageAdapter = new StorageAdapter();
