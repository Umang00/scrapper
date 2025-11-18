import { Request, Response, NextFunction } from 'express';
import { db } from '../services/database';
import { supabase } from '../services/supabase';
import { logger } from '../services/logger';
import { AppError } from '../middleware/errorHandler';

export class CaptchaController {
  /**
   * GET /captcha/queue - Get pending captchas
   */
  static async getQueue(_req: Request, res: Response, next: NextFunction) {
    try {
      const captchas = await db.query(
        `SELECT * FROM captcha_events WHERE status = 'pending' OR status = 'solving' ORDER BY created_at ASC`
      );

      res.json({
        status: 'success',
        data: captchas,
        count: captchas.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /captcha/:id/solve - Submit captcha solution
   */
  static async solveCaptcha(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { solution_token, solved_by } = req.body;

      if (!solution_token || !solved_by) {
        throw new AppError(400, 'Missing required fields: solution_token, solved_by');
      }

      const [captcha] = await db.query(
        `UPDATE captcha_events
         SET status = 'solved', solution_token = $1, solved_by = $2, solved_at = now()
         WHERE id = $3 AND status IN ('pending', 'solving')
         RETURNING *`,
        [solution_token, solved_by, id]
      );

      if (!captcha) {
        throw new AppError(404, 'Captcha not found or already solved');
      }

      // Broadcast captcha solved event
      await supabase.broadcast('captcha_queue', 'captcha_solved', {
        captcha_id: id,
        solved_by,
      });

      logger.info('Captcha solved', { captchaId: id, solved_by });

      res.json({
        status: 'success',
        data: captcha,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /captcha/:id - Get captcha details
   */
  static async getCaptcha(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const [captcha] = await db.query('SELECT * FROM captcha_events WHERE id = $1', [id]);

      if (!captcha) {
        throw new AppError(404, 'Captcha not found');
      }

      res.json({
        status: 'success',
        data: captcha,
      });
    } catch (error) {
      next(error);
    }
  }
}
