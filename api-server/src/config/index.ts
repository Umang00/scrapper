import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
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

  // Security
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
  },

  encryption: {
    key: process.env.ENCRYPTION_KEY || '',
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
} as const;

// Validate required config
const requiredConfig = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
];

if (config.nodeEnv === 'production') {
  requiredConfig.push('ENCRYPTION_KEY', 'JWT_SECRET', 'AWS_ACCESS_KEY_ID');
}

const missing = requiredConfig.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.warn(`⚠️  Missing environment variables: ${missing.join(', ')}`);
  if (config.nodeEnv === 'production') {
    throw new Error('Missing required environment variables in production');
  }
}
