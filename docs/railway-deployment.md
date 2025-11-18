# Railway Deployment Guide

Deploy the Universal Crawler to [Railway](https://railway.app) - a modern platform for deploying applications with zero configuration.

## Why Railway?

- **Simple**: Deploy with one command or GitHub integration
- **Affordable**: $5/month hobby plan, pay-as-you-go pricing
- **Fast**: Automatic builds and deployments
- **Scalable**: Easy horizontal scaling for workers
- **Batteries Included**: PostgreSQL, Redis available as plugins

## Prerequisites

1. [Railway account](https://railway.app) (sign up with GitHub)
2. [Railway CLI](https://docs.railway.app/develop/cli#install) installed
3. Docker images built and pushed to a registry (optional for Railway build)

## Quick Start

### 1. Install Railway CLI

```bash
# macOS/Linux
curl -fsSL https://railway.app/install.sh | sh

# Windows (PowerShell)
iwr https://railway.app/install.ps1 | iex

# Login to Railway
railway login
```

### 2. Create a New Project

```bash
cd /path/to/scrapper
railway init
```

### 3. Add PostgreSQL Database

```bash
railway add --plugin postgresql
```

This provisions a PostgreSQL database and sets `DATABASE_URL` automatically.

### 4. Set Environment Variables

```bash
# Supabase
railway variables set SUPABASE_URL=https://your-project.supabase.co
railway variables set SUPABASE_ANON_KEY=your-anon-key
railway variables set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AWS S3
railway variables set AWS_REGION=us-east-1
railway variables set AWS_ACCESS_KEY_ID=your-access-key
railway variables set AWS_SECRET_ACCESS_KEY=your-secret-key
railway variables set S3_BUCKET_NAME=your-bucket-name

# Encryption
railway variables set ENCRYPTION_KEY=$(openssl rand -hex 32)

# Node environment
railway variables set NODE_ENV=production
```

### 5. Deploy Services

Railway supports multiple services in one project:

#### Deploy API Server

```bash
# Create service for API
railway service create api-server

# Link to API service
railway service link api-server

# Set dockerfile path
railway variables set RAILWAY_DOCKERFILE_PATH=api-server/Dockerfile

# Deploy
railway up
```

#### Deploy Workers

```bash
# Create service for workers
railway service create workers

# Link to workers service
railway service link workers

# Set dockerfile path
railway variables set RAILWAY_DOCKERFILE_PATH=workers/Dockerfile

# Set worker replicas (scale to 2 workers)
railway service scale workers --replicas 2

# Deploy
railway up
```

#### Deploy Frontend

```bash
# Create service for frontend
railway service create frontend

# Link to frontend service
railway service link frontend

# Set dockerfile path
railway variables set RAILWAY_DOCKERFILE_PATH=frontend/Dockerfile

# Set build args
railway variables set NEXT_PUBLIC_API_URL=https://api-server.railway.app/api
railway variables set NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
railway variables set NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Deploy
railway up
```

## GitHub Integration (Recommended)

Railway can automatically deploy from your GitHub repository:

### 1. Connect Repository

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway will detect Dockerfiles automatically

### 2. Configure Services

For each service (api-server, workers, frontend):

1. Click "+ New" → "Service"
2. Select "GitHub Repo"
3. Choose your repository
4. Set **Root Directory** and **Dockerfile Path**:

**API Server:**
- Root Directory: `/`
- Dockerfile Path: `api-server/Dockerfile`

**Workers:**
- Root Directory: `/`
- Dockerfile Path: `workers/Dockerfile`

**Frontend:**
- Root Directory: `/`
- Dockerfile Path: `frontend/Dockerfile`

### 3. Set Environment Variables

In Railway dashboard, go to each service → Variables tab → Add all required variables.

### 4. Deploy

Railway automatically deploys on every push to `main` branch.

## Service Configuration

### API Server

- **Port**: 3000 (automatically detected)
- **Health Check**: `/health` endpoint
- **Resources**: 512MB RAM, 0.5 vCPU (adjustable)
- **Replicas**: 1 (horizontal scaling available)

### Workers

- **Port**: None (background service)
- **Resources**: 2GB RAM, 1 vCPU (recommended for browser automation)
- **Replicas**: 2-5 (scale based on job volume)

### Frontend

- **Port**: 3000 (Next.js)
- **Resources**: 256MB RAM, 0.25 vCPU
- **Replicas**: 1

## Database Setup

### Apply Migrations

After PostgreSQL is provisioned:

```bash
# Get database connection string
railway variables get DATABASE_URL

# Connect and apply migrations
psql $DATABASE_URL -f infra/database/migrations/001_initial_schema.sql
psql $DATABASE_URL -f infra/database/migrations/002_realtime_setup.sql
```

Or use Railway's built-in PostgreSQL client:

```bash
railway connect postgresql
# Then paste migration SQL
```

## Monitoring

### View Logs

```bash
# API server logs
railway logs --service api-server

# Worker logs
railway logs --service workers --follow

# All services
railway logs
```

### Metrics

Railway provides built-in metrics:
- CPU usage
- Memory usage
- Network traffic
- Request count

Access at: `https://railway.app/project/{your-project}/metrics`

## Scaling

### Horizontal Scaling (Workers)

```bash
# Scale workers to 3 replicas
railway service scale workers --replicas 3

# Auto-scaling (Pro plan)
railway service autoscale workers --min 2 --max 10 --target-cpu 70
```

### Vertical Scaling

In Railway dashboard:
1. Go to service settings
2. Adjust **Memory** and **vCPU** limits
3. Click "Update"

## Cost Estimation

### Hobby Plan ($5/month)

Includes:
- $5 usage credit/month
- Shared resources
- 500GB egress
- Sleeps after 6 hours inactivity

**Estimated monthly cost for full stack:**
- API Server (512MB, 24/7): ~$3
- Workers (1GB x2, 24/7): ~$6
- Frontend (256MB, 24/7): ~$2
- PostgreSQL (shared): $0
- **Total**: ~$11/month

### Pro Plan ($20/month)

Includes:
- $20 usage credit/month
- Dedicated resources
- Priority support
- No sleep mode
- Auto-scaling

**Estimated monthly cost:**
- API Server (1GB): ~$5
- Workers (2GB x3): ~$15
- Frontend (512MB): ~$3
- PostgreSQL (dedicated): ~$5
- **Total**: ~$28/month

## Troubleshooting

### Build Failures

```bash
# View build logs
railway logs --build

# Common issues:
# 1. Wrong Dockerfile path - check RAILWAY_DOCKERFILE_PATH
# 2. Missing dependencies - ensure package.json is correct
# 3. Build timeout - increase timeout in service settings
```

### Runtime Errors

```bash
# Check service logs
railway logs --service api-server --tail 100

# Common issues:
# 1. Missing environment variables
# 2. Database connection failed - check DATABASE_URL
# 3. Out of memory - increase memory allocation
```

### Connection Issues

```bash
# Test API endpoint
curl https://your-api.railway.app/health

# Test database connection
railway run psql $DATABASE_URL -c "SELECT 1"
```

## Advanced Configuration

### Custom Domains

1. Go to service settings → Domains
2. Click "Generate Domain" or "Custom Domain"
3. Add CNAME record: `your-domain.com` → `{service}.railway.app`

### Webhooks

Set up deployment webhooks:

```bash
railway webhooks create \
  --service api-server \
  --url https://your-monitoring-service.com/webhook \
  --events deploy.started,deploy.completed
```

### Private Networking

Enable private networking between services:

1. Go to project settings → Networking
2. Enable "Private Networking"
3. Services can communicate via internal URLs: `http://api-server.railway.internal:3000`

## CI/CD Integration

Railway integrates with GitHub Actions for advanced CI/CD:

```.github/workflows/railway-deploy.yml
name: Deploy to Railway

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install Railway CLI
        run: npm install -g @railway/cli

      - name: Deploy to Railway
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
        run: |
          railway link ${{ secrets.RAILWAY_PROJECT_ID }}
          railway up --service api-server
          railway up --service workers
          railway up --service frontend
```

## Next Steps

1. ✅ Deploy all services to Railway
2. ✅ Apply database migrations
3. ✅ Test API endpoints
4. ✅ Upload test credentials for connectors
5. ✅ Create first crawl job
6. ✅ Monitor logs and metrics
7. ✅ Set up custom domain (optional)
8. ✅ Configure auto-scaling (Pro plan)

## Support

- [Railway Documentation](https://docs.railway.app)
- [Railway Discord](https://discord.gg/railway)
- [Railway Status](https://status.railway.app)
