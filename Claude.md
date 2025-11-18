## Autonomous Delivery Playbook

### Operating Context
- Current date context is **November 2025**; rely on upstream changelogs, Context7, and web sources to avoid deprecated APIs or stale assumptions.
- Treat the `todo` file as the source of truth for work items. Each entry must be executed sequentially unless explicit parallelism is documented.
- Always favor existing boilerplates (Crawlee + Playwright templates, Supabase starters, etc.) and verify integration patterns before inventing new scaffolding.

### Execution Flow (per TODO item)
1. **Plan**
   - Read the todo entry, supporting docs (PRD, connector guides), and relevant schemas.
   - Map required subsystems (connectors, Supabase Realtime, S3, proxy layer, etc.).
2. **Environment & Intelligence**
   - Pull latest knowledge via Context7/web where needed (framework releases, API updates, compliance notes).
   - Confirm required SDK versions are current (Node/TS, Crawlee, Playwright, Supabase JS, etc.).
3. **Implementation**
   - Modify code/config keeping schema/table/column names exactly aligned with database definitions.
   - Reference boilerplate code for connectors, captcha handling, Supabase Realtime channels, and storage adapters.
   - Avoid deprecated APIs; if unavoidable, document migration steps.
4. **Quality Gates**
   - Run lint command(s) defined in the repo (`npm run lint`, `eslint`, etc.) before any build/test.
   - Run build (and tests if available). If lint/build fail, fix issues immediately; do not proceed or push until clean.
5. **Verification**
   - Ensure metadata schemas, enums, and auth scopes stay consistent between code and DB migrations.
   - Double-check naming: casing, pluralization, and semantics must match across SQL, ORM, and API contracts.
6. **Commit & Delivery**
   - Once lint/build/tests pass, commit with descriptive message referencing todo ID.
   - Push to GitHub (respecting branch policies). If automation handles pushes, confirm CI status before closing the todo.

### Error Handling & Autonomy
- If a step blocks (missing key, API failure, etc.), log the issue, attempt remediation (e.g., rotate proxy, refresh Supabase session), and only escalate when automation cannot resolve.
- Prefer deterministic retries (exponential backoff) and capture traces (Playwright, Crawlee logs) for debugging.

### Tooling & Integration Rules
- Supabase Realtime manages pub/sub and presence; ensure channels, auth policies, and schema migrations stay synchronized.
- Crawlee workers must honor connector contracts (prepare/crawl/parse, telemetry, retries).
- Browser automation (Playwright primary, Puppeteer-extra only when stealth is mandatory) must reuse session pools and comply with captcha guidance.
- Captcha workflow: publish events to Supabase Realtime channels with screenshots/HAR refs, block until solved, resume with validated tokens.
- Storage alignment: S3 keys referenced in `storage_refs` must exist; track checksums where feasible.

### Credential & API Key Inventory (values stored elsewhere)
- Supabase project URL, anon key, service-role key.
- PostgreSQL connection string (app + management roles).
- AWS (or compatible) S3 access key/secret + region/bucket names.
- Proxy provider credentials (residential + datacenter pools).
- Optional captcha solver tokens (human loop remains primary).
- OAuth/session secrets per social connector (Twitter/X, Instagram, Reddit, YouTube, etc.).
- GitHub token (if automation needs to push or open PRs).

### Security & Compliance Notes
- Never hardcode secrets; use vault/CI secrets and reference via env vars.
- Enforce RLS/ACL policies matching connector scopes; validate any schema changes against code before deploy.
- Log credential access and sensitive operations for audit; redact PII in logs.

### Key Reminders
- Matching schemas: if DB column is `crawl_items.source_platform`, code/DTOs must use the same identifier and casing.
- No “demo only” artifacts: every change must be production-ready, observable, and backed by tests/traces.
- Document decisions inside TODO updates or commit messages so future automation can reason about state.

