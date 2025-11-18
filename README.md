# Universal Crawler

A production-ready, modular web scraping platform built with Crawlee, Playwright, Next.js, and Supabase.

## Features

- **Modular Connector Architecture**: Add new platforms without changing core code
- **Browser Automation**: Playwright for JS-heavy sites with stealth capabilities
- **Real-time Monitoring**: Supabase Realtime for live job updates and captcha notifications
- **Human-in-Loop Captcha**: Operator console for solving captchas manually
- **Session Management**: Persistent authentication with cookie bundles and OAuth
- **Proxy Rotation**: Multi-provider support with health tracking
- **S3 Storage**: Artifacts (screenshots, HAR, HTML) stored in S3
- **PostgreSQL Metadata**: Structured data storage with full-text search

## Architecture

```
├── api-server/       # Express REST API
├── workers/          # Crawlee workers with connectors
├── frontend/         # Next.js operator console
├── shared/           # Shared TypeScript types
├── infra/            # Database migrations & Terraform
└── docs/             # Documentation
```

## Tech Stack

- **Backend**: Node.js 24 LTS, Express, TypeScript
- **Workers**: Crawlee 3.15.3, Playwright 1.56.1
- **Frontend**: Next.js 15, React 19, TailwindCSS
- **Database**: PostgreSQL (via Supabase)
- **Realtime**: Supabase Realtime (pub/sub + presence)
- **Storage**: AWS S3 (or compatible)
- **Auth**: Supabase Auth with RLS policies

## Quick Start

### Prerequisites

- Node.js 24 LTS (`.nvmrc` included)
- PostgreSQL database (or Supabase project)
- AWS S3 bucket (or compatible storage)
- Supabase account

### Installation

```bash
# Clone repository
git clone <repo-url>
cd scrapper

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Apply database migrations
# See docs/supabase-setup.md

# Build all workspaces
npm run build
```

### Development

```bash
# Start API server
npm run dev:api

# Start worker (in another terminal)
npm run dev:worker

# Start frontend (in another terminal)
npm run dev:ui
```

Access the operator console at http://localhost:3000

## Documentation

- [Supabase Setup Guide](docs/supabase-setup.md)
- [Credential Inventory](docs/credentials-inventory.md)
- [Realtime Channels](docs/supabase-realtime-channels.md)
- [Project Notes](docs/notes.md)

## Project Structure

### API Server (`api-server/`)

REST API for job management, items, captcha queue, and sessions.

**Endpoints**:
- `POST /api/jobs` - Create crawl job
- `GET /api/jobs/:id` - Get job details
- `POST /api/jobs/:id/stop` - Stop job
- `GET /api/items` - List extracted items
- `GET /api/captcha/queue` - Get captcha queue
- `POST /api/captcha/:id/solve` - Submit solution
- `POST /api/auth/sessions` - Upload credentials

### Workers (`workers/`)

Crawlee-based workers that execute crawl jobs.

**Components**:
- `BrowserPool`: Manage Playwright contexts
- `ProxyManager`: Rotate proxies with health tracking
- `AuthManager`: Load and validate sessions
- `CaptchaManager`: Detect and request solutions
- `StorageAdapter`: Upload to S3 and save metadata

**Connectors**:
- `blog`: Generic blog/article connector (reference implementation)
- Future: Twitter, Instagram, Reddit, YouTube

### Frontend (`frontend/`)

Next.js operator console with real-time updates.

**Pages**:
- `/` - Dashboard
- `/jobs` - Job list and creation
- `/jobs/[id]` - Job details with live stream
- `/captcha` - Captcha queue
- `/items` - Extracted items explorer
- `/sessions` - Authentication sessions

## Database Schema

Core tables:
- `crawl_jobs` - Job configurations and status
- `crawl_items` - Extracted items with metadata
- `captcha_events` - Captcha challenges and solutions
- `operator_sessions` - Operator presence tracking
- `auth_credentials` - Platform credentials (encrypted)
- `proxy_pool` - Proxy inventory and health
- `storage_artifacts` - S3 artifact references
- `audit_log` - Security and access audit trail

## Realtime Channels

- `jobs.<job_id>` - Job-specific updates (status, progress, errors)
- `captcha_queue` - Global captcha notifications
- `operator_presence` - Operator online/offline status
- `alerts.global` - System-wide alerts

## Adding a New Connector

1. Create `workers/src/connectors/<platform>/index.ts`
2. Extend `BaseConnector` class
3. Implement `prepare()`, `crawl()`, `parse()` methods
4. Register in `workers/src/connectors/index.ts`
5. Add tests

Example:
```typescript
export class TwitterConnector extends BaseConnector {
  name = 'twitter';
  requiresAuth = true;

  needsBrowser(url: string): boolean {
    return true; // Twitter requires JS
  }

  async prepare(job: JobContext): Promise<AuthSnapshot> {
    // Load session cookies
  }

  async crawl(job: JobContext, page: Page, url: string): Promise<RawData> {
    // Navigate and extract
  }

  async parse(rawData: RawData): Promise<NormalizedItem[]> {
    // Normalize to schema
  }
}
```

## Environment Variables

See `.env.example` for required variables:
- Database: `DATABASE_URL`
- Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- AWS: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`
- Proxies: `PROXY_RESIDENTIAL_URL`, `PROXY_DATACENTER_URL`

## Testing

```bash
# Lint all workspaces
npm run lint

# Type-check
npm run typecheck

# Run tests
npm run test
```

## Deployment

### Docker

```bash
# Build images
docker build -t universal-crawler-api ./api-server
docker build -t universal-crawler-worker ./workers
docker build -t universal-crawler-ui ./frontend

# Run with docker-compose
docker-compose up -d
```

### Manual

```bash
# Build production bundles
npm run build

# Start services
NODE_ENV=production npm run start --workspace=api-server
NODE_ENV=production npm run start --workspace=workers
NODE_ENV=production npm run start --workspace=frontend
```

## Security

- All secrets stored in vault (AWS Secrets Manager or HashiCorp Vault)
- Row Level Security (RLS) enforced on all tables
- Encrypted credentials in database (AES-256-GCM)
- Audit logging for sensitive operations
- HTTPS/TLS for all external connections

## License

MIT

## Support

- GitHub Issues: [Report bugs](https://github.com/your-repo/issues)
- Documentation: See `docs/` folder
