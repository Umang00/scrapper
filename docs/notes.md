# Project Notes, Assumptions, and Risks

**Last Updated**: November 18, 2025
**Phase**: 0 - Foundations & Research

---

## Tech Stack Decisions (Nov 2025)

### Framework Versions
- **Node.js**: 24 LTS "Krypton" (latest LTS as of Oct 2025)
- **Crawlee**: 3.15.3 (latest, Nov 10, 2025)
- **Playwright**: 1.56.1 (latest, includes AI-powered test agents)
- **Supabase JS**: 2.81.1 (latest, dropped Node 18 support in v2.79.0)
- **Next.js**: 15.1.5 (latest stable)
- **React**: 19.0.0 (latest)

### Rationale
- Using latest stable versions to avoid deprecated APIs
- Node 24 LTS provides long-term support through April 2028
- Crawlee 3.15.3 bumped cheerio to 1.0.0-rc.10 (breaking change from rc.3)
- Playwright 1.56+ includes new "Playwright Agents" for LLM-driven automation
- Supabase Realtime is confirmed as the canonical realtime stack (replacing SuperViz mentioned in early docs)

---

## Architecture Assumptions

### 1. Supabase Realtime as Pub/Sub Layer
**Assumption**: Supabase Realtime can handle:
- Job status broadcasts to multiple operator clients
- Captcha queue notifications with low latency (<2s)
- Presence detection for operator availability
- Event throughput of ~100 events/second during peak

**Risk**: Supabase Realtime rate limits may throttle high-volume jobs
**Mitigation**: Implement event batching and use broadcast channels for non-critical updates

### 2. Human-in-Loop Captcha Resolution
**Assumption**: Operators are available 24/7 to solve captchas within 2 minutes
**Risk**: Captcha delays during off-hours or operator unavailability
**Mitigation**:
- Implement captcha solver API as fallback
- Queue system with timeout and retry logic
- Alert on captcha backlog >10 items

### 3. Session Persistence
**Assumption**: Platform session cookies remain valid for 7-14 days
**Risk**: Session invalidation due to IP changes, device fingerprint drift, or platform policy changes
**Mitigation**:
- Daily session health checks
- Automatic re-auth flow on 401/403 errors
- Operator-assisted interactive login for 2FA

### 4. Proxy Pool Reliability
**Assumption**: Residential proxies maintain >95% success rate for target platforms
**Risk**: Proxy pool depletion, blocks, or captcha rate increases
**Mitigation**:
- Multiple proxy provider integration
- Health checks and automatic rotation
- Fallback to datacenter proxies for low-risk targets

### 5. Connector Modularity
**Assumption**: Each platform can be abstracted to `prepare()`, `crawl()`, `parse()` interface
**Risk**: Some platforms require highly custom flows (e.g., TikTok WebSocket, Clubhouse audio)
**Mitigation**: Connector interface allows platform-specific overrides; document exceptions

---

## Outstanding Questions

### Schema & Data
- [ ] **Metadata retention policy**: How long to store raw snapshots (HTML, HAR files)?
  - *Proposed*: 30 days for debugging; 7 days for S3 Glacier
- [ ] **PII handling**: What fields need redaction/hashing for GDPR/CCPA?
  - *Proposed*: Hash author handles, redact email/phone patterns in text_content
- [ ] **Deduplication strategy**: How to handle re-crawls of same post_id?
  - *Proposed*: UPSERT on (source_platform, post_id); track update_count

### Performance
- [ ] **Worker scaling**: What's the target concurrency per worker pod?
  - *Proposed*: 5 browser contexts per pod (Playwright recommendation)
- [ ] **Queue management**: Redis vs Crawlee internal queue for multi-worker setup?
  - *Proposed*: Start with Crawlee RequestQueue + PostgreSQL; migrate to Redis if >100 workers

### Security
- [ ] **Credential encryption**: Which KMS to use (AWS Secrets Manager vs HashiCorp Vault)?
  - *Proposed*: AWS Secrets Manager for cloud; Vault for on-prem
- [ ] **RLS policies**: Should operators only see their own jobs or all jobs in their team?
  - *Proposed*: Team-level visibility; admin sees all

### Legal & Compliance
- [ ] **Terms of Service compliance**: Which platforms explicitly prohibit scraping?
  - *Action*: Create per-connector `legal_profile.json` with TOS summary
- [ ] **Rate limiting**: What are safe request rates per platform?
  - *Action*: Document in connector guides; start conservative (1 req/5s)

---

## Known Risks & Mitigation

### Technical Risks

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| Platform anti-bot updates break connectors | High | Medium | Modular connector design; monthly updates; stealth plugins |
| Supabase Realtime downtime | Medium | Low | Fallback to polling API; queue events in Redis |
| Browser pool memory leaks | Medium | Medium | Graceful context rotation; k8s pod restarts |
| S3 cost overruns | Medium | High | Lifecycle policies; compression; S3 Glacier |
| Proxy blocks spike | High | High | Multi-provider setup; automatic failover; backoff logic |

### Operational Risks

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| Operator unavailability for captchas | High | Medium | Paid solver fallback; alerts; SLA monitoring |
| Credential rotation breaks workers | Medium | Low | Blue-green deployment; health checks; rollback |
| Job queue stalls | Medium | Low | Deadletter queue; timeout monitoring; auto-retry |

### Compliance Risks

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| GDPR/CCPA violation | High | Low | PII redaction; audit trails; data retention policies |
| Platform TOS violation | Medium | High | Legal review; connector-level controls; operator warnings |
| Rate limit violations | Low | Medium | Conservative defaults; exponential backoff |

---

## Dependencies & Prerequisites

### External Services (Required)
- [ ] Supabase project (free tier acceptable for dev)
- [ ] PostgreSQL database (Supabase-managed or RDS)
- [ ] S3 bucket (or compatible: MinIO, Cloudflare R2)
- [ ] Redis instance (for prod; optional for dev)

### Third-Party Accounts (Optional but Recommended)
- [ ] Proxy provider (BrightData, Smartproxy, or similar)
- [ ] Captcha solver service (2Captcha, Anti-Captcha, or similar)
- [ ] Platform developer accounts (Twitter API, Reddit API, YouTube API)

### Infrastructure (Production)
- [ ] Container orchestration (ECS, EKS, or Docker Compose for dev)
- [ ] Secrets manager (AWS Secrets Manager, Vault)
- [ ] Monitoring stack (Prometheus + Grafana, or Datadog)
- [ ] CI/CD pipeline (GitHub Actions configured)

---

## Development Milestones

### Phase 0 ✓ (Current)
- [x] Framework version research
- [x] Project structure created
- [x] Credential inventory documented
- [x] Assumptions and risks documented

### Phase 1 (Next)
- [ ] SQL schema migrations
- [ ] TypeScript types aligned to schema
- [ ] Supabase channel topology designed

### Phase 2-6
- See `todo.md` for detailed checklist

---

## Open Design Decisions

### 1. Connector Priority
**Question**: Which connectors to implement first?
**Options**:
- A) Twitter (high complexity, high value)
- B) Reddit (medium complexity, good API)
- C) Generic blog (low complexity, broad applicability)

**Recommendation**: Start with Generic Blog (fastest validation), then Reddit (stable API), then Twitter (most complex)

### 2. Frontend Framework Features
**Question**: Should we use App Router (Next.js 13+) or Pages Router?
**Decision**: Use **App Router** (Next.js 15 default) for:
- Better React 19 compatibility
- Server Components for reduced client JS
- Improved data fetching patterns

### 3. Testing Strategy
**Question**: What's the balance between unit, integration, and E2E tests?
**Proposed**:
- 60% unit tests (connectors, extractors, utilities)
- 30% integration tests (API endpoints, worker flows)
- 10% E2E tests (critical UI paths)

---

## References

- [Crawlee Docs](https://crawlee.dev/)
- [Playwright Docs](https://playwright.dev/)
- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- [PRD](../universal_crawler_prd.md)
- [TODO](../todo.md)
- [Claude Playbook](../Claude.md)
