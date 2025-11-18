# Universal Crawler Delivery Plan (Phased)

> **Baseline rule:** Before touching any checkbox below, re-read `../cloud.empty` and follow every instruction (latest tech awareness, lint → build → test gates, schema/name parity).

---

## Phase 0 – Foundations & Research
**Dependencies:** `cloud.empty`, `../universal_crawler_prd.md`, OSS boilerplates
- [ ] Reconfirm Supabase Realtime as the canonical realtime stack (replacing SuperViz) by reviewing vendor EOL notes and Supabase docs.
- [ ] Inventory secrets: Supabase (anon + service), Postgres URLs, S3 creds, proxy creds, OAuth tokens, captcha providers, GitHub token. Store locations + rotation plan.
- [ ] Capture assumptions, risks, and outstanding questions in `docs/notes.md` for downstream phases.
- [ ] Deliverable: `docs/notes.md` updated + credential inventory checklist.

## Phase 1 – Architecture & Schema Alignment
**Depends on:** Phase 0 (context & credentials)
- [ ] Metadata schema sync
  - [ ] Compare PRD schema vs DB migrations for `crawl_items`, `captcha_events`, `job_status`, `operator_sessions` ensuring identical casing/naming/types.
  - [ ] Draft SQL migrations + rollback scripts; note dependencies on Supabase policies.
  - [ ] Update ORM/entities/TypeScript types to match schema (no alias drift).
- [ ] Supabase topology
  - [ ] Design channel naming (`jobs.<crawl_id>`, `captcha_queue`, `operator_presence`, `alerts.global`). Document payload contracts.
  - [ ] Define RLS/ACL policies: operators read job subsets, workers publish via service role only; outline tests to validate.
- [ ] Testing reminder: After drafting schema/types, run lint + type-check (per `cloud.empty`) to ensure types stay aligned.

## Phase 2 – Backend & Workers
**Depends on:** Phase 1 (schema + channel definitions)
- [ ] API Gateway (`/api-server`)
  - [ ] Implement REST handlers: `POST /jobs`, `GET /jobs/:id`, `POST /jobs/:id/stop`, `POST /auth/sessions`, `POST /captcha/:id/solve`.
  - [ ] Marshal Supabase updates from API (e.g., publish job create event, captcha solved event).
  - [ ] Enforce RBAC + audit logging for sensitive endpoints.
- [ ] Scheduler & Worker Pool (`/workers` via Crawlee)
  - [ ] Configure Crawlee request queue, proxy manager, browser pool manager, captcha manager, auth manager.
  - [ ] Implement connector lifecycle scaffolding (prepare/crawl/parse), include retry/backoff logic and telemetry hooks.
  - [ ] Emit Supabase events for progress, errors, captcha detection.
- [ ] Storage Adapter
  - [ ] Persist artifacts to S3 with deterministic key scheme; store references in `storage_refs`.
  - [ ] Write metadata rows, ensuring transactions keep DB + S3 consistent.
- [ ] Quality gate: run `npm run lint` + `npm run build` (and unit tests) for API + workers before moving to Phase 3.

## Phase 3 – Supabase Realtime Integration
**Depends on:** Phase 2 (publishers implemented)
- [ ] Supabase project configuration
  - [ ] Enable realtime for relevant tables; create dedicated broadcast channels.
  - [ ] Script channel provisioning + policy application (Terraform or Supabase CLI).
- [ ] Server-side publishers
  - [ ] Wrap Supabase client usage (service role) for API/worker publishing; add retries + logging.
  - [ ] Ensure events include correlation IDs for tracing (jobId, taskId).
- [ ] Frontend client/service
  - [ ] Create Supabase client factory that injects auth token + handles reconnect.
  - [ ] Build subscription hooks for jobs, captcha_queue, operator_presence, alerts.
- [ ] Security validation
  - [ ] Write tests ensuring unauthorized actors cannot subscribe/publish (e.g., jest + Supabase emulator).
  - [ ] Confirm token rotation flow (workers via CI secrets, operators via UI login).

## Phase 4 – Operator Console (Frontend)
**Depends on:** Phases 2-3 (APIs + realtime)
- [ ] Application shell (React/Next.js)
  - [ ] Implement layout, navigation, auth guard, Supabase provider.
- [ ] Feature pages
  - [ ] Dashboard: metrics (queue lag, captcha spike alerts, proxy health), event stream.
  - [ ] Jobs list/detail: filtered views, live log stream, retry/stop controls.
  - [ ] Captcha queue: screenshot preview, metadata, solution form posting to `/captcha/:id/solve` + event ack.
  - [ ] Session manager: upload cookie bundles, list active sessions, trigger interactive login instructions.
  - [ ] Explorer: metadata search, artifact download links (signed S3 URLs).
- [ ] Realtime UX
  - [ ] Wire Supabase hooks per page; throttle updates to avoid UI floods.
  - [ ] Handle offline/reconnect states gracefully.
- [ ] Frontend testing: lint, type-check, unit tests, and Playwright smoke tests for critical flows.

## Phase 5 – Testing & Quality Gates
**Depends on:** Phases 2-4 (functional system)
- [ ] Linting/type-check
  - [ ] Ensure unified lint command (backend + frontend) documented; enforce via CI.
- [ ] Automated tests
  - [ ] Unit tests for connectors, extractors, Supabase publisher utilities.
  - [ ] Integration tests: API endpoints (using Postman/newman or `curl` scripts), worker end-to-end jobs with mocked sites, Supabase emulator tests.
  - [ ] UI E2E tests with Playwright (job creation, captcha resolution, session upload).
- [ ] Observability
  - [ ] Validate logs emit structured fields, metrics exported (Prometheus), traces captured for job lifecycle.
  - [ ] Add alert definitions (proxy depletion, captcha spike, stalled jobs) and test them via synthetic triggers.

## Phase 6 – DevOps & Delivery
**Depends on:** All prior phases completed & tested
- [ ] CI/CD pipeline
  - [ ] GitHub Actions workflow: checkout → install → lint → build → test → docker build/push → deploy staging → manual approval → prod deploy.
  - [ ] Cache deps, upload artifacts (Playwright traces, coverage).
- [ ] Infrastructure as Code
  - [ ] Terraform modules for API server, workers (ECS/EKS), Redis, Postgres (RDS), S3, Supabase config, monitoring stack (Prometheus/Grafana).
  - [ ] Secrets management (AWS Secrets Manager or Vault) referencing inventory from Phase 0.
- [ ] Release management
  - [ ] Final checklist: ensure Supabase channels/policies live, proxies rotated, docs/runbooks updated, backups verified.
  - [ ] Tag release + push changelog; monitor post-deploy alerts.

---

### Dependency Summary
- Phase 1 requires validated context + credentials from Phase 0.
- Phase 2 consumes schemas + channel plans from Phase 1 before coding APIs/workers.
- Phase 3 sits atop backend publishers (Phase 2) to wire realtime messaging.
- Phase 4 depends on working APIs + realtime subscriptions (Phases 2-3) for UI.
- Phase 5 validates the integrated system from backend through UI (Phases 2-4).
- Phase 6 packages everything, relying on prior code/tests plus infra readiness.

