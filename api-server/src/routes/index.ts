import { Router } from 'express';
import { JobsController } from '../controllers/jobs.controller';
import { ItemsController } from '../controllers/items.controller';
import { CaptchaController } from '../controllers/captcha.controller';
import { AuthController } from '../controllers/auth.controller';
import { db } from '../services/database';
import { supabase } from '../services/supabase';
import { storage } from '../services/storage';
import { jobCreationLimiter, authLimiter, captchaLimiter } from '../middleware/rateLimiter';

const router = Router();

// Health check
router.get('/health', async (_req, res) => {
  const dbHealthy = await db.healthCheck();
  const supabaseHealthy = await supabase.healthCheck();
  const s3Healthy = await storage.healthCheck();

  const healthy = dbHealthy && supabaseHealthy && s3Healthy;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    services: {
      database: dbHealthy ? 'healthy' : 'unhealthy',
      supabase: supabaseHealthy ? 'healthy' : 'unhealthy',
      s3: s3Healthy ? 'healthy' : 'unhealthy',
    },
    timestamp: new Date().toISOString(),
  });
});

// Jobs routes
router.post('/jobs', jobCreationLimiter, JobsController.createJob); // Rate limited: 10 jobs/hour
router.get('/jobs', JobsController.listJobs);
router.get('/jobs/:id', JobsController.getJob);
router.post('/jobs/:id/stop', JobsController.stopJob);

// Items routes
router.get('/items', ItemsController.listItems);
router.get('/items/:id', ItemsController.getItem);

// Captcha routes
router.get('/captcha/queue', CaptchaController.getQueue);
router.get('/captcha/:id', CaptchaController.getCaptcha);
router.post('/captcha/:id/solve', captchaLimiter, CaptchaController.solveCaptcha); // Rate limited: 20/min

// Auth/Session routes
router.post('/auth/sessions', authLimiter, AuthController.createSession); // Rate limited: 5/15min
router.get('/auth/sessions', AuthController.listSessions);

export default router;
