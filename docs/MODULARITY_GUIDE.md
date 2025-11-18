# Modularity & Boilerplate Usage Guide

This codebase is **highly modular** and can be used as boilerplate for various projects. Here's how to reuse components.

## 🧩 Modular Architecture

### 1. **Connector Pattern** - Reusable for ANY Data Extraction

**Location**: `workers/src/connectors/`

**What it is:**
- Abstract base class defining lifecycle: `prepare()` → `crawl()` → `parse()`
- Each platform extends `BaseConnector`
- Standardized interface for all data sources

**Reusable for:**
- ✅ Web scraping (any website)
- ✅ API integration (REST, GraphQL)
- ✅ RSS/Atom feed parsing
- ✅ PDF extraction
- ✅ Email parsing (IMAP/POP3)
- ✅ File system crawling
- ✅ Database dumps
- ✅ Webhook consumers

**Example - Create Email Connector:**
```typescript
import { BaseConnector, JobContext, RawData, NormalizedItem } from '../base-connector';

export class EmailConnector extends BaseConnector {
  name = 'email';
  requiresAuth = true;

  needsBrowser(_url: string): boolean {
    return false; // IMAP doesn't need browser
  }

  async crawl(job: JobContext, _page: null, emailQuery: string): Promise<RawData> {
    // Connect to IMAP server
    // Fetch emails matching query
    // Return raw email data
  }

  async parse(rawData: RawData): Promise<NormalizedItem[]> {
    // Parse email into normalized format
    // Extract subject, body, attachments
    // Return items
  }
}
```

**Example - Create Shopify Connector:**
```typescript
export class ShopifyConnector extends BaseConnector {
  name = 'shopify';
  requiresAuth = true; // API key required

  needsBrowser(_url: string): boolean {
    return false; // Use Shopify API
  }

  async crawl(job: JobContext, _page: null, storeUrl: string): Promise<RawData> {
    // Use Shopify Admin API
    // Fetch products, orders, customers
    const response = await fetch(`${storeUrl}/admin/api/2024-01/products.json`, {
      headers: { 'X-Shopify-Access-Token': this.getApiKey(job) }
    });
    return { url: storeUrl, json: await response.json() };
  }

  async parse(rawData: RawData): Promise<NormalizedItem[]> {
    // Parse Shopify products into normalized items
  }
}
```

### 2. **Worker Architecture** - Background Job Processing

**Location**: `workers/src/`

**What it is:**
- Job queue processing
- Browser pool management
- Proxy rotation
- Storage management
- Retry logic

**Reusable for:**
- ✅ Video processing
- ✅ Image optimization
- ✅ Report generation
- ✅ Email sending
- ✅ Batch data processing
- ✅ ETL pipelines
- ✅ Scheduled tasks
- ✅ Webhook processing

**Example - Image Processing Worker:**
```typescript
import { BrowserPool } from './common/browser-pool';
import { StorageAdapter } from './common/storage-adapter';

export class ImageProcessor {
  async processJob(job: ImageJob) {
    const storage = new StorageAdapter(s3Client, dbPool);

    // Download image
    const image = await fetch(job.imageUrl);

    // Process (resize, optimize, watermark)
    const processed = await sharp(image)
      .resize(800, 600)
      .webp({ quality: 80 })
      .toBuffer();

    // Upload to S3
    const s3Key = await storage.uploadArtifact(
      job.id,
      'processed-image.webp',
      processed
    );

    // Save metadata to database
    await storage.saveArtifactMetadata(job.id, s3Key, 'image/webp');
  }
}
```

### 3. **API Structure** - REST API Boilerplate

**Location**: `api-server/src/`

**What it is:**
- Express server with TypeScript
- Controller/Service pattern
- Middleware (auth, logging, error handling)
- Database connection pooling
- Supabase Realtime integration

**Reusable for:**
- ✅ Any REST API
- ✅ GraphQL server (add Apollo)
- ✅ Webhook receiver
- ✅ Admin dashboard backend
- ✅ Mobile app backend
- ✅ IoT device API
- ✅ Microservices

**Example - E-commerce API:**
```typescript
// api-server/src/controllers/products.controller.ts
import { Request, Response, NextFunction } from 'express';
import { db } from '../services/database';
import { logger } from '../services/logger';

export class ProductsController {
  static async listProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { category, min_price, max_price } = req.query;

      const products = await db.query(
        `SELECT * FROM products
         WHERE ($1::text IS NULL OR category = $1)
         AND price BETWEEN $2::numeric AND $3::numeric`,
        [category, min_price || 0, max_price || 99999]
      );

      res.json({ status: 'success', data: products.rows });
    } catch (error) {
      logger.error('Failed to fetch products', { error });
      next(error);
    }
  }

  static async createProduct(req: Request, res: Response, next: NextFunction) {
    // Create product logic
  }
}
```

### 4. **Frontend Stack** - Next.js + Supabase Realtime

**Location**: `frontend/src/`

**What it is:**
- Next.js 15 + React 19
- Supabase Realtime hooks
- TailwindCSS styling
- API client wrapper
- Real-time data subscriptions

**Reusable for:**
- ✅ Admin dashboards
- ✅ Real-time analytics
- ✅ Chat applications
- ✅ Collaborative tools
- ✅ Live tracking systems
- ✅ Trading platforms
- ✅ Gaming leaderboards

**Example - Live Analytics Dashboard:**
```typescript
// hooks/useMetricsChannel.ts
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Metric {
  timestamp: string;
  cpu_usage: number;
  memory_usage: number;
  request_count: number;
}

export function useMetricsChannel(serviceId: string) {
  const [metrics, setMetrics] = useState<Metric[]>([]);

  useEffect(() => {
    const channel = supabase
      .channel(`metrics.${serviceId}`)
      .on('broadcast', { event: 'metric' }, (payload) => {
        setMetrics((prev) => [...prev, payload.data].slice(-100));
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [serviceId]);

  return { metrics };
}

// app/analytics/page.tsx
export default function AnalyticsDashboard() {
  const { metrics } = useMetricsChannel('api-server-1');

  return (
    <div>
      <h1>Live Metrics</h1>
      <LineChart data={metrics} />
    </div>
  );
}
```

### 5. **Type Safety** - Shared Types Package

**Location**: `shared/types/`

**What it is:**
- Database schema types
- API request/response types
- Realtime payload types
- Connector interfaces

**Reusable for:**
- ✅ Any monorepo project
- ✅ Frontend/backend type sharing
- ✅ SDK generation
- ✅ API documentation
- ✅ Contract testing

**Example - Shared Types for E-commerce:**
```typescript
// shared/types/products.ts
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  products: OrderItem[];
  total: number;
  status: OrderStatus;
}

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

// Use in backend
import { Product, Order } from '@your-project/shared/types/products';

// Use in frontend
import { Product } from '@your-project/shared/types/products';
```

### 6. **Infrastructure as Code** - Terraform + Docker

**Location**: `infra/`

**What it is:**
- Complete AWS infrastructure
- Multi-stage Docker builds
- Docker Compose for local dev
- GitHub Actions CI/CD

**Reusable for:**
- ✅ Any cloud deployment
- ✅ Multi-environment setups (dev/staging/prod)
- ✅ Disaster recovery
- ✅ Blue/green deployments
- ✅ Auto-scaling applications

**Example - Customize for Your Project:**
```hcl
# infra/terraform/variables.tf
variable "project_name" {
  description = "Project name"
  type        = string
  default     = "my-saas-app" # Change this
}

variable "api_image" {
  description = "Docker image for API"
  type        = string
  default     = "ghcr.io/myorg/my-api:latest" # Change this
}
```

## 🔧 How to Use as Boilerplate

### Project Type 1: Data Aggregation Platform

**Use these components:**
- ✅ Connector pattern (for data sources)
- ✅ Worker architecture (for processing)
- ✅ API structure (for serving data)
- ✅ Frontend (for dashboard)

**Example: News Aggregator**
```bash
# Keep:
workers/src/connectors/          # Add RSS, API connectors
workers/src/common/             # Reuse as-is
api-server/                     # Reuse as-is
frontend/                       # Customize UI

# Remove:
workers/src/connectors/twitter  # Not needed
workers/src/connectors/instagram # Not needed
```

### Project Type 2: Monitoring/Analytics Platform

**Use these components:**
- ✅ API structure (for metric collection)
- ✅ Frontend with Realtime (for live dashboards)
- ✅ Database schema pattern (for time-series data)

**Example: Server Monitoring**
```bash
# Keep:
api-server/src/controllers/     # Metrics endpoints
frontend/src/hooks/             # Real-time hooks
frontend/src/app/              # Dashboard pages

# Customize:
shared/types/database.ts        # Change to metrics schema
infra/database/migrations/      # New schema for metrics

# Remove:
workers/src/connectors/         # Not needed for monitoring
```

### Project Type 3: SaaS Application

**Use these components:**
- ✅ Full stack (API + Frontend)
- ✅ Authentication patterns
- ✅ Multi-tenancy (via RLS policies)
- ✅ Deployment infrastructure

**Example: Project Management Tool**
```bash
# Keep everything, customize:
api-server/src/controllers/     # Add projects, tasks, users
frontend/src/app/              # Add project pages, kanban boards
shared/types/                  # Define project, task types
infra/database/migrations/      # Schema for projects, tasks, teams
```

### Project Type 4: Automation Platform

**Use these components:**
- ✅ Worker architecture
- ✅ Browser automation (BrowserPool)
- ✅ Proxy management
- ✅ Job queue

**Example: Form Filler / Bot**
```bash
# Keep:
workers/src/common/browser-pool.ts     # Browser management
workers/src/common/proxy-manager.ts    # Proxy rotation
workers/src/crawler.ts                # Job orchestration

# Customize:
workers/src/connectors/               # Add form-filling logic

# Remove:
frontend/                            # Not needed for headless bot
```

## 📋 Quick Start Templates

### Template 1: Minimal API (No Workers)

```bash
# Keep only:
api-server/
shared/types/
infra/database/
docker-compose.yml  # Remove worker service
```

**Use for:**
- Simple CRUD APIs
- Mobile app backends
- Webhook receivers

### Template 2: Background Jobs Only (No API)

```bash
# Keep only:
workers/
shared/types/
infra/database/
```

**Use for:**
- Batch processing
- Scheduled tasks
- Data pipelines

### Template 3: Full Stack SaaS

```bash
# Keep everything:
api-server/
workers/
frontend/
shared/
infra/
```

**Use for:**
- Complete applications
- Dashboards with background processing
- Multi-user platforms

## 🎨 Customization Checklist

When using as boilerplate:

**1. Update Branding:**
- [ ] Change project name in all `package.json` files
- [ ] Update Docker image names
- [ ] Customize frontend branding (logo, colors)
- [ ] Update README.md

**2. Modify Database Schema:**
- [ ] Edit `infra/database/migrations/001_initial_schema.sql`
- [ ] Update `shared/types/database.ts` to match
- [ ] Regenerate RLS policies for your use case

**3. Customize API Endpoints:**
- [ ] Remove unused controllers (jobs, captcha if not needed)
- [ ] Add your domain-specific controllers
- [ ] Update routes in `api-server/src/routes/`

**4. Update Frontend:**
- [ ] Remove/modify pages in `frontend/src/app/`
- [ ] Customize hooks in `frontend/src/hooks/`
- [ ] Update TailwindCSS theme
- [ ] Add your components

**5. Configure Connectors:**
- [ ] Remove social media connectors if not needed
- [ ] Add your domain-specific connectors
- [ ] Update connector registry

**6. Deployment:**
- [ ] Update `terraform.tfvars` with your values
- [ ] Modify `docker-compose.yml` service names
- [ ] Configure CI/CD for your repo
- [ ] Update environment variables

## 🔑 Key Design Patterns Used

### 1. **Dependency Injection**
```typescript
// Services injected into controllers
class JobsController {
  constructor(
    private db: DatabaseService,
    private supabase: SupabaseService,
    private logger: LoggerService
  ) {}
}
```

### 2. **Repository Pattern**
```typescript
// Database access abstracted
class JobRepository {
  async findById(id: string): Promise<Job | null> {}
  async create(data: CreateJobDto): Promise<Job> {}
  async update(id: string, data: UpdateJobDto): Promise<Job> {}
}
```

### 3. **Strategy Pattern** (Connectors)
```typescript
// Different strategies for different platforms
const connector = getConnector(platform); // Returns TwitterConnector, InstagramConnector, etc.
await connector.crawl(job, page, url);
```

### 4. **Observer Pattern** (Realtime)
```typescript
// Supabase Realtime acts as event bus
supabase.broadcast('jobs.123', 'status', { status: 'completed' });

// Frontend subscribes
channel.on('broadcast', { event: 'status' }, (payload) => {
  updateUI(payload);
});
```

### 5. **Factory Pattern** (Browser Pool)
```typescript
// Create browser contexts on demand
const context = await browserPool.getContext(contextId, options);
```

## 💡 Real-World Use Cases

### 1. **E-commerce Price Tracker**
- Use connectors to scrape product prices
- Workers process price changes
- Frontend dashboard shows price history
- Realtime alerts on price drops

### 2. **Social Media Manager**
- Connectors for Twitter, Instagram, LinkedIn
- Workers schedule posts
- Frontend for content calendar
- Realtime analytics

### 3. **SEO Monitoring Tool**
- Connectors for search engines
- Workers track keyword rankings
- Frontend for SEO dashboard
- Alerts on ranking changes

### 4. **Lead Generation Platform**
- Connectors for LinkedIn, company websites
- Workers enrich lead data
- Frontend CRM interface
- Realtime lead scoring

### 5. **Content Aggregator**
- RSS/API connectors
- Workers for content curation
- Frontend reader interface
- Realtime content updates

## 📚 Further Customization

### Add Authentication

```typescript
// api-server/src/middleware/auth.ts
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = user;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' });
  }
}

// Use in routes
router.get('/protected', authenticateJWT, controller.protectedEndpoint);
```

### Add Rate Limiting

```typescript
// api-server/src/middleware/rate-limit.ts
import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later',
});

// Use in app
app.use('/api/', apiLimiter);
```

### Add Caching

```typescript
// api-server/src/services/cache.ts
import Redis from 'ioredis';

export class CacheService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }
}
```

## 🎯 Summary

**This codebase is highly modular and can be used for:**

1. ✅ **Web Scraping Projects** - Use connector pattern
2. ✅ **Background Job Processing** - Use worker architecture
3. ✅ **Real-time Applications** - Use Supabase Realtime integration
4. ✅ **SaaS Platforms** - Use full stack
5. ✅ **APIs** - Use API structure
6. ✅ **Dashboards** - Use frontend with hooks
7. ✅ **Data Pipelines** - Use workers + storage adapter
8. ✅ **Automation Tools** - Use browser pool + workers

**Key Benefits:**
- 🏗️ **Proven architecture** - Production-ready patterns
- 🔒 **Type-safe** - Full TypeScript coverage
- 🚀 **Scalable** - Horizontal and vertical scaling
- 📦 **Containerized** - Docker + Docker Compose
- ☁️ **Deploy anywhere** - Render, Railway, AWS, Vercel
- 🧪 **Testable** - Modular design for easy testing
- 📖 **Well-documented** - Comprehensive guides

**Use it as:**
- Starting point for new projects
- Reference implementation
- Learning resource
- Production boilerplate

Happy building! 🚀
