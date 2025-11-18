# Universal Crawler

<div align="center">

**Production-ready social media & web scraping platform with AI-powered video transcription**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-24-green)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[Features](#features) • [Architecture](#architecture) • [Quick Start](#quick-start) • [Documentation](#documentation) • [Deployment](#deployment)

</div>

---

## 🎯 What is Universal Crawler?

Universal Crawler is a **modular, production-ready web scraping platform** designed to extract structured data from social media platforms and websites at scale. Built with enterprise-grade tools (Crawlee, Playwright, Supabase), it handles everything from browser automation to real-time monitoring.

### 🔥 Why Universal Crawler?

**Problem:** Building web scrapers is hard. Each platform needs different approaches, authentication breaks, captchas appear, and scaling is complex.

**Solution:** Universal Crawler provides a **plug-and-play connector architecture** where adding a new platform is as simple as extending a base class. No infrastructure headaches, no scaling issues, just write your scraping logic.

---

## ✨ Features

### 🚀 Core Platform

- **🔌 Modular Connector System**: Add new platforms by extending `BaseConnector` - zero changes to core infrastructure
- **🤖 Smart Browser Automation**: Playwright with stealth plugins to bypass bot detection
- **📊 Real-time Job Monitoring**: Live updates via Supabase Realtime (WebSocket pub/sub)
- **🎭 Human-in-Loop Captchas**: Web console for operators to solve captchas in real-time
- **🔐 Session Management**: Persistent authentication with cookies, OAuth tokens, and API keys
- **🌐 Proxy Rotation**: Multi-provider support with automatic health tracking and failover
- **📦 S3 Storage**: Automatic upload of screenshots, HAR files, and HTML to S3-compatible storage
- **🔍 Full-Text Search**: PostgreSQL with indexed search on extracted content

### 🎥 Video Transcription (NEW!)

- **📝 YouTube Captions**: Instant extraction of auto-generated captions (<1s, free, 95% accurate)
- **🎤 Vosk Speech-to-Text**: Offline transcription for all platforms (TikTok, Instagram, Facebook)
- **🤖 Auto Mode**: Smart fallback - tries YouTube captions first, uses Vosk if unavailable
- **💰 Zero API Costs**: Self-hosted Vosk models (40MB), no OpenAI/AssemblyAI fees
- **🌍 Multi-language**: Support for 20+ languages with different models
- **🔎 Searchable Transcripts**: Full-text indexed in database for instant search

### 🔒 Security & Captcha Solving

- **2Captcha Integration**: Automated captcha solving via 2Captcha API
- **Manual Fallback**: Human-in-loop interface for unsupported captcha types
- **Hybrid Mode**: Try 2Captcha first, fallback to manual if needed
- **Cost Optimization**: ~$7-9/month for 1000 captchas (vs $50+ for pure manual)

### 📱 Platform Support

Currently supported platforms with dedicated connectors:

- ✅ **YouTube** - Videos, channels, playlists, shorts (with auto-caption extraction)
- ✅ **TikTok** - Videos, profiles, hashtags, sounds (with speech-to-text)
- ✅ **Instagram** - Posts, reels, profiles, stories (with video transcription)
- ✅ **Facebook** - Posts, pages, groups, events, marketplace, reels
- ✅ **Twitter/X** - Tweets, profiles, timelines, searches
- ✅ **LinkedIn** - Posts, profiles, companies, jobs
- ✅ **Reddit** - Threads, subreddits, user posts
- ✅ **Blogs/Articles** - Generic connector for any blog or news site

Each connector extracts:
- 📄 Text content (titles, descriptions, comments)
- 🖼️ Media files (images, videos, thumbnails)
- 👤 Author information (handles, usernames, profiles)
- 📊 Engagement metrics (likes, shares, views, comments)
- 🕐 Timestamps (publish dates, last updated)
- 🎥 **Video transcripts** (speech-to-text for videos)

---

## 🏗️ Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Universal Crawler                         │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Frontend   │      │  API Server  │      │   Workers    │
│  (Next.js)   │◄────►│  (Express)   │◄────►│  (Crawlee)   │
│              │      │              │      │              │
│ - Dashboard  │      │ - REST API   │      │ - Connectors │
│ - Job Queue  │      │ - Auth       │      │ - Scrapers   │
│ - Captcha UI │      │ - Validation │      │ - Parsers    │
└──────┬───────┘      └──────┬───────┘      └──────┬───────┘
       │                     │                     │
       │                     │                     │
       └─────────────────────┼─────────────────────┘
                             │
                    ┌────────▼────────┐
                    │    Supabase     │
                    │                 │
                    │ - PostgreSQL    │
                    │ - Realtime      │
                    │ - Auth/RLS      │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
         ┌────▼───┐     ┌────▼───┐    ┌────▼───┐
         │  AWS   │     │ Video  │    │ Proxy  │
         │   S3   │     │Download│    │  Pool  │
         │Storage │     │ +Vosk  │    │        │
         └────────┘     └────────┘    └────────┘
```

### Component Breakdown

#### 1. **Frontend** (`frontend/`) - Next.js 15 + React 19

Real-time operator console for monitoring and control:

- **Dashboard**: Job statistics, system health, recent items
- **Job Management**: Create, monitor, stop jobs with live progress bars
- **Captcha Queue**: Real-time captcha notifications with solve interface
- **Item Explorer**: Search and filter extracted data with full-text search
- **Session Manager**: Upload and manage authentication credentials
- **Presence Tracking**: See which operators are online

**Tech:** Next.js 15, React 19, TailwindCSS 4, Supabase Realtime

#### 2. **API Server** (`api-server/`) - Express + TypeScript

RESTful API for job orchestration and data access:

**Job Management:**
- `POST /api/jobs` - Create new crawl job
- `GET /api/jobs` - List all jobs (with filters)
- `GET /api/jobs/:id` - Get job details and progress
- `POST /api/jobs/:id/stop` - Stop running job
- `DELETE /api/jobs/:id` - Delete job and artifacts

**Item Management:**
- `GET /api/items` - List extracted items (paginated, filterable)
- `GET /api/items/:id` - Get item details with signed S3 URLs
- `POST /api/items/search` - Full-text search on items

**Captcha Management:**
- `GET /api/captcha/queue` - Get pending captchas
- `POST /api/captcha/:id/solve` - Submit captcha solution
- `POST /api/captcha/:id/skip` - Skip unsolvable captcha

**Auth Management:**
- `POST /api/auth/sessions` - Upload platform credentials
- `GET /api/auth/sessions` - List stored sessions
- `DELETE /api/auth/sessions/:id` - Delete session
- `POST /api/auth/sessions/:id/validate` - Test session validity

**Tech:** Express 4, TypeScript 5, Zod validation, JWT auth

#### 3. **Workers** (`workers/`) - Crawlee + Playwright

Background workers that execute crawl jobs:

**Core Services:**
- **BrowserPool**: Manages Playwright browser contexts with stealth mode
- **ProxyManager**: Rotates proxies, tracks health, handles failures
- **AuthManager**: Loads sessions, validates cookies, refreshes tokens
- **CaptchaManager**: Detects challenges, queues for solution
- **StorageAdapter**: Uploads artifacts to S3, saves metadata to DB
- **VideoDownloader**: Downloads videos from 1000+ sites via yt-dlp
- **VideoTranscriber**: Transcribes videos with YouTube captions or Vosk

**Connector Architecture:**

Each platform connector extends `BaseConnector`:

```typescript
export abstract class BaseConnector {
  abstract name: string;              // Platform identifier
  abstract requiresAuth: boolean;     // Needs credentials?

  abstract needsBrowser(url: string): boolean;
  abstract crawl(job, page, url): Promise<RawData>;
  abstract parse(rawData): Promise<NormalizedItem[]>;

  async prepare(job): Promise<AuthSnapshot> {
    // Load and validate session
  }
}
```

**Example Connector Flow:**

```
1. prepare()  → Load auth session from DB
2. crawl()    → Navigate with Playwright, extract HTML
3. parse()    → Transform to normalized schema
4. transcribe() → (Optional) Extract video transcript
5. save()     → Upload to S3, store in PostgreSQL
```

**Tech:** Crawlee 3, Playwright 1.56, Puppeteer 24, Vosk 0.3

#### 4. **Database** (PostgreSQL via Supabase)

**Core Tables:**

- `crawl_jobs` - Job configuration, status, progress
- `crawl_items` - Extracted items with full-text search
- `captcha_events` - Captcha challenges and solutions
- `operator_sessions` - Real-time presence tracking
- `auth_credentials` - Platform credentials (AES-256 encrypted)
- `proxy_pool` - Proxy inventory with health metrics
- `storage_artifacts` - S3 references for screenshots/HAR
- `audit_log` - Security and compliance logging

**Indexing Strategy:**

- GIN index on `transcript_text` for full-text search
- B-tree indexes on common filters (platform, status, date)
- Partial indexes for active jobs and pending captchas

#### 5. **Realtime Channels** (Supabase Realtime)

**Job Channels** (`jobs.<job_id>`):
```json
{
  "event": "progress_update",
  "payload": {
    "urls_completed": 45,
    "urls_total": 100,
    "items_extracted": 312,
    "status": "running"
  }
}
```

**Captcha Queue** (`captcha_queue`):
```json
{
  "event": "captcha_detected",
  "payload": {
    "id": "uuid",
    "type": "recaptcha_v2",
    "url": "https://...",
    "screenshot": "s3://..."
  }
}
```

**Operator Presence** (`operator_presence`):
- Online/offline tracking
- Last activity timestamp
- Auto-cleanup after 30s of inactivity

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 24 LTS** (check `.nvmrc`)
- **PostgreSQL** (or Supabase account)
- **AWS S3** (or compatible storage like MinIO)
- **Redis** (optional, for rate limiting)

### Installation

```bash
# 1. Clone repository
git clone https://github.com/your-org/universal-crawler.git
cd universal-crawler

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# 4. Apply database migrations
psql $DATABASE_URL < infra/database/migrations/001_initial_schema.sql
psql $DATABASE_URL < infra/database/migrations/002_realtime_setup.sql
psql $DATABASE_URL < infra/database/migrations/003_add_transcripts.sql

# 5. Build all workspaces
npm run build
```

### Development Mode

Open 3 terminals:

**Terminal 1 - API Server:**
```bash
npm run dev:api
# Runs on http://localhost:3000
```

**Terminal 2 - Worker:**
```bash
npm run dev:worker
# Polls for jobs from database
```

**Terminal 3 - Frontend:**
```bash
npm run dev:ui
# Runs on http://localhost:3001
```

### Create Your First Job

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "source_platform": "youtube",
    "urls": ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
    "config": {}
  }'
```

Monitor the job in the frontend at http://localhost:3001/jobs

---

## 📚 Documentation

### Core Guides

- **[Architecture Deep Dive](docs/architecture.md)** - System design, data flow, scaling strategies
- **[Developer Guide](docs/development.md)** - Setup, debugging, best practices
- **[API Reference](docs/api-reference.md)** - Complete REST API documentation
- **[Connector Development](docs/connector-development.md)** - How to add new platforms

### Feature Guides

- **[Video Transcription](docs/video-transcription.md)** - Setup Vosk, configure YouTube captions
- **[Captcha Solving](docs/captcha-solving.md)** - 2Captcha integration, manual fallback
- **[Supabase Setup](docs/supabase-setup.md)** - Database, Realtime, RLS policies
- **[Proxy Configuration](docs/proxy-setup.md)** - Residential/datacenter rotation
- **[Session Management](docs/session-management.md)** - Platform authentication

### Deployment Guides

- **[Docker Deployment](docs/docker-deployment.md)** - Docker Compose for local/production
- **[AWS Terraform](docs/aws-deployment.md)** - ECS, RDS, S3 infrastructure as code
- **[Render.com](docs/render-deployment.md)** - FREE tier deployment ($0/month)
- **[Railway.com](docs/railway-deployment.md)** - Alternative PaaS ($5-50/month)

---

## 🧪 Testing

```bash
# Lint all workspaces
npm run lint

# Type-check
npm run typecheck

# Run unit tests
npm test

# Run tests with coverage
npm test -- --coverage
```

**Test Coverage:**
- 35 unit tests across workers and API server
- Mock browser automation with Vitest
- Integration tests for connectors
- End-to-end tests for API endpoints

---

## 🚢 Deployment

### Option 1: Render.com (Recommended - FREE Tier!)

**Cost:** $0/month for testing, $28/month for production

```bash
# See docs/render-deployment.md for step-by-step guide
```

**What you get:**
- ✅ PostgreSQL database (free tier)
- ✅ API server (free tier)
- ✅ Background workers (free tier)
- ✅ Static frontend hosting (free tier)
- ✅ Automatic HTTPS + custom domains
- ✅ Auto-deploy from GitHub

### Option 2: Docker Compose (Local/Production)

```bash
# Start all services
docker-compose up -d

# Scale workers to 3 instances
docker-compose up -d --scale worker=3

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### Option 3: AWS (Enterprise)

```bash
cd infra/terraform
terraform init
terraform apply
# Deploys: ECS Fargate + RDS + S3 + CloudWatch
```

See [AWS Deployment Guide](docs/aws-deployment.md) for detailed instructions.

---

## 🔒 Security

- **Encrypted Credentials**: AES-256-GCM encryption for all platform credentials
- **Row Level Security**: Supabase RLS policies enforce access control
- **Audit Logging**: All sensitive operations logged to `audit_log` table
- **HTTPS/TLS**: All external connections over HTTPS
- **Secret Management**: AWS Secrets Manager or HashiCorp Vault integration
- **Input Validation**: Zod schemas validate all API inputs
- **Rate Limiting**: Express rate-limit middleware on all endpoints

---

## 📊 Performance & Scaling

### Benchmarks

| Operation | Throughput | Latency |
|-----------|-----------|---------|
| Simple page crawl | ~500 pages/hour/worker | 3-7s per page |
| Video transcription (YouTube) | ~3600 videos/hour | <1s per video |
| Video transcription (Vosk) | ~30 videos/hour | 1-2min per video |
| Full-text search | ~10k queries/sec | <50ms |
| Job creation | ~100 jobs/sec | <100ms |

### Scaling Strategies

**Horizontal Scaling:**
- Add more worker instances via `docker-compose scale worker=N`
- Each worker polls for jobs independently
- No coordination required (stateless workers)

**Vertical Scaling:**
- Increase `BROWSER_MAX_CONTEXTS` to run more browsers per worker
- Add more CPU cores for Vosk transcription

**Database Optimization:**
- Read replicas for item search queries
- Connection pooling (PgBouncer)
- Partitioning for `crawl_items` table (by date)

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Areas we need help:**
- 🔌 New platform connectors (Pinterest, Snapchat, etc.)
- 🌍 Multi-language support for transcription
- 📊 Advanced analytics and reporting
- 🧪 More test coverage
- 📚 Documentation improvements

---

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

Built with amazing open-source tools:
- [Crawlee](https://crawlee.dev/) - Web scraping framework
- [Playwright](https://playwright.dev/) - Browser automation
- [Supabase](https://supabase.com/) - PostgreSQL + Realtime
- [Next.js](https://nextjs.org/) - React framework
- [Vosk](https://alphacephei.com/vosk/) - Speech recognition
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - Video downloader

---

## 📧 Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/your-org/universal-crawler/issues)
- **Documentation**: See `docs/` folder
- **Email**: support@your-org.com

---

<div align="center">

**⭐ Star this repo if you find it useful!**

Made with ❤️ by the Universal Crawler team

</div>
