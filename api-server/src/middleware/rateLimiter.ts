import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { Request, Response } from 'express';

// Extend Request type to include rateLimit property
interface RateLimitRequest extends Request {
  rateLimit?: {
    limit: number;
    current: number;
    remaining: number;
    resetTime: Date;
  };
}

// General API rate limiter
export const apiLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      status: 'error',
      message: 'Too many requests from this IP, please try again later',
      retryAfter: (req as RateLimitRequest).rateLimit?.resetTime,
    });
  },
});

// Stricter rate limit for job creation
export const jobCreationLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 job creations per hour
  message: 'Too many jobs created, please try again later',
  skipSuccessfulRequests: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      status: 'error',
      message: 'Job creation rate limit exceeded. Maximum 10 jobs per hour.',
      retryAfter: (req as RateLimitRequest).rateLimit?.resetTime,
    });
  },
});

// Authentication endpoint limiter (prevent brute force)
export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth attempts per 15 minutes
  message: 'Too many authentication attempts, please try again later',
  skipSuccessfulRequests: true, // Don't count successful auth attempts
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      status: 'error',
      message: 'Too many authentication attempts. Please try again in 15 minutes.',
      retryAfter: (req as RateLimitRequest).rateLimit?.resetTime,
    });
  },
});

// Captcha solving limiter (prevent abuse)
export const captchaLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Limit to 20 captcha solutions per minute
  message: 'Captcha solving rate limit exceeded',
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      status: 'error',
      message: 'Captcha solving rate limit exceeded. Please slow down.',
      retryAfter: (req as RateLimitRequest).rateLimit?.resetTime,
    });
  },
});
