# Universal Headless Crawler System — PRD, Architecture & Implementation (Revised)

> **Goal:** deliver a production-ready, modular, low-cost crawler platform that reliably captures content from social platforms, blogs, and JS-heavy sites — including authenticated content — using proven open-source frameworks and existing boilerplate code. The system must use Supabase Realtime for pub/sub + presence state and S3 (or compatible object storage) for large artifacts. Metadata storage is required and canonical.

---

## 1. Problem statement (concise)
Modern content sources present the following blocking vectors:
- JS-rendered pages and infinite scroll.
- Auth walls (session-based, OAuth, cookies, 2FA).
- Bot detection and fingerprinting.
- Captchas.
- Platform-specific rate limits and API restrictions.

We must build a resilient platform that:
- Uses existing OSS frameworks and boilerplates rather than re-writing core functionality.
- Handles authenticated crawling with session persistence and human-in-loop captcha resolution.
- Scales cheaply by reserving full browser automation for when necessary.
- Provides a required, validated metadata model for every extracted item.
- Integrates Supabase Realtime for real-time UX and S3 for heavy storage.

---

## 2. High-level requirements
### Functional (required)
- Accept crawl jobs (URL lists, platform types, connector selection).
- Execute connector flow: prepare (auth/session), crawl (render/fetch), parse (extract), persist (metadata + artifacts).
- Manage proxies, browser pool, and fingerprint rotation.
- Detect captchas and route to human-in-loop via Supabase Realtime channels.
- Provide REST API and operator UI with real-time updates.
- Produce normalized JSON metadata for every item (schema is required).

### Non-functional (required)
- Modular connector architecture (add new connectors without changing core).
- Testable and Dockerized workers.
- Observability: logs, metrics, alerts.
- Secure credentials, audit trails, role-based access for operators.

---

## 3. Tech stack (what we use and when)
### Primary choices (default)
- **Crawler framework:** Crawlee (Node/TS) — use for scheduler, queues, request retries, and Playwright/Puppeteer integration. Use Crawlee templates as boilerplate. **When:** all jobs by default; especially recommended for multi-site scale.
- **Browser automation:** Playwright (primary) — stable, multi-browser, and good auto-waiting. Use **Puppeteer + puppeteer-extra-stealth** selectively for sites where stealth plugins help. **When:** JS-heavy pages, login flows, infinite-scroll where HTTP fetch fails.
- **Platform-specific OSS tools:** `snscrape`, `instaloader`, `yt-dlp` etc. **When:** native tools satisfy requirements (public data, lower cost). Prefer these before starting a browser job.
- **HTTP clients (non-JS pages):** `httpx` (Python) or `node-fetch`/`got` (Node). **When:** blogs, news, static pages.
- **Realtime & lightweight state:** **Supabase Realtime** (operator presence, job events, captcha queue). **When:** UI live updates, broadcast telemetry, and human-in-loop notifications. Use Supabase Auth policies to scope channel access per operator/job.
- **Blob storage:** S3 or S3-compatible (object store for snapshots, HARs, screenshots, media). **When:** all large artifacts.
- **Metadata DB:** PostgreSQL (canonical). **When:** always — metadata is required for every extracted record.
- **Queue / broker:** Redis (Crawlee can use internal queues; Redis used for horizontal scale). **When:** multi-worker deployments.
- **Proxy provider:** pluggable; integrate residential and datacenter proxies. **When:** domain-specific rules or elevated block rates.

### Frontend
- **Stack:** React + TypeScript (Next.js if SSR required). Use Supabase Realtime client/hooks (via `@supabase/supabase-js`) for presence and broadcast channels. **When:** Operator console and collaborative flows.

### Infra / Ops
- Dockerized workers, Terraform or similar IaC, CI/CD pipelines (GitHub Actions), Prometheus + Grafana or managed equivalents for monitoring.

---

## 4. Boilerplates and reference repos (copy/inspect)
**Crawlee + Playwright**
- Crawlee main: https://github.com/apify/crawlee
- Crawlee Playwright template: https://github.com/apify/crawlee/tree/main/examples/playwright-crawler
- Crawlee Puppeteer template: https://github.com/apify/crawlee/tree/main/examples/puppeteer-crawler

**Puppeteer stealth**
- puppeteer-extra + stealth plugin: https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth

**Undetected drivers (Python, if needed)**
- undetected_chromedriver: https://github.com/ultrafunkamsterdam/undetected-chromedriver

**Platform-specific OSS**
- snscrape (X/Twitter, Reddit etc): https://github.com/JustAnotherArchivist/snscrape
- Instaloader (Instagram): https://github.com/instaloader/instaloader
- yt-dlp (YouTube): https://github.com/yt-dlp/yt-dlp

**Examples and utilities**
- Example Playwright login session saving/restore patterns: (see Crawlee Playwright examples above)
- Puppeteer-extra examples: same repo as stealth plugin

---

## 5. Architecture & component mapping (detailed)

### 5.1 Component list (required)
- **API Gateway / REST API** — job submission, metadata queries, signed artifact links, operator actions.
- **Scheduler / Job Manager (Crawlee)** — enqueues tasks, enforces per-domain rate limits, priorities.
- **Worker pool (Crawlee workers)** — runs connector code; dockerized.
- **Browser Pool Manager (Playwright)** — manages browser instances, session reuse, UA & viewport variance.
- **Auth Manager** — secure storage of credentials (encrypted), cookie snapshots, token refresh flows.
- **Proxy Manager** — rules for proxy selection, health checks, usage stats.
- **Captcha Manager (human-in-loop)** — detect, push to Supabase Realtime captcha channel for operator solve, apply solved tokens back to worker.
- **Extractor Engine** — connector-specific parsers that normalize outputs.
- **Storage Adapter** — writes artifacts to S3, publishes lightweight status to Supabase Realtime (for UI), writes metadata to Postgres.
- **Monitoring & Logging** — Prometheus/Grafana or cloud-managed equivalents.
- **UI (Operator Console)** — React app using Supabase Realtime for broadcasts, presence, and captcha queue.

### 5.2 Data flow sequence (per job)
1. User or API enqueues job with params (connector, URLs, auth mode, depth).
2. Scheduler validates job and enqueues tasks to request queue.
3. Worker picks up task and asks Connector.prepare(): ensures session (Auth Manager) and proxy selection.
4. Worker runs Connector.crawl(): chooses HTTP fetch or Playwright depending on `needs_browser`.
   - If `needs_browser` and captcha appears: worker calls Captcha Manager → publish to Supabase Realtime captcha channel.
   - Operator solves via UI; solution returned via REST API / Supabase Realtime channel.
5. Worker runs Connector.parse() → normalizes metadata and extracts media links.
6. Storage Adapter persists artifacts to S3 and metadata to Postgres.
7. Worker publishes progress events to Supabase Realtime; API reflects updated status.

---

## 6. Required metadata schema (canonical — store in Postgres)
All fields marked `REQUIRED` must be present for each extracted item.

```sql
-- simplified SQL for reference
CREATE TABLE crawl_items (
  id UUID PRIMARY KEY,
  crawl_id UUID NOT NULL,
  source_platform TEXT NOT NULL,
  url TEXT NOT NULL,
  post_id TEXT,
  author_handle TEXT,
  content_type TEXT NOT NULL,
  text_content TEXT,
  extracted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  published_at TIMESTAMP WITH TIME ZONE,
  engagement JSONB,
  media_refs JSONB,
  storage_refs JSONB NOT NULL, -- S3 keys and Supabase Realtime refs
  connector TEXT NOT NULL,
  auth_state JSONB,
  proxy_id TEXT,
  fingerprint_used JSONB,
  status TEXT NOT NULL,
  raw_snapshot_path TEXT,
  UNIQUE (source_platform, post_id) -- where post_id exists
);
```

**Validation rules (enforced on ingest):**
- `source_platform`, `url`, `connector`, `storage_refs`, and `status` are required.
- If `post_id` exists, enforce uniqueness to avoid duplicates.
- `engagement` and `media_refs` should be JSON arrays/objects.

---

## 7. API surface (essential endpoints)
- `POST /jobs` — submit a crawl job (body: connector, urls[], auth_mode, depth, job_meta)
- `GET /jobs/:id` — job status and progress
- `POST /jobs/:id/stop` — stop job
- `GET /items?query` — search metadata
- `GET /items/:id` — get metadata + signed artifact links
- `POST /auth/sessions` — upload cookie bundle or trigger interactive login
- `POST /captcha/:id/solve` — operator posts solved captcha token
- Websocket/Supabase Realtime channels for live events (job progress, captcha queue)

---

## 8. Frontend (Operator Console) — pages & real-time behavior
**Pages (required):**
- Dashboard: job metrics, captcha spike alerts, proxy health
- Jobs list: CRUD on jobs
- Job detail: live log stream, task timeline, failed tasks, retry controls
- Captcha queue: list of captcha challenges with screenshot & input area
- Session manager: cookie bundles and login flows
- Explorer: search metadata and download artifacts

**Realtime:** Use Supabase Realtime channels for live job events, captcha queues, and operator presence. Persist authoritative data via API ↔ Postgres.

---

## 9. Social connector plan (one standardized template)
**Each connector must implement (JS/TS interface):**
```ts
interface Connector {
  name: string;
  requiresAuth: boolean;
  needsBrowser(url: string): boolean;
  prepare(job: JobContext): Promise<AuthSnapshot>;
  crawl(job: JobContext, pageOrResponse): Promise<RawData>;
  parse(rawData: RawData): Promise<NormalizedItem[]>;
}
```

**Connector specifics (short):**
- **Twitter/X:** prefer `snscrape` for public content; use Playwright for logged-in profiles or archive endpoints.
- **Instagram:** prefer `instaloader`; use Playwright for stories, private accounts, or UI-only features.
- **Reddit:** prefer API + OAuth; fallback to Playwright for UI-only cases.
- **YouTube:** prefer `yt-dlp` for metadata & media; Playwright for comments UI-heavy tasks.
- **Blogs/News:** prefer `httpx`/Scrapy + BeautifulSoup; Playwright only for heavy JS.

Each connector must return NormalizedItem objects that conform to the metadata schema.

---

## 10. Captcha and 2FA handling (required design)
- **Detection:** connectors must assert `captchaDetected()` and call Captcha Manager.
- **Human-in-loop:** publish captcha job to Supabase Realtime with screenshot + metadata and block worker until a solution is provided or job times out.
- **Operator UI:** must present a clear workflow for solving and resubmitting tokens.
- **Optional paid solver adapters:** pluggable, but human-in-loop mandatory as fallback.
- **2FA:** treat interactive 2FA as an operator-resolved event — store and reuse session snapshots after manual completion.

---

## 11. Security, Compliance, and Legal

### 11.1 Credential Security
- All credentials (platform usernames, passwords, tokens, proxy credentials) must be stored encrypted at rest using a KMS-managed key.
- Workers must never embed plaintext credentials in images or logs.
- Credential access must be logged with operator identity, timestamp, and purpose.
- Session cookies retrieved during login flows must be stored securely and rotated if compromised.

### 11.2 Authentication Safety and Risks
- Auth Manager must sandbox login flows so credentials are not exposed to logs or screenshots.
- Interactive login flows involving operators must follow a secure temporary token exchange.
- Session replays must validate cookie age and ensure no cross-user contamination.

### 11.3 Compliance Requirements
- Personal information must be redacted or hashed depending on regional compliance policies.
- Raw snapshots (HTML, JS bundles) often contain sensitive fields and must have retention policies.
- All writes to storage (S3 + metadata DB) must be versioned for audit and rollback.
- Adhere to data residency rules if scraping produces regulated data (EU, US-specific).

### 11.4 Legal Controls
- Each connector must include a declarative `legal_profile.json` defining:
  - Whether robots.txt is respected.
  - Whether login-based scraping is legally permitted.
  - Allowed output fields.
- Maintain a domain/URL blacklist.
- Enforce rate limiting to avoid violating platform terms.
- Operators must receive warnings when launching login-based or high-risk crawls.

---

## 12. Observability, Monitoring, and SLOs

### 12.1 Logging
- Structured JSON logs for each worker.
- Correlation IDs for each crawl job and sub-task.
- Error classification: JS errors, network errors, auth errors, captcha events, extraction failures.

### 12.2 Metrics
- Queue lag (seconds).
- Worker throughput (URLs/min).
- Captcha frequency per domain.
- Proxy health metrics.
- Authentication failure rate.

### 12.3 Tracing
- Distributed tracing for end-to-end job flow: API → Scheduler → Worker → Storage.
- Instrument connectors so each page load, API call, or scroll action is traceable.

### 12.4 SLOs
- 95% of small crawls (<10 URLs) should complete within 2 minutes.
- <5% captcha appearance for API-preferred connectors.
- <1% worker crashes per 1,000 tasks.
- Metadata completeness rate: 100% for required fields.

### 12.5 Alerting
- Alert on proxy pool depletion.
- Alert on high captcha spike.
- Alert on session invalidation for authenticated connectors.
- Alert on crawler stall (job stuck for >X minutes).

---

## 13. CI/CD, Infrastructure, and DevOps

### 13.1 Build Pipeline
- Linting and type-checking for Node + TS.
- Unit tests for connectors, extractors, auth flows.
- Integration tests using Playwright in headless mode against mocked sites.
- Docker image build for workers and API server.

### 13.2 Deployment Pipeline
- GitHub Actions or similar.
- Automatic deploy on merge to main (staging cluster).
- Manual approval for production deploys.

### 13.3 Infrastructure as Code
- Terraform modules for:
  - VPC
  - ECS/EKS worker cluster
  - Load balancer
  - Redis
  - Postgres (RDS)
  - S3 buckets
  - KMS for secrets
  - Monitoring stack (Prometheus/Grafana)

### 13.4 Worker Autoscaling
- Scale on queue length.
- Scale on CPU/memory usage.
- Graceful shutdown with job draining.

### 13.5 Backup & Recovery
- Daily metadata DB snapshots.
- Versioned S3 storage for raw artifacts.
- Disaster recovery region replication optional.

---

## 14. Complete File/Folder Structure (Finalized)
```
/universal-crawler
  /api-server
    src/
    controllers/
    routes/
    middleware/
    Dockerfile

  /workers
    /connectors
      /twitter
      /instagram
      /reddit
      /youtube
      /blogs
    /common
      auth-manager.ts
      proxy-manager.ts
      browser-pool.ts
      captcha-manager.ts
      extractor-engine.ts
    crawler.config.ts
    Dockerfile

  /frontend
    /src
      /components
      /pages
      /hooks
      /superviz
    package.json

  /infra
    /terraform

  /storage
    (local dev only)

  /docs
    prd.md
    connector-guides.md
    api-spec.md

  README.md
```

---

## 15. Developer Runbook (End-to-End)

### 15.1 Local Setup
1. Install Node.js, Python (optional), Docker.
2. Clone Crawlee Playwright template.
3. Install deps: `npm install`.
4. Setup environment variables: DB URL, S3 bucket, Supabase project URL, Supabase keys (service + anon), proxy credentials.
5. Run API server (`npm run dev:api`) and workers (`npm run dev:worker`).
6. Start frontend UI (`npm run dev:ui`).

### 15.2 Adding a new connector
- Create a new folder under `/connectors/<platform>`.
- Define `prepare`, `crawl`, `parse` methods.
- Register connector inside `crawler.config.ts`.
- Add extraction tests.
- Add connector-specific UI elements if required.

### 15.3 Debugging crawls
- Use worker console logs.
- Enable Playwright trace viewer.
- Use proxy-debug mode to inspect route blocks.

### 15.4 Production Checklist
- Rotate proxy credentials.
- Validate cookie bundle freshness.
- Check captcha queue handling.
- Ensure scaling thresholds updated.

---

## 16. Example Connector Blueprint (High-Level)
```
connectorName: "twitter"
requiresAuth: true
needsBrowser: (url) => url.includes("/messages")

prepare():
  - load cookie bundle
  - if expired → trigger interactive login
  - verify session by hitting /settings endpoint

crawl():
  - if public → try snscrape first
  - if private/auth-required → use Playwright
  - detect captchas → push to Supabase Realtime
  - infinite scroll until limit

parse():
  - extract tweet id, handle, body, timestamps
  - extract media URLs
  - generate normalized metadata
```