# Render Deployment Guide

Deploy the Universal Crawler to [Render](https://render.com) - a modern platform with generous free tier and predictable pricing.

## Why Render? (vs Railway)

| Feature | Render | Railway |
|---------|--------|---------|
| **Free Tier** | ✅ Yes (750hrs/month) | ❌ No ($5 minimum) |
| **PostgreSQL** | ✅ Free tier available | ⚠️ $5/month minimum |
| **Background Workers** | ✅ Native support | ✅ Supported |
| **Docker Support** | ✅ Native Dockerfile | ✅ Native Dockerfile |
| **Browser Automation** | ✅ Good (longer timeouts) | ✅ Good |
| **Pricing** | 💰 More predictable | 💰 Usage-based |
| **Auto-deploy** | ✅ GitHub integration | ✅ GitHub integration |
| **Custom domains** | ✅ Free HTTPS | ✅ Free HTTPS |

**Verdict: Render is BETTER for this project!**
- Free tier perfect for testing/MVP
- More predictable costs at scale
- Better for long-running workers
- Free PostgreSQL for testing

## Pricing Comparison

### Render (Recommended) 💰

**Free Tier (Testing/MVP):**
- Web Services: Free (512MB RAM, shared CPU, spins down after 15min)
- Background Workers: Free (512MB RAM)
- PostgreSQL: Free (1GB storage, expires after 90 days)
- **Total: $0/month** (perfect for testing!)

**Paid Production:**
- API Server (Starter): $7/month (512MB RAM, always on)
- Workers (Starter x2): $14/month (1GB RAM each, always on)
- Frontend (Static Site): $0/month (free!)
- PostgreSQL (Starter): $7/month (1GB RAM, 10GB storage)
- **Total: $28/month** (vs Railway's $28-50/month)

**Paid Production (Better specs):**
- API Server (Standard): $25/month (2GB RAM, 1 CPU)
- Workers (Standard x2): $50/month (4GB RAM, 2 CPU each)
- Frontend (Static Site): $0/month
- PostgreSQL (Standard): $20/month (4GB RAM, 100GB storage)
- **Total: $95/month** (vs Railway's $100-150/month)

### Railway

**No Free Tier:**
- Hobby: $5/month + usage ($11-15/month for full stack)
- Pro: $20/month + usage ($28-50/month for full stack)

**Render Wins on Cost!** 🎉

## Quick Start

### 1. Create Render Account

1. Go to [render.com](https://render.com)
2. Sign up with GitHub (recommended)
3. Free tier automatically activated

### 2. Deploy PostgreSQL

1. Click "New +" → "PostgreSQL"
2. Name: `universal-crawler-db`
3. Database: `universal_crawler`
4. User: `crawler`
5. Region: `Oregon (US West)` or closest to you
6. Plan: **Free** (for testing) or **Starter** ($7/month)
7. Click "Create Database"
8. **Save the connection string** (Internal Database URL)

### 3. Apply Database Migrations

```bash
# Get the External Database URL from Render dashboard
psql <external-database-url> -f infra/database/migrations/001_initial_schema.sql
psql <external-database-url> -f infra/database/migrations/002_realtime_setup.sql
```

### 4. Deploy API Server

1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure:

**Build Settings:**
- **Name**: `universal-crawler-api`
- **Region**: Same as database
- **Branch**: `main`
- **Root Directory**: ` ` (leave empty)
- **Environment**: `Docker`
- **Dockerfile Path**: `api-server/Dockerfile`

**Plan:**
- Free (for testing) or Starter ($7/month)

**Environment Variables:**
```bash
NODE_ENV=production
PORT=10000
DATABASE_URL=<internal-database-url>  # From step 2
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=your-bucket-name
ENCRYPTION_KEY=<generate with: openssl rand -hex 32>
```

4. Click "Create Web Service"

### 5. Deploy Workers

1. Click "New +" → "Background Worker"
2. Connect your GitHub repository
3. Configure:

**Build Settings:**
- **Name**: `universal-crawler-worker-1`
- **Region**: Same as database
- **Branch**: `main`
- **Root Directory**: ` ` (leave empty)
- **Environment**: `Docker`
- **Dockerfile Path**: `workers/Dockerfile`

**Plan:**
- Free (for testing) or Starter ($7/month)

**Environment Variables:**
```bash
NODE_ENV=production
DATABASE_URL=<internal-database-url>
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=your-bucket-name
ENCRYPTION_KEY=<same as API server>
```

4. Click "Create Background Worker"

**To scale workers:**
- Repeat steps 1-4 for `universal-crawler-worker-2`, `worker-3`, etc.
- Each worker runs independently

### 6. Deploy Frontend

#### Option A: Static Site (Recommended - FREE!)

1. Click "New +" → "Static Site"
2. Connect your GitHub repository
3. Configure:

**Build Settings:**
- **Name**: `universal-crawler-ui`
- **Region**: Same as database
- **Branch**: `main`
- **Root Directory**: `frontend`
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `out`

**Environment Variables:**
```bash
NEXT_PUBLIC_API_URL=https://universal-crawler-api.onrender.com/api
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Note**: Update `next.config.js` to enable static export:
```javascript
output: 'export', // Instead of 'standalone'
```

#### Option B: Web Service (Dynamic - $7/month)

If you need server-side rendering:

1. Click "New +" → "Web Service"
2. Use Dockerfile: `frontend/Dockerfile`
3. Same environment variables as Option A

### 7. Set Up Auto-Deploy

Render automatically deploys on every push to `main` branch!

**To configure:**
1. Go to service settings → "Build & Deploy"
2. Enable "Auto-Deploy" (enabled by default)
3. Optional: Set up deploy hooks for specific branches

## Service URLs

After deployment, your services will be available at:

- API: `https://universal-crawler-api.onrender.com`
- Frontend: `https://universal-crawler-ui.onrender.com`
- Workers: (Background services, no public URL)

## Environment Groups (Pro Tip!)

For easier management, create an Environment Group:

1. Go to Dashboard → "Environment Groups"
2. Create new group: `universal-crawler-shared`
3. Add common variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `AWS_REGION`
   - `S3_BUCKET_NAME`
   - `ENCRYPTION_KEY`
4. Link to all services (API, Workers)

This way, you update variables in one place!

## Scaling Configuration

### Horizontal Scaling (Workers)

**Manual:**
1. Duplicate worker service
2. Name it `universal-crawler-worker-2`
3. Same configuration
4. Done!

**With IaC (Blueprint):**

Create `render.yaml` in project root:

```yaml
services:
  - type: web
    name: universal-crawler-api
    env: docker
    dockerfilePath: ./api-server/Dockerfile
    plan: starter
    region: oregon
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: universal-crawler-db
          property: connectionString

  - type: worker
    name: universal-crawler-worker-1
    env: docker
    dockerfilePath: ./workers/Dockerfile
    plan: starter
    region: oregon
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: universal-crawler-db
          property: connectionString

  - type: worker
    name: universal-crawler-worker-2
    env: docker
    dockerfilePath: ./workers/Dockerfile
    plan: starter
    region: oregon
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: universal-crawler-db
          property: connectionString

databases:
  - name: universal-crawler-db
    databaseName: universal_crawler
    user: crawler
    plan: starter
```

Deploy with: `render deploy`

### Vertical Scaling

1. Go to service settings
2. Change plan: Free → Starter → Standard → Pro
3. Click "Save Changes"
4. Service redeploys automatically

## Monitoring & Logs

### View Logs

**Real-time:**
1. Go to service dashboard
2. Click "Logs" tab
3. Auto-refreshes

**CLI:**
```bash
# Install Render CLI
npm install -g @render/cli

# Login
render login

# View logs
render logs -s universal-crawler-api
render logs -s universal-crawler-worker-1 --tail 100
```

### Metrics

Render provides built-in metrics:
- **CPU Usage**: View in service dashboard
- **Memory Usage**: Track memory consumption
- **Request Count**: API endpoint hits
- **Error Rate**: Failed requests

### Alerts

1. Go to service → "Notifications"
2. Enable:
   - Deploy notifications
   - Error rate alerts
   - Resource usage alerts
3. Connect to email, Slack, or Discord

## Custom Domains

### Add Custom Domain

1. Go to service settings → "Custom Domains"
2. Click "Add Custom Domain"
3. Enter your domain: `api.yourdomain.com`
4. Add DNS records (Render provides instructions):
   ```
   Type: CNAME
   Name: api
   Value: universal-crawler-api.onrender.com
   ```
5. SSL certificate auto-provisioned (free!)

## Troubleshooting

### Build Failures

**Common issues:**

1. **Wrong Dockerfile path**
   - Check "Dockerfile Path" in settings
   - Should be: `api-server/Dockerfile` or `workers/Dockerfile`

2. **Build timeout**
   - Increase timeout in service settings
   - Or optimize Dockerfile (multi-stage build)

3. **Missing dependencies**
   - Ensure `package.json` includes all deps
   - Check `npm install` works locally

**View build logs:**
- Service dashboard → "Events" tab → Click on deploy

### Runtime Errors

**Check logs:**
```bash
render logs -s universal-crawler-api --tail 200
```

**Common issues:**

1. **Database connection failed**
   - Verify `DATABASE_URL` is correct (use Internal URL)
   - Check database is running (green status)

2. **Missing environment variables**
   - Go to service → "Environment" tab
   - Verify all required vars are set

3. **Out of memory**
   - Upgrade to larger plan (Starter → Standard)
   - Or optimize memory usage in code

### Connection Issues

**Test API:**
```bash
curl https://universal-crawler-api.onrender.com/health
```

**Test database:**
```bash
psql <external-database-url> -c "SELECT 1"
```

## Free Tier Limitations

**Web Services:**
- ⏱️ Spins down after 15min of inactivity
- 🐌 Cold start: ~30s to wake up
- 🚫 Not for production (use Starter plan)

**Background Workers:**
- ✅ Always running
- ✅ Perfect for crawlers
- ✅ No spin-down

**PostgreSQL:**
- 🗓️ Expires after 90 days
- 💾 1GB storage limit
- 🚫 No backups
- **Upgrade to Starter** for production

## Production Checklist

Before going live:

- [ ] Upgrade database to Starter plan ($7/month)
- [ ] Upgrade API server to Starter plan ($7/month)
- [ ] Upgrade workers to Starter plan ($7/month each)
- [ ] Set up custom domains
- [ ] Enable notifications (Slack/Discord)
- [ ] Configure auto-scaling (if needed)
- [ ] Test all endpoints
- [ ] Run test crawl job
- [ ] Monitor logs for 24 hours
- [ ] Set up backups (database snapshots)

## CI/CD Integration

### GitHub Actions

Create `.github/workflows/render-deploy.yml`:

```yaml
name: Deploy to Render

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Render
        uses: bounceapp/render-action@v1
        with:
          render-token: ${{ secrets.RENDER_API_KEY }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          service-id: ${{ secrets.RENDER_SERVICE_ID }}
```

### Deploy Hooks

Trigger deploys via webhook:

```bash
# Get deploy hook URL from Render dashboard
curl -X POST https://api.render.com/deploy/srv-xxx?key=yyy
```

## Cost Optimization Tips

### 1. Use Static Site for Frontend
- **Free** vs $7/month for web service
- Same functionality for static content

### 2. Share Database
- One PostgreSQL instance for all services
- Use Internal Database URL (faster, free bandwidth)

### 3. Scale Workers Intelligently
- Start with 1-2 workers
- Add more only when needed
- Monitor job queue length

### 4. Use Free Tier for Development
- Deploy dev branch to free services
- Test before pushing to production

### 5. Optimize Docker Images
- Multi-stage builds (already done!)
- Minimize layers
- Faster builds = less build time charges

## Backup & Disaster Recovery

### Database Backups

**Automatic (Starter plan and above):**
- Daily backups
- 7-day retention
- One-click restore

**Manual:**
```bash
# Export database
pg_dump <external-database-url> > backup.sql

# Restore
psql <external-database-url> < backup.sql
```

### Service Rollback

1. Go to service → "Events" tab
2. Find previous successful deploy
3. Click "Rollback to this deploy"

## Render vs Railway vs AWS

| Feature | Render | Railway | AWS (Terraform) |
|---------|--------|---------|-----------------|
| **Free Tier** | ✅ Yes | ❌ No | ❌ No |
| **Ease of Setup** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| **Cost (MVP)** | $0-28/mo | $11-28/mo | $120-330/mo |
| **Cost (Production)** | $28-95/mo | $28-100/mo | $120-500/mo |
| **Scalability** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Control** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Background Jobs** | ✅ Native | ✅ Supported | ✅ ECS Tasks |
| **Docker Support** | ✅ Native | ✅ Native | ✅ ECS/Fargate |

**Recommendation:**
- **MVP/Testing**: Render (free tier!)
- **Small Production**: Render ($28-95/month)
- **Large Scale**: AWS with Terraform ($120-500/month)

## Next Steps

1. ✅ Sign up for Render
2. ✅ Deploy PostgreSQL (Free tier)
3. ✅ Apply database migrations
4. ✅ Deploy API Server (Free tier)
5. ✅ Deploy Workers (Free tier)
6. ✅ Deploy Frontend (Static site - Free!)
7. ✅ Test API endpoints
8. ✅ Create test crawl job
9. ✅ Monitor for 24 hours
10. ✅ Upgrade to paid plans when ready

## Support

- **Render Docs**: https://render.com/docs
- **Render Community**: https://community.render.com
- **Status Page**: https://status.render.com
- **Support**: Email support@render.com (paid plans get priority)

---

**Total Cost Summary:**

| Plan | Monthly Cost | Use Case |
|------|-------------|----------|
| **Free Tier** | $0 | Testing & MVP |
| **Starter** | $28 | Small production (<1000 jobs/day) |
| **Standard** | $95 | Medium production (1000-10000 jobs/day) |
| **Pro** | $200+ | Large scale (>10000 jobs/day) |

**Render is the winner for cost-effective deployment!** 🏆
