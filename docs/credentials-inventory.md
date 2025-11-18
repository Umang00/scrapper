# Credential Inventory and Secret Management

> **Status**: Template created - needs actual secret values to be configured in secure vault

## Required Credentials

### 1. Supabase
- **Purpose**: Realtime pub/sub, metadata storage, authentication
- **Required Keys**:
  - `SUPABASE_URL`: Project URL
  - `SUPABASE_ANON_KEY`: Public/anon key for client-side
  - `SUPABASE_SERVICE_ROLE_KEY`: Server-side key with elevated permissions
- **Rotation Plan**: Quarterly or upon suspected compromise
- **Access Level**:
  - Anon key: Frontend, limited backend
  - Service role: Backend workers only

### 2. PostgreSQL
- **Purpose**: Canonical metadata database
- **Required Keys**:
  - `DATABASE_URL`: Full connection string
- **Rotation Plan**: Monthly
- **Access Level**: Backend services only

### 3. AWS S3 (or compatible)
- **Purpose**: Storage for artifacts (screenshots, HARs, media)
- **Required Keys**:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_REGION`
  - `S3_BUCKET_NAME`
- **Rotation Plan**: Quarterly
- **Access Level**: Backend workers only
- **Permissions**: Read/Write to specific bucket only

### 4. Proxy Providers
- **Purpose**: IP rotation to avoid blocks
- **Required Keys**:
  - `PROXY_RESIDENTIAL_URL`: Residential proxy pool endpoint with auth
  - `PROXY_DATACENTER_URL`: Datacenter proxy pool endpoint with auth
- **Rotation Plan**: Per provider policy
- **Access Level**: Worker processes only

### 5. Platform OAuth/Session Credentials

#### Twitter/X
- **Purpose**: Authenticated content crawling
- **Required Keys**:
  - `TWITTER_API_KEY`
  - `TWITTER_API_SECRET`
  - Cookie bundles (stored encrypted in DB)
- **Rotation Plan**: Session cookies rotate weekly; API keys quarterly

#### Instagram
- **Purpose**: Authenticated content crawling
- **Required Keys**:
  - `INSTAGRAM_USERNAME`
  - `INSTAGRAM_PASSWORD`
  - Session cookies (stored encrypted)
- **Rotation Plan**: Credentials verified weekly; rotate on failure

#### Reddit
- **Purpose**: OAuth-based API access
- **Required Keys**:
  - `REDDIT_CLIENT_ID`
  - `REDDIT_CLIENT_SECRET`
- **Rotation Plan**: Quarterly

#### YouTube
- **Purpose**: API-based metadata extraction
- **Required Keys**:
  - `YOUTUBE_API_KEY`
- **Rotation Plan**: Quarterly

### 6. Captcha Solver (Optional)
- **Purpose**: Automated captcha solving (human-in-loop is primary)
- **Required Keys**:
  - `CAPTCHA_SOLVER_API_KEY`
- **Rotation Plan**: Per service provider policy
- **Access Level**: Worker captcha manager only

### 7. GitHub
- **Purpose**: Automated commits, PR creation
- **Required Keys**:
  - `GITHUB_TOKEN`
- **Rotation Plan**: Quarterly
- **Access Level**: CI/CD pipeline only
- **Scope**: repo, workflow

### 8. Application Secrets
- **Purpose**: Internal security
- **Required Keys**:
  - `JWT_SECRET`: For API authentication
  - `ENCRYPTION_KEY`: For encrypting stored credentials in DB
- **Rotation Plan**: Annually (coordinate with re-encryption process)
- **Access Level**: API server and credential managers only

## Security Best Practices

### Storage
- **Production**: Use AWS Secrets Manager, HashiCorp Vault, or similar KMS
- **Development**: Use `.env.local` (NEVER commit to git)
- **CI/CD**: GitHub Secrets or equivalent

### Access Logging
- Log all credential access with:
  - Timestamp
  - Service/component requesting access
  - Purpose/operation
  - Result (success/failure)

### Audit Trail
- Quarterly review of credential access logs
- Alert on unusual access patterns
- Document all manual credential retrievals

### Rotation Process
1. Generate new credential
2. Deploy new credential to all services
3. Verify all services using new credential
4. Revoke old credential
5. Document rotation in audit log

### Incident Response
- On suspected compromise:
  1. Immediately rotate affected credential
  2. Review access logs for unauthorized use
  3. Audit all operations performed with compromised credential
  4. Document incident and remediation steps

## Checklist

- [ ] Supabase project created and keys obtained
- [ ] PostgreSQL database provisioned
- [ ] S3 bucket created with appropriate policies
- [ ] Proxy provider accounts set up
- [ ] Platform OAuth apps registered
- [ ] Captcha solver account created (optional)
- [ ] GitHub token generated with correct scopes
- [ ] JWT secret generated (crypto-random)
- [ ] Encryption key generated (crypto-random, 256-bit)
- [ ] Secrets stored in vault/secrets manager
- [ ] `.env.example` updated with all required variables
- [ ] Access logging configured
- [ ] Rotation calendar created
