import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },

  // Database
  database: {
    url: process.env.DATABASE_URL || '',
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // AWS S3
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: process.env.AWS_REGION || 'us-east-1',
    s3BucketName: process.env.S3_BUCKET_NAME || '',
  },

  // Proxies
  proxies: {
    residential: process.env.PROXY_RESIDENTIAL_URL || '',
    datacenter: process.env.PROXY_DATACENTER_URL || '',
  },

  // Crawler settings
  crawler: {
    maxConcurrency: parseInt(process.env.CRAWLER_MAX_CONCURRENCY || '5', 10),
    headless: process.env.CRAWLER_HEADLESS !== 'false',
    userDataDir: process.env.CRAWLER_USER_DATA_DIR || './crawlee_storage',
  },

  // Browser settings
  browser: {
    maxContexts: parseInt(process.env.BROWSER_MAX_CONTEXTS || '5', 10),
    contextTimeout: parseInt(process.env.BROWSER_CONTEXT_TIMEOUT || '300000', 10),
  },
} as const;
