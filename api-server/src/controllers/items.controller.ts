import { Request, Response, NextFunction } from 'express';
import { db } from '../services/database';
import { storage } from '../services/storage';
import { AppError } from '../middleware/errorHandler';

export class ItemsController {
  /**
   * GET /items - Search and list crawled items
   */
  static async listItems(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        crawl_id,
        source_platform,
        content_type,
        author_handle,
        limit = 50,
        offset = 0,
      } = req.query;

      let query = 'SELECT * FROM crawl_items WHERE 1=1';
      const params: (string | number)[] = [];

      if (crawl_id && typeof crawl_id === 'string') {
        params.push(crawl_id);
        query += ` AND crawl_id = $${params.length}`;
      }

      if (source_platform && typeof source_platform === 'string') {
        params.push(source_platform);
        query += ` AND source_platform = $${params.length}`;
      }

      if (content_type && typeof content_type === 'string') {
        params.push(content_type);
        query += ` AND content_type = $${params.length}`;
      }

      if (author_handle && typeof author_handle === 'string') {
        params.push(author_handle);
        query += ` AND author_handle = $${params.length}`;
      }

      query += ' ORDER BY extracted_at DESC';

      const limitNum = limit ? Number(limit) : 50;
      const offsetNum = offset ? Number(offset) : 0;

      params.push(limitNum, offsetNum);
      query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

      const items = await db.query(query, params);

      res.json({
        status: 'success',
        data: items,
        count: items.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /items/:id - Get item details with signed URLs
   */
  static async getItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const items = await db.query<{ id: string; storage_refs?: Record<string, string> }>('SELECT * FROM crawl_items WHERE id = $1', [id]);
      const item = items[0];

      if (!item) {
        throw new AppError(404, 'Item not found');
      }

      // Generate signed URLs for storage refs
      const storageRefs = item.storage_refs || {};
      const signedUrls: Record<string, string> = {};

      for (const [key, s3Key] of Object.entries(storageRefs)) {
        if (typeof s3Key === 'string' && s3Key.startsWith('s3://')) {
          const cleanKey = s3Key.replace('s3://' + process.env.S3_BUCKET_NAME + '/', '');
          signedUrls[key] = storage.getSignedUrl(cleanKey, 3600);
        }
      }

      res.json({
        status: 'success',
        data: {
          ...item,
          signed_urls: signedUrls,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
