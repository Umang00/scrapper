import { Request, Response, NextFunction } from 'express';
import { db } from '../services/database';
import { supabase } from '../services/supabase';
import { logger } from '../services/logger';
import { AppError } from '../middleware/errorHandler';
import { v4 as uuidv4 } from 'uuid';

export class JobsController {
  /**
   * POST /jobs - Create a new crawl job
   */
  static async createJob(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        connector,
        source_platform,
        auth_mode = 'public',
        urls,
        depth = 1,
        max_items,
        config = {},
        tags,
        notes,
      } = req.body;

      // Validation
      if (!connector || !source_platform || !urls || urls.length === 0) {
        throw new AppError(400, 'Missing required fields: connector, source_platform, urls');
      }

      const jobId = uuidv4();

      // Insert job into database
      const [job] = await db.query(
        `INSERT INTO crawl_jobs (
          id, connector, source_platform, auth_mode, urls, depth, max_items, config, tags, notes, total_urls, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          jobId,
          connector,
          source_platform,
          auth_mode,
          JSON.stringify(urls),
          depth,
          max_items,
          JSON.stringify(config),
          tags,
          notes,
          urls.length,
          'pending',
        ]
      );

      // Broadcast job creation event
      await supabase.broadcast(`jobs.${jobId}`, 'status', {
        job_id: jobId,
        status: 'pending',
        message: 'Job created',
      });

      logger.info('Job created', { jobId, connector, source_platform });

      res.status(201).json({
        status: 'success',
        data: job,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /jobs/:id - Get job details
   */
  static async getJob(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const [job] = await db.query('SELECT * FROM crawl_jobs WHERE id = $1', [id]);

      if (!job) {
        throw new AppError(404, 'Job not found');
      }

      res.json({
        status: 'success',
        data: job,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /jobs - List all jobs
   */
  static async listJobs(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        status,
        connector,
        limit = 50,
        offset = 0,
      } = req.query;

      let query = 'SELECT * FROM crawl_jobs WHERE 1=1';
      const params: (string | number)[] = [];

      if (status && typeof status === 'string') {
        params.push(status);
        query += ` AND status = $${params.length}`;
      }

      if (connector && typeof connector === 'string') {
        params.push(connector);
        query += ` AND connector = $${params.length}`;
      }

      query += ' ORDER BY created_at DESC';

      const limitNum = limit ? Number(limit) : 50;
      const offsetNum = offset ? Number(offset) : 0;

      params.push(limitNum, offsetNum);
      query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

      const jobs = await db.query(query, params);

      res.json({
        status: 'success',
        data: jobs,
        count: jobs.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /jobs/:id/stop - Stop a running job
   */
  static async stopJob(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const [job] = await db.query(
        `UPDATE crawl_jobs SET status = 'cancelled', completed_at = now() WHERE id = $1 RETURNING *`,
        [id]
      );

      if (!job) {
        throw new AppError(404, 'Job not found');
      }

      // Broadcast job stopped event
      await supabase.broadcast(`jobs.${id}`, 'status', {
        job_id: id,
        status: 'cancelled',
        message: 'Job stopped by user',
      });

      logger.info('Job stopped', { jobId: id });

      res.json({
        status: 'success',
        data: job,
      });
    } catch (error) {
      next(error);
    }
  }
}
