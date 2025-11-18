import AWS from 'aws-sdk';
import { config } from '../config';
import { logger } from './logger';
import crypto from 'crypto';

class StorageService {
  private s3: AWS.S3;

  constructor() {
    this.s3 = new AWS.S3({
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey,
      region: config.aws.region,
    });

    logger.info('S3 client initialized', { region: config.aws.region });
  }

  /**
   * Upload a file to S3
   */
  async upload(
    key: string,
    data: Buffer | string,
    options?: {
      contentType?: string;
      metadata?: Record<string, string>;
    }
  ): Promise<string> {
    try {
      await this.s3
        .putObject({
          Bucket: config.aws.s3BucketName,
          Key: key,
          Body: data,
          ContentType: options?.contentType,
          Metadata: options?.metadata,
        })
        .promise();

      logger.debug('Uploaded to S3', { key });
      return key;
    } catch (error) {
      logger.error('S3 upload failed', { key, error });
      throw error;
    }
  }

  /**
   * Get a signed URL for downloading
   */
  getSignedUrl(key: string, expiresIn: number = 3600): string {
    return this.s3.getSignedUrl('getObject', {
      Bucket: config.aws.s3BucketName,
      Key: key,
      Expires: expiresIn,
    });
  }

  /**
   * Delete a file from S3
   */
  async delete(key: string): Promise<void> {
    try {
      await this.s3
        .deleteObject({
          Bucket: config.aws.s3BucketName,
          Key: key,
        })
        .promise();

      logger.debug('Deleted from S3', { key });
    } catch (error) {
      logger.error('S3 delete failed', { key, error });
      throw error;
    }
  }

  /**
   * Generate a unique S3 key
   */
  generateKey(prefix: string, extension: string): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    return `${prefix}/${timestamp}-${random}.${extension}`;
  }

  /**
   * Calculate SHA256 checksum
   */
  calculateChecksum(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.s3
        .headBucket({
          Bucket: config.aws.s3BucketName,
        })
        .promise();
      return true;
    } catch (error) {
      logger.error('S3 health check failed', error);
      return false;
    }
  }
}

export const storage = new StorageService();
